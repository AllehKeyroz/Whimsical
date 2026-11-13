#!/usr/bin/env node
/**
 * KDS FLUX MCP server.
 *
 * Run locally (stdio):
 *   KDSFLUX_SUPABASE_URL=... KDSFLUX_SUPABASE_SERVICE_ROLE_KEY=... \
 *   KDSFLUX_TOKEN=kdsflux_... node server/mcp.mjs
 *
 * Run as an HTTP service (Streamable HTTP):
 *   MCP_TRANSPORT=http MCP_PORT=8788 ... node server/mcp.mjs
 *
 * The API token is created in KDS FLUX → avatar menu → Integrações / API.
 * Only this server holds the Supabase service role key; clients only send their
 * KDS FLUX API token.
 */
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import { z } from "zod";

const URL_ENV = process.env.KDSFLUX_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const KEY_ENV = process.env.KDSFLUX_SUPABASE_SERVICE_ROLE_KEY || "";
const TRANSPORT = (process.env.MCP_TRANSPORT || "stdio").toLowerCase();
const PORT = Number(process.env.MCP_PORT || 8788);

if (!URL_ENV || !KEY_ENV) {
  console.error(
    "KDS FLUX MCP: set KDSFLUX_SUPABASE_URL and KDSFLUX_SUPABASE_SERVICE_ROLE_KEY (service role, server-side only).",
  );
  process.exit(1);
}

