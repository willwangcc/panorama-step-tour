# Generated manifest contract

The live dataset is local-only at `public/generated/manifest.json` (ignored by Git). `southern-anhui-2026.example.json` is an older illustrative schema, not runtime data.

Schema version 1:
- `places`: stable IDs, filename-derived names, member viewpoint IDs, GPS centroid when available.
- `viewpoints`: stable source-filename hash ID, place ID, title/date, desktop/mobile/thumbnail URLs, GPS, altitude, heading, unverified gimbal heading estimate, original audit metadata.
- `edges`: stable directed source/target ID, distance, geographic bearing, provisional yaw/pitch, confidence, review status and aerial-neighbor type.
- `policy`: thresholds and heading/original-source interpretation.
- `failures`: excluded or failed media with explicit reasons.

Calibration interchange: `{ "schemaVersion": 1, "corrections": { "FROM--TO": { "yaw": 0, "pitch": -10, "reviewStatus": "manually-calibrated" } } }`. Import validates existing edge IDs and finite bounded angles. Local changes do not mutate originals or generated manifest.
