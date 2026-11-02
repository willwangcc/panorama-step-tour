// Keep a small LRU of compressed JPEG blobs, not decoded 6K GPU textures.
// The viewer consumes object URLs so preloading and rendering share one download.
export function createPanoramaCache(limit = 4) {
  const entries = new Map();
  async function load(url, onProgress = () => {}) {
    if (entries.has(url)) {
      const entry = entries.get(url);
      entries.delete(url);
      entries.set(url, entry);
      onProgress(100);
      return entry;
    }
    const pending = new Promise((resolve, reject) => {
      const req = new XMLHttpRequest();
      req.open("GET", url);
      req.responseType = "blob";
      req.timeout = 45000;
      req.onprogress = (e) =>
        onProgress(
          e.lengthComputable ? Math.round((e.loaded / e.total) * 100) : null,
        );
      req.onload = () =>
        req.status === 200 && req.response.size > 0
          ? resolve(URL.createObjectURL(req.response))
          : reject(new Error(`图片请求失败 (${req.status})`));
      req.onerror = () =>
        reject(new Error("图片读取失败，请检查网络或服务器。"));
      req.ontimeout = () => reject(new Error("图片加载超时，请重试。"));
      req.send();
    });
    entries.set(url, pending);
    try {
      const objectUrl = await pending;
      while (entries.size > limit) {
        const oldest = entries.keys().next().value;
        if (oldest === url) break;
        const expired = entries.get(oldest);
        entries.delete(oldest);
        expired.then(
          (value) => URL.revokeObjectURL(value),
          () => {},
        );
      }
      return objectUrl;
    } catch (error) {
      entries.delete(url);
      throw error;
    }
  }
  return {
    load,
    clear() {
      for (const entry of entries.values())
        entry.then(
          (value) => URL.revokeObjectURL(value),
          () => {},
        );
      entries.clear();
    },
  };
}
