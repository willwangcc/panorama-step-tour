import { chromium, devices, expect } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import sharp from "sharp";
const base = process.env.TOUR_URL || "http://127.0.0.1:5173";
const tag = base.startsWith("http://127.") ? "local" : "production";
const first = "p-6c8a6232e020";
const reportDir = "reports/hd";
await fs.mkdir(reportDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [],
  bad = [],
  checks = [];
function observe(page) {
  const requests = [],
    images = [],
    pending = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error")
      errors.push({ message: m.text(), location: m.location() });
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
          const b = await r.body(),
            m = await sharp(b).metadata();
          images.push({
            url: r.url(),
            status: r.status(),
            width: m.width,
            height: m.height,
            bytes: b.length,
            sha256: createHash("sha256").update(b).digest("hex"),
          });
        })(),
      );
  });
  return { requests, images, pending };
}
async function ready(page) {
  await expect(page.locator("#loading")).toBeHidden({ timeout: 60000 });
  await expect(page.locator("#error")).toBeHidden();
  await expect(page.locator("canvas")).toBeVisible();
}
try {
  const desktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    }),
    page = await desktop.newPage(),
    d = observe(page);
  await page.goto(`${base}/#${first}`);
  await ready(page);
  await Promise.all(d.pending);
  assert.equal(
    d.requests.length,
    1,
    "Desktop initial load must fetch exactly one panorama",
  );
  assert.deepEqual([d.images[0].width, d.images[0].height], [6144, 3072]);
  assert.ok(!d.requests.some((u) => u.includes("-mobile.jpg")));
  await page.click("#enter");
  // Identical 64-degree field of view for the before / after screenshots.
  for (let i = 0; i < 3; i++) await page.click("#zoomIn");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${reportDir}/${tag}-desktop-hd.png` });
  await page.mouse.move(850, 330);
  await page.mouse.down();
  await page.mouse.move(500, 365, { steps: 12 });
  await page.mouse.up();
  await page.click("#zoomOut");
  await page.mouse.wheel(0, -100);
  await page.click("#rotate");
  assert.equal(
    await page.locator("#rotate").getAttribute("aria-pressed"),
    "true",
  );
  await page.click("#rotate");
  await page.click("#explore");
  await page.getByRole("button", { name: "宏村 · 6", exact: true }).click();
  await ready(page);
  await page
    .getByRole("button", { name: "切换到 宏村 · 02", exact: true })
    .click();
  await ready(page);
  const secondRequests = d.requests.length;
  await page.click("#next");
  await ready(page);
  const afterNext = d.requests.length;
  await page.click("#back");
  await ready(page);
  assert.equal(
    d.requests.length,
    afterNext,
    "Cached scene must not download again",
  );
  assert.ok(
    afterNext <= secondRequests + 1,
    "A scene switch must fetch at most one panorama",
  );
  await page.click("#calibrate");
  await page.click("#aim");
  await page.click("#closeEditor");
  const before = page.url();
  await page.locator(".step-marker button.calibrated").click();
  await page.waitForURL((u) => u.href !== before);
  await ready(page);
  await page.click("#back");
  await ready(page);
  await page.click("#calibrate");
  await page.click("#resetCalibration");
  await page.click("#closeEditor");
  await Promise.all(d.pending);
  assert.ok(d.images.every((i) => i.width === 6144 && i.height === 3072));
  const mobile = await browser.newContext({ ...devices["iPhone 13"] }),
    phone = await mobile.newPage(),
    m = observe(phone);
  await phone.goto(`${base}/#${first}`);
  await ready(phone);
  await Promise.all(m.pending);
  assert.equal(
    m.requests.length,
    1,
    "Mobile initial load must fetch exactly one panorama",
  );
  assert.deepEqual([m.images[0].width, m.images[0].height], [4096, 2048]);
  assert.ok(m.requests.every((u) => u.includes("-mobile.jpg")));
  await phone.click("#enter");
  await phone.screenshot({ path: `${reportDir}/${tag}-mobile-hd.png` });
  const cdp = await mobile.newCDPSession(phone);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 250, y: 250 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 110, y: 280 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await phone.click("#explore");
  await phone.getByRole("button", { name: "碧山 · 6", exact: true }).click();
  await ready(phone);
  await phone
    .getByRole("button", { name: "切换到 碧山 · 02", exact: true })
    .click();
  await ready(phone);
  await Promise.all(m.pending);
  assert.ok(m.images.every((i) => i.width === 4096 && i.height === 2048));
  assert.ok(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  if (
    tag === "local" &&
    (await fs.access(`${reportDir}/wannan-360.vercel.app-before.jpg`).then(
      () => true,
      () => false,
    ))
  ) {
    const oldPage = await desktop.newPage();
    await oldPage.route(`**/generated/${first}.jpg*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        path: `${reportDir}/wannan-360.vercel.app-before.jpg`,
      }),
    );
    await oldPage.goto(`${base}/#${first}`);
    await ready(oldPage);
    await oldPage.click("#enter");
    for (let i = 0; i < 3; i++) await oldPage.click("#zoomIn");
    await oldPage.waitForTimeout(700);
    await oldPage.screenshot({ path: `${reportDir}/desktop-3072-before.png` });
  }
  await fs.writeFile(
    `${reportDir}/${tag}-browser-errors.json`,
    JSON.stringify({ errors, bad }, null, 2),
  );
  assert.deepEqual(errors, [], "Browser console/page errors");
  assert.deepEqual(bad, [], "Failed site requests");
  checks.push(
    "desktop actual JPEG 6144x3072",
    "mobile actual JPEG 4096x2048",
    "one initial panorama per device",
    "no desktop/mobile double fetch",
    "drag/zoom/rotation",
    "regional and local scene switches",
    "hotspot navigation",
    "cached revisit without network request",
    "mobile touch and responsive layout",
    "no console errors",
  );
  const report = {
    base,
    passed: true,
    desktop: d.images,
    mobile: m.images,
    desktopRequests: d.requests.length,
    mobileRequests: m.requests.length,
    errors,
    bad,
    checks,
  };
  await fs.writeFile(
    `${reportDir}/${tag}-browser.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      base,
      passed: true,
      checks,
      desktopImages: d.images.length,
      mobileImages: m.images.length,
    }),
  );
} finally {
  await browser.close();
}
