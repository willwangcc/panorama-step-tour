// Verify every viewpoint from a capture day through the actual regional / scene UI.
import { chromium, devices, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import sharp from "sharp";
import { parseArgs } from "node:util";
const { values } = parseArgs({ options: { date: { type: "string" } } });
assert.match(
  values.date || "",
  /^\d{4}:\d{2}:\d{2}$/,
  "Pass --date YYYY:MM:DD",
);
const base = process.env.TOUR_URL || "http://127.0.0.1:5173";
const manifest = await (await fetch(`${base}/generated/manifest.json`)).json();
const nodes = manifest.viewpoints.filter((n) =>
  n.date?.startsWith(values.date),
);
assert.ok(nodes.length, "No viewpoints on requested capture date");
const places = manifest.places.filter((p) =>
  nodes.some((n) => n.placeId === p.id),
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  bad = [],
  results = [];
const tag = base.startsWith("http://127.") ? "local" : "production";
await fs.mkdir("reports/import-20261102", { recursive: true });
async function ready(page) {
  await expect(page.locator("#loading")).toBeHidden({ timeout: 60000 });
  await expect(page.locator("#error")).toBeHidden();
  await expect(page.locator("canvas")).toBeVisible();
}
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext(
      mobile
        ? devices["iPhone 13"]
        : { viewport: { width: 1440, height: 900 } },
    );
    const page = await context.newPage(),
      pending = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("request", (r) => {
      if (/\/generated\/p-[a-f0-9]+(?:-mobile)?\.jpg(?:\?|$)/.test(r.url()))
        requests.push(r.url());
    });
    page.on("response", (r) => {
      if (r.url().startsWith(base) && r.status() >= 400)
        bad.push({ url: r.url(), status: r.status() });
      if (/\/generated\/p-[a-f0-9]+(?:-mobile)?\.jpg(?:\?|$)/.test(r.url()))
        pending.push(
          (async () => {
            const bytes = await r.body(),
              meta = await sharp(bytes).metadata();
            assert.equal(r.status(), 200);
            assert.deepEqual(
              [meta.width, meta.height],
              mobile ? [4096, 2048] : [6144, 3072],
            );
            assert.equal(r.url().includes("-mobile.jpg"), mobile);
          })(),
        );
    });
    await page.goto(`${base}/#${nodes[0].id}`);
    await ready(page);
    assert.equal(requests.length, 1);
    await page.click("#enter");
    const selected = mobile
      ? places.filter((p) => p.viewpoints.length > 1).slice(0, 2)
      : places;
    let visited = 0;
    for (const place of selected) {
      await page.click("#explore");
      assert.equal(
        await page.locator("#places button").count(),
        manifest.places.length,
      );
      await page
        .locator("#places")
        .getByRole("button", {
          name: `探索${place.name}`,
          exact: true,
        })
        .click();
      await ready(page);
      await expect(page.locator("#sceneTitle")).toHaveText(place.name);
      for (const id of place.viewpoints) {
        const node = manifest.viewpoints.find((n) => n.id === id);
        await page
          .getByRole("button", { name: `切换到 ${node.title}`, exact: true })
          .click();
        await ready(page);
        assert.equal(new URL(page.url()).hash, `#${id}`);
        visited++;
      }
      if (visited <= 4)
        await page.screenshot({
          path: `reports/import-20261102/${tag}-${mobile ? "mobile" : "desktop"}-${place.id}.png`,
        });
    }
    await Promise.all(pending);
    results.push({
      mobile,
      places: selected.length,
      viewpoints: visited,
      requests: requests.length,
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(bad, []);
  const report = {
    base,
    date: values.date,
    passed: true,
    results,
    errors,
    bad,
  };
  await fs.writeFile(
    `reports/import-20261102/${tag}-browser.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
