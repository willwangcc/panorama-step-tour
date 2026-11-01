#!/usr/bin/env node
// Audits local DJI JPEG photographs without uploading or altering them.
// Never interpret filename order, a 2:1 ratio, or _D.JPG as proof of a 360° tour.
import { promises as fs } from "node:fs";
import { join, resolve, relative, dirname, extname } from "node:path";
import { spawnSync } from "node:child_process";

const input = process.argv[2];
if (!input || input.startsWith("-")) {
  console.error('Usage: npm run audit:photos -- "/absolute/path/to/your/photo-folder"');
  process.exit(1);
}
const directory = resolve(input);
const root = process.cwd();
const outDir = join(root, "reports");
const formats = new Set([".jpg", ".jpeg"]);
const HEADER_LIMIT = 4 * 1024 * 1024;
const readOnly = true;

async function scan(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    // Do not follow symlinks. No traversal outside explicitly supplied root.
    if (entry.isDirectory()) files.push(...await scan(join(dir, entry.name)));
    else if (entry.isFile() && formats.has(extname(entry.name).toLowerCase())) {
      files.push(join(dir, entry.name));
    }
  }
  return files.sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function jpegDimensions(data) {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 <= data.length) {
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }
    while (offset < data.length && data[offset] === 0xff) offset++;
    if (offset >= data.length) break;
    const marker = data[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > data.length) break;
    const segmentSize = data.readUInt16BE(offset);
    if (segmentSize < 2 || offset + segmentSize > data.length) break;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      if (segmentSize < 7) return null;
      return {
        height: data.readUInt16BE(offset + 3),
        width: data.readUInt16BE(offset + 5)
      };
    }
    offset += segmentSize;
  }
  return null;
}

