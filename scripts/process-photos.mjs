import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { buildEdges } from "../src/lib/spatial.js";
sharp.cache({ memory: 64 });
sharp.concurrency(2);
const report = JSON.parse(
  await fs.readFile(process.argv[2] || "reports/audit.json", "utf8"),
);
const aliases = JSON.parse(
  await fs.readFile("data/import-place-aliases.json", "utf8"),
);
const out = "public/generated";
await fs.mkdir(out, { recursive: true });
let old = {};
try {
  old = JSON.parse(await fs.readFile(`${out}/cache.json`, "utf8"));
} catch {}
let existing = { viewpoints: [], edges: [] };
try {
  existing = JSON.parse(await fs.readFile(`${out}/manifest.json`, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const cache = {},
  imported = [],
  failures = [];
let processed = 0,
  skipped = 0;
for (const p of report.photos) {
  if (p.classification !== "verified-equirectangular") {
    failures.push({
      filename: p.filename,
      error: "Projection not verified; excluded without stretching.",
    });
    continue;
  }
  const id =
    "p-" +
    crypto.createHash("sha256").update(p.filename).digest("hex").slice(0, 12);
  const source = path.join(report.sourceDirectory, p.filename);
  try {
    const stat = await fs.stat(source);
    const fingerprint = `v2:6144:4096:86:${stat.size}:${stat.mtimeMs}`;
    const urls = {
      panorama: `/generated/${id}.jpg`,
      mobile: `/generated/${id}-mobile.jpg`,
      thumbnail: `/generated/${id}-thumb.jpg`,
    };
    const paths = Object.values(urls).map((u) => "public" + u);
    let exists = true;
    for (const f of paths)
      try {
        await fs.access(f);
      } catch {
        exists = false;
      }
    if (old[id] === fingerprint && exists) {
      skipped++;
    } else {
      for (const [i, width] of [6144, 4096, 480].entries()) {
        const temp = paths[i] + ".tmp";
        await sharp(source, { limitInputPixels: 250000000, failOn: "error" })
          .resize({ width, withoutEnlargement: true })
          .jpeg({ quality: i === 2 ? 76 : 86 })
          .toFile(temp);
        await fs.rename(temp, paths[i]);
      }
      processed++;
    }
    cache[id] = fingerprint;
    const place = aliases[p.place] || p.place;
    const placeId =
      "place-" +
      crypto.createHash("sha256").update(place).digest("hex").slice(0, 8);
    imported.push({
      id,
      placeId,
      place,
      filename: p.filename,
      date: p.dateTime,
      ...urls,
      gps:
        Number.isFinite(p.gpsLatitude) && Number.isFinite(p.gpsLongitude)
          ? { lat: p.gpsLatitude, lon: p.gpsLongitude }
          : null,
      altitude:
        p.absoluteAltitude == null ? p.gpsAltitude : Number(p.absoluteAltitude),
      relativeAltitude: p.relativeAltitude,
      heading: p.poseHeading,
      headingEstimate: p.gimbalYaw == null ? null : Number(p.gimbalYaw),
      headingStatus:
        p.poseHeading == null ? "unverified-gimbal-estimate" : "gpano-pose",
      metadata: p,
    });
    await fs.writeFile(
      `${out}/cache.json`,
      JSON.stringify({ ...old, ...cache }),
    );
    console.log(
      `${imported.length}/${report.photos.length} ${p.place} ${old[id] === fingerprint && exists ? "cached" : "generated"}`,
    );
  } catch (e) {
    failures.push({ filename: p.filename, error: e.message });
    console.error(p.filename, e.message);
  }
}
if (failures.length) {
  await fs.writeFile(
    "reports/processing-failures.json",
    JSON.stringify(failures, null, 2),
  );
  throw Error(
    "Import incomplete; existing manifest retained. See reports/processing-failures.json",
  );
}
// Incremental upsert: a new source folder must never erase previous batches.
const byId = new Map(existing.viewpoints.map((n) => [n.id, n]));
for (const n of imported) byId.set(n.id, n);
const nodes = [...byId.values()];
nodes.sort((a, b) => (a.date || a.id).localeCompare(b.date || b.id));
const places = [...new Set(nodes.map((n) => n.placeId))].map((id) => {
  const ns = nodes.filter((n) => n.placeId === id),
    gps = ns.filter((n) => n.gps);
  return {
    id,
    name: ns[0].place,
    viewpoints: ns.map((n) => n.id),
    gps: gps.length
      ? {
          lat: gps.reduce((s, n) => s + n.gps.lat, 0) / gps.length,
          lon: gps.reduce((s, n) => s + n.gps.lon, 0) / gps.length,
        }
      : null,
  };
});
for (const p of places)
  p.viewpoints.forEach((id, i) => {
    nodes.find((n) => n.id === id).title =
      `${p.name} · ${String(i + 1).padStart(2, "0")}`;
  });
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  title: "皖南 · 空间漫游",
  places,
  viewpoints: nodes,
  edges: buildEdges(nodes).map(
    (edge) => existing.edges.find((old) => old.id === edge.id) || edge,
  ),
  failures,
  policy: {
    maxStepMeters: 350,
    maxAltitudeDelta: 100,
    nearestNeighbors: 3,
    heading:
      "Gimbal yaw is only a provisional estimate; manual calibration required.",
    originals: "Read-only; never served.",
  },
};
await fs.writeFile(
  `${out}/manifest.json.tmp`,
  JSON.stringify(manifest, null, 2),
);
await fs.rename(`${out}/manifest.json.tmp`, `${out}/manifest.json`);
await fs.writeFile(
  "reports/processing.json",
  JSON.stringify(
    {
      processed,
      skipped,
      failures,
      nodes: nodes.length,
      places: places.length,
      edges: manifest.edges.length,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    processed,
    skipped,
    failures,
    nodes: nodes.length,
    places: places.length,
    edges: manifest.edges.length,
  }),
);
if (failures.length) process.exitCode = 1;
