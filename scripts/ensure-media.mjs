// Fresh clones fetch the pinned public GitHub release; no credentials or original SD card.
import fs from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { inspectMedia, mediaPath } from "./lib/media.mjs";
const config = JSON.parse(
  await fs.readFile(
    new URL("../deployment/github-media.json", import.meta.url),
    "utf8",
  ),
);
try {
  const current = await inspectMedia();
  assert.equal(current.revision, config.revision);
  console.log(
    `Using verified local media: ${current.files.length} files, revision ${current.revision}.`,
  );
} catch (error) {
  console.log(
    `Preparing ${config.viewpoints} HD panoramas from GitHub Release (${(config.archiveBytes / 1048576).toFixed(1)} MiB).`,
  );
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "anhui-media-"));
  try {
    const archive = path.join(temp, "media.tar.gz");
    async function download(part, destination) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch(part.url, {
            signal: AbortSignal.timeout(10 * 60 * 1000),
          });
          if (!response.ok)
            throw Error(`GitHub media download: HTTP ${response.status}`);
          const hash = createHash("sha256");
          let bytes = 0;
          await pipeline(
            Readable.fromWeb(response.body),
            new Transform({
              transform(chunk, encoding, done) {
                bytes += chunk.length;
                if (bytes > part.bytes)
                  return done(Error("Unexpected download size"));
                hash.update(chunk);
                done(null, chunk);
              },
            }),
            createWriteStream(destination),
          );
          assert.equal(bytes, part.bytes, "Incomplete media part");
          assert.equal(
            hash.digest("hex"),
            part.sha256,
            "Media part checksum mismatch",
          );
          return;
        } catch (error) {
          if (attempt === 3) throw error;
          console.warn(`Retrying media download: ${error.message}`);
        }
      }
    }
    if (config.parts?.length) {
      let next = 0,
        complete = 0;
      async function worker() {
        while (next < config.parts.length) {
          const i = next++;
          await download(config.parts[i], path.join(temp, `part-${i}`));
          console.log(
            `Media parts verified ${++complete}/${config.parts.length}`,
          );
        }
      }
      await Promise.all([worker(), worker(), worker()]);
      async function* chunks() {
        for (let i = 0; i < config.parts.length; i++)
          for await (const chunk of createReadStream(
            path.join(temp, `part-${i}`),
          ))
            yield chunk;
      }
      const hash = createHash("sha256");
      let total = 0;
      await pipeline(
        Readable.from(chunks()),
        new Transform({
          transform(chunk, encoding, done) {
            total += chunk.length;
            hash.update(chunk);
            done(null, chunk);
          },
        }),
        createWriteStream(archive),
      );
      assert.equal(
        total,
        config.archiveBytes,
        "Combined archive size mismatch",
      );
      assert.equal(
        hash.digest("hex"),
        config.sha256,
        "Combined archive checksum mismatch",
      );
    } else {
      await download(
        { url: config.url, bytes: config.archiveBytes, sha256: config.sha256 },
        archive,
      );
    }
    const list = spawnSync("tar", ["-tzf", archive], {
      encoding: "utf8",
      maxBuffer: 1048576,
    });
    if (list.status !== 0)
      throw Error("Cannot read media archive: " + list.stderr);
    for (const name of list.stdout.trim().split("\n"))
      assert.match(
        name,
        /^generated\/(?:manifest\.json|p-[a-f0-9]{12}(?:-mobile|-thumb)?\.jpg)?$/,
        "Unexpected archive entry",
      );
    const extract = spawnSync("tar", ["-xzf", archive, "-C", temp], {
      encoding: "utf8",
    });
    if (extract.status !== 0)
      throw Error("Cannot extract media archive: " + extract.stderr);
    const inventory = await inspectMedia(temp);
    assert.equal(
      inventory.revision,
      config.revision,
      "Extracted media revision mismatch",
    );
    assert.equal(inventory.files.length, config.resources);
    await fs.mkdir("public/generated", { recursive: true });
    for (const file of inventory.files)
      await fs.copyFile(
        mediaPath(temp, file.url),
        mediaPath("public", file.url),
      );
    // Publish the manifest last, only after every image has passed validation.
    await fs.copyFile(
      path.join(temp, "generated/manifest.json"),
      "public/generated/manifest.json",
    );
    console.log(
      `Installed ${inventory.files.length} verified resources: desktop 6144x3072, mobile 4096x2048.`,
    );
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
