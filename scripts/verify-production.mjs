import fs from "node:fs/promises";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { inspectMedia, variants } from "./lib/media.mjs";
const base = process.env.TOUR_URL || "https://wannan-360.vercel.app";
const { source, files, revision, totalBytes } = await inspectMedia();
const home = await fetch(base, { signal: AbortSignal.timeout(30000) });
assert.equal(home.status, 200);
const response = await fetch(base + "/generated/manifest.json", {
  signal: AbortSignal.timeout(30000),
});
assert.equal(response.status, 200);
const m = await response.json();
assert.equal(m.mediaRevision, revision);
assert.deepEqual(m.edges, source.edges);
assert.deepEqual(m.places, source.places);
assert.equal(m.viewpoints.length, 71);
assert.ok(
  !/SourceFile|filename|projectionMetadata|\/Volumes\/|\/Users\/|metadata/.test(
    JSON.stringify(m),
  ),
);
const expected = new Map(files.map((f) => [f.url, f]));
const tasks = m.viewpoints.flatMap((n) =>
  Object.keys(variants).map((variant) => ({ variant, url: n[variant] })),
);
let index = 0;
const verified = [];
async function worker() {
  while (index < tasks.length) {
    const { variant, url } = tasks[index++],
      entry = expected.get(url.split("?")[0]);
    assert.ok(entry);
    const r = await fetch(base + url, {
      headers: { Range: "bytes=0-65535" },
      signal: AbortSignal.timeout(45000),
    });
    assert.ok(r.status === 200 || r.status === 206, `${url}: HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer()),
      meta = await sharp(buf).metadata();
    assert.deepEqual([meta.width, meta.height], variants[variant], url);
    const size =
      r.status === 206
        ? Number(r.headers.get("content-range")?.split("/").at(-1))
        : buf.length;
    assert.equal(size, entry.bytes, url + " byte size");
    verified.push({
      url,
      status: r.status,
      width: meta.width,
      height: meta.height,
      bytes: size,
    });
    if (verified.length % 30 === 0)
      console.log(`${verified.length}/${tasks.length} resources verified`);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
// Exact unversioned URL from the acceptance criterion: full GET, HTTP 200, byte identity.
const exact = "/generated/p-6c8a6232e020.jpg";
const r = await fetch(base + exact, { signal: AbortSignal.timeout(45000) });
assert.equal(r.status, 200);
const buffer = Buffer.from(await r.arrayBuffer()),
  meta = await sharp(buffer).metadata();
assert.deepEqual([meta.width, meta.height], [6144, 3072]);
assert.equal(
  createHash("sha256").update(buffer).digest("hex"),
  expected.get(exact).sha256,
);
await fs.mkdir("reports/hd", { recursive: true });
await fs.writeFile("reports/hd/production-exact.jpg", buffer);
const result = {
  base,
  passed: true,
  home: home.status,
  manifest: response.status,
  exact: {
    url: base + exact,
    status: r.status,
    width: meta.width,
    height: meta.height,
    bytes: buffer.length,
  },
  places: 31,
  viewpoints: 71,
  edges: 85,
  resources: verified.length,
  totalBytes,
  revision,
  verified,
};
await fs.writeFile(
  "reports/hd/production-http.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify({ ...result, verified: undefined }));
