import L from "leaflet";
import "leaflet/dist/leaflet.css";
export function createExplorer(manifest, onSelect) {
  const map = L.map("map", { scrollWheelZoom: false });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
    .on(
      "tileerror",
      () =>
        (document.getElementById("mapStatus").textContent =
          "底图暂不可用；GPS 点位和下方地点目录仍可使用。"),
    )
    .addTo(map);
  const points = [];
  for (const p of manifest.places) {
    if (!p.gps) continue;
    const ll = [p.gps.lat, p.gps.lon];
    points.push(ll);
    L.circleMarker(ll, {
      radius: 7,
      color: "#f7f1dd",
      weight: 2,
      fillColor: "#526d50",
      fillOpacity: 1,
    })
      .addTo(map)
      .bindTooltip(`${p.name} · ${p.viewpoints.length} 个视角`)
      .on("click", () => onSelect(p.viewpoints[0]));
  }
  if (points.length) map.fitBounds(points, { padding: [30, 30] });
  else map.setView([29.94, 117.94], 10);
  return () => {
    map.invalidateSize();
    if (points.length) map.fitBounds(points, { padding: [30, 30] });
  };
}
