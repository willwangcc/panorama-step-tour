import { inspectMedia } from "./lib/media.mjs";
const { source, files, totalBytes, revision } = await inspectMedia(
  process.argv[2] || "public",
);
console.log(
  JSON.stringify(
    {
      places: source.places.length,
      panoramas: source.viewpoints.length,
      edges: source.edges.length,
      resources: files.length,
      totalBytes,
      MiB: Math.round((totalBytes / 1048576) * 10) / 10,
      revision,
      dimensions: {
        desktop: "6144x3072",
        mobile: "4096x2048",
        thumbnail: "480x240",
      },
    },
    null,
    2,
  ),
);