function readGpanoEvidence(data) {
  const xmp = data.toString("latin1");
  const gpano = /GPano:|<GPano:/i.test(xmp);
  const equirectangular = /(?:GPano:)?ProjectionType\s*=\s*["']equirectangular|<GPano:ProjectionType>\s*equirectangular\s*</i.test(xmp);
  return { gpano, equirectangular };
}

function derivePlace(name) {
  const prefix = name.split(/DJI_/i)[0];
  const site = prefix.replace(/^\d{1,2}日\s*/, "").replace(/\s+/g, " ").trim();
  return site || "未分类";
}

function maybeMetadataViaExifTool(filePaths) {
  const probe = spawnSync("exiftool", ["-ver"], { encoding: "utf8", timeout: 5000 });
  if (probe.error || probe.status !== 0) return null;
  const fields = [
    "-json", "-n", "-charset", "filename=utf8",
    "-FileName", "-DateTimeOriginal",
    "-GPSLatitude", "-GPSLongitude", "-GPSAltitude",
    "-AbsoluteAltitude", "-RelativeAltitude",
    "-FlightYawDegree", "-GimbalYawDegree",
    "-PoseHeadingDegrees", "-ProjectionType",
    ...filePaths
  ];
  const r = spawnSync("exiftool", fields, {
    encoding: "utf8", timeout: 180000, maxBuffer: 32 * 1024 * 1024
  });
  if (r.error || r.status !== 0) {
    console.warn("ExifTool metadata pass did not succeed; continuing with JPEG/XMP audit.");
    return null;
  }
  try {
    const parsed = JSON.parse(r.stdout);
    return new Map(parsed.map((item) => [resolve(item.SourceFile), item]));
  } catch {
    return null;
  }
}

function csvCell(x) {
  if (x === null || x === undefined) return "";
  const value = String(x);
  return /[",\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
}

async function main() {
  const stat = await fs.stat(directory);
  if (!stat.isDirectory()) throw new Error("Input must be a directory: " + directory);
  const paths = await scan(directory);
  if (!paths.length) throw new Error("No JPEG files found: " + directory);
  const exif = maybeMetadataViaExifTool(paths);
  const rows = [];
  for (const file of paths) {
    const info = await fs.stat(file);
    const handle = await fs.open(file, "r");
    let data;
    try {
      const length = Math.min(HEADER_LIMIT, info.size);
      data = Buffer.allocUnsafe(length);
      const result = await handle.read(data, 0, length, 0);
      data = data.subarray(0, result.bytesRead);
    } finally {
      await handle.close();
    }

    const dimensions = jpegDimensions(data);
    const xmp = readGpanoEvidence(data);
    const meta = exif?.get(file) || {};
    const width = dimensions?.width ?? null;
    const height = dimensions?.height ?? null;
    const aspectRatio = width && height ? Number((width / height).toFixed(3)) : null;
    const ratioCandidate = aspectRatio !== null && Math.abs(aspectRatio - 2) < 0.12;
    const verifiedGPano = xmp.equirectangular || /equirectangular/i.test(String(meta.ProjectionType || ""));
    const classification = verifiedGPano && ratioCandidate
      ? "verified-equirectangular"
      : ratioCandidate
      ? "2:1-candidate-needs-manual-check"
      : dimensions
      ? "ordinary-or-unknown-still"
      : "unreadable-jpeg-header";

    rows.push({
      filename: relative(directory, file),
      place: derivePlace(file.split("/").at(-1)),
      sizeMB: Number((info.size / 1024 / 1024).toFixed(2)),
      width, height, aspectRatio, classification,
      gpanoEvidence: Boolean(xmp.gpano),
      dateTime: meta.DateTimeOriginal ?? null,
      gpsLatitude: meta.GPSLatitude ?? null,
      gpsLongitude: meta.GPSLongitude ?? null,
      gpsAltitude: meta.GPSAltitude ?? null,
      absoluteAltitude: meta.AbsoluteAltitude ?? null,
      relativeAltitude: meta.RelativeAltitude ?? null,
      flightYaw: meta.FlightYawDegree ?? null,
      gimbalYaw: meta.GimbalYawDegree ?? null,
      poseHeading: meta.PoseHeadingDegrees ?? null
    });
  }

  const stats = {
    total: rows.length,
    totalGB: Number((rows.reduce((sum, x) => sum + x.sizeMB, 0) / 1024).toFixed(2)),
    gpsTagged: rows.filter(x => x.gpsLatitude !== null && x.gpsLongitude !== null).length,
    byClassification: Object.fromEntries(
      [...new Set(rows.map(x => x.classification))].map(category => [
        category, rows.filter(x => x.classification === category).length
      ])
    ),
    byPlace: Object.fromEntries(
      [...new Set(rows.map(x => x.place))].map(place => [
        place, rows.filter(x => x.place === place).length
      ])
    )
  };
  const report = {
    schemaVersion: 1,
    sourceDirectory: directory,
    isRawSourceAudit: true,
    gpsExtractionAvailable: Boolean(exif),
    sourcePhotosModified: !readOnly,
    notice: "A 2:1 aspect ratio is not proof of spherical panorama. No physical route or camera pose is inferred. Reports may include precise GPS; keep them private.",
    stats,
    photos: rows
  };
  await fs.mkdir(outDir, { recursive: true });
  const jsonFile = join(outDir, "audit.json");
  const csvFile = join(outDir, "audit.csv");
  await fs.writeFile(jsonFile, JSON.stringify(report, null, 2) + "\n", "utf8");
  const headers = ["filename","place","sizeMB","width","height","aspectRatio","classification","gpanoEvidence","dateTime","gpsLatitude","gpsLongitude","gpsAltitude","absoluteAltitude","relativeAltitude","flightYaw","gimbalYaw","poseHeading"];
  await fs.writeFile(csvFile, [headers.join(","), ...rows.map(row => headers.map(h => csvCell(row[h])).join(","))].join("\n") + "\n", "utf8");

  console.log("JPEGs analyzed:", stats.total, "| Size:", stats.totalGB, "GB");
  console.log("ExifTool found:", Boolean(exif), "| GPS-tagged:", stats.gpsTagged);
  for (const [classification, count] of Object.entries(stats.byClassification)) {
    console.log(" -", classification + ":", count);
  }
  console.log("JSON:", jsonFile);
  console.log("CSV:", csvFile);
  console.log("No source photographs were modified or uploaded.");
  if (!exif) console.log("Tip: install ExifTool to include camera GPS / altitude / headings.");
}

main().catch((error) => {
  console.error("Audit failed:", error.message);
  process.exitCode = 1;
});
