import "./style.css";
import { createViewer } from "./lib/viewer.js";
import { createExplorer } from "./lib/explorer.js";
import { nextPlace, featuredPlaces } from "./lib/place-navigation.js";
const $ = (id) => document.getElementById(id);
const storageKey = "anhui-calibration-v1";
let manifest,
  engine,
  current,
  busy = false,
  rotating = false,
  history = [],
  resizeMap,
  loadTimer,
  featured = [];
let corrections = {};
try {
  corrections = JSON.parse(localStorage.getItem(storageKey) || "{}");
} catch {}
const toast = (message) => {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("toast").hidden = true), 4200);
};
const outgoing = () => manifest.edges.filter((e) => e.from === current);
const node = (id) => manifest.viewpoints.find((n) => n.id === id);
function error(message) {
  clearTimeout(loadTimer);
  busy = false;
  $("loading").hidden = true;
  $("errorText").textContent = message;
  $("error").hidden = false;
}
function loading(message) {
  busy = true;
  $("error").hidden = true;
  $("loadingText").textContent = message;
  $("loading").hidden = false;
  clearTimeout(loadTimer);
  loadTimer = setTimeout(
    () => error("加载时间较长，请重试或选择其他地点。"),
    55000,
  );
}
function enter() {
  $("app").classList.remove("landing");
  engine?.viewer.stopAutoRotate();
  rotating = false;
  $("rotate").setAttribute("aria-pressed", "false");
}
function placeButton(place, className = "place-tile") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("aria-label", `探索${place.name}`);
  const img = document.createElement("img");
  img.src = node(place.viewpoints[0]).thumbnail;
  img.alt = "";
  img.loading = "lazy";
  const label = document.createElement("span");
  label.textContent = `${place.name} · ${place.viewpoints.length} 个视角`;
  button.append(img, label);
  button.onclick = () => navigate(place.viewpoints[0]);
  return button;
}
function openExplorer() {
  if (!manifest) return;
  $("explorer").showModal();
  if (!resizeMap) resizeMap = createExplorer(manifest, (id) => {
    if (id === current) {
      enter();
      $("explorer").close();
    } else navigate(id);
  });
  setTimeout(resizeMap, 50);
}
function render() {
  const n = node(current),
    p = manifest.places.find((p) => p.id === n.placeId),
    edges = outgoing(),
    recommended = nextPlace(manifest.places, p.id);
  $("sceneTitle").textContent = n.place;
  $("nextPlaceName").textContent = recommended ? recommended.name : "探索全部地点";
  $("nextPlace").textContent = recommended ? "下一站 →" : "查看地点 →";
  $("nextPlace").onclick = () => recommended ? navigate(recommended.viewpoints[0]) : openExplorer();
  $("sceneIndex").textContent =
    `VIEWPOINT ${String(p.viewpoints.indexOf(n.id) + 1).padStart(2, "0")} / ${String(p.viewpoints.length).padStart(2, "0")}`;
  $("sceneMeta").textContent =
    `${n.date?.slice(0, 10).replaceAll(":", ".") || "日期未知"} · ${n.relativeAltitude != null ? "相对起飞点 " + Number(n.relativeAltitude).toFixed(0) + " m" : "高度未知"}`;
  $("accuracy").textContent = edges.length
    ? `GPS 邻近 · ${edges.filter((e) => corrections[e.id]).length}/${edges.length} 个方向已校准`
    : "此处暂无可信邻近连接 · 可从缩略图切换视角";
  $("localCount").textContent = String(p.viewpoints.length).padStart(2, "0");
  $("location").textContent =
    `${n.place} / ${n.gps ? n.gps.lat.toFixed(3) + "° N, " + n.gps.lon.toFixed(3) + "° E" : "GPS 未知"}`;
  $("rail").replaceChildren();
  for (const id of p.viewpoints) {
    const v = node(id),
      button = document.createElement("button");
    button.className = "scene-card";
    button.setAttribute("aria-label", `切换到 ${v.title}`);
    button.setAttribute("aria-current", String(id === current));
    const img = document.createElement("img");
    img.src = v.thumbnail;
    img.alt = "";
    img.loading = "lazy";
    const caption = document.createElement("span");
    caption.textContent = v.title;
    button.append(img, caption);
    button.onclick = () => navigate(id);
    $("rail").append(button);
  }
  $("neighbors").textContent = edges.length
    ? `${edges.length} 个邻近视角 · 非地面步行`
    : "独立拍摄点";
  $("next").disabled = !edges.length;
  $("back").disabled = !history.length;
  $("calibrate").disabled = !edges.length;
  $("edgeSelect").replaceChildren();
  for (const e of edges) {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = `${node(e.to).title} · ${e.distance} m`;
    $("edgeSelect").append(opt);
  }
  $("aim").disabled = !edges.length;
  calibrationStatus();
  window.location.hash = current;
}
async function navigate(id, edge, { back = false } = {}) {
  if (busy || id === current) return;
  enter();
  $("explorer").close();
  $("editor").hidden = true;
  const previous = current;
  loading(`正在载入 ${node(id).title}…`);
  try {
    await engine.prepare(
      id,
      (p) =>
        ($("loadingText").textContent =
          `正在载入 ${node(id).title}${p == null ? "…" : ` · ${p}%`}`),
    );
    if (!back) history.push(previous);
    current = id;
    engine.go(id, node(previous));
    render();
    if (edge && !corrections[edge.id])
      toast("已切换至 GPS 邻近视角；方向尚待校准。");
  } catch (e) {
    error(e.message);
  }
}
function calibrationStatus() {
  const e = manifest?.edges.find((e) => e.id === $("edgeSelect").value),
    c = e && corrections[e.id];
  $("calibrationStatus").textContent = c
    ? `手动方向：${c.yaw.toFixed(1)}° / ${c.pitch.toFixed(1)}° · 保存在此浏览器`
    : "虚线热点为航向估算，尚未核验。";
}
function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(corrections));
  } catch {
    toast("浏览器无法持久保存，请导出 JSON。");
  }
}
$("enter").onclick = enter;
$("home").onclick = () => {
  $("app").classList.add("landing");
  $("editor").hidden = true;
};
$("explore").onclick = openExplorer;
$("allPlaces").onclick = openExplorer;
$("otherPlaces").onclick = openExplorer;
$("placeSearch").oninput = () => {
  const query = $("placeSearch").value.trim().toLocaleLowerCase();
  let visible = 0;
  for (const button of $("places").children) {
    const matches = button.dataset.name.toLocaleLowerCase().includes(query);
    button.hidden = !matches;
    if (matches) visible++;
  }
  $("placeEmpty").hidden = visible > 0;
};
document.querySelector("[data-close]").onclick = () => $("explorer").close();
$("explorer").addEventListener("click", (e) => {
  if (e.target === $("explorer")) {
    const r = $("explorer").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      $("explorer").close();
  }
});
$("rotate").onclick = () => {
  if (!engine) return;
  rotating = !rotating;
  if (rotating) engine.viewer.startAutoRotate(-1.1);
  else engine.viewer.stopAutoRotate();
  $("rotate").setAttribute("aria-pressed", String(rotating));
};
$("zoomIn").onclick = () =>
  engine?.viewer.setHfov(Math.max(40, engine.viewer.getHfov() - 12));
