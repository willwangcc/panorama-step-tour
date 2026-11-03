// Produce the redistributable GitHub asset from existing web derivatives only.
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { inspectMedia, publicManifest, mediaPath } from "./lib/media.mjs";
const { values } = parseArgs({
  options: {
    tag: { type: "string" },
    "base-manifest": { type: "string" },
  },
});
assert.match(
  values.tag || "",
  /^[a-zA-Z0-9][a-zA-Z0-9._-]+$/,
  "Pass --tag RELEASE_TAG",
);
const inventory = await inspectMedia();
const previous = JSON.parse(
  await fs.readFile("deployment/github-media.json", "utf8"),
);
let files = inventory.files;
if (values["base-manifest"]) {
  const base = JSON.parse(await fs.readFile(values["base-manifest"], "utf8"));
  const urls = new Set(
    base.viewpoints.flatMap((n) =>
      [n.panorama, n.mobile, n.thumbnail].map((u) => u.split("?")[0]),
    ),
  );
  const retained = inventory.files.filter((f) => urls.has(f.url));
  assert.equal(
    retained.length,
    urls.size,
    "Base media removed; use full package",
  );
  const revision = createHash("sha256")
    .update(
      retained
        .map((f) => `${f.url}:${f.sha256}`)
        .sort()
        .join("\n"),
    )
    .digest("hex")
    .slice(0, 20);
  assert.equal(
    revision,
    previous.revision,
    "Base media changed; use full package",
  );
  files = inventory.files.filter((f) => !urls.has(f.url));
  assert.ok(files.length, "No new media to package");
}
const root = "reports/github-media",
  dir = path.join(root, "bundle/generated");
await fs.rm(path.dirname(dir), { recursive: true, force: true });
await fs.mkdir(dir, { recursive: true });
for (const f of files)
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
    url: `https://github.com/willwangcc/panorama-step-tour/releases/download/${values.tag}/${name}`,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const bundle = {
  archiveName: filename,
  parts,
  archiveBytes: data.length,
  sha256,
};
const bundles = values["base-manifest"]
  ? [
      ...(previous.bundles || [
        {
          archiveName: previous.archiveName,
          parts: previous.parts,
          archiveBytes: previous.archiveBytes,
          sha256: previous.sha256,
        },
      ]),
      bundle,
    ]
  : [bundle];
const config = {
  schemaVersion: 2,
  revision: inventory.revision,
  bundles,
  archiveBytes: bundles.reduce((sum, b) => sum + b.archiveBytes, 0),
  resources: inventory.files.length,
  viewpoints: inventory.source.viewpoints.length,
  places: inventory.source.places.length,
  edges: inventory.source.edges.length,
};
await fs.writeFile(
  "deployment/github-media.json",
  JSON.stringify(config, null, 2) + "\n",
);
await fs.writeFile(archive + ".sha256", `${sha256}  ${filename}\n`);
console.log(JSON.stringify({ archive, ...config }, null, 2));
