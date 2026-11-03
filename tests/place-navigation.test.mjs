import test from "node:test";
import assert from "node:assert/strict";
import { orderedPlaces, featuredPlaces, nextPlace } from "../src/lib/place-navigation.js";
const places = [
  { id: "other", name: "Other", viewpoints: ["o"] },
  { id: "bishan", name: "碧山", viewpoints: ["b"] },
  { id: "empty", name: "Empty", viewpoints: [] },
  { id: "hongcun", name: "宏村", viewpoints: ["h"] },
  { id: "pingshan", name: "屏山", viewpoints: ["p"] },
];
test("featured places prioritize curated journey and omit empty places", () => {
  assert.deepEqual(featuredPlaces(places).map(p => p.id), ["hongcun", "bishan", "pingshan"]);
  assert.deepEqual(orderedPlaces(places).map(p => p.id), ["hongcun", "bishan", "pingshan", "other"]);
});
test("next place navigates across places, wraps, and handles missing or singleton", () => {
  assert.equal(nextPlace(places, "hongcun").id, "bishan");
  assert.equal(nextPlace(places, "other").id, "hongcun");
  assert.equal(nextPlace(places, "unknown").id, "hongcun");
  assert.equal(nextPlace([{id:"one",viewpoints:["v"]}], "one"), null);
  assert.equal(nextPlace([], "one"), null);
});
