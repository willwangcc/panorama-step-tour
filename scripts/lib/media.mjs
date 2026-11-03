import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import sharp from "sharp";

export const variants = {
  panorama: [6144, 3072],
  mobile: [4096, 2048],
  thumbnail: [480, 240],
};
const fields = [
  "id",
  "placeId",
  "place",
  "title",
  "date",
  "panorama",
  "mobile",
  "thumbnail",
  "gps",
  "altitude",
  "relativeAltitude",
  "heading",
  "headingEstimate",
  "headingStatus",
];
export function publicManifest(source, inventory) {
  const hashes = new Map(inventory?.files.map((f) => [f.url, f.sha256]) || []);
  return {
    schemaVersion: source.schemaVersion,
    title: source.title,
    generatedAt: source.generatedAt,
    ...(inventory || source.mediaRevision
      ? { mediaRevision: inventory?.revision ?? source.mediaRevision }
      : {}),
    places: source.places,
    viewpoints: source.viewpoints.map((n) =>
      Object.fromEntries(
        fields
          .filter((k) => k in n)
          .map((k) => [
            k,
            variants[k] && hashes.has(n[k])
              ? `${n[k]}?v=${hashes.get(n[k]).slice(0, 16)}`
              : n[k],
          ]),
      ),
    ),
    edges: source.edges,
  };
}
export function mediaPath(root, url) {
  const pathname = url.split("?")[0];
  assert.match(
    pathname,
    /^\/generated\/p-[a-f0-9]{12}(?:-mobile|-thumb)?\.jpg$/,
    "Unexpected media path",
  );
  return path.join(root, pathname);
}
export async function inspectMedia(root = "public") {
  const source = JSON.parse(
    await fs.readFile(path.join(root, "generated/manifest.json"), "utf8"),
  );
  assert.ok(
    source.places.length > 0 && source.viewpoints.length > 0,
    "Empty tour",
  );
  const ids = new Set(source.viewpoints.map((n) => n.id));
  assert.equal(ids.size, source.viewpoints.length, "Duplicate viewpoint ID");
  const placeIds = new Set(source.places.map((p) => p.id));
  assert.equal(placeIds.size, source.places.length, "Duplicate place ID");
  const membership = new Set();
  for (const place of source.places) {
    assert.ok(place.viewpoints.length > 0, "Empty place");
    for (const id of place.viewpoints) {
      assert.ok(!membership.has(id), "Viewpoint in multiple places");
      membership.add(id);
      assert.equal(
        source.viewpoints.find((n) => n.id === id)?.placeId,
        place.id,
        "Invalid place membership",
      );
    }
  }
  assert.equal(membership.size, ids.size, "Unlisted viewpoint");
  assert.equal(
    new Set(source.edges.map((e) => e.id)).size,
    source.edges.length,
    "Duplicate edge ID",
  );
  const files = [],
    seen = new Set();
  for (const n of source.viewpoints) {
    assert.notEqual(
      n.panorama,
      n.mobile,
      "Desktop and mobile must use distinct resources",
    );
    for (const [variant, dimensions] of Object.entries(variants)) {
      const url = n[variant].split("?")[0];
      assert.ok(!seen.has(url), "Duplicate media URL");
      seen.add(url);
      const file = mediaPath(root, url),
        bytes = await fs.readFile(file),
        meta = await sharp(bytes).metadata();
      assert.deepEqual(
        [meta.width, meta.height],
        dimensions,
        `${url}: ${variant} resolution regression`,
      );
      assert.ok(
        !meta.exif && !meta.xmp && !meta.iptc,
        `${url}: unexpected embedded metadata`,
      );
      files.push({
        url,
        variant,
        width: meta.width,
        height: meta.height,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
  for (const e of source.edges) {
    assert.ok(ids.has(e.from) && ids.has(e.to), "Dangling edge");
    assert.equal(
      source.viewpoints.find((n) => n.id === e.from).placeId,
      source.viewpoints.find((n) => n.id === e.to).placeId,
    );
  }
  const revision = createHash("sha256")
    .update(
      files
        .map((f) => `${f.url}:${f.sha256}`)
        .sort()
        .join("\n"),
    )
    .digest("hex")
    .slice(0, 20);
  return {
    source,
    files,
    revision,
    totalBytes: files.reduce((s, f) => s + f.bytes, 0),
  };
}
