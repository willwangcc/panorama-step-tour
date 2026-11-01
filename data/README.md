# Dataset contract

**Content lives separately from the viewer.** The first project is `southern-anhui-2026`, not a hardcoded Yi County-only tour.

The dataset should contain:
- `places`: one per geographic site (name, optional centroid, short description);
- `viewpoints`: unique pano IDs, place IDs, optimized panorama URL, optional GPS/altitude/heading, provenance, preview thumbnail, source photograph ID;
- `edges`: explicitly approved source/destination viewpoint IDs, yaw and pitch hotspot direction, optional distance and transition label.

**Rules:** A hotspot only means a physically plausible step if images show adjacent vantage points and the route was inspected. File capture order and photo name are insufficient. Distant places belong to the regional place index.

Sample manifest in `southern-anhui-2026.example.json` is documentation only, not real verified data. No local photograph, camera pose or geographic coordinate has been supplied to the repository yet.
