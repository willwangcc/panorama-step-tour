import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { build } from "vite";
import { inspectMedia, publicManifest, mediaPath } from "./lib/media.mjs";
const inventory = await inspectMedia();
const config = JSON.parse(await fs.readFile("deployment/media.json", "utf8"));
assert.equal(config.project, "southern-anhui");
assert.equal(
  config.revision,
  inventory.revision,
  "Media changed: run npm run upload:media before building.",
);
assert.match(
  config.origin,
  /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com$/,
);
assert.equal(config.prefix, `southern-anhui/hd-${inventory.revision}`);
const remoteFiles = inventory.files.filter((f) => f.variant !== "thumbnail");
let cursor = 0;
async function verifyRemote() {
  while (cursor < remoteFiles.length) {
    const f = remoteFiles[cursor++];
    const url = `${config.origin}/${config.prefix}/${path.basename(f.url)}`;
    const r = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(r.status, 200, `Missing Blob ${url}`);
    assert.equal(
      Number(r.headers.get("content-length")),
      f.bytes,
      `Wrong byte size ${url}`,
    );
  }
}
await Promise.all([verifyRemote(), verifyRemote(), verifyRemote()]);
// Always rebuild the output. Never reuse the manually downsampled prebuilt directory.
const out = ".vercel/output",
  staticDir = `${out}/static`;
await fs.rm(out, { recursive: true, force: true });
await build({
  configFile: false,
  publicDir: false,
  build: { outDir: staticDir, emptyOutDir: true },
});
await fs.mkdir(`${staticDir}/generated`, { recursive: true });
for (const f of inventory.files.filter((f) => f.variant === "thumbnail"))
  await fs.copyFile(mediaPath("public", f.url), mediaPath(staticDir, f.url));
await fs.writeFile(
  `${staticDir}/generated/manifest.json`,
  JSON.stringify(publicManifest(inventory.source, inventory), null, 2) + "\n",
);
const routes = [
  {
    src: "^/generated/manifest\\.json$",
    headers: { "Cache-Control": "public, max-age=0, must-revalidate" },
    continue: true,
  },
  {
    src: "^/generated/(p-[a-f0-9]{12}(?:-mobile)?\\.jpg)$",
    dest: `${config.origin}/${config.prefix}/$1`,
    headers: {
      "Cache-Control": "public, max-age=86400",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    },
  },
  {
    src: "^/assets/(.*)$",
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    continue: true,
  },
  { handle: "filesystem" },
];
await fs.writeFile(
  `${out}/config.json`,
  JSON.stringify({ version: 3, routes }, null, 2) + "\n",
);
const published = JSON.parse(
  await fs.readFile(`${staticDir}/generated/manifest.json`, "utf8"),
);
assert.deepEqual(
  published.edges,
  inventory.source.edges,
  "Connections changed",
);
assert.deepEqual(published.places, inventory.source.places, "Places changed");
const text = JSON.stringify(published);
assert.ok(
  !/SourceFile|projectionMetadata|filename|\/Volumes\/|\/Users\/|metadata/.test(
    text,
  ),
  "Private metadata leaked",
);
let total = 0;
async function size(dir) {
  for (const f of await fs.readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, f.name);
    if (f.isDirectory()) await size(name);
    else total += (await fs.stat(name)).size;
  }
}
await size(out);
assert.ok(
  total < 100000000,
  "Prebuilt output exceeds Hobby upload limit; do not resize panoramas.",
);
await fs.mkdir("reports/hd", { recursive: true });
await fs.writeFile(
  "reports/hd/build.json",
  JSON.stringify(
    {
      revision: inventory.revision,
      staticBytes: total,
      mediaBytes: inventory.totalBytes,
      resources: inventory.files.length,
      proxiedPanoramas: remoteFiles.length,
      places: inventory.source.places.length,
      viewpoints: inventory.source.viewpoints.length,
      edges: inventory.source.edges.length,
    },
    null,
    2,
  ),
);
console.log(
  `Verified ${remoteFiles.length} full-resolution Blob objects. Prebuilt output ${(total / 1048576).toFixed(2)} MiB; media ${(inventory.totalBytes / 1048576).toFixed(1)} MiB. No originals read or resized.`,
);
