# Panorama Step Tour

**360° photos → spatially connected places → a navigable web experience.**

This is the standalone evolution of [Demo Gallery's Panorama Step Tour](https://github.com/willwangcc/demo-gallery/tree/main/demos/panorama-step-tour). It intentionally separates a reusable viewer/engine from real-world geographic datasets.

## Current MVP

- Interactive 360° equirectangular panoramas
- Multiple viewpoints connected by click-to-walk hotspots
- Drag/touch look-around, zoom, fullscreen, autorotation, scene transitions, route thumbnails
- Add 2–12 local panorama photos for an in-browser tour; place forward hotspots manually
- A two-scene curated sample from [Pannellum's tour](https://pannellum.org/documentation/examples/tour/)

**Boundary:** This is a connected multi-viewpoint *photo tour*, not photogrammetric 3D reconstruction. Sequential links are guesses until coordinates/bearings are reviewed.

## Development

Requires Node.js 20+.

```bash
npm install
npm run dev
npm run build
npm run preview
```

Vite produces `dist/`; configure a standalone Vercel project with the default Vite settings. The existing Demo Gallery remains untouched during extraction.

## The first dataset: Southern Anhui, October 2026

The planned source set contains 71 DJI JPEG files totaling ~4.9 GB. The **originals live locally and must not be committed to Git**. They cover 黟县火车站、碧山、南屏、宏村、屏山、卢村、塔川、木坑林海、齐云山 and additional sites. Some places (e.g. 齐云山) are outside 黟县, so the geographic umbrella is **Southern Anhui / 皖南**, not every file is physically in Yi County.

Before import:
1. **Audit real files:** width/height, EXIF GPS/altitude/camera heading, GPano/XMP, timestamps, thumbnails; do not infer 360° from `_D.JPG`.
2. **Classify:** ready-to-view 2:1 equirectangular panoramas, stitchable photo groups, ordinary aerial stills, unusable/ambiguous images.
3. **Optimize:** generate web-ready derivatives and thumbnails, preserve a manifest of original metadata and provenance; keep 4.9 GB originals outside Git.
4. **Organize:** region → place → viewpoint. Use a map for distant locations, and local **step connections only for physically adjacent viewpoints**.
5. **Deploy:** publish web images to a suitable asset host; set manifest URLs and deploy a separate Vercel project.
6. **Review:** manually verify bearings, north alignment, hotspot transitions and GPS privacy before publishing.

See `docs/architecture.md` for the production model and `data/README.md` for the manifest format.

## Open-source reference / attribution

The built-in two-image example is linked from the [Pannellum virtual tour example](https://pannellum.org/documentation/examples/tour/); photography credited to Matthew Petroff under CC BY-SA 3.0 as stated in the [Pannellum repository](https://github.com/mpetroff/pannellum#license). No example photo binary is checked into this repository. Pannellum's viewer library is MIT-licensed and loaded through its versioned CDN.

Uploads are browser-local Blob URLs; no server receives the user's files. Reloading discards the tour.

## Migration

Extracted from `willwangcc/demo-gallery/demos/panorama-step-tour` (original PR #29). The gallery version is preserved for compatibility until its own metadata can link to the standalone project.
