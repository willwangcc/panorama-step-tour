const SAMPLE_TOUR = [
  {
    id: "mason-circle",
    title: "Mason Circle",
    description: "Viewpoint 01 · Start at the circle, then follow the marker to the next panorama.",
    url: "https://pannellum.org/images/from-tree.jpg",
    yaw: 117,
    pitch: -3,
    next: { yaw: 132.9, pitch: -2.1 }
  },
  {
    id: "spring-house",
    title: "Spring House or Dairy",
    description: "Viewpoint 02 · Look back toward Mason Circle to retrace the route.",
    url: "https://pannellum.org/images/bma-0.jpg",
    yaw: 5,
    pitch: 0,
    prev: { yaw: 37.1, pitch: -0.6, targetYaw: -23, targetPitch: 2 }
  }
];

const $ = (id) => document.getElementById(id);
const dom = {
  panorama: $("panorama"),
  loading: $("viewerLoading"),
  mode: $("tourMode"),
  title: $("sceneTitle"),
  description: $("sceneDescription"),
  counter: $("sceneCounter"),
  progress: $("sceneProgress"),
  count: $("sceneCount"),
  rail: $("sceneRail"),
  source: $("sceneSource"),
  prev: $("prevBtn"),
  next: $("nextBtn"),
  auto: $("autoBtn"),
  autoIcon: $("autoIcon"),
  zoomIn: $("zoomInBtn"),
  zoomOut: $("zoomOutBtn"),
  full: $("fullBtn"),
  openEditor: $("openEditor"),
  closeEditor: $("closeEditor"),
  overlay: $("editorOverlay"),
  backdrop: $("editorBackdrop"),
  drop: $("dropZone"),
  file: $("fileInput"),
  uploadResult: $("uploadResult"),
  reset: $("resetSample"),
  placeNext: $("placeNextBtn"),
  placementTip: $("placementTip"),
  toast: $("toast")
};

let scenes = SAMPLE_TOUR.map((scene) => ({ ...scene }));
let activeIndex = 0;
let viewer = null;
let isLocalTour = false;
let isRotating = false;
let ownedObjectUrls = [];
let toastTimeout = null;
let loadTimeout = null;

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => dom.toast.classList.remove("visible"), 3900);
}

function buildHotspots(scene, index) {
  const hotSpots = [];
  if (index > 0) {
    const previous = scenes[index - 1];
    const aim = scene.prev || { yaw: -165, pitch: -7 };
    hotSpots.push({
      id: "prev-" + scene.id,
      type: "scene",
      cssClass: "step-hotspot step-hotspot-back",
      pitch: aim.pitch,
      yaw: aim.yaw,
      text: "Back to " + previous.title,
      sceneId: previous.id,
      targetYaw: aim.targetYaw === undefined ? "same" : aim.targetYaw,
      targetPitch: aim.targetPitch === undefined ? "same" : aim.targetPitch
    });
  }
  if (index < scenes.length - 1) {
    const next = scenes[index + 1];
    const aim = scene.next || { yaw: 12, pitch: -7 };
    hotSpots.push({
      id: "next-" + scene.id,
      type: "scene",
      cssClass: "step-hotspot step-hotspot-next",
      pitch: aim.pitch,
      yaw: aim.yaw,
      text: "Walk to " + next.title,
      sceneId: next.id,
      targetYaw: next.yaw,
      targetPitch: next.pitch
    });
  }
  return hotSpots;
}

function makeConfig() {
  const configScenes = {};
  scenes.forEach((scene, i) => {
    configScenes[scene.id] = {
      type: "equirectangular",
      title: scene.title,
      panorama: scene.url,
      yaw: scene.yaw || 0,
      pitch: scene.pitch || 0,
      hfov: 95,
      hotSpots: buildHotspots(scene, i)
    };
  });
  return {
    default: {
      firstScene: scenes[0].id,
      sceneFadeDuration: 850,
      autoLoad: true,
      showControls: false,
      showFullscreenCtrl: false,
      showZoomCtrl: false,
      compass: false,
      backgroundColor: [9, 20, 26]
    },
    scenes: configScenes
  };
}

function setLoading(value) {
  dom.loading.classList.toggle("is-hidden", !value);
}

function stopAutoRotate() {
  isRotating = false;
  dom.auto.classList.remove("is-active");
  dom.auto.setAttribute("aria-pressed", "false");
  if (viewer && typeof viewer.stopAutoRotate === "function") viewer.stopAutoRotate();
}

