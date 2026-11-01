# Architecture — Southern Anhui spatial walk

## North star

```text
Local DJI originals (4.9 GB; 71 JPGs)
  └─ Audit: photo type, panorama projection, width/height, GPS, altitude, heading, time
      ├─ Full equirectangular 360° → panorama node
      ├─ Stitchable shot sequence → stitch/review → panorama node
      └─ Ordinary aerial photograph → map gallery / location thumbnail (NOT fake 360°)
          └─ Optimize to web variants + thumbnails
              └─ Geographic tour manifest
                  ├─ Regional map → Places (macro jumps)
                  └─ Place graph → Nearby viewpoints (step navigation)
                      └─ Vite / Pannellum viewer → Vercel
```

## Roles, mental models and acceptance gates

- **Spatial media engineer (photogrammetry):** correct camera model and projection before rendering. GPS is a location clue, **not** a reconstructed 3D point cloud.
- **GIS/geospatial engineer:** graph nodes are camera centers, not generic place names; use GPS/altitude/bearings where available, never invent precise edges.
- **Graphics/frontend engineer:** view transforms, smooth transitions, pano tile levels, touch controls, robustness; Pannellum is suitable for 360° waypoint tours.
- **Media pipeline engineer:** content audit → web derivatives → CDNs/object storage → integrity and bandwidth; avoid pushing raw 4.9 GB into Git or assuming 71 huge files are cheap to serve.
- **Experience designer:** region → place → viewpoint, map for distant jumps and ground/air waypoint arrows only for genuinely adjacent views.

## Distinguish three different things

| Mode | Input | Viewer | Navigation |
|---|---|---|---|
| Map + aerial stills | Ordinary JPG | Image cards or geolocated pins | Switch locations, not 360° |
| Connected 360° panoramas | Complete 2:1 equirectangular images | Pannellum | Turn head/camera in place; click nearby viewpoint |
| Photogrammetric free-flight | Dense overlapping multi-view shots / calibrated capture | Three.js / splats / mesh | Free movement with actual parallax |

**Do not label distant-place slideshow navigation as physical step-by-step movement.** The first real production experience should have both regional place navigation and local within-place step routes.

## Recommended repository layout

```text
panorama-step-tour/
├── index.html
├── src/
│   ├── main.js                    # extracted proof-of-concept viewer
│   └── style.css
├── data/
│   ├── README.md                  # manifest contract
│   └── southern-anhui-2026.example.json
├── docs/
│   └── architecture.md
├── scripts/                       # future asset audit + processing commands
├── .github/workflows/ci.yml
└── package.json
```

**Later** extract viewer functions into `src/viewer/`, add `src/data/` and `src/components/`. Avoid refactoring before source photo classification proves the need.

## Data ingestion contract (next phase)

1. Local Codex inspects **actual** photos with ExifTool / image metadata tools.
2. Persist audit JSON with filename, 2D dimensions, file size, GPS lat/lon, altitude, heading, timestamp and GPano tags. Keep exact GPS reports local until publication consent.
3. Group by site and distance/heading; require user review to confirm accurate movement directions. Timestamp order is **not** spatial adjacency.
4. Generate 2K–8K optimized panoramas (ideally multires tiles), JPEG/WebP thumbnails and checksum manifest. If images are large, host them on Vercel Blob / R2 / an image CDN, not in Git.
5. Create `data/southern-anhui-2026.json` with places, viewpoint URLs, coordinates and validated edges.
6. Validate: 360° seam, sky/nadir, true north, neighbor arrows, direct URL refresh, load speed on mobile, GPS/privacy.
7. Deploy standalone Vercel site from `willwangcc/panorama-step-tour`.

## Explicit v1 success criteria

- A location selector covers the real itinerary, even if some places only have ordinary photos.
- At least one place offers **two or more real, nearby 360° vantage points** with correct forward/back links.
- User can drag, rotate and switch viewpoints on desktop and mobile.
- Shared link works without access to user's original 4.9 GB folder.
- Raw assets are not committed; attribution and spatial accuracy are checked.