$("zoomOut").onclick = () =>
  engine?.viewer.setHfov(Math.min(120, engine.viewer.getHfov() + 12));
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($("app").requestFullscreen) await $("app").requestFullscreen();
    else toast("此浏览器不支持全屏，已使用全窗口视图。");
  } catch {
    toast("无法进入全屏，已使用全窗口视图。");
  }
};
$("next").onclick = () => {
  const e = outgoing()[0];
  if (e) navigate(e.to, e);
};
$("back").onclick = () => {
  if (busy || !history.length) return;
  const id = history.pop();
  navigate(id, null, { back: true });
};
$("calibrate").onclick = () => {
  engine.viewer.stopAutoRotate();
  rotating = false;
  $("rotate").setAttribute("aria-pressed", "false");
  $("editor").hidden = false;
};
$("closeEditor").onclick = () => ($("editor").hidden = true);
$("edgeSelect").onchange = calibrationStatus;
$("aim").onclick = () => {
  const e = manifest.edges.find((e) => e.id === $("edgeSelect").value);
  if (!e) return;
  corrections[e.id] = {
    yaw: engine.viewer.getYaw(),
    pitch: engine.viewer.getPitch(),
    reviewStatus: "manually-calibrated",
  };
  save();
  engine.refreshEdge(e);
  const chosen = e.id;
  render();
  $("edgeSelect").value = chosen;
  calibrationStatus();
  toast("连接方向已保存。");
};
$("resetCalibration").onclick = () => {
  const e = manifest.edges.find((e) => e.id === $("edgeSelect").value);
  if (!e) return;
  delete corrections[e.id];
  save();
  engine.refreshEdge(e);
  render();
};
$("export").onclick = () => {
  const blob = new Blob(
      [JSON.stringify({ schemaVersion: 1, corrections }, null, 2)],
      { type: "application/json" },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "anhui-calibration.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("import").onchange = async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1000000) throw Error("文件过大");
    const data = JSON.parse(await file.text());
    if (
      data.schemaVersion !== 1 ||
      !data.corrections ||
      typeof data.corrections !== "object"
    )
      throw Error("格式不正确");
    const validated = {};
    for (const [id, c] of Object.entries(data.corrections)) {
      if (
        !manifest.edges.some((e) => e.id === id) ||
        !Number.isFinite(c.yaw) ||
        Math.abs(c.yaw) > 180 ||
        !Number.isFinite(c.pitch) ||
        Math.abs(c.pitch) > 90
      )
        throw Error("连接或角度无效");
      validated[id] = {
        yaw: c.yaw,
        pitch: c.pitch,
        reviewStatus: "manually-calibrated",
      };
    }
    Object.assign(corrections, validated);
    save();
    manifest.edges.forEach((e) => engine.refreshEdge(e));
    render();
    toast("校准已导入。");
  } catch (e) {
    toast("无法导入：" + e.message);
  } finally {
    $("import").value = "";
  }
};
$("retry").onclick = () => location.reload();
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("editor").hidden = true;
});
async function start() {
  loading("正在读取皖南影像档案…");
  try {
    const response = await fetch("/generated/manifest.json");
    if (!response.ok)
      throw Error("尚未生成影像，请运行 npm run prepare:media。");
    manifest = await response.json();
    if (!manifest.viewpoints?.length) throw Error("没有可用的全景。");
    // Ignore invalid stale local values; imported configurations receive stricter validation.
    corrections = Object.fromEntries(
      Object.entries(corrections).filter(
        ([id, c]) =>
          manifest.edges.some((e) => e.id === id) &&
          Number.isFinite(c?.yaw) &&
          Math.abs(c.yaw) <= 180 &&
          Number.isFinite(c?.pitch) &&
          Math.abs(c.pitch) <= 90,
      ),
    );
    current =
      node(location.hash.slice(1))?.id ||
      manifest.viewpoints.find(
        (n) => n.place === "宏村" && n.date?.includes("09:59"),
      )?.id ||
      manifest.viewpoints[0].id;
    $("counts").textContent =
      `${manifest.places.length} 个地点 / ${manifest.viewpoints.length} 个全景视角`;
    featured = featuredPlaces(manifest.places, 3);
    $("featuredPlaces").replaceChildren(...featured.map(p => placeButton(p, "featured-tile")));
    for (const p of manifest.places) {
      const button = placeButton(p);
      button.dataset.name = p.name;
      $("places").append(button);
    }
    engine = await createViewer(
      manifest,
      current,
      corrections,
      navigate,
      () => {
        clearTimeout(loadTimer);
        busy = false;
        $("loading").hidden = true;
        $("error").hidden = true;
      },
      (message) => error(String(message).replace(/<[^>]*>/g, "")),
      (progress) =>
        ($("loadingText").textContent =
          `正在载入高清全景${progress == null ? "…" : ` · ${progress}%`}`),
    );
    render();
  } catch (e) {
    error(e.message);
  }
}
start();
