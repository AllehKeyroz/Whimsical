import { useEffect, useState } from "react";
import { useStore } from "../store";
import { cloudCreateApiToken, cloudListApiTokens, cloudRevokeApiToken, type ApiTokenRow } from "../lib/supabase";
import { generateApiToken, hashApiToken, tokenPrefix } from "../lib/apiTokens";
import { Modal } from "./Modals";
import { Icon } from "./icons";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function IntegrationsPanel() {
  const open = useStore((s) => s.integrationsOpen);
  const setOpen = useStore((s) => s.setIntegrationsOpen);
  const cloud = useStore((s) => s.cloud);
  const showToast = useStore((s) => s.showToast);

  const [tokens, setTokens] = useState<ApiTokenRow[]>([]);
  const [name, setName] = useState("MCP");
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = async (userId: string) => {
    const result = await cloudListApiTokens(userId);
    if (result.error) setError(result.error);
    else setTokens(result.rows);
  };

  useEffect(() => {
    if (!open || !cloud.user) return;
    setLoaded(false);
    setError(null);
    setCreated(null);
    void refresh(cloud.user.id).finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cloud.user?.id]);

  const create = async () => {
    if (!cloud.user) return;
    setBusy(true);
    setError(null);
    try {
      const raw = generateApiToken();
      const hash = await hashApiToken(raw);
      const err = await cloudCreateApiToken(cloud.user.id, name, hash, tokenPrefix(raw));
      if (err) {
        setError(err);
        return;
      }
      setCreated(raw);
      await refresh(cloud.user.id);
      showToast("Token criado. Copie agora: ele não será exibido novamente.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revogar este token? Agentes que o usam perdem o acesso imediatamente.")) return;
    const err = await cloudRevokeApiToken(id);
    if (err) setError(err);
    else if (cloud.user) await refresh(cloud.user.id);
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast("Copiado.");
    } catch {
      showToast("Não foi possível copiar.");
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin.replace(/\/+$/, "") : "";
  const configuredUrl = (import.meta.env.VITE_MCP_URL || "").trim().replace(/\/+$/, "");
  const mcpUrl = configuredUrl || `${origin}/mcp`;
  const mcpConfig = `{
  "mcpServers": {
    "kds-flux": {
      "type": "http",
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer ${created ?? "SEU_TOKEN"}" }
    }
  }
}`;

  return (
    <Modal
      open={open}
      title="Integrações / API"
      subtitle="Crie tokens para agentes de IA lerem e editarem boards via MCP. Cada token herda apenas os boards do seu usuário."
      onClose={() => setOpen(false)}
      wide
      className="integrations-modal"
    >
      {!cloud.user ? (
        <p className="cloud-note">Entre na nuvem para criar tokens de API.</p>
      ) : (
        <>
          <div className="integration-create">
            <label className="cloud-field">
              <span>Nome do token</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Claude, Cursor, automação…" />
            </label>
            <button className="primary-btn" disabled={busy} onClick={() => void create()}>
              <Icon name="key" size={15} /> {busy ? "Gerando…" : "Gerar token"}
            </button>
          </div>

          {created ? (
            <div className="token-created">
              <b>Copie agora — este token não será exibido novamente</b>
              <div className="token-value">
                <code>{created}</code>
                <button className="secondary-btn" onClick={() => void copy(created)}>
                  Copiar
                </button>
              </div>
            </div>
          ) : null}

          <div className="token-list">
            <div className="token-list-head">
              <b>Tokens</b>
              <span>{tokens.length} token(s)</span>
            </div>
            {!loaded ? (
              <p className="cloud-note">Carregando…</p>
            ) : tokens.length === 0 ? (
              <p className="cloud-note">Nenhum token criado.</p>
            ) : (
              <table className="token-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Prefixo</th>
                    <th>Criado</th>
                    <th>Último uso</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => (
                    <tr key={token.id}>
                      <td>{token.name}</td>
                      <td>
                        <code>{token.prefix}…</code>
                      </td>
                      <td>{fmt(token.created_at)}</td>
                      <td>{fmt(token.last_used_at)}</td>
                      <td>{token.revoked_at ? "Revogado" : "Ativo"}</td>
                      <td>
                        {!token.revoked_at ? (
                          <button className="token-revoke" onClick={() => void revoke(token.id)}>
                            Revogar
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="integration-setup">
            <h3>Configuração do MCP</h3>
            <p>
              Use o endpoint abaixo e o token no seu cliente de agentes (Claude, Cursor, etc.):
            </p>
            <div className="token-value">
              <pre>{mcpConfig}</pre>
              <button className="secondary-btn" onClick={() => void copy(mcpConfig)}>
                Copiar
              </button>
            </div>
            <p className="cloud-note">
              O token é pessoal e dá acesso aos seus boards. Trate como senha e revogue se necessário.
            </p>
          </div>

          {error ? <div className="cloud-error">{error}</div> : null}
        </>
      )}
    </Modal>
  );
}
