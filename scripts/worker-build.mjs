import { build } from "esbuild";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const assets = {};
for (const dir of ["public", "seed"]) {
  for (const name of readdirSync(dir)) {
    if (/\.(js|html|css|jpg|wav|pdf)$/.test(name)) {
      assets[name] = readFileSync(dir + "/" + name).toString("base64");
    }
  }
}

mkdirSync("web", { recursive: true });
writeFileSync("web/robots.txt", "User-agent: *\nDisallow: /ucitel\n");
writeFileSync("generated-assets.mjs", "export default " + JSON.stringify(assets));

await build({
  entryPoints: ["worker.mjs"],
  outfile: "dist/server/index.cjs",
  bundle: true,
  minify: true,
  platform: "node",
  target: "node22",
  format: "cjs",
});
