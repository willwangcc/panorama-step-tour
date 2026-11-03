// Place-level recommendations are independent of GPS aerial-viewpoint edges.
// Prefer a small curated journey; fall back to the manifest's stable place order.
// Match stable display names; runtime IDs are generated from photo metadata.
export const curatedJourney = ["宏村", "碧山", "屏山", "齐云山"];

export function orderedPlaces(places) {
  const rank = new Map(curatedJourney.map((name, index) => [name, index]));
  return places.filter(p => p.viewpoints?.length).slice().sort((a, b) =>
    (rank.get(a.name) ?? Infinity) - (rank.get(b.name) ?? Infinity) ||
    places.indexOf(a) - places.indexOf(b));
}

export function featuredPlaces(places, limit = 3) {
  return orderedPlaces(places).slice(0, limit);
}

export function nextPlace(places, currentId) {
  const ordered = orderedPlaces(places);
  if (ordered.length < 2) return null;
  const index = ordered.findIndex(p => p.id === currentId);
  if (index < 0) return ordered[0];
  return ordered[(index + 1) % ordered.length];
}
