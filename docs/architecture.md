# Local panorama architecture

## Data flow

Read-only originals → `audit-photos.mjs` → ignored `reports/audit.json` → `process-photos.mjs` → ignored `public/generated/manifest.json` + media → static Vite app.

The audit checks JPEG dimensions and GPano projection evidence and invokes the npm-bundled ExifTool for GPS, time, altitude and XMP fields. Projection metadata is retained per image. Processing permits only verified full equirectangular images, preserves 2:1 dimensions, and records failures. Incremental cache keys include source size/mtime and processing recipe version.

## Spatial semantics

`src/lib/spatial.js` computes WGS84 great-circle distances and initial bearings. Each node considers at most three nearest nodes with the same filename-derived place label, horizontal distance 3–350 m and absolute altitude difference ≤100 m when available. The resulting 85 **directed candidate edges** are spatial proximity evidence, not proof of an unobstructed flight or walk. Other viewpoints remain accessible through the regional directory and scene rail.

Yaw = geographic bearing − panorama north heading, wrapped to [-180,180). GPano PoseHeading, if available, is the preferred heading. This dataset lacks it: gimbal yaw is explicitly an unverified estimate, shown as dashed “待校准” hotspots. Pitch uses altitude difference / horizontal distance. GPS/altitude and headings are not fabricated. Unknown yaw means no positioned hotspot. All edges preserve review status.

Manual corrections store per-edge yaw/pitch with a manual review status. They do not certify the whole panorama's true north. Scene transitions preserve geographic heading only when both source/destination have trustworthy pose headings; otherwise they preserve relative view angle without claiming world alignment. Back follows visit history; regional jumps are separate from local neighbor navigation.

## Browser modules

- `src/main.js`: manifest loading, scene state/history, UI, bounded loading/error feedback, calibration persistence/export/import.
- `src/lib/viewer.js`: Pannellum scenes, hotspot callbacks, target preload with progress, fades. Only the active panorama is loaded; thumbnails use lazy loading. Desktop 6144px/mobile 4096px selection occurs at initialization.
- `src/lib/explorer.js`: Leaflet map with GPS markers, OSM attribution and tile-error fallback. Directory remains available if tiles fail.
- `src/style.css`: cinematic landscape-led layout, touch/mobile sizing, reduced-motion handling.

All runtime libraries are bundled locally; only map tiles require Internet. No backend, credentials, paid API or original-media URL is needed.

## Limits

31 place labels come from filenames and include nearby sublocations; they are not claimed to be 31 independently verified administrative villages. Missing links are intentional when points exceed limits. First version uses optimized single-resolution images with small previews, not tiled multiresolution. Physical iPhone Safari and human visual calibration remain unverified.

Pannellum API reference: https://pannellum.org/documentation/api/

## HD release and cache regression guard

The former manual prebuilt output resized images to 3072 × 1536 and reused the desktop URL for mobile. Production now uses `scripts/build-production.mjs` and `scripts/upload-media.mjs`: strict 6144/4096 dimension and metadata checks → byte-preserving content-addressed Blob upload → one static build with thumbnails and public-field-only Manifest → same-origin CDN rewrites → HTTP and browser JPEG verification. The 100 MB Hobby CLI upload cap applies to the small app package; no panorama resampling is part of deployment.

`src/lib/panorama-cache.js` keeps four compressed image blobs. The initial scene and requested destinations use one progress-reporting request each; Pannellum renders object URLs. Revisiting a retained scene causes no additional network request. Evicted scenes can still use browser HTTP caching, but a later visit may revalidate/download. The cache releases blobs at page exit. It retains no decoded panorama textures beyond the active viewer.

Public Manifest image URLs include byte-derived version queries to bypass cached 3072 artifacts. The stable desktop/mobile endpoints still return the intended full-resolution variants. The 31 place records and 85 edge records are copied without changes; private audit/EXIF data stays local. Git deployment is disabled because Git intentionally contains no generated photographs; use the explicit prebuilt production command.
