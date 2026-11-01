export const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const rad = (x) => (x * Math.PI) / 180;
export function distance(a, b) {
  const dlat = rad(b.lat - a.lat),
    dlon = rad(b.lon - a.lon);
  return (
    6371000 *
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin(dlat / 2) ** 2 +
            Math.cos(rad(a.lat)) *
              Math.cos(rad(b.lat)) *
              Math.sin(dlon / 2) ** 2,
        ),
      ),
    )
  );
}
export function bearing(a, b) {
  const d = rad(b.lon - a.lon),
    x = Math.sin(d) * Math.cos(rad(b.lat));
  const y =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(d);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}
export function buildEdges(nodes) {
  const edges = [];
  for (const a of nodes) {
    const candidates = nodes
      .filter((b) => b.id !== a.id && b.placeId === a.placeId && a.gps && b.gps)
      .map((b) => ({ b, d: distance(a.gps, b.gps) }))
      .filter(
        ({ b, d }) =>
          d >= 3 &&
          d <= 350 &&
          (!(Number.isFinite(a.altitude) && Number.isFinite(b.altitude)) ||
            Math.abs(a.altitude - b.altitude) <= 100),
      )
      .sort((x, y) => x.d - y.d)
      .slice(0, 3);
    for (const { b, d } of candidates) {
      const azimuth = bearing(a.gps, b.gps);
      const heading = a.heading ?? a.headingEstimate;
      edges.push({
        id: `${a.id}--${b.id}`,
        from: a.id,
        to: b.id,
        distance: Math.round(d),
        bearing: azimuth,
        yaw: heading == null ? null : wrap(azimuth - heading),
        pitch:
          Number.isFinite(a.altitude) && Number.isFinite(b.altitude)
            ? (Math.atan2(b.altitude - a.altitude, d) * 180) / Math.PI
            : -8,
        confidence: "gps-proximity",
        reviewStatus:
          a.heading == null
            ? "direction-needs-calibration"
            : "metadata-direction-needs-review",
        kind: "aerial-neighbor",
        note: "GPS 邻近空中拍摄点，并非地面步行路线；方向需视觉核验。",
      });
    }
  }
  return edges;
}
