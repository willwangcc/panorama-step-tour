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

Production uses the explicit prebuilt release below; raw photographs are never uploaded. Multiresolution tiles and visually verified north calibration remain future improvements.

## High-resolution production release

Production media must remain **6144 × 3072 desktop / 4096 × 2048 mobile**. A deployment verifier rejects the former 3072px artifact and rejects desktop/mobile URLs pointing at the same file. The viewer selects one variant at startup, fetches only the current scene, and keeps the last four compressed JPEG blobs so preloading/rendering/revisiting share one download.

Hobby's 100 MB CLI upload limit is handled with Vercel Blob, not image downsampling. The existing derivatives are uploaded byte-for-byte under a content-derived prefix. The 142 panorama objects use ~335 MiB of Blob storage; 71 unchanged thumbnails ship with the static app. Hobby Blob includes 1 GB storage and 10 GB monthly transfer; exceeding free limits may make media unavailable until the quota resets. No paid plan is required by this workflow.

```sh
# Existing project must be southern-anhui. Credentials stay in ignored .env.local.
npx vercel project inspect --non-interactive
npx vercel env pull .env.local
npm run verify:media
npm run upload:media        # reuses unchanged objects, never reads the DJI originals
npm run check
npm run test:hd             # localhost server must be running
npm run build:production   # verify CDN objects, rebuild and validate .vercel/output
npx vercel deploy --prebuilt --prod
npm run verify:production
TOUR_URL=https://wannan-360.vercel.app npm run test:hd
```

`deployment/media.json` contains only the public CDN origin and content revision. The production builder copies existing thumbnails, strips local paths/EXIF audit fields from the Manifest and writes CDN rewrites for the existing `/generated/*.jpg` paths. Image URLs carry content hashes to invalidate the old blurry cache. The stable unversioned desktop URL still returns the full 6144px image. The deploy step does not run a second remote application build.

Git-triggered Vercel deployments are disabled in `vercel.json`: generated imagery is intentionally absent from Git, so production releases use the verified prebuilt pipeline above. GitHub's existing build check is unchanged.

Root cause: the previous manually prepared `.vercel/output` contained resized 3072px images and redirected mobile Manifest entries to those same files; neither the checked-in processing script nor Vite requested that downsampling. Checking HTTP status alone missed the quality regression. The new checks measure actual JPEG dimensions and compare production bytes to local source derivatives.
