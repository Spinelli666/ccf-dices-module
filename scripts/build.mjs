// Builds the module into a folder the site serves at /modules/dice-so-nice/:
//   node scripts/build.mjs [outDir]   (default: dist)
// The bundle, the physics worker, the assets (models, textures, sounds, fonts), module.json and the
// license, so whoever gets the files gets the license with them.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve(process.argv[2] ?? "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const common = {
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  legalComments: "eof",
  logLevel: "info",
};

await build({
  ...common,
  entryPoints: { index: "src/ccf/module.js" },
  outdir: out,
  // The engine stays in its own chunk, loaded on the first throw.
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
});
// The worker is loaded with new URL("./PhysicsWorker.js", import.meta.url) from the engine chunk.
await build({ ...common, entryPoints: { PhysicsWorker: "src/web-workers/PhysicsWorker.js" }, outdir: resolve(out, "chunks") });

cpSync("assets", out, { recursive: true });
cpSync("module.json", resolve(out, "module.json"));
cpSync("LICENSE.md", resolve(out, "LICENSE.md"));
console.log(`built into ${out}`);
