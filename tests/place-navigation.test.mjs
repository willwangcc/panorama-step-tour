import test from "node:test";
import assert from "node:assert/strict";
import { orderedPlaces, featuredPlaces, nextPlace } from "../src/lib/place-navigation.js";

// IDs mirror the release manifest: curated names must work with opaque generated place IDs.
const places = [
  { id: "place-1f22d583", name: "黟县火车站", viewpoints: ["station"] },
  { id: "place-3b2d8e24", name: "碧山", viewpoints: ["bishan"] },
  { id: "place-27116f69", name: "南屏", viewpoints: ["nanping"] },
  { id: "place-4739f4b3", name: "宏村", viewpoints: ["hongcun"] },
  { id: "place-f6f3bf8a", name: "屏山", viewpoints: ["pingshan"] },
  { id: "place-4a090d84", name: "齐云山", viewpoints: ["qiyunshan"] },
  { id: "empty", name: "Empty", viewpoints: [] },
];
test("featured places use real manifest names, not generated IDs", () => {
  assert.deepEqual(featuredPlaces(places).map(p => p.name), ["宏村", "碧山", "屏山"]);
  assert.deepEqual(orderedPlaces(places).map(p => p.name), [
    "宏村", "碧山", "屏山", "齐云山", "黟县火车站", "南屏",
  ]);
});
test("next place follows curated ordering, wraps, and handles missing/singleton", () => {
  assert.equal(nextPlace(places, "place-4739f4b3").name, "碧山");
  assert.equal(nextPlace(places, "place-3b2d8e24").name, "屏山");
  assert.equal(nextPlace(places, "place-4a090d84").name, "黟县火车站");
  assert.equal(nextPlace(places, "place-27116f69").name, "宏村");
  assert.equal(nextPlace(places, "unknown").name, "宏村");
  assert.equal(nextPlace([{id:"one",name:"One",viewpoints:["v"]}], "one"), null);
  assert.equal(nextPlace([], "one"), null);
});
test("no curated names: preserve manifest order without changing viewpoint IDs", () => {
  const unmatched = [
    { id: "opaque-1", name: "甲", viewpoints: ["vp-1"] },
    { id: "opaque-2", name: "乙", viewpoints: ["vp-2"] },
  ];
  assert.deepEqual(orderedPlaces(unmatched).map(p => p.id), ["opaque-1", "opaque-2"]);
  assert.equal(nextPlace(unmatched, "opaque-1").viewpoints[0], "vp-2");
});
