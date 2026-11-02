// Upload existing derivatives byte-for-byte. No image encoding or original access.
import fs from "node:fs/promises";
import { put, list } from "@vercel/blob";
import { inspectMedia } from "./lib/media.mjs";
if (!process.env.BLOB_READ_WRITE_TOKEN)
  try {
    process.loadEnvFile(".env.local");
  } catch {}
const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token)
  throw Error(
    "Missing BLOB_READ_WRITE_TOKEN. Run vercel env pull .env.local first.",
  );
const inventory = await inspectMedia();
const prefix = `southern-anhui/hd-${inventory.revision}`;
const media = inventory.files.filter((f) => f.variant !== "thumbnail");
// One listing makes reruns idempotent. The content-derived prefix changes if any byte changes.
const existing = new Map();
let cursor;
do {
  const result = await list({
    token,
    prefix: prefix + "/",
    limit: 1000,
    cursor,
  });
  for (const b of result.blobs) existing.set(b.pathname, b);
  cursor = result.hasMore ? result.cursor : undefined;
} while (cursor);
let origin,
  uploaded = 0,
  reused = 0,
  index = 0;
async function worker() {
  while (index < media.length) {
    const f = media[index++],
      name = f.url.split("/").at(-1),
      pathname = `${prefix}/${name}`,
      found = existing.get(pathname);
    let url;
    if (found) {
      if (found.size !== f.bytes)
        throw Error(`Existing object size mismatch: ${pathname}`);
      url = found.url;
      reused++;
    } else {
      const result = await put(pathname, await fs.readFile("public" + f.url), {
        token,
        access: "public",
        addRandomSuffix: false,
        contentType: "image/jpeg",
        cacheControlMaxAge: 31536000,
        multipart: false,
      });
      url = result.url;
      uploaded++;
    }
    const objectOrigin = new URL(url).origin;
    if (origin && origin !== objectOrigin) throw Error("Mixed Blob stores");
    origin = objectOrigin;
    console.log(
      `${uploaded + reused}/${media.length} ${name} ${found ? "reused" : "uploaded"} (${f.width}x${f.height})`,
    );
  }
}
await Promise.all([worker(), worker(), worker()]);
const config = {
  schemaVersion: 1,
  project: "southern-anhui",
  origin,
  prefix,
  revision: inventory.revision,
};
await fs.mkdir("deployment", { recursive: true });
await fs.writeFile(
  "deployment/media.json",
  JSON.stringify(config, null, 2) + "\n",
);
await fs.mkdir("reports/hd", { recursive: true });
await fs.writeFile(
  "reports/hd/upload.json",
  JSON.stringify(
    {
      uploaded,
      reused,
      mediaBytes: media.reduce((s, f) => s + f.bytes, 0),
      ...config,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ uploaded, reused, origin, prefix }));
