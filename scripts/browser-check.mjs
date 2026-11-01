import { chromium, devices, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [],
  bad = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.url().startsWith("http://127.0.0.1:5173") && r.status() >= 400)
    bad.push([r.url(), r.status()]);
});
page.on("request", (r) => requests.push(r.url()));
await page.goto("http://127.0.0.1:5173/");
await page.locator("#loading").waitFor({ state: "hidden" });
await page.locator("#error").waitFor({ state: "hidden" });
assert.equal(await page.locator("canvas").count(), 1);
const initialPanos = requests.filter((u) =>
  /\/p-[a-f0-9]+(?:-mobile)?\.jpg/.test(u),
);
assert.equal(
  initialPanos.length,
  1,
  "initial load should request only current panorama",
);
await page.screenshot({ path: "reports/desktop-landing.png" });
await page.click("#enter");
await page.click("#fullscreen");
assert.ok(await page.evaluate(() => !!document.fullscreenElement));
await page.click("#fullscreen");
await page.mouse.move(800, 330);
await page.mouse.down();
await page.mouse.move(450, 360, { steps: 15 });
await page.mouse.up();
await page.click("#zoomIn");
await page.click("#zoomOut");
await page.mouse.move(700, 300);
await page.mouse.wheel(0, -200);
await page.click("#rotate");
assert.equal(
  await page.locator("#rotate").getAttribute("aria-pressed"),
  "true",
);
await page.click("#rotate");
// Place one test hotspot at the current center so its click is deterministic, then remove it.
await page.click("#calibrate");
await page.click("#aim");
await page.click("#closeEditor");
const before = page.url();
await page.locator(".step-marker button.calibrated").click();
await page.waitForURL((u) => u.href !== before);
await page.locator("#loading").waitFor({ state: "hidden" });
await page.click("#back");
await page.waitForURL(before);
await page.locator("#loading").waitFor({ state: "hidden" });
await page.click("#calibrate");
const download = page.waitForEvent("download");
await page.click("#export");
await (await download).saveAs("reports/test-calibration.json");
await page.click("#resetCalibration");
await page.locator("#import").setInputFiles("reports/test-calibration.json");
await expect(page.locator("#calibrationStatus")).toContainText("手动方向");
await page.click("#resetCalibration");
await page.click("#closeEditor");
await page.click("#explore");
assert.equal(await page.locator("#places button").count(), 31);
await page.getByRole("button", { name: "齐云山 · 6", exact: true }).click();
await page.locator("#loading").waitFor({ state: "hidden" });
assert.equal(await page.locator("#sceneTitle").textContent(), "齐云山");
await page
  .getByRole("button", { name: "切换到 齐云山 · 02", exact: true })
  .click();
await page.locator("#loading").waitFor({ state: "hidden" });
assert.match(await page.locator("#sceneIndex").textContent(), /02/);
await page.screenshot({ path: "reports/desktop-tour.png" });
await page.click("#explore");
await page.screenshot({ path: "reports/regional-map.png" });
await page.getByRole("button", { name: "关闭区域探索", exact: true }).click();
const mobile = await browser.newContext({
  ...devices["iPhone 13"],
  defaultBrowserType: undefined,
});
const phone = await mobile.newPage();
phone.on("pageerror", (e) => errors.push(e.message));
await phone.goto("http://127.0.0.1:5173/");
await phone.locator("#loading").waitFor({ state: "hidden" });
await phone.click("#enter");
assert.ok(await phone.locator("#next").isVisible());
assert.ok(
  await phone.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth,
  ),
);
await phone.screenshot({ path: "reports/mobile-tour.png" });
const cdp = await mobile.newCDPSession(phone);
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: 250, y: 250 }],
});
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [{ x: 100, y: 280 }],
});
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
await phone.click("#next");
await phone.locator("#loading").waitFor({ state: "hidden" });
await phone.click("#explore");
await phone.getByRole("button", { name: "碧山 · 6", exact: true }).click();
await phone.locator("#loading").waitFor({ state: "hidden" });
assert.equal(await phone.locator("#sceneTitle").textContent(), "碧山");
const manifest = await (
  await page.request.get("http://127.0.0.1:5173/generated/manifest.json")
).json();
for (const n of manifest.viewpoints)
  for (const key of ["panorama", "mobile", "thumbnail"])
    assert.equal(
      (await page.request.head("http://127.0.0.1:5173" + n[key])).status(),
      200,
    );
assert.deepEqual(errors, []);
assert.deepEqual(bad, []);
await fs.writeFile(
  "reports/browser-check.json",
  JSON.stringify(
    {
      passed: true,
      initialPanoramaRequests: initialPanos.length,
      errors,
      bad,
      checks: [
        "desktop real panorama",
        "drag",
        "zoom buttons and wheel",
        "fullscreen",
        "touch drag",
        "auto rotate toggle",
        "hotspot click",
        "history back",
        "calibration save/export/import/reset",
        "regional directory",
        "local scene switch",
        "map render",
        "iPhone viewport layout and navigation",
      ],
    },
    null,
    2,
  ),
);
await browser.close();
console.log("Browser checks passed");
