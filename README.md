# 皖南 · 空间漫游

Southern Anhui — A Spatial Journey. Real DJI aerial panoramas, built with Vite, Pannellum and Leaflet.

[Deploy to Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fwillwangcc%2Fpanorama-step-tour) · [Live experience](https://wannan-360.vercel.app) · [HD media on GitHub](https://github.com/willwangcc/panorama-step-tour/releases/tag/media-hd-v1)

## Deploy directly from this repository

Fork or import this repository into Vercel. No environment variables, Blob account, SD card or manual media upload is required.

- Framework: Vite.
- Install command: `npm ci`.
- Build command: `npm run build`.
- Output directory: `dist`.
- Node.js: 22 or newer; standard `tar` executable (available in Vercel builds).

The build downloads seven parts of the pinned public GitHub Release archive in parallel, combines them, verifies every part and the complete archive with SHA-256, and checks the dimensions of all 213 JPEGs, then includes the imagery in the static website. Each deployment serves its own media under `/generated/`; there is no runtime dependency on the original owner's Vercel Blob store. Git deployments are enabled.

The release contains 71 desktop panoramas at **6144 × 3072**, 71 mobile panoramas at **4096 × 2048**, 71 thumbnails at **480 × 240**, and a sanitized runtime Manifest. There are **31 places, 71 viewpoints and 85 directed spatial connections**. Extracted media totals **336.1 MiB**; the download is about **332.4 MiB**. First builds take longer while downloading. Verified local media is reused on subsequent runs.

The images are GitHub **Release assets**, rather than objects in Git history. This keeps cloning the code repository small while making the full-resolution dataset publicly available. `deployment/github-media.json` pins the part URLs and checksums, combined archive size, content revision and SHA-256. Forks intentionally use this public upstream release until their owner publishes another dataset and updates that file.

## Run locally

```sh
npm ci
npm run dev
```

The first run downloads the same public release automatically. Open the local URL printed by Vite. To prepare media separately:

```sh
npm run setup:media
npm run verify:media
npm run build
npm run preview
```

If the release cannot be downloaded or fails integrity checks, the build fails with an explicit error instead of publishing an empty tour or lower-resolution substitutes.

## Experience

- Panorama landing, regional GPS map and local scene rail.
- Mouse/touch rotation, wheel/button zoom, slow auto rotation and browser-dependent fullscreen.
- GPS-derived aerial neighbors. Dashed hotspots mark provisional directions; these are camera-location jumps, not ground walking routes.
- Direction editor with local persistence and calibration JSON export/import.
- The viewer downloads one desktop/mobile variant for the current scene. A four-entry compressed-blob cache avoids duplicate preload/render requests and downloads on retained-scene revisits.
- Hash URLs identify viewpoints. Back follows visit history; nearest advances to a qualifying neighboring viewpoint.
- OSM map tiles need Internet. All panorama media is served by the deployed website itself.

All photographs have GPS, but no reliable GPano north heading. Gimbal yaw remains an explicitly unverified estimate. Place names are derived from filenames, including nearby sublocations. Multi-resolution tiles and visually verified north calibration remain future improvements.

## Author-only original-media pipeline

Original SD-card files are read-only and are never included in the release. The public deployment archive contains optimized derivatives only, with EXIF and local source paths excluded.

```sh
npm run audit:photos -- "/Volumes/EOS_DIGITAL/黟县"
npm run process:photos
npm run package:media
```

The audit JSON/CSV and private processing metadata stay in ignored `reports/`. Local derivatives, incremental cache and manifests stay in ignored `public/generated/`. `package:media` creates a sanitized archive, seven transport parts and checksum in `reports/github-media/`; publish them to the matching GitHub Release before pushing a changed download configuration.

Processing preserves the 2:1 projection, uses bounded Sharp memory/concurrency and reuses successful outputs for unchanged originals. Unknown projections are recorded without stretching them into false spheres. macOS resource forks are excluded.

The earlier `upload:media`, `build:production` and `deploy:production` commands retain the original author's optional Blob/prebuilt workflow. They are **not required** for repository imports; a normal `npm run build` produces a fully self-contained static site from the GitHub release. Hobby's CLI source-upload limit is avoided when importing Git and downloading assets during the build.

## Verify

```sh
npm run test
npm run check
npm run verify:media
# Local dev server must be running; requires Google Chrome:
npm run test:hd
# Check your own deployment:
TOUR_URL=https://your-site.vercel.app npm run verify:production
TOUR_URL=https://your-site.vercel.app npm run test:hd
```

Checks measure actual JPEG dimensions, metadata stripping, scene navigation, desktop/mobile resource selection, cache reuse and uncaught browser errors. Production verification compares full response hashes with the local derivatives. Mobile tests use Chromium iPhone emulation, not physical iPhone Safari.

The existing GitHub workflow checks source and unit tests without repeatedly downloading the large media release. Vercel performs the complete media-backed deployment build.