function replaceTour(newScenes, local) {
  stopAutoRotate();
  if (viewer) {
    try { viewer.destroy(); } catch (error) { console.warn("Could not release panorama viewer", error); }
    viewer = null;
  }
  dom.panorama.innerHTML = "";
  scenes = newScenes;
  isLocalTour = local;
  activeIndex = 0;
  setLoading(true);
  dom.uploadResult.textContent = "";
  render();

  if (!window.pannellum || typeof window.pannellum.viewer !== "function") {
    setLoading(false);
    showToast("Viewer unavailable. Check your connection and refresh.");
    return;
  }

  try {
    viewer = window.pannellum.viewer("panorama", makeConfig());
    viewer.on("scenechange", (sceneId) => {
      const index = scenes.findIndex((scene) => scene.id === sceneId);
      if (index !== -1) activeIndex = index;
      render();
      setLoading(true);
    });
    viewer.on("load", () => {
      clearTimeout(loadTimeout);
      setLoading(false);
      render();
    });
    viewer.on("error", () => {
      clearTimeout(loadTimeout);
      setLoading(false);
      showToast("Panorama could not be loaded. Check the source or your connection.");
    });
    clearTimeout(loadTimeout);
    loadTimeout = setTimeout(() => {
      if (!dom.loading.classList.contains("is-hidden")) {
        setLoading(false);
        showToast("The panorama is taking a while to load. Check your connection.");
      }
    }, 16000);
  } catch (error) {
    console.error(error);
    setLoading(false);
    showToast("Could not initialize 360° viewer.");
  }
}

function goTo(index) {
  if (!viewer || index < 0 || index >= scenes.length || index === activeIndex) return;
  const scene = scenes[index];
  stopAutoRotate();
  activeIndex = index;
  setLoading(true);
  render();
  viewer.loadScene(scene.id, scene.pitch || 0, scene.yaw || 0, 95);
}

function render() {
  const scene = scenes[activeIndex];
  if (!scene) return;
  const counter = String(activeIndex + 1).padStart(2, "0") + " / " + String(scenes.length).padStart(2, "0");
  dom.mode.textContent = isLocalTour ? "YOUR PRIVATE PANORAMA ROUTE" : "CURATED FIELD WALK";
  dom.title.textContent = scene.title;
  const dot = document.createElement("span");
  dot.className = "title-accent";
  dot.textContent = ".";
  dom.title.appendChild(dot);
  dom.description.textContent = scene.description;
  dom.counter.textContent = counter;
  dom.progress.textContent = counter;
  dom.count.textContent = String(scenes.length) + " WAYPOINTS";
  dom.prev.disabled = activeIndex === 0;
  dom.next.disabled = activeIndex === scenes.length - 1;
  dom.placeNext.disabled = !isLocalTour || activeIndex === scenes.length - 1;
  dom.placementTip.textContent = !isLocalTour
    ? "Load your own panoramas to enable directional editing."
    : activeIndex === scenes.length - 1
    ? "This is the last viewpoint. Choose an earlier scene to place its forward marker."
    : "Point the camera toward your next location, then click above to place the marker.";

  dom.source.textContent = isLocalTour
    ? "Your own 360° photographs · browser session only"
    : "Photos · Matthew Petroff · CC BY-SA 3.0 ↗";
  if (isLocalTour) dom.source.removeAttribute("href");
  else dom.source.href = "https://pannellum.org/documentation/examples/tour/";

  dom.rail.replaceChildren();
  scenes.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scene-tile" + (index === activeIndex ? " selected" : "");
    button.setAttribute("aria-label", "View " + item.title);
    button.setAttribute("aria-current", index === activeIndex ? "true" : "false");

    const image = document.createElement("div");
    image.className = "scene-tile-image";
    image.style.backgroundImage = 'linear-gradient(180deg, transparent, rgba(0,0,0,.38)), url("' + item.url + '")';

    const number = document.createElement("span");
    number.className = "tile-number";
    number.textContent = String(index + 1).padStart(2, "0");
    image.appendChild(number);

    const indicator = document.createElement("span");
    indicator.className = "tile-indicator";
    indicator.textContent = index === activeIndex ? "● NOW" : "→ GO";
    image.appendChild(indicator);

    const label = document.createElement("span");
    label.className = "tile-label";
    label.textContent = item.title;
    button.append(image, label);
    button.addEventListener("click", () => goTo(index));
    dom.rail.appendChild(button);
  });
}

function toggleRotate() {
  if (!viewer) return;
  isRotating = !isRotating;
  if (isRotating) viewer.startAutoRotate(-1.3);
  else viewer.stopAutoRotate();
  dom.auto.classList.toggle("is-active", isRotating);
  dom.auto.setAttribute("aria-pressed", String(isRotating));
}

function changeZoom(delta) {
  if (viewer) viewer.setHfov(Math.max(40, Math.min(115, viewer.getHfov() + delta)));
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    showToast("Fullscreen is not supported in this browser.");
  }
}

function openEditor() {
  dom.overlay.hidden = false;
  document.body.classList.add("editor-open");
  dom.closeEditor.focus();
}

