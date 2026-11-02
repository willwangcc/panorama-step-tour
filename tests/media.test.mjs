import test from "node:test";
import assert from "node:assert/strict";
import { publicManifest, mediaPath } from "../scripts/lib/media.mjs";
import { variants } from "../scripts/lib/media.mjs";
test("publish only viewer fields and bust stale panorama caches", () => {
  const source = {
    schemaVersion: 1,
    title: "tour",
    places: [],
    edges: [{ from: "a", to: "b" }],
    viewpoints: [
      {
        id: "a",
        panorama: "/generated/p-123456abcdef.jpg",
        mobile: "/generated/p-123456abcdef-mobile.jpg",
        filename: "private.JPG",
        metadata: { SourceFile: "/Volumes/SD/private.JPG" },
      },
    ],
  };
  const output = publicManifest(source, {
    revision: "rev",
    files: [
      {
        url: source.viewpoints[0].panorama,
        sha256: "abcdef0123456789deadbeef",
      },
    ],
  });
  assert.equal(
    output.viewpoints[0].panorama,
    "/generated/p-123456abcdef.jpg?v=abcdef0123456789",
  );
  assert.ok(!JSON.stringify(output).includes("private"));
  assert.deepEqual(output.edges, source.edges);
});
test("media contract requires full desktop and distinct mobile dimensions", () => {
  assert.deepEqual(variants.panorama, [6144, 3072]);
  assert.deepEqual(variants.mobile, [4096, 2048]);
  assert.throws(() => mediaPath("public", "/generated/../../.env.local"));
  assert.throws(() => mediaPath("public", "https://example.com/photo.jpg"));
  assert.equal(
    mediaPath("public", "/generated/p-123456abcdef.jpg?v=abc"),
    "public/generated/p-123456abcdef.jpg",
  );
});
