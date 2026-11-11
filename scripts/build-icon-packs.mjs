import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const PACKS = [
  { id: "logos", pkg: "@squinch/pack-logos" },
  { id: "aws", pkg: "@squinch/pack-aws" },
  { id: "azure", pkg: "@squinch/pack-azure" },
  { id: "gcp", pkg: "@squinch/pack-gcp" },
  { id: "k8s", pkg: "@squinch/pack-k8s" },
];

const OUT = join(process.cwd(), "public", "brand-icons");

function viewBoxOf(svg) {
  const vb = /viewBox=["']([^"']+)["']/i.exec(svg);
  if (vb) return vb[1];
  const w = /width=["']([\d.]+)/i.exec(svg);
  const h = /height=["']([\d.]+)/i.exec(svg);
  return `0 0 ${w ? w[1] : 24} ${h ? h[1] : 24}`;
}

/** Simple Icons are filled black; paint them white for the brand plate. */
function paintWhite(svg) {
  return svg.replace(/<svg\b([^>]*)>/i, (_match, attrs) => `<svg${attrs} fill="#ffffff">`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const index = { packs: [] };

  for (const pack of PACKS) {
    const pkgRoot = dirname(require.resolve(`${pack.pkg}/package.json`));
    const meta = JSON.parse(await readFile(join(pkgRoot, "pack.json"), "utf8"));
    const entries = [];

    for (const [id, info] of Object.entries(meta.icons ?? {})) {
      const svgPath = join(pkgRoot, "icons", info.file);
      let svg;
      try {
        svg = await readFile(svgPath, "utf8");
      } catch {
        continue;
      }
      const isLogo = pack.id === "logos";
      const data = isLogo ? paintWhite(svg) : svg;
      entries.push({
        id,
        title: info.title || id,
        category: info.category || "",
        viewBox: viewBoxOf(data),
        svg: data,
        plate: isLogo ? info.color || "#8b3fd9" : undefined,
      });
    }

    entries.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    await writeFile(
      join(OUT, `${pack.id}.json`),
      JSON.stringify({
        id: pack.id,
        title: meta.title,
        license: meta.license,
        attribution: meta.attribution,
        icons: entries,
      }),
    );

    index.packs.push({
      id: pack.id,
      title: meta.title,
      license: meta.license,
      attribution: meta.attribution,
      count: entries.length,
    });
    console.log(`icons: ${pack.id} -> ${entries.length} icons`);
  }

  await writeFile(join(OUT, "index.json"), JSON.stringify(index));
}

main().catch((error) => {
  console.error("icon packs:", error);
  process.exit(1);
});
