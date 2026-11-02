import test from "node:test";
import assert from "node:assert/strict";
import { createPanoramaCache } from "../src/lib/panorama-cache.js";
test("preload, render and revisit share one fetch; cache evicts old compressed blobs", async () => {
  const original = globalThis.XMLHttpRequest,
    requests = [];
  globalThis.XMLHttpRequest = class {
    open(method, url) {
      this.url = url;
    }
    send() {
      requests.push(this.url);
      this.status = 200;
      this.response = new Blob(["JPEG"]);
      queueMicrotask(() => this.onload());
    }
  };
  const cache = createPanoramaCache(2);
  try {
    const first = await cache.load("/a.jpg");
    assert.equal(await cache.load("/a.jpg"), first);
    await cache.load("/b.jpg");
    await cache.load("/a.jpg");
    await cache.load("/c.jpg");
    await cache.load("/a.jpg");
    await cache.load("/b.jpg");
    assert.deepEqual(requests, ["/a.jpg", "/b.jpg", "/c.jpg", "/b.jpg"]);
  } finally {
    cache.clear();
    globalThis.XMLHttpRequest = original;
  }
});
test("failed downloads can be retried", async () => {
  const original = globalThis.XMLHttpRequest;
  let count = 0;
  globalThis.XMLHttpRequest = class {
    open() {}
    send() {
      this.status = ++count === 1 ? 503 : 200;
      this.response = new Blob(["JPEG"]);
      queueMicrotask(() => this.onload());
    }
  };
  const cache = createPanoramaCache();
  try {
    await assert.rejects(cache.load("/failed.jpg"), /503/);
    assert.match(await cache.load("/failed.jpg"), /^blob:/);
    assert.equal(count, 2);
  } finally {
    cache.clear();
    globalThis.XMLHttpRequest = original;
  }
});
