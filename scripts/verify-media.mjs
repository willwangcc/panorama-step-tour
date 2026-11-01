import fs from "node:fs/promises";
import assert from "node:assert/strict";
import sharp from "sharp";
const m = JSON.parse(await fs.readFile("public/generated/manifest.json"));
const ids = new Set(m.viewpoints.map((n) => n.id));
assert.equal(ids.size, m.viewpoints.length);
let bytes = 0;
for (const n of m.viewpoints) {
  for (const k of ["panorama", "mobile", "thumbnail"]) {
    const p = "public" + n[k],
      s = await fs.stat(p),
      meta = await sharp(p).metadata();
    assert.equal(meta.width / meta.height, 2);
    bytes += s.size;
  }
}
for (const e of m.edges) {
  assert.ok(ids.has(e.from) && ids.has(e.to));
  assert.ok(e.distance <= 350 && e.distance >= 3);
  assert.equal(
    m.viewpoints.find((n) => n.id === e.from).placeId,
    m.viewpoints.find((n) => n.id === e.to).placeId,
  );
}
console.log(
  `Validated ${m.viewpoints.length * 3} JPEG derivatives, ${m.places.length} places, ${m.edges.length} directed edges; ${(bytes / 1048576).toFixed(1)} MiB.`,
);
