// Place-level recommendations are independent of GPS aerial-viewpoint edges.
// Prefer a small curated journey; fall back to the manifest's stable place order.
export const curatedJourney = ["hongcun", "bishan", "pingshan", "qiyunshan"];

export function orderedPlaces(places) {
  const rank = new Map(curatedJourney.map((id, index) => [id, index]));
  return places.filter(p => p.viewpoints?.length).slice().sort((a, b) =>
    (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) ||
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
