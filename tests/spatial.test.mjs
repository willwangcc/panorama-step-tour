import test from "node:test";
import assert from "node:assert/strict";
import { distance, bearing, buildEdges, wrap } from "../src/lib/spatial.js";
test("geographic bearing and wrap convention", () => {
  assert.equal(bearing({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }), 0);
  assert.equal(bearing({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }), 90);
  assert.equal(wrap(350), -10);
  assert.ok(
    Math.abs(distance({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 111195) < 1,
  );
});
test("exclude remote, different place, missing GPS and excessive altitude edges", () => {
  const a = {
    id: "a",
    placeId: "p",
    gps: { lat: 30, lon: 118 },
    altitude: 200,
    heading: null,
    headingEstimate: 90,
  };
  const near = { ...a, id: "near", gps: { lat: 30, lon: 118.001 } };
  const nodes = [
    a,
    near,
    { ...near, id: "other", placeId: "other" },
    { ...near, id: "high", altitude: 500 },
    { ...a, id: "far", gps: { lat: 31, lon: 118 } },
    { ...a, id: "missing", gps: null },
  ];
  const edges = buildEdges(nodes).filter((e) => e.from === "a");
  assert.equal(edges.length, 1);
  assert.equal(edges[0].to, "near");
  assert.equal(edges[0].reviewStatus, "direction-needs-calibration");
  assert.ok(Math.abs(edges[0].yaw) < 1);
});