function closeEditor() {
  dom.overlay.hidden = true;
  document.body.classList.remove("editor-open");
  dom.openEditor.focus();
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      reject(new Error(file.name + ": choose JPG, PNG, or WebP"));
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      reject(new Error(file.name + ": exceeds 30 MB"));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (!height || Math.abs(width / height - 2) > 0.12) {
        URL.revokeObjectURL(url);
        reject(new Error(file.name + ": needs a 2:1 equirectangular image"));
      } else {
        resolve({ url, width, height, name: file.name });
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(file.name + ": could not read image"));
    };
    image.src = url;
  });
}

async function importPhotos(fileList) {
  const files = Array.from(fileList).slice(0, 13);
  dom.uploadResult.classList.remove("error", "success");
  if (files.length < 2 || files.length > 12) {
    dom.uploadResult.classList.add("error");
    dom.uploadResult.textContent = "Choose between 2 and 12 panoramic images.";
    return;
  }
  dom.uploadResult.textContent = "Checking panorama dimensions…";
  const results = await Promise.allSettled(files.map(readPhoto));
  const errors = results.filter((result) => result.status === "rejected").map((result) => result.reason.message);
  const photos = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
  if (errors.length || photos.length < 2) {
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    dom.uploadResult.classList.add("error");
    dom.uploadResult.textContent = errors.slice(0, 2).join(" · ") || "Add at least two valid 360° photos.";
    return;
  }

  // Release previous uploaded media once the old viewer is destroyed.
  const previousUrls = ownedObjectUrls;
  const tour = photos.map((photo, i) => ({
    id: "uploaded-" + i,
    title: photo.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Viewpoint " + (i + 1),
    description: "Your panorama · Viewpoint " + String(i + 1).padStart(2, "0") + " of " + photos.length + " · Navigate with the markers or route.",
    url: photo.url,
    yaw: 0,
    pitch: 0,
    next: i < photos.length - 1 ? { yaw: 12, pitch: -7 } : undefined,
    prev: i > 0 ? { yaw: -165, pitch: -7 } : undefined
  }));
  replaceTour(tour, true);
  previousUrls.forEach((url) => URL.revokeObjectURL(url));
  ownedObjectUrls = photos.map((photo) => photo.url);
  closeEditor();
  dom.uploadResult.classList.add("success");
  dom.uploadResult.textContent = String(photos.length) + " photos linked successfully.";
  showToast(String(photos.length) + " panoramas connected. Open Create to aim the next-waypoint arrows.");
}

function restoreSample() {
  replaceTour(SAMPLE_TOUR.map((scene) => ({ ...scene })), false);
  ownedObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  ownedObjectUrls = [];
  dom.file.value = "";
  closeEditor();
  showToast("Curated panorama walk restored.");
}

function placeNextWaypoint() {
  if (!viewer || !isLocalTour || activeIndex >= scenes.length - 1) return;
  const current = scenes[activeIndex];
  const yaw = viewer.getYaw();
  const pitch = viewer.getPitch();
  current.next = { yaw, pitch };
  try {
    viewer.removeHotSpot("next-" + current.id, current.id);
    const point = buildHotspots(current, activeIndex).find((item) => item.id === "next-" + current.id);
    viewer.addHotSpot(point, current.id);
    closeEditor();
    showToast("Forward marker aligned with your view. Click the circle to walk.");
  } catch (error) {
    console.error(error);
    showToast("Could not move the waypoint. Try again.");
  }
}

dom.prev.addEventListener("click", () => goTo(activeIndex - 1));
dom.next.addEventListener("click", () => goTo(activeIndex + 1));
dom.auto.addEventListener("click", toggleRotate);
dom.zoomIn.addEventListener("click", () => changeZoom(-12));
dom.zoomOut.addEventListener("click", () => changeZoom(12));
dom.full.addEventListener("click", toggleFullscreen);
dom.openEditor.addEventListener("click", openEditor);
dom.closeEditor.addEventListener("click", closeEditor);
dom.backdrop.addEventListener("click", closeEditor);
dom.reset.addEventListener("click", restoreSample);
dom.placeNext.addEventListener("click", placeNextWaypoint);
dom.file.addEventListener("change", (event) => {
  if (event.target.files?.length) importPhotos(event.target.files);
});

dom.drop.addEventListener("dragover", (event) => {
  event.preventDefault();
  dom.drop.classList.add("dragover");
});
dom.drop.addEventListener("dragleave", () => dom.drop.classList.remove("dragover"));
dom.drop.addEventListener("drop", (event) => {
  event.preventDefault();
  dom.drop.classList.remove("dragover");
  if (event.dataTransfer.files.length) importPhotos(event.dataTransfer.files);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !dom.overlay.hidden) closeEditor();
  if (!dom.overlay.hidden || event.target instanceof HTMLInputElement) return;
  if (event.key === "ArrowRight" && event.altKey) goTo(activeIndex + 1);
  if (event.key === "ArrowLeft" && event.altKey) goTo(activeIndex - 1);
});
window.addEventListener("beforeunload", () => {
  ownedObjectUrls.forEach((url) => URL.revokeObjectURL(url));
});

replaceTour(SAMPLE_TOUR.map((scene) => ({ ...scene })), false);
