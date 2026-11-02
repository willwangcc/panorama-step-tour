import "pannellum/build/pannellum.js";
import "pannellum/build/pannellum.css";
import { wrap } from "./spatial.js";
import { createPanoramaCache } from "./panorama-cache.js";
export async function createViewer(
  manifest,
  first,
  corrections,
  onNavigate,
  onLoad,
  onError,
  onProgress,
) {
  const mobile = matchMedia("(max-width: 700px)").matches;
  const nodes = new Map(manifest.viewpoints.map((n) => [n.id, n]));
  const sceneConfig = {};
  const sourceUrls = new Map();
  const cache = createPanoramaCache(4);
  const hotspot = (e) => {
    const c = corrections[e.id],
      yaw = c?.yaw ?? e.yaw;
    if (yaw == null) return null;
    return {
      id: e.id,
      yaw,
      pitch: Math.max(-65, Math.min(65, c?.pitch ?? e.pitch)),
      cssClass: "step-marker",
      createTooltipFunc: (el) => {
        const button = document.createElement("button");
        button.className = c ? "calibrated" : "";
        button.textContent = "↗";
        button.setAttribute(
          "aria-label",
          `前往 ${nodes.get(e.to).title}，${e.distance}米${c ? "，已手动校准" : "，方向待校准"}`,
        );
        const label = document.createElement("span");
        label.textContent = `${e.distance} m · ${c ? "已校准" : "待校准"}`;
        button.append(label);
        button.onclick = () => onNavigate(e.to, e);
        el.append(button);
      },
    };
  };
  for (const n of manifest.viewpoints)
    sceneConfig[n.id] = {
      type: "equirectangular",
      panorama: mobile ? n.mobile : n.panorama,
      preview: n.thumbnail,
      yaw: 0,
      pitch: -18,
      hfov: 100,
      hotSpots: manifest.edges
        .filter((e) => e.from === n.id)
        .map(hotspot)
        .filter(Boolean),
    };
  for (const [id, scene] of Object.entries(sceneConfig))
    sourceUrls.set(id, scene.panorama);
  sceneConfig[first].panorama = await cache.load(
    sourceUrls.get(first),
    onProgress,
  );
  window.addEventListener("pagehide", () => cache.clear(), { once: true });
  const viewer = window.pannellum.viewer("panorama", {
    default: {
      firstScene: first,
      autoLoad: true,
      showControls: false,
      sceneFadeDuration: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 650,
      minHfov: 40,
      maxHfov: 120,
      backgroundColor: [0.08, 0.12, 0.1],
    },
    scenes: sceneConfig,
  });
  viewer.on("load", onLoad);
  viewer.on("error", onError);
  return {
    viewer,
    url: (id) => sourceUrls.get(id),
    async prepare(id, progress) {
      sceneConfig[id].panorama = await cache.load(sourceUrls.get(id), progress);
      viewer.addScene(id, sceneConfig[id]);
    },
    refreshEdge(e) {
      try {
        viewer.removeHotSpot(e.id, e.from);
      } catch {}
      const h = hotspot(e);
      if (h) viewer.addHotSpot(h, e.from);
    },
    go(id, source) {
      const dest = nodes.get(id);
      const sourceHeading = source?.heading,
        destHeading = dest.heading;
      const yaw =
        sourceHeading != null && destHeading != null
          ? wrap(viewer.getYaw() + sourceHeading - destHeading)
          : viewer.getYaw();
      viewer.loadScene(id, viewer.getPitch(), yaw, viewer.getHfov());
    },
  };
}
