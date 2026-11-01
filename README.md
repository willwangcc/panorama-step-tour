# 皖南 · 空间漫游

Southern Anhui — A Spatial Journey. Local-first, real DJI 360° aerial photography, built with Vite, Pannellum and Leaflet. Original SD-card files are read-only and never served or uploaded.

## Run locally

```sh
npm ci
npm run audit:photos -- "/Volumes/EOS_DIGITAL/黟县"
npm run process:photos
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:5173/. Generated media stays usable after ejecting the SD card. Default audit source is the directory above. All scripts run from the repository root.

## Experience

- Full-screen real panorama landing, then a minimal local scene rail.
- Drag / touch rotation, wheel and button zoom, slow auto rotation and fullscreen (browser-dependent on iOS).
- Regional GPS map and 31-place directory. Map tiles need Internet; the directory and imagery run locally.
- GPS-derived aerial neighbors; dashed hotspots explicitly indicate provisional directions. These are camera-location jumps, not ground walking routes or reconstructed 3D movement.
- Direction editor: rotate until a destination is in the center, choose the connection, save. Local storage persists calibration; export/import JSON transfers it. Test calibrations are cleared by the automated test.
- Hash URLs identify viewpoints. Back returns through visited scenes, nearest advances to the closest qualifying viewpoint.

## Media

The audited dataset contains 71 GPano-tagged full equirectangular JPEGs, 71 GPS positions, and 31 filename-derived place labels. No reliable GPano north heading exists. Gimbal yaw is preserved only as an **unverified estimate**. Source files total 4.57 GiB; 213 derivatives total approximately 336 MiB.

`reports/` contains the local audit JSON/CSV, processing logs, browser report and screenshots. `public/generated/` contains the manifest, cache and JPEGs. Both directories are ignored by Git. A fresh clone must run the pipeline before the viewer can load.

Processing is serial with bounded Sharp cache/concurrency. Each original produces 6144px and 4096px wide 2:1 JPEGs plus a 480px thumbnail. EXIF is stripped from derivatives; metadata stays in the local manifest. Completed results are reused when filename, size, mtime and pipeline version match. Partial output is written to `.tmp` and renamed only after successful encoding. Failed/unknown projections are recorded, never stretched to fake a sphere. macOS `._` resource forks are excluded.

## Verify

```sh
npm run check
npm run verify:media
# Start the dev server first; requires installed Google Chrome:
npm run test:browser
```

Browser checks cover actual imagery, hotspot navigation, drag/zoom, fullscreen, calibration round-trip, regional/local switching, mobile viewport/touch, no initial eager panorama fetch, all 213 image URLs and uncaught JS errors. Mobile testing uses Chromium iPhone emulation, not physical iPhone Safari.

No deployment or raw-photo upload is part of this project setup. Multiresolution tiles and visually verified north calibration remain future improvements.
