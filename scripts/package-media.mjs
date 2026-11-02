// Produce the redistributable GitHub asset from existing web derivatives only.
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { inspectMedia, publicManifest, mediaPath } from "./lib/media.mjs";
const inventory = await inspectMedia();
const root = "reports/github-media",
  dir = path.join(root, "bundle/generated");
await fs.mkdir(dir, { recursive: true });
for (const f of inventory.files)
  await fs.copyFile(
    mediaPath("public", f.url),
    path.join(dir, path.basename(f.url)),
  );
const manifest = publicManifest(inventory.source);
manifest.mediaRevision = inventory.revision;
await fs.writeFile(
  path.join(dir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
const filename = `southern-anhui-hd-${inventory.revision}.tar.gz`,
  archive = path.resolve(root, filename);
const packed = spawnSync("tar", ["-czf", archive, "generated"], {
  cwd: path.join(root, "bundle"),
  env: { ...process.env, COPYFILE_DISABLE: "1" },
  encoding: "utf8",
});
if (packed.status !== 0) throw Error(packed.stderr || "tar failed");
const data = await fs.readFile(archive),
  sha256 = createHash("sha256").update(data).digest("hex");
const parts = [];
for (
  let offset = 0, part = 1;
  offset < data.length;
  offset += 48 * 1048576, part++
) {
  const name = `${filename}.part${String(part).padStart(2, "0")}`;
  const bytes = data.subarray(offset, offset + 48 * 1048576);
  await fs.writeFile(path.join(root, name), bytes);
  parts.push({
    url: `https://github.com/willwangcc/panorama-step-tour/releases/download/media-hd-v1/${name}`,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const config = {
  schemaVersion: 1,
  revision: inventory.revision,
  archiveName: filename,
  parts,
  archiveBytes: data.length,
  sha256,
  resources: 213,
  viewpoints: 71,
  places: 31,
  edges: 85,
};
await fs.writeFile(
  "deployment/github-media.json",
  JSON.stringify(config, null, 2) + "\n",
);
await fs.writeFile(archive + ".sha256", `${sha256}  ${filename}\n`);
console.log(JSON.stringify({ archive, ...config }, null, 2));
