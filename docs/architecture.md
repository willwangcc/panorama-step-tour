# Local panorama architecture

## Data flow

Read-only originals → `audit-photos.mjs` → ignored `reports/audit.json` → `process-photos.mjs` → ignored `public/generated/manifest.json` + media → static Vite app.

The audit checks JPEG dimensions and GPano projection evidence and invokes the npm-bundled ExifTool for GPS, time, altitude and XMP fields. Projection metadata is retained per image. Processing permits only verified full equirectangular images, preserves 2:1 dimensions, and records failures. Incremental cache keys include source size/mtime and processing recipe version.

## Spatial semantics

`src/lib/spatial.js` computes WGS84 great-circle distances and initial bearings. Each node considers at most three nearest nodes with the same filename-derived place label, horizontal distance 3–350 m and absolute altitude difference ≤100 m when available. The resulting **directed candidate edges** are spatial proximity evidence, not proof of an unobstructed flight or walk. Other viewpoints remain accessible through the regional directory and scene rail.

Yaw = geographic bearing − panorama north heading, wrapped to [-180,180). GPano PoseHeading, if available, is the preferred heading. This dataset lacks it: gimbal yaw is explicitly an unverified estimate, shown as dashed “待校准” hotspots. Pitch uses altitude difference / horizontal distance. GPS/altitude and headings are not fabricated. Unknown yaw means no positioned hotspot. All edges preserve review status.

Manual corrections store per-edge yaw/pitch with a manual review status. They do not certify the whole panorama's true north. Scene transitions preserve geographic heading only when both source/destination have trustworthy pose headings; otherwise they preserve relative view angle without claiming world alignment. Back follows visit history; regional jumps are separate from local neighbor navigation.

## Browser modules

- `src/main.js`: manifest loading, scene state/history, UI, bounded loading/error feedback, calibration persistence/export/import.
- `src/lib/viewer.js`: Pannellum scenes, hotspot callbacks, target preload with progress, fades. Only the active panorama is loaded; thumbnails use lazy loading. Desktop 6144px/mobile 4096px selection occurs at initialization.
- `src/lib/explorer.js`: Leaflet map with GPS markers, OSM attribution and tile-error fallback. Directory remains available if tiles fail.
- `src/style.css`: cinematic landscape-led layout, touch/mobile sizing, reduced-motion handling.

All runtime libraries are bundled locally; only map tiles require Internet. No backend, credentials, paid API or original-media URL is needed.

## Limits

Place labels come from filenames and explicit view-label aliases; they are not claimed to be independently verified administrative villages. The current dataset contains 48 places, 101 viewpoints and 101 directed candidate edges. Missing links are intentional when points exceed limits. First version uses optimized single-resolution images with small previews, not tiled multiresolution. Physical iPhone Safari and human visual calibration remain unverified.

Pannellum API reference: https://pannellum.org/documentation/api/

## HD release and cache regression guard

The former manual prebuilt output resized images to 3072 × 1536 and reused the desktop URL for mobile. The earlier Blob/prebuilt workflow uses `scripts/build-production.mjs` and `scripts/upload-media.mjs`: strict 6144/4096 dimension and metadata checks → byte-preserving content-addressed Blob upload → one static build with thumbnails and public-field-only Manifest → same-origin CDN rewrites → HTTP and browser JPEG verification. The 100 MB Hobby CLI upload cap applies to the small app package; no panorama resampling is part of deployment.

`src/lib/panorama-cache.js` keeps four compressed image blobs. The initial scene and requested destinations use one progress-reporting request each; Pannellum renders object URLs. Revisiting a retained scene causes no additional network request. Evicted scenes can still use browser HTTP caching, but a later visit may revalidate/download. The cache releases blobs at page exit. It retains no decoded panorama textures beyond the active viewer.

Public Manifest image URLs include byte-derived version queries to bypass cached 3072 artifacts. The stable desktop/mobile endpoints still return the intended full-resolution variants. Private audit/EXIF data stays local. The current default uses Git deployments and downloads pinned GitHub media during the build, as described below.

Production validation also caught a proxy cache hazard: forcing shared `s-maxage` on external image rewrites could cache a 206 Range response and return it to a subsequent full GET. Rewrites now bypass the intermediary shared cache while retaining browser caching and Blob's native CDN. The production verifier downloads full images and compares SHA-256, rather than treating a partial header response as a successful full resource.

## Portable GitHub-backed deployments (current default)

`deployment/github-media.json` pins ordered public GitHub Release bundles containing all 303 optimized JPEGs and a sanitized complete Manifest. `npm run build` and `npm run dev` first execute `scripts/ensure-media.mjs`. Existing verified media is reused; a fresh clone streams the archive to temporary disk, verifies its exact size and SHA-256, validates archive entry paths, extracts and checks every image dimension/hash, then installs `public/generated/` with the Manifest copied last. No secret, original photo directory or Blob store is needed.

A normal Vite build includes the entire 501.4 MiB dataset in `dist/`. The publish plugin retains the public content revision, versions media URLs and strips private fields. Each imported deployment hosts its own panorama files at the same origin. `vercel.json` enables Git deployments with `npm run build` and `dist` output. The optional original-author Blob/prebuilt scripts remain available but are not used by this default flow.

Media is distributed as a GitHub Release attachment rather than inflating code history. `scripts/package-media.mjs` packages only the allowlisted web derivatives and public Manifest; it never reads DJI originals. Publishing new media requires uploading its archive before committing the corresponding pinned download configuration. GitHub's existing source-check workflow skips the large download; the Vercel build provides the full deployment check.

Each archive uses ≤48 MiB transport parts, uploaded/downloaded in parallel. The base has seven parts; the November 2 addition has four. Each part and the reassembled archive have pinned SHA-256 checksums; extraction and all JPEG validation happen only after those checks pass. Fork owners do not need to merge anything manually.

## Incremental imports

`process-photos.mjs` upserts the current audit batch into the existing manifest by filename-derived ID. It preserves previous nodes, cached media, and existing edge records; explicit aliases in `data/import-place-aliases.json` group new viewpoints into places. GPS and altitude thresholds still govern links within each place, so distant or high-altitude views remain available via the scene rail without invented connections. All photo failures prevent publishing a partial manifest.

`package-media.mjs --tag TAG --base-manifest reports/before-import.json` verifies the retained base media revision, packages only new derivatives plus a complete public Manifest, and appends an immutable bundle to the download config. Setup applies base and incremental bundles in order, validates the final graph and exact dataset counts/revision, then copies the manifest last. A full package without `--base-manifest` can compact future batches.