const supabase = createClient(URL_ENV.replace(/\/+$/, ""), KEY_ENV, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const nowIso = () => new Date().toISOString();

function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function fail(message) {
  return { isError: true, content: [{ type: "text", text: message }] };
}

async function resolveToken(raw) {
  if (!raw) throw new Error("Missing API token.");
  const token = raw.trim();
  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, owner_id, revoked_at")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (error) throw new Error(`Token lookup failed: ${error.message}`);
  if (!data || data.revoked_at) throw new Error("Invalid or revoked API token.");
  void supabase.from("api_tokens").update({ last_used_at: nowIso() }).eq("id", data.id);
  return data.owner_id;
}

async function getBoardRow(boardId, ownerId) {
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("id", boardId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Board ${boardId} not found for this token.`);
  return data;
}

async function loadBoard(boardId, ownerId) {
  const row = await getBoardRow(boardId, ownerId);
  const document = row.document && typeof row.document === "object" ? row.document : {};
  return {
    ...document,
    id: row.id,
    title: document.title ?? row.title ?? "Board sem título",
    objects: document.objects && typeof document.objects === "object" ? document.objects : {},
    version: 2,
    createdAt: document.createdAt ?? Date.parse(row.created_at) ?? Date.now(),
    updatedAt: document.updatedAt ?? Date.parse(row.updated_at) ?? Date.now(),
    folderId: row.folder_id ?? document.folderId ?? null,
  };
}

async function saveBoard(board, ownerId) {
  board.updatedAt = Date.now();
  board.version = 2;
  const { error } = await supabase
    .from("boards")
    .update({
      title: String(board.title || "Board sem título").slice(0, 200),
      folder_id: board.folderId ?? null,
      document: board,
      updated_at: new Date(board.updatedAt).toISOString(),
    })
    .eq("id", board.id)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
  return board;
}

function nextOrder(board) {
  return Math.max(0, ...Object.values(board.objects).map((o) => Number(o.order) || 0)) + 1;
}

function nodeLabel(object) {
  if (!object) return "";
  if (typeof object.text === "string") return object.text;
  if (object.objectType === "connector") return object.label || "";
  if (object.objectType === "image") return object.alt || "";
  if (object.objectType === "icon") return object.icon || "";
  return "";
}

function summary(object) {
  if (!object) return null;
  return {
    id: object.id,
    type: object.objectType,
    shapeType: object.shapeType,
    text: nodeLabel(object),
    rect: object.rect,
    parentId: object.parentId ?? null,
    hidden: !!object.hidden,
    locked: !!object.locked,
    style: object.style,
    fromId: object.fromId,
    toId: object.toId,
    label: object.label,
    connectorType: object.connectorType,
    mind: !!object.mind,
  };
}

function defaultTextStyle(size = 16) {
  return { fontSize: size, fontWeight: 400, italic: false, underline: false, align: "center" };
}

function makeConnector(board, fromId, toId, opts = {}) {
  const from = board.objects[fromId];
  const to = board.objects[toId];
  if (!from || !to || !from.rect || !to.rect) throw new Error("Both nodes must have a rect.");
  const fc = { x: from.rect.x + from.rect.w / 2, y: from.rect.y + from.rect.h / 2 };
  const tc = { x: to.rect.x + to.rect.w / 2, y: to.rect.y + to.rect.h / 2 };
  const horizontal = Math.abs(tc.x - fc.x) >= Math.abs(tc.y - fc.y) * 0.8;
  const right = tc.x >= fc.x;
  const down = tc.y >= fc.y;
  const fromRel = horizontal
    ? { rx: right ? 1 : 0, ry: 0.5, axis: "x" }
    : { rx: 0.5, ry: down ? 1 : 0, axis: "y" };
  const toRel = horizontal
    ? { rx: right ? 0 : 1, ry: 0.5, axis: "x" }
    : { rx: 0.5, ry: down ? 0 : 1, axis: "y" };
  const connector = {
    id: nanoid(),
    objectType: "connector",
    parentId: null,
    groupId: null,
    fromId,
    toId,
    connectorType: opts.connectorType || (opts.mind ? "curved" : "elbow"),
    fromRel,
    toRel,
    fromEndpoint: opts.fromEndpoint ?? "none",
    toEndpoint: opts.toEndpoint ?? (opts.mind ? "none" : "arrow"),
    fromCardinality: null,
    toCardinality: null,
    style: {
      color: opts.color || "gray",
      deco: opts.thick ? "fill" : opts.dashed ? "dash" : "outline",
    },
    label: String(opts.label || ""),
    order: nextOrder(board),
    mind: !!opts.mind,
  };
  board.objects[connector.id] = connector;
  return connector;
}

function buildMcpServer(ownerId) {
  const server = new McpServer({ name: "kds-flux", version: "1.0.0" });

  const tool = (name, config, handler) =>
    server.registerTool(name, config, async (args) => {
      try {
        return ok(await handler(args));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    });

  tool("list_boards", { description: "List boards available to this API token.", inputSchema: {} }, async () => {
    const { data, error } = await supabase
      .from("boards")
      .select("id,title,folder_id,created_at,updated_at")
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { boards: data ?? [] };
  });

  tool(
    "get_board",
    {
      description: "Read a board. Returns nodes and connectors with their ids, text and geometry.",
      inputSchema: {
        board_id: z.string(),
        include_objects: z.boolean().optional().describe("Default true."),
      },
    },
    async ({ board_id, include_objects }) => {
      const board = await loadBoard(board_id, ownerId);
      const objects = Object.values(board.objects);
      const nodes = objects
        .filter((o) => o.objectType !== "connector")
        .map(summary)
        .filter(Boolean);
      const connectors = objects.filter((o) => o.objectType === "connector").map(summary).filter(Boolean);
      return {
        board: {
          id: board.id,
          title: board.title,
          folderId: board.folderId ?? null,
          mindMap: !!board.mindMap,
          updatedAt: board.updatedAt,
        },
        node_count: nodes.length,
        connector_count: connectors.length,
        ...(include_objects === false ? {} : { nodes, connectors }),
      };
    },
  );

  tool(
    "get_node",
    {
      description: "Read a single node/connector by id.",
      inputSchema: { board_id: z.string(), node_id: z.string() },
    },
    async ({ board_id, node_id }) => {
      const board = await loadBoard(board_id, ownerId);
      const object = board.objects[node_id];
      if (!object) throw new Error(`Node ${node_id} not found.`);
      return { board_id, node: object };
    },
  );

  tool(
    "find_nodes",
    {
      description: "Search nodes by text (case-insensitive).",
      inputSchema: { board_id: z.string(), query: z.string(), limit: z.number().int().min(1).max(200).optional() },
    },
    async ({ board_id, query, limit }) => {
      const board = await loadBoard(board_id, ownerId);
      const q = query.trim().toLowerCase();
      const nodes = Object.values(board.objects)
        .filter((o) => o.objectType !== "connector")
        .filter((o) => !q || nodeLabel(o).toLowerCase().includes(q))
        .slice(0, limit ?? 50)
        .map(summary);
      return { board_id, nodes };
    },
  );

  tool(
    "update_node_text",
    {
      description: "Change only the text of a specific node without rewriting the board.",
      inputSchema: { board_id: z.string(), node_id: z.string(), text: z.string() },
    },
    async ({ board_id, node_id, text }) => {
      const board = await loadBoard(board_id, ownerId);
      const object = board.objects[node_id];
      if (!object) throw new Error(`Node ${node_id} not found.`);
      if (!("text" in object) && object.objectType !== "connector") {
        throw new Error("This node type does not support text.");
      }
      if (object.objectType === "connector") object.label = text;
      else object.text = text;
      await saveBoard(board, ownerId);
      return { board_id, node: summary(object) };
    },
  );

  tool(
    "update_node",
    {
      description:
        "Patch a node: text, rect (x/y/w/h), rotation, hidden, locked, link, or style (color/deco/hex). Only provided fields change.",
      inputSchema: {
        board_id: z.string(),
        node_id: z.string(),
        text: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        rotation: z.number().optional(),
        hidden: z.boolean().optional(),
        locked: z.boolean().optional(),
        link: z.string().optional(),
        color: z.string().optional(),
        deco: z.string().optional(),
        hex: z.string().optional(),
      },
    },
    async (args) => {
      const board = await loadBoard(args.board_id, ownerId);
      const object = board.objects[args.node_id];
      if (!object) throw new Error(`Node ${args.node_id} not found.`);
      if (args.text !== undefined) {
        if (object.objectType === "connector") object.label = args.text;
        else if ("text" in object) object.text = args.text;
      }
      if (object.rect && (args.x !== undefined || args.y !== undefined || args.width !== undefined || args.height !== undefined)) {
        object.rect = {
          x: args.x ?? object.rect.x,
          y: args.y ?? object.rect.y,
          w: args.width ?? object.rect.w,
          h: args.height ?? object.rect.h,
        };
      }
      if (args.rotation !== undefined) object.rotation = args.rotation;
      if (args.hidden !== undefined) object.hidden = args.hidden;
      if (args.locked !== undefined) object.locked = args.locked;
      if (args.link !== undefined) object.link = args.link;
      if (object.style && (args.color !== undefined || args.deco !== undefined || args.hex !== undefined)) {
        object.style = {
          ...object.style,
          ...(args.color !== undefined ? { color: args.color } : {}),
          ...(args.deco !== undefined ? { deco: args.deco } : {}),
          ...(args.hex !== undefined ? { hex: args.hex } : {}),
        };
      }
      await saveBoard(board, ownerId);
      return { board_id: args.board_id, node: summary(object) };
    },
  );

  tool(
    "move_node",
    {
      description: "Move a node to an absolute position or by a delta.",
      inputSchema: {
        board_id: z.string(),
        node_id: z.string(),
        x: z.number().optional(),
        y: z.number().optional(),
        dx: z.number().optional(),
        dy: z.number().optional(),
      },
    },
    async ({ board_id, node_id, x, y, dx, dy }) => {
      const board = await loadBoard(board_id, ownerId);
      const object = board.objects[node_id];
      if (!object?.rect) throw new Error(`Node ${node_id} has no rect.`);
      object.rect = {
        ...object.rect,
        x: x ?? object.rect.x + (dx ?? 0),
        y: y ?? object.rect.y + (dy ?? 0),
      };
      await saveBoard(board, ownerId);
      return { board_id, node: summary(object) };
    },
  );

  tool(
    "resize_node",
    {
      description: "Resize a node.",
      inputSchema: {
        board_id: z.string(),
        node_id: z.string(),
        width: z.number().positive(),
        height: z.number().positive(),
      },
    },
    async ({ board_id, node_id, width, height }) => {
      const board = await loadBoard(board_id, ownerId);
      const object = board.objects[node_id];
      if (!object?.rect) throw new Error(`Node ${node_id} has no rect.`);
      object.rect = { ...object.rect, w: width, h: height };
      await saveBoard(board, ownerId);
      return { board_id, node: summary(object) };
    },
  );

  tool(
    "add_node",
    {
      description:
        "Create a shape/text/sticky/mind node. Optionally connect it from an existing node. Returns the new node id.",
      inputSchema: {
        board_id: z.string(),
        kind: z.enum(["shape", "text", "sticky", "mind"]).optional(),
        shape_type: z
          .enum(["rect", "pill", "ellipse", "diamond", "triangle", "hexagon", "cylinder", "parallelogram", "document", "sticky"])
          .optional(),
        text: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        connect_from: z.string().optional(),
        color: z.string().optional(),
        mind: z.boolean().optional(),
      },
    },
    async (args) => {
      const board = await loadBoard(args.board_id, ownerId);
      const kind = args.kind ?? "shape";
      const now = Date.now();
      const id = nanoid();
      const x = args.x ?? 0;
      const y = args.y ?? 0;
      if (kind === "text" || kind === "mind" || args.mind) {
        board.mindMap = true;
        const color = args.color || "purple";
        board.objects[id] = {
          id,
          objectType: "text",
          parentId: null,
          groupId: null,
          rect: { x, y, w: args.width ?? 180, h: args.height ?? 32 },
          style: { color, deco: "transparent" },
          text: args.text ?? "",
          textStyle: { ...defaultTextStyle(15), align: "center" },
          rotation: 0,
          order: nextOrder(board),
          mindNode: true,
          mindRoot: false,
        };
      } else {
        const shapeType = kind === "sticky" ? "sticky" : args.shape_type || "rect";
        const color = args.color || (shapeType === "sticky" ? "yellow" : "blue");
        board.objects[id] = {
          id,
          objectType: "shape",
          parentId: null,
          groupId: null,
          shapeType,
          rect: { x, y, w: args.width ?? 192, h: args.height ?? 96 },
          style: { color, deco: shapeType === "sticky" ? "fill" : "outline" },
          text: args.text ?? "",
          textStyle: defaultTextStyle(18),
          rotation: 0,
          order: nextOrder(board),
        };
      }
      let connectorId = null;
      if (args.connect_from) {
        const connector = makeConnector(board, args.connect_from, id, {
          mind: kind === "mind" || !!args.mind,
          color: board.objects[id].style?.color || "gray",
        });
        connectorId = connector.id;
      }
      await saveBoard(board, ownerId);
      return { board_id: args.board_id, node_id: id, connector_id: connectorId, node: summary(board.objects[id]) };
    },
  );

  tool(
    "add_connector",
    {
      description: "Connect two existing nodes.",
      inputSchema: {
        board_id: z.string(),
        from_node_id: z.string(),
        to_node_id: z.string(),
        label: z.string().optional(),
        connector_type: z.enum(["elbow", "straight", "curved"]).optional(),
        color: z.string().optional(),
        dashed: z.boolean().optional(),
        thick: z.boolean().optional(),
        from_endpoint: z.enum(["none", "arrow", "circle", "diamond", "fork"]).optional(),
        to_endpoint: z.enum(["none", "arrow", "circle", "diamond", "fork"]).optional(),
        mind: z.boolean().optional(),
      },
    },
    async (args) => {
      const board = await loadBoard(args.board_id, ownerId);
      const connector = makeConnector(board, args.from_node_id, args.to_node_id, {
        label: args.label,
        connectorType: args.connector_type,
        color: args.color,
        dashed: args.dashed,
        thick: args.thick,
        fromEndpoint: args.from_endpoint,
        toEndpoint: args.to_endpoint,
        mind: args.mind,
      });
      if (args.mind) board.mindMap = true;
      await saveBoard(board, ownerId);
      return { board_id: args.board_id, connector: summary(connector) };
    },
  );

  tool(
    "delete_node",
    {
      description: "Delete a node and its connectors. Set recursive=true to remove mind-map descendants.",
      inputSchema: {
        board_id: z.string(),
        node_id: z.string(),
        recursive: z.boolean().optional(),
      },
    },
    async ({ board_id, node_id, recursive }) => {
      const board = await loadBoard(board_id, ownerId);
      if (!board.objects[node_id]) throw new Error(`Node ${node_id} not found.`);
      const remove = new Set([node_id]);
      if (recursive) {
        let changed = true;
        while (changed) {
          changed = false;
          for (const o of Object.values(board.objects)) {
            if (o.objectType !== "connector" || !remove.has(o.fromId)) continue;
            if (!remove.has(o.toId)) {
              remove.add(o.toId);
              changed = true;
            }
          }
        }
      }
      for (const o of Object.values(board.objects)) {
        if (o.objectType !== "connector") continue;
        if (remove.has(o.fromId) || remove.has(o.toId)) remove.add(o.id);
      }
      for (const id of remove) delete board.objects[id];
      await saveBoard(board, ownerId);
      return { board_id, deleted: [...remove] };
    },
  );

  tool(
    "patch_nodes",
    {
      description:
        "Apply several node patches in one operation (text/move/resize/style). Good for streaming edits without rewriting the whole board.",
      inputSchema: {
        board_id: z.string(),
        patches: z
          .array(
            z.object({
              node_id: z.string(),
              text: z.string().optional(),
              x: z.number().optional(),
              y: z.number().optional(),
              dx: z.number().optional(),
              dy: z.number().optional(),
              width: z.number().optional(),
              height: z.number().optional(),
              color: z.string().optional(),
              deco: z.string().optional(),
            }),
          )
          .min(1),
      },
    },
    async ({ board_id, patches }) => {
      const board = await loadBoard(board_id, ownerId);
      const updated = [];
      for (const patch of patches) {
        const object = board.objects[patch.node_id];
        if (!object) throw new Error(`Node ${patch.node_id} not found.`);
        if (patch.text !== undefined) {
          if (object.objectType === "connector") object.label = patch.text;
          else if ("text" in object) object.text = patch.text;
        }
        if (object.rect) {
          object.rect = {
            x: patch.x ?? object.rect.x + (patch.dx ?? 0),
            y: patch.y ?? object.rect.y + (patch.dy ?? 0),
            w: patch.width ?? object.rect.w,
            h: patch.height ?? object.rect.h,
          };
        }
        if (object.style && (patch.color || patch.deco)) {
          object.style = {
            ...object.style,
            ...(patch.color ? { color: patch.color } : {}),
            ...(patch.deco ? { deco: patch.deco } : {}),
          };
        }
        updated.push(summary(object));
      }
      await saveBoard(board, ownerId);
      return { board_id, updated };
    },
  );

  tool(
    "create_board",
    {
      description: "Create a new board for this token owner.",
      inputSchema: {
        title: z.string(),
        folder_id: z.string().optional(),
        mind_map: z.boolean().optional(),
      },
    },
    async ({ title, folder_id, mind_map }) => {
      const id = nanoid();
      const now = Date.now();
      const objects = {};
      if (mind_map) {
        const rootId = nanoid();
        objects[rootId] = {
          id: rootId,
          objectType: "text",
          parentId: null,
          groupId: null,
          rect: { x: -85, y: -20, w: 170, h: 40 },
          style: { color: "white", deco: "fill", hex: "#ffffff" },
          text: "Mapa Mental",
          textStyle: { ...defaultTextStyle(20), fontWeight: 600, color: "#293845" },
          rotation: 0,
          order: 1,
          mindNode: true,
          mindRoot: true,
        };
      }
      const document = {
        id,
        title,
        fontFamily: "Dinsical",
        objects,
        version: 2,
        createdAt: now,
        updatedAt: now,
        folderId: folder_id ?? null,
        mindMap: !!mind_map,
      };
      const { error } = await supabase.from("boards").insert({
        id,
        owner_id: ownerId,
        title,
        folder_id: folder_id ?? null,
        document,
      });
      if (error) throw new Error(error.message);
      return { board_id: id, title, mind_map: !!mind_map };
    },
  );

  tool(
    "set_board_title",
    {
      description: "Rename a board.",
      inputSchema: { board_id: z.string(), title: z.string() },
    },
    async ({ board_id, title }) => {
      const board = await loadBoard(board_id, ownerId);
      board.title = title.slice(0, 200);
      await saveBoard(board, ownerId);
      return { board_id, title: board.title };
    },
  );

  tool(
    "delete_board",
    {
      description: "Delete a board permanently. Use with care.",
      inputSchema: { board_id: z.string() },
    },
    async ({ board_id }) => {
      const { error } = await supabase.from("boards").delete().eq("id", board_id).eq("owner_id", ownerId);
      if (error) throw new Error(error.message);
      return { board_id, deleted: true };
    },
  );

  tool("list_folders", { description: "List folders of this token owner.", inputSchema: {} }, async () => {
    const { data, error } = await supabase
      .from("folders")
      .select("id,name,created_at")
      .eq("owner_id", ownerId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return { folders: data ?? [] };
  });

  tool(
    "create_folder",
    {
      description: "Create a folder.",
      inputSchema: { name: z.string() },
    },
    async ({ name }) => {
      const id = nanoid();
      const { error } = await supabase
        .from("folders")
        .insert({ id, owner_id: ownerId, name: name.slice(0, 60), created_at: nowIso() });
      if (error) throw new Error(error.message);
      return { folder_id: id, name };
    },
  );

  return server;
}

async function runStdio() {
  const ownerId = await resolveToken(process.env.KDSFLUX_TOKEN || "");
  const server = buildMcpServer(ownerId);
  await server.connect(new StdioServerTransport());
  console.error("KDS FLUX MCP ready (stdio).");
}

function bearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
  });
}

async function runHttp() {
  const httpServer = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, mcp-session-id");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, service: "kds-flux-mcp" }));
      return;
    }
    if (!req.url || !req.url.startsWith("/mcp")) {
      res.writeHead(404).end("Not found");
      return;
    }

    let ownerId;
    try {
      ownerId = await resolveToken(bearer(req));
    } catch (error) {
      res.writeHead(401, { "content-type": "application/json" }).end(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unauthorized" }),
      );
      return;
    }

    const server = buildMcpServer(ownerId);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close().catch(() => undefined);
      void server.close().catch(() => undefined);
    });

    try {
      const body = req.method === "POST" ? await readBody(req) : undefined;
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" }).end(
          JSON.stringify({ error: error instanceof Error ? error.message : "MCP failure" }),
        );
      }
    }
  });

  httpServer.listen(PORT, () => {
    console.error(`KDS FLUX MCP listening on http://0.0.0.0:${PORT}/mcp`);
  });
}

if (TRANSPORT === "http") {
  await runHttp();
} else {
  await runStdio();
}
