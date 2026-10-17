// Bahubhashi India: how linguistically diverse is each state? (Census 2011, Table C-16)

const BLUE = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]; // sequential 100..700

const METRICS = {
  ldi: {
    label: "Diversity index",
    breaks: [0.2, 0.3, 0.4, 0.5, 0.6, 0.75],
    fmt: (v) => v.toFixed(2),
    explain: `Greenberg's diversity index: the chance that two randomly chosen residents report
      <b>different mother tongues</b>. 0 means everyone speaks one language; values near 1 mean very many.`,
  },
  eff: {
    label: "Effective languages",
    breaks: [1.25, 1.5, 2, 2.5, 3.5, 6],
    fmt: (v) => v.toFixed(1),
    explain: `The number of <b>equally large</b> languages that would give the same diversity.
      A state with two languages split 50:50 scores 2.`,
  },
  n1pct: {
    label: "Languages ≥ 1%",
    breaks: [3, 4, 5, 6, 8, 10],
    fmt: (v) => String(v),
    explain: `How many languages are the mother tongue of <b>at least 1%</b> of the state's people.`,
  },
  n10k: {
    label: "Languages ≥ 10,000 speakers",
    breaks: [5, 8, 11, 15, 20, 25],
    fmt: (v) => String(v),
    explain: `How many languages have <b>at least 10,000 speakers</b> in the state. Large states score high
      partly because of their size and migrants from elsewhere.`,
  },
};

const FAMILY = {
  "Indo-Aryan": { light: "#eb6834", dark: "#d95926" },
  "Dravidian": { light: "#1baf7a", dark: "#199e70" },
  "Austro-Asiatic": { light: "#eda100", dark: "#c98500" },
  "Tibeto-Burmese": { light: "#e87ba4", dark: "#d55181" },
  "Other": { light: "#008300", dark: "#008300" }, // English, Pashto, Arabic
};
// Single-hue ramps for the language mosaic, dark -> light; the last step is a pale tint used when the
// largest language fades into the background. The viewer picks one in the style box.
const PALETTES = {
  blue: { label: "Blue", steps: ["#0d366b", "#2a78d6", "#6da7ec", "#9ec5f4", "#cde2fb", "#e6f0fc"] },
  teal: { label: "Teal", steps: ["#0a3b34", "#127a68", "#1baf7a", "#74d3ae", "#bfeedb", "#e3f7ef"] },
  violet: { label: "Violet", steps: ["#251c63", "#4a3aa7", "#7b6ce0", "#ab9ff0", "#d9d3fa", "#eeebfd"] },
  plum: { label: "Plum", steps: ["#4a1531", "#99335f", "#d55181", "#ec93b5", "#f7cbdc", "#fbe6ee"] },
  terracotta: { label: "Terracotta", steps: ["#5c1f0d", "#b4441c", "#eb6834", "#f3a07c", "#f9d3c1", "#fcebe2"] },
  ink: { label: "Ink", steps: ["#1f1f1d", "#52514e", "#898781", "#b8b6ae", "#dcdad3", "#eeede8"] },
};
// Night sky view colours.
const NIGHT = { bg: "#0a0f1e", land: "#131b30", edge: "#2c3a5c", warm: "#ffe2a8", border: "#a9bdf0" };
// Family colours brightened to read as light on the dark map.
const GLOW = { "Indo-Aryan": "#ffb26b", "Dravidian": "#5fe3b8", "Austro-Asiatic": "#ffd84d",
               "Tibeto-Burmese": "#ff8cc2", "Other": "#a6ec8a" };

// Scripts view: glyph colour by script group.
const SCRIPT_GROUP_COLOUR = {
  "Brahmic, north": "#ffb26b", "Brahmic, east": "#ffd84d", "Brahmic, south": "#5fe3b8",
  "Perso-Arabic": "#8fc3ff", "Latin": "#eef0ff", "Scripts made for one language": "#d0a6ff",
};

// The public build (site_public/, made by scripts/build_public.py) marks <body data-public data-views="...">:
// only those views get buttons, the style box is hidden, there is no ?review, and voices.json holds approved clips only.
const PUBLIC = document.body.hasAttribute("data-public");
const ONLY_VIEWS = document.body.dataset.views ? document.body.dataset.views.split(",") : null;
const viewAllowed = (k) => !ONLY_VIEWS || ONLY_VIEWS.includes(k);

// Viewer's style choices for the hexagon views (kept in this browser only).
const STYLE_KEY = "lti-hex-style";
const style = { palette: "blue", fade: true, arrange: "scatter", tiles: "diversity", lights: "family" };
if (!PUBLIC) try { Object.assign(style, JSON.parse(localStorage.getItem(STYLE_KEY) || "{}")); } catch {}
if (document.body.dataset.arrange) style.arrange = document.body.dataset.arrange; // e.g. the public build's stripes
const saveStyle = () => { try { localStorage.setItem(STYLE_KEY, JSON.stringify(style)); } catch {} };
const GROUT = { light: "#d9d3c4", dark: "#2a2d33" }; // between tiles in the hexagon views
const OUTSIDE = { light: "#b4b2a9", dark: "#5f5e5a" }; // mother tongues outside the 121 languages
const famKey = (f) => (FAMILY[f] ? f : "Other");
const isDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
const famColor = (f) => FAMILY[famKey(f)][isDark() ? "dark" : "light"];

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = (x) => (x >= 0.1 ? `${(x * 100).toFixed(0)}%` : x >= 0.001 ? `${(x * 100).toFixed(1)}%` : "<0.1%");
const big = (n) => n.toLocaleString("en-IN");

// Voices (speech samples per state): loaded with the other data so the map never sees them half-ready.
// ?review opens the review page for these clips (site/review.js, shared with the NE pilot). Once any voice clip
// has a decision in data/review.json, the map plays only clips marked Good.
const REVIEW = !PUBLIC && new URLSearchParams(location.search).has("review");
const voices = await fetch("data/voices.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const decisions = PUBLIC ? {} : await fetch("data/review.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).then((d) => d?.clips || {}).catch(() => ({}));
const voiceTotals = { all: 0, shown: 0, reviewed: false };
if (voices) {
  const all = Object.values(voices.states).flatMap((v) => v.clips);
  voiceTotals.all = all.length;
  voiceTotals.reviewed = !!voices.reviewed || all.some((c) => decisions[c.id]); // public voices.json is pre-filtered
  if (voiceTotals.reviewed && !REVIEW && !voices.reviewed) {
    for (const v of Object.values(voices.states)) v.clips = v.clips.filter((c) => decisions[c.id]?.status === "good");
  }
  voiceTotals.shown = Object.values(voices.states).reduce((n, v) => n + v.clips.length, 0);
}
const audio = new Audio();
const player = { st: null, i: -1 };
const voiceMarkers = {};

const [states, census] = await Promise.all(
  ["data/states_2011.geojson", "data/census_languages.json"].map((u) => fetch(u, { cache: "no-cache" }).then((r) => r.json()))
);

// state.metric is one of METRICS, or one of the two hexagon views below.
const HEX_VIEWS = { mosaic: "Language mosaic", families: "Language families" };
const VIEWS = { night: "Night sky", scripts: "Scripts", ...HEX_VIEWS, ...(voices ? { voices: "Voices" } : {}) }; // non-measure views, in button order
const state = { metric: "night", selected: null };
try { const m = new URLSearchParams(location.search).get("m"); if ((METRICS[m] || VIEWS[m]) && viewAllowed(m)) state.metric = m; } catch {}
const isHexView = () => !!HEX_VIEWS[state.metric];
const isNight = () => state.metric === "night";
const isScripts = () => state.metric === "scripts";
const isVoices = () => state.metric === "voices"; // states coloured by the family of the language you hear, with play buttons
const isDarkView = () => isNight() || isScripts(); // both use the dark night map
// Colour cells by language rank (mosaic) rather than by family.
const byRank = () => state.metric === "mosaic";
// The measure used for rankings and tooltips; the other views rank by effective languages.
const metricKey = () => (METRICS[state.metric] ? state.metric : "eff");

const css = getComputedStyle(document.documentElement);
const v = (name) => css.getPropertyValue(name).trim();

// Voices view: each state in the colour of the family of the language its clips are in.
function voiceFamily(st) {
  const v = voices?.states[st];
  if (!v || !v.clips.length) return null;
  return v.census_rank == null ? null : census.states[st].languages[v.census_rank][2];
}
function voiceFillExpr() {
  const e = ["match", ["get", "name"]];
  for (const st of Object.keys(census.states)) {
    const f = voiceFamily(st);
    e.push(st, f ? famColor(f) : v("--line"));
  }
  e.push(v("--line"));
  return e;
}
const baseFill = () => (isVoices() ? voiceFillExpr() : stepExpr(state.metric));

function stepExpr(metric) {
  const key = METRICS[metric] ? metric : "eff"; // views that aren't measures fall back to effective languages
  const b = METRICS[key].breaks;
  const e = ["step", ["get", key], BLUE[0]];
  b.forEach((x, i) => e.push(x, BLUE[i + 1]));
  return e;
}

renderMetricBar();
renderLegend();

const INDIA = [[68, 6.5], [97.5, 37.2]];
// Keep India clear of the measure buttons (top) and, on phones, the legend strip (bottom).
// On wider screens the legend sits bottom-left, so leave room for it on the left instead.
const pad = () => innerWidth <= 760
  ? { top: 46, left: 16, right: 16, bottom: ($("#legend").offsetHeight || 60) + 14 }
  : { top: 46, right: 16, bottom: 16, left: ($("#legend").offsetWidth || 100) + 20 };

const map = new maplibregl.Map({
  container: "map",
  style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": v("--bg") } }] },
  bounds: INDIA,
  fitBoundsOptions: { padding: pad() },
  attributionControl: false,
  dragRotate: false,
});
map.touchZoomRotate.disableRotation();
// Refit India when the window changes size (unless a state is zoomed in).
map.on("resize", () => { if (!state.selected) map.fitBounds(INDIA, { padding: pad(), duration: 0 }); });
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

map.on("load", () => {
  addVoiceMarkers();
  map.addSource("states", { type: "geojson", data: states, promoteId: "name" });
  map.addLayer({ id: "fill", type: "fill", source: "states", paint: { "fill-color": baseFill(), "fill-opacity": 1 } });
  map.addLayer({ id: "edge", type: "line", source: "states", paint: { "line-color": v("--panel"), "line-width": 0.8 } });
  map.addLayer({
    id: "hover", type: "line", source: "states",
    paint: { "line-color": v("--ink"), "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 1.5, 0] },
  });
  map.addLayer({ id: "sel", type: "line", source: "states", filter: ["==", ["get", "name"], ""], paint: { "line-color": v("--ink"), "line-width": 2.5 } });

  // Tiny UTs (Lakshadweep, Chandigarh, ...) are sub-pixel at this zoom: mark each with a dot in its colour.
  map.addSource("small", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: states.features.filter((f) => f.properties.small).map((f) => ({
        type: "Feature", properties: f.properties,
        geometry: { type: "Point", coordinates: [f.properties.lx, f.properties.ly] },
      })),
    },
  });
  map.addLayer({
    id: "small-dot", type: "circle", source: "small",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 5, 7, 8],
      "circle-color": baseFill(),
      "circle-stroke-color": v("--ink"),
      "circle-stroke-width": 1,
    },
  });

  // One hover/click handler for every view: a mosaic cell, a tiny-UT dot or a state.
  const hit = (point) => {
    const layers = [...(isNight() && map.getLayer("star-core") ? ["star-core"] : []),
      ...(isScripts() && map.getLayer("script-glyph") ? ["script-glyph", "script-unknown"] : []), "small-dot", ...hexLayers(), "fill"];
    const f = map.queryRenderedFeatures(point, { layers })[0];
    if (!f) return null;
    const isCell = f.layer.id.startsWith("hex"), isStar = f.layer.id === "star-core" || f.layer.id.startsWith("script-");
    const name = isCell || isStar ? f.properties.st : f.properties.name;
    return { name, cell: isCell ? f.properties : null, star: isStar ? f.properties : null,
             props: states.features.find((x) => x.properties.name === name).properties };
  };
  let hovered = null;
  const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "tip" });
  const setHover = (name) => {
    if (hovered) map.setFeatureState({ source: "states", id: hovered }, { hover: false });
    hovered = name;
    if (name) map.setFeatureState({ source: "states", id: name }, { hover: true });
  };
  map.on("mousemove", (e) => {
    const h = hit(e.point);
    setHover(h && h.name);
    map.getCanvas().style.cursor = h ? "pointer" : "";
    if (!h) return tip.remove();
    const M = METRICS[metricKey()];
    tip.setLngLat(e.lngLat)
      .setHTML(h.star ? (isScripts() ? scriptTip(h.star) : starTip(h.star)) : h.cell ? cellTip(h.cell)
        : `<b>${esc(h.name)}</b><br>${M.label}: <b>${M.fmt(h.props[metricKey()])}</b><br>
        <span class="muted">Largest: ${esc(h.props.top)} ${pct(h.props.top_share)}</span>`)
      .addTo(map);
  });
  map.getCanvas().addEventListener("mouseleave", () => { setHover(null); tip.remove(); });
  map.on("click", (e) => { const h = hit(e.point); if (h) select(h.name); });
  applyView();
});

// ---------- hexagon views ----------
// Each state is filled with H3 hexagons shared out among its languages (scripts/build_mosaic.py).
// Two colourings of the same cells:
//   mosaic    one hue; shade = the language's rank in its state
//   families  one hue per language family
// The style box lets the viewer pick the hue, whether the largest language fades into the background,
// how cells are arranged inside a state, and the tile size.

let mosaic = null;

// Tilings and the zoom range each layer is shown at. "A" is the diversity-sized tiling (one fixed grid
// per state, finer where more languages are spoken); 4/5/6 are equal-size H3 resolutions.
const TILE_ZOOMS = {
  diversity: { A: [0, 24] },
  large: { 4: [0, 5.2], 5: [5.2, 6.8], 6: [6.8, 24] },
  small: { 5: [0, 5.6], 6: [5.6, 24] },
};
const TILINGS = ["A", "4", "5", "6"];
const hexZoom = (res) => TILE_ZOOMS[style.tiles]?.[res] ?? [0, 0];

// Function declarations (hoisted): the legend is drawn before this section runs.
function outsideColor() { return OUTSIDE[isDark() ? "dark" : "light"]; }
// Colours for language ranks 0 (largest) .. 4 (5th and smaller) in the chosen hue.
// With "fade", the largest language is a pale tint close to the page, so every other language stands out.
function rankColors() {
  const p = PALETTES[style.palette].steps; // dark -> light
  return style.fade ? [p[5], p[0], p[1], p[2], p[3]] : p.slice(0, 5);
}
function rankColor(r) { const c = rankColors(); return c[Math.min(r, c.length - 1)]; }

// Rank of each language within each state (0 = largest), from the census table.
const rankIn = Object.fromEntries(Object.entries(census.states).map(([st, s]) =>
  [st, Object.fromEntries(s.languages.map(([l], i) => [l, i]))]));
const ordinal = (k) => k + ({ 1: "st", 2: "nd", 3: "rd" }[k % 10 * (k % 100 > 10 && k % 100 < 14 ? 0 : 1)] || "th");

// Swatch for a language in the side panel, matching the current map colouring.
function langSwatch(name, fam, st) {
  return byRank() ? rankColor(rankIn[st][name]) : famColor(fam);
}
const hexLayers = () => (mosaic ? TILINGS.map((r) => `hex${r}`).filter((id) => map.getLayer(id)) : []);

function fillExpr() {
  if (state.metric === "families") {
    return ["match", ["get", "fam"], ...Object.keys(FAMILY).flatMap((f) => [f, famColor(f)]), outsideColor()];
  }
  const c = rankColors();
  return ["match", ["get", "r"], -1, outsideColor(), 0, c[0], 1, c[1], 2, c[2], 3, c[3], c[4]];
}

async function ensureMosaic() {
  if (mosaic) return;
  mosaic = await fetch("data/mosaic.json", { cache: "no-cache" }).then((r) => r.json());
  addHexesForZoom();
  map.on("moveend", () => { if (isHexView()) addHexesForZoom(); });
}

// Cells of a tiling as { c: [lng, lat], li, si, id? }.
function cellList(res) {
  if (res === "A") return mosaic.adaptive.cells.map(([lng, lat, li, si]) => ({ c: [lng, lat], li, si }));
  return mosaic.cells[res].map(([id, li, si]) => { const [lat, lng] = h3.cellToLatLng(id); return { id, c: [lng, lat], li, si }; });
}

// Polygon ring of a cell. Diversity-sized tiles are drawn slightly smaller than their grid spacing,
// so a thin gap shows the grain: coarse in one-language states, fine in diverse ones.
function ringOf(cell, res) {
  if (res !== "A") { const r = h3.cellToBoundary(cell.id, true); r.push(r[0]); return r; }
  const R = (mosaic.adaptive.w[cell.si] * 0.9) / Math.sqrt(3); // km, centre to corner
  const kx = 111.32 * Math.cos((mosaic.adaptive.lat0[cell.si] * Math.PI) / 180), ky = 110.57; // km per degree
  const ring = [0, 1, 2, 3, 4, 5].map((k) => {
    const a = (Math.PI / 180) * (60 * k + 30);
    return [cell.c[0] + (R * Math.cos(a)) / kx, cell.c[1] + (R * Math.sin(a)) / ky];
  });
  ring.push(ring[0]);
  return ring;
}

// Order of a state's cells for the chosen arrangement, and which language goes where.
// scatter: the build's random shuffle. rings: the state's second language at the centre, smaller ones
// in rings around it and the largest outermost. stripes: languages in bands from west to east.
// None of these is geography: the census gives one total per state.
function features(res) {
  const byState = new Map();
  for (const cell of cellList(res)) {
    if (!byState.has(cell.si)) byState.set(cell.si, []);
    byState.get(cell.si).push(cell);
  }
  const out = [];
  for (const [si, cells] of byState) {
    const st = mosaic.states[si];
    const rank = (li) => (li < 0 ? 999 : rankIn[st][mosaic.langs[li][0]]);
    if (style.arrange !== "scatter") {
      const p = states.features.find((f) => f.properties.name === st).properties;
      const key = style.arrange === "rings"
        ? ({ c: [lng, lat] }) => (lat - p.ly) ** 2 + ((lng - p.lx) * Math.cos((p.ly * Math.PI) / 180)) ** 2
        : ({ c: [lng] }) => lng;
      const order = style.arrange === "rings" ? (li) => (rank(li) === 0 ? 1e6 : rank(li)) : rank;
      const labels = cells.map((c) => c.li).sort((a, b) => order(a) - order(b));
      cells.sort((a, b) => key(a) - key(b)).forEach((c, i) => { c.li = labels[i]; });
    }
    for (const cell of cells) {
      const li = cell.li;
      out.push({ type: "Feature",
                 properties: { li, st, r: li < 0 ? -1 : Math.min(rank(li), 4), fam: li < 0 ? "" : famKey(mosaic.langs[li][1]) },
                 geometry: { type: "Polygon", coordinates: [ringOf(cell, res)] } });
    }
  }
  return { type: "FeatureCollection", features: out };
}

// Polygons are built only for the tilings the current zoom needs
// (the finest equal-size level alone has ~89,000 cells).
function addHexesForZoom() {
  const z = map.getZoom();
  for (const res of TILINGS) {
    const id = `hex${res}`;
    const [lo, hi] = hexZoom(res);
    if (map.getLayer(id) || hi <= lo || z < lo - 0.5 || z > hi) continue;
    map.addSource(id, { type: "geojson", data: features(res) });
    map.addLayer({
      id, type: "fill", source: id, minzoom: lo, maxzoom: hi,
      layout: { visibility: isHexView() ? "visible" : "none" },
      paint: { "fill-color": fillExpr(), "fill-outline-color": "rgba(0,0,0,0)" },
    }, "edge");
  }
}

// Tiny UTs: a dot in the colour of their largest language.
function dotColor() {
  if (state.metric === "mosaic") return rankColor(0);
  return ["match", ["get", "name"],
    ...states.features.filter((f) => f.properties.small).flatMap((f) =>
      [f.properties.name, famColor(census.states[f.properties.name].languages[0][2])]),
    v("--muted")];
}

async function applyView() {
  $(".mapwrap").classList.toggle("night", isDarkView());
  if (!map.getLayer("fill")) return;
  if (isHexView()) await ensureMosaic();
  if (isDarkView()) await ensureNight(); // the scripts view reuses the dark map and glowing border
  if (isScripts()) { await ensureScripts(); render(); renderLegend(); }
  applyNight();
  if (isDarkView()) { renderStyleBox(); return; }
  const on = isHexView();
  hexLayers().forEach((id) => {
    map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    map.setPaintProperty(id, "fill-color", fillExpr());
  });
  // In the hexagon views the state fill becomes the "grout" showing between tiles, so the tile grain
  // (coarse in one-language states, fine in diverse ones) stays visible even when tiles are pale.
  map.setPaintProperty("fill", "fill-opacity", 1);
  map.setPaintProperty("fill", "fill-color", on ? GROUT[isDark() ? "dark" : "light"] : baseFill());
  map.setPaintProperty("edge", "line-color", on ? v("--ink") : v("--panel"));
  map.setPaintProperty("edge", "line-width", on ? 0.7 : 0.8);
  map.setPaintProperty("edge", "line-opacity", on ? 0.6 : 1);
  map.setPaintProperty("small-dot", "circle-color", on ? dotColor() : baseFill());
  renderStyleBox();
}

// Re-place cells (arrangement changed) or switch tilings (tile size changed): drop the built layers
// and build what the current zoom needs again.
function rebuildHexes() {
  if (!mosaic) return;
  for (const id of hexLayers()) { map.removeLayer(id); map.removeSource(id); }
  addHexesForZoom();
}

function renderStyleBox() {
  const box = $("#style-box");
  box.hidden = PUBLIC || (!isHexView() && !isNight());
  if (box.hidden) return;
  const seg = (name, opts) => `<div class="seg" role="radiogroup">${opts.map(([k, l]) =>
    `<button data-${name.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}="${k}" class="${style[name] === k ? "on" : ""}" aria-checked="${style[name] === k}" role="radio">${l}</button>`).join("")}</div>`;
  box.querySelector(".style-body").innerHTML = `
    ${isNight() ? `<div class="st-row"><span>Lights</span>${seg("lights", [["family", "By family"], ["warm", "Warm"]])}</div>` : ""}
    ${byRank() ? `
    <div class="st-row"><span>Colour</span><div class="swatches">${Object.entries(PALETTES).map(([k, p]) =>
      `<button data-palette="${k}" class="${style.palette === k ? "on" : ""}" title="${p.label}" aria-label="${p.label}"
        style="background:linear-gradient(90deg, ${p.steps[0]}, ${p.steps[2]}, ${p.steps[4]})"></button>`).join("")}</div></div>
    <label class="st-row"><input type="checkbox" id="fade" ${style.fade ? "checked" : ""}> Largest language fades into the background</label>` : ""}
    ${!isHexView() ? "" : `
    <div class="st-row"><span>Arrange</span>${seg("arrange", [["scatter", "Scattered"], ["rings", "Rings"], ["stripes", "Stripes"]])}</div>
    <div class="st-row"><span>Tiles</span>${seg("tiles", [["diversity", "By diversity"], ["small", "Small"], ["large", "Large"]])}</div>`}`;
}

$("#style-box").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const [k] = Object.keys(b.dataset);
  if (!k || style[k] === b.dataset[k]) return;
  style[k] = b.dataset[k];
  saveStyle();
  if (k === "arrange" || k === "tiles") rebuildHexes();
  applyView();
  renderLegend();
  render();
});
$("#style-box").addEventListener("change", (e) => {
  if (e.target.id !== "fade") return;
  style.fade = e.target.checked;
  saveStyle();
  applyView();
  renderLegend();
  render();
});

// ---------- scripts ----------
// The night map again, but each language's light is a glowing letter of the script it is usually written in
// (scripts/build_scripts.py: Unicode CLDR likely scripts, with documented overrides).

let scriptData = null;

async function ensureScripts() {
  if (scriptData) return;
  const [meta, lights] = await Promise.all(["data/scripts.json", "data/script_lights.geojson"]
    .map((u) => fetch(u, { cache: "no-cache" }).then((r) => r.json())));
  scriptData = meta;
  // Load only the letters we draw, from Google Fonts (one small request for all scripts).
  const fams = [...new Set(Object.values(meta.scripts).map((s) => s.font))];
  const text = Object.values(meta.scripts).map((s) => s.glyph).join("");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f.replace(/ /g, "+")}`).join("&")}` +
    `&text=${encodeURIComponent(text)}&display=block`;
  document.head.append(link);
  await new Promise((ok) => { link.onload = ok; link.onerror = ok; });
  await Promise.all(Object.values(meta.scripts).map((s) => document.fonts.load(`60px "${s.font}"`, s.glyph).catch(() => {})));

  // One glowing glyph image per script, coloured by script group.
  for (const [code, s] of Object.entries(meta.scripts)) {
    const c = document.createElement("canvas");
    c.width = c.height = 96;
    const g = c.getContext("2d");
    g.font = `60px "${s.font}"`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = g.shadowColor = SCRIPT_GROUP_COLOUR[s.group];
    g.shadowBlur = 14;
    g.fillText(s.glyph, 48, 52);
    g.shadowBlur = 4;
    g.fillText(s.glyph, 48, 52);
    map.addImage(`g-${code}`, g.getImageData(0, 0, 96, 96), { pixelRatio: 2 });
  }
  map.addSource("script-lights", { type: "geojson", data: lights });
  // Same growth with zoom as the language lights; a glyph is ~2.4x the light's radius tall.
  const size = ["interpolate", ["exponential", 1.6], ["zoom"],
    ...[[3, 0.7], [4.5, 1], [6, 2.4], [8, 5], [10, 9]].flatMap(([z, k]) => [z, ["*", ["get", "r"], 0.08 * k]])];
  map.addLayer({ id: "script-unknown", type: "circle", source: "script-lights", filter: ["==", ["get", "script"], ""],
    paint: { "circle-radius": 1.5, "circle-color": "#6b7590", "circle-opacity": 0.8 } });
  map.addLayer({ id: "script-glyph", type: "symbol", source: "script-lights", filter: ["!=", ["get", "script"], ""],
    layout: { "icon-image": ["concat", "g-", ["get", "script"]], "icon-size": size,
              "icon-allow-overlap": true, "icon-ignore-placement": true,
              "symbol-sort-key": ["-", 0, ["get", "r"]] }, // big glyphs on top
    paint: { "icon-opacity": ["interpolate", ["linear"], ["get", "r"], 1.4, 0.55, 3, 0.85, 6, 1] } });
}

function scriptTip(p) {
  const l = scriptData.languages[p.lang] || {};
  const s = scriptData.scripts[l.script];
  const also = (l.also || []).map((c) => scriptData.names?.[c] || scriptData.scripts[c]?.name || c).join(", ");
  return `<b>${esc(p.lang)}</b> <span class="muted">· ${big(p.n)} speakers in ${esc(p.st)}</span><br>
    ${s ? `Written in <b>${esc(s.name)}</b> <span class="glyph" style="font-family:'${s.font}'">${s.glyph}</span>` : "Script not recorded in our sources"}
    ${also ? `<br><span class="muted">also: ${esc(also)}</span>` : ""}${langNote(p.lang)}`;
}

function scriptsLegendHTML() {
  return `<div class="lg-title">Each language, as a letter of its script</div>` +
    Object.entries(SCRIPT_GROUP_COLOUR).map(([g, c]) =>
      `<div class="lg-row"><span class="lg-glow" style="background:${c};box-shadow:0 0 6px ${c}"></span>${g}</div>`).join("") +
    `<div class="lg-note">Size: speakers in the state</div>`;
}

function scriptsHomeHTML() {
  if (!scriptData) return `<h2>The scripts of India</h2><p class="muted">Loading…</p>`;
  const list = Object.entries(scriptData.scripts).sort((a, b) => b[1].speakers - a[1].speakers);
  return `
    <h2>The scripts of India</h2>
    <p>The same lights as the night sky, but each language is drawn as a <b>letter of the script it is usually written in</b>.</p>
    <p class="muted">Many languages are written in more than one script, such as Santali, Sindhi and Punjabi; the map shows the
    usual one and hovering lists the others. Scripts are from <a href="https://cldr.unicode.org/" target="_blank" rel="noopener">Unicode CLDR</a>,
    which has none for six smaller languages (Kui, Khond/Kondh, Halam, Jatapu, Rai and Lahauli), so they are not shown.</p>
    <h3>Scripts by mother-tongue speakers</h3>
    <table class="langs scripts">
      <tbody>${list.map(([code, s]) => `<tr>
        <td class="g" style="font-family:'${s.font}';color:${SCRIPT_GROUP_COLOUR[s.group]}">${s.glyph}</td>
        <td><b>${esc(s.name)}</b><br><span class="muted">${s.languages.length} language${s.languages.length > 1 ? "s" : ""}:
          ${s.languages.slice(0, 4).map(([l]) => esc(l)).join(", ")}${s.languages.length > 4 ? "…" : ""}</span></td>
        <td class="num">${big(s.speakers)}</td></tr>`).join("")}
      </tbody>
    </table>
    ${caveatsHTML()}`;
}

// Share of a state's people by the script of their mother tongue.
function stateScriptsHTML(name) {
  if (!scriptData) return "";
  const s = census.states[name];
  const by = {};
  for (const [l, n] of s.languages) {
    const sc = scriptData.languages[l]?.script || "";
    by[sc] = (by[sc] || 0) + n;
  }
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1]).filter(([, n]) => n / s.population >= 0.001);
  return `<h3>Scripts</h3>
    <table class="langs scripts"><tbody>${rows.map(([sc, n]) => {
      const m = scriptData.scripts[sc];
      return `<tr><td class="g" style="font-family:'${m?.font || "inherit"}';color:${m ? SCRIPT_GROUP_COLOUR[m.group] : "inherit"}">${m ? m.glyph : "·"}</td>
        <td>${m ? esc(m.name) : "Not recorded"}</td><td class="num">${pct(n / s.population)}</td></tr>`;
    }).join("")}</tbody></table>`;
}

// ---------- night sky ----------
// A dark map where every language in a state is a soft light, sized by speakers (scripts/build_night.py).
// A one-language state is a single big glow; a diverse state is a constellation. Positions inside a
// state are decorative: the census gives one total per state.

let nightLoaded = false;

async function ensureNight() {
  if (nightLoaded) return;
  nightLoaded = true;
  const [data, outline] = await Promise.all(["data/night.geojson", "data/india_outline.geojson"]
    .map((u) => fetch(u, { cache: "no-cache" }).then((r) => r.json())));
  // A softly glowing border around India, under the lights.
  map.addSource("india-outline", { type: "geojson", data: outline });
  map.addLayer({ id: "outline-glow", type: "line", source: "india-outline",
    paint: { "line-color": NIGHT.border, "line-width": 7, "line-blur": 6, "line-opacity": 0.35 } });
  map.addLayer({ id: "outline", type: "line", source: "india-outline",
    paint: { "line-color": NIGHT.border, "line-width": 1.2, "line-opacity": 0.85 } });
  map.addSource("stars", { type: "geojson", data });
  // Radii are stored for the all-India zoom; grow them gently as you zoom in.
  // (MapLibre needs the zoom interpolation at the top of the expression.)
  const size = (k) => ["interpolate", ["exponential", 1.6], ["zoom"],
    ...[[3, 0.7], [4.5, 1], [6, 2.4], [8, 5], [10, 9]].flatMap(([z, g]) => [z, ["*", ["get", "r"], k * g]])];
  // Small languages are dimmer as well as smaller, so a one-language state reads as one glow.
  const bright = ["interpolate", ["linear"], ["get", "r"], 1.4, 0.45, 3, 0.8, 6, 1];
  map.addLayer({ id: "star-halo", type: "circle", source: "stars",
    paint: { "circle-radius": size(2.2), "circle-blur": 1, "circle-opacity": twinkle(bright, 0.3, 0.45, 0) } });
  map.addLayer({ id: "star-core", type: "circle", source: "stars",
    paint: { "circle-radius": size(1), "circle-blur": 0.5, "circle-opacity": twinkle(bright, 1, 0.12, 0) } });
  startTwinkle(bright);
}

// Twinkle: opacity = base * level * (1 - depth/2 + depth/2 * sin(t + phase)), each light with its own phase.
// MapLibre expressions have no clock, so the page re-sets the opacity with a new t a few times a second.
function twinkle(bright, level, depth, t) {
  return ["*", bright, level, ["+", 1 - depth / 2, ["*", depth / 2, ["sin", ["+", t, ["get", "ph"]]]]]];
}
function startTwinkle(bright) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const t0 = performance.now();
  setInterval(() => {
    if (!isNight() || document.hidden || !map.getLayer("star-core")) return;
    const t = (performance.now() - t0) / 900; // about one slow pulse every 6 s
    map.setPaintProperty("star-halo", "circle-opacity", twinkle(bright, 0.3, 0.45, t));
    map.setPaintProperty("star-core", "circle-opacity", twinkle(bright, 1, 0.12, t));
  }, 120);
}

const lightColour = () => (style.lights === "warm" ? NIGHT.warm
  : ["match", ["get", "fam"], ...Object.entries(GLOW).flatMap(([f, c]) => [f, c]), GLOW.Other]);

// Switch the base map between its normal look and the dark night look.
function applyNight() {
  const on = isDarkView();
  ["script-glyph", "script-unknown"].forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", isScripts() ? "visible" : "none");
  });
  map.setPaintProperty("bg", "background-color", on ? NIGHT.bg : v("--bg"));
  ["outline-glow", "outline", "star-halo", "star-core"].forEach((id) => {
    if (!map.getLayer(id)) return;
    map.setLayoutProperty(id, "visibility", (id.startsWith("star") ? isNight() : on) ? "visible" : "none");
    if (id.startsWith("star")) map.setPaintProperty(id, "circle-color", lightColour());
  });
  map.setPaintProperty("hover", "line-color", on ? "#8fa3d6" : v("--ink"));
  map.setPaintProperty("sel", "line-color", on ? "#dfe4f0" : v("--ink"));
  map.setLayoutProperty("small-dot", "visibility", on ? "none" : "visible"); // tiny UTs have their own lights
  if (!on) return;
  hexLayers().forEach((id) => map.setLayoutProperty(id, "visibility", "none"));
  map.setPaintProperty("fill", "fill-color", NIGHT.land);
  map.setPaintProperty("fill", "fill-opacity", 1);
  map.setPaintProperty("edge", "line-color", NIGHT.edge);
  map.setPaintProperty("edge", "line-width", 0.6);
  map.setPaintProperty("edge", "line-opacity", 1);
}

// Notes shown when hovering a language's light (night sky and scripts views).
const LANG_NOTE = {
  Sanskrit: "Reported as a mother tongue by people who use it at home, but also as a matter of identity or devotion: India's count swung from 49,736 (1991) to 14,135 (2001) to 24,821 (2011).",
};
const langNote = (l) => (LANG_NOTE[l] ? `<br><span class="muted tip-note">${esc(LANG_NOTE[l])}</span>` : "");

function starTip(p) {
  return `<b>${esc(p.lang)}</b> <span class="muted">· ${esc(p.fam)}</span><br>
    ${big(p.n)} speakers · ${pct(p.share)} of ${esc(p.st)}${langNote(p.lang)}`;
}

function nightLegendHTML() {
  const r = (n) => 2 * (1.2 + 2.2 * Math.cbrt(n / 1e6)); // same scale as build_night.py, as a diameter
  const sizes = [[1e3, "1k"], [1e5, "1 lakh"], [1e7, "1 crore"]];
  return `<div class="lg-title">Each light is a language</div>
    <div class="lg-size">${sizes.map(([n, l]) => `<span><i style="width:${r(n)}px;height:${r(n)}px"></i>${l}</span>`).join("")}</div>
    ${style.lights === "warm" ? `<div class="lg-note">speakers in the state</div>`
      : Object.entries(GLOW).map(([f, c]) => `<div class="lg-row"><span class="lg-glow" style="background:${c};box-shadow:0 0 6px ${c}"></span>${f === "Other" ? "Other (English …)" : f}</div>`).join("")}`;
}

function nightHomeHTML() {
  return `
    <h2>India at night, by language</h2>
    <p>Every one of the census's 121 languages spoken by at least 1,000 people in a state is a <b>light</b>, sized by its speakers in the 2011 Census.
    A state where nearly everyone shares one language is a <b>single bright glow</b>; a diverse state is a
    <b>constellation</b> of many small lights.</p>
    <p class="muted">Where a light sits inside its state means nothing: the census counts each state as a whole.
    The largest language is placed near the middle and the others are scattered around it.
    Mother tongues grouped under a language share its light (Bhojpuri is inside Hindi's), and the few people whose
    mother tongue is outside the 121 have no light.</p>
    <p class="muted">Hover a light to see its language, or click a state for its full list.</p>
    <h3>States by effective number of languages</h3>
    <button type="button" class="formula-link" data-formulas="">ƒ How are these calculated?</button>
    ${rankingHTML()}
    ${caveatsHTML()}`;
}

function cellTip({ li, st }) {
  const s = census.states[st];
  if (li < 0) {
    const outside = s.population - s.languages.reduce((a, [, n]) => a + n, 0);
    return `<b>Outside the 121 languages</b><br>${pct(outside / s.population)} of ${esc(st)}`;
  }
  const [name, fam] = mosaic.langs[li];
  const r = rankIn[st][name];
  const n = s.languages[r][1];
  return `<b>${esc(name)}</b> <span class="muted">· ${esc(fam)}</span><br>${pct(n / s.population)} of ${esc(st)}
    <br><span class="muted">${r === 0 ? "Largest" : ordinal(r + 1) + " largest"} language there · ${s.n1pct} at 1% or more</span>`;
}

function mosaicHomeHTML() {
  const intro = state.metric === "mosaic"
    ? `<h2>A mosaic of mother tongues</h2>
      <p>Each state is filled with hexagons, shared out among its languages in proportion to speakers in the 2011 Census.
      ${style.fade
        ? `The <b>largest language fades into the background</b>; every other language is a stronger shade, darkest for the
          second largest. A state that speaks one language stays pale; a diverse state fills with colour.`
        : `The <b>darkest shade is the state's largest language</b>, and each smaller language is lighter.
          A state that speaks one language is one flat colour; a diverse state is a patchwork.`}</p>`
    : `<h2>Language families</h2>
      <p>The same hexagons, coloured by <b>language family</b>: Indo-Aryan, Dravidian, Austro-Asiatic and Tibeto-Burmese,
      the main families the census groups India's languages into, plus a few others such as English.</p>`;
  return `${intro}
    <p class="muted">The census counts each state as a whole, so <b>where a cell sits inside a state means nothing</b>.
    ${PUBLIC ? "" : "Use the style box to scatter the cells, gather them into rings or lay them out in stripes. "}Zoom in for finer cells.</p>
    <p class="muted">Hover a cell to see its language, or click a state for its full list.</p>
    <h3>States by effective number of languages</h3>
    <button type="button" class="formula-link" data-formulas="">ƒ How are these calculated?</button>
    ${rankingHTML()}
    ${caveatsHTML()}`;
}

// ---------- controls ----------

function renderMetricBar() {
  const views = [...Object.entries(VIEWS), ...Object.entries(METRICS).map(([k, m]) => [k, m.label])].filter(([k]) => viewAllowed(k));
  $("#metric-bar").innerHTML = views
    .map(([k, label]) => `<button role="radio" aria-checked="${k === state.metric}" data-m="${k}" class="${k === state.metric ? "on" : ""}">${label}</button>`)
    .join("");
  if (typeof showVoiceMarkers === "function") showVoiceMarkers();
}

function renderLegend() {
  const outside = `<div class="lg-row"><span class="lg-sw" style="background:${outsideColor()}"></span>Outside the 121</div>` +
    (style.tiles === "diversity" ? `<div class="lg-note">Smaller tiles = more languages</div>` : "");
  $("#legend").classList.toggle("mosaic", isHexView() || isDarkView());
  $(".mapwrap").classList.toggle("night", isDarkView()); // dark map area, set before the map finishes loading
  if (isNight()) { $("#legend").innerHTML = nightLegendHTML(); return; }
  if (isScripts()) { $("#legend").innerHTML = scriptsLegendHTML(); return; }
  if (isVoices()) {
    const fams = [...new Set(Object.keys(census.states).map(voiceFamily).filter(Boolean).map(famKey))];
    $("#legend").innerHTML = `<div class="lg-title">Family of the language you hear</div>` +
      Object.keys(FAMILY).filter((f) => fams.includes(f)).map((f) =>
        `<div class="lg-row"><span class="lg-sw" style="background:${famColor(f)}"></span>${f}</div>`).join("");
    return;
  }
  if (byRank()) {
    const labels = ["Largest language", "2nd", "3rd", "4th", "5th and smaller"];
    $("#legend").innerHTML = `<div class="lg-title">Language rank in its state</div>` +
      rankColors().map((c, i) => `<div class="lg-row"><span class="lg-sw" style="background:${c}"></span>${labels[i]}</div>`).join("") + outside;
    return;
  }
  if (state.metric === "families") {
    $("#legend").innerHTML = `<div class="lg-title">Language family</div>` +
      Object.keys(FAMILY).map((f) => `<div class="lg-row"><span class="lg-sw" style="background:${famColor(f)}"></span>${f === "Other" ? "Other (English …)" : f}</div>`).join("") +
      outside;
    return;
  }
  const M = METRICS[state.metric];
  const b = M.breaks;
  const labels = [`< ${M.fmt(b[0])}`, ...b.slice(0, -1).map((x, i) => `${M.fmt(x)}–${M.fmt(b[i + 1])}`), `≥ ${M.fmt(b[b.length - 1])}`];
  $("#legend").innerHTML = `<div class="lg-title">${M.label}</div>` +
    BLUE.map((c, i) => `<div class="lg-row"><span class="lg-sw" style="background:${c}"></span>${labels[i]}</div>`).join("");
}

$("#metric-bar").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-m]");
  if (!b) return;
  state.metric = b.dataset.m;
  try { history.replaceState(null, "", `?m=${state.metric}`); } catch {}
  applyView();
  renderMetricBar();
  renderLegend();
  render();
});

// ---------- panel ----------

function rankingHTML() {
  const key = metricKey();
  const M = METRICS[key];
  const rows = states.features.map((f) => f.properties).sort((a, b) => b[key] - a[key]);
  const max = Math.max(...rows.map((r) => r[key]));
  return `<table class="rank">
    <caption class="sr">States ranked by ${esc(M.label)}</caption>
    <thead><tr><th scope="col">State / UT</th><th scope="col" class="num">${esc(M.label)}</th></tr></thead>
    <tbody>${rows.map((r) => `<tr data-state="${esc(r.name)}" tabindex="0">
      <td>${esc(r.name)}</td>
      <td class="num"><span class="bar" style="width:${(60 * r[key]) / max}px"></span>${M.fmt(r[key])}</td></tr>`).join("")}
    </tbody></table>`;
}

function voicesHomeHTML() {
  const rows = Object.entries(voices.states).filter(([, v]) => v.clips.length).sort(([a], [b]) => a.localeCompare(b));
  return `
    <h2>Hear India</h2>
    <p>Press <b>▶</b> on a state to hear a few seconds of its <b>largest language</b>, spoken by people who live there.
    Press again for another speaker. Each state is coloured by the family of that language.</p>
    <p class="muted">Speakers are describing everyday pictures. Where a language or place is missing from the recordings,
    the state's note says what you hear instead.</p>
    <table class="voices-list">
      <caption class="sr">Speech samples by state</caption>
      <tbody>${rows.map(([st, v]) => `<tr>
        <th scope="row"><a href="#" data-goto="${esc(st)}">${esc(st)}</a><span class="muted"> · ${esc(v.language)}</span></th>
        <td>${v.clips.map((c, i) => `<button class="clip" data-st="${esc(st)}" data-i="${i}"
          title="${esc(c.gender)} speaker recorded in ${esc(c.recorded_in)}" aria-label="Play ${esc(v.language)} speaker ${i + 1}">▶</button>`).join("")}</td>
      </tr>`).join("")}</tbody>
    </table>
    <p class="muted">Speech from <a href="https://vaani.iisc.ac.in/" target="_blank" rel="noopener">Vaani</a> (IISc &amp; ARTPARK, CC-BY-4.0).
    Languages are as the speakers stated them.</p>`;
}

function homeHTML() {
  if (isNight()) return nightHomeHTML();
  if (isScripts()) return scriptsHomeHTML();
  if (isVoices()) return voicesHomeHTML();
  if (isHexView()) return mosaicHomeHTML();
  const M = METRICS[state.metric];
  return `
    <h2>How many languages does a state speak?</h2>
    <p>The 2011 Census grouped the mother tongues people reported into <b>121 languages</b>:
    22 in the Eighth Schedule and 99 outside it. The map shades each state by how evenly its people are spread across them.</p>
    <p class="muted">${M.explain}</p>
    <p class="muted">Click a state to see its languages.</p>
    <h3>All states and UTs</h3>
    <button type="button" class="formula-link" data-formulas="">ƒ How are these calculated?</button>
    ${rankingHTML()}
    ${caveatsHTML()}`;
}

function familyBar(fams) {
  const entries = Object.entries(fams);
  const total = entries.reduce((s, [, x]) => s + x, 0);
  const merged = {};
  for (const [f, x] of entries) merged[famKey(f)] = (merged[famKey(f)] || 0) + x;
  const order = Object.keys(FAMILY).filter((f) => merged[f]);
  return `<div class="stack" role="img" aria-label="${order.map((f) => `${f} ${pct(merged[f] / total)}`).join(", ")}">
      ${order.map((f) => `<span style="flex:${merged[f]};background:${famColor(f)}" title="${f} ${pct(merged[f] / total)}"></span>`).join("")}
    </div>
    <div class="fam-legend">${order.map((f) => `<span><i style="background:${famColor(f)}"></i>${f} ${pct(merged[f] / total)}</span>`).join("")}</div>`;
}

function stateHTML(name) {
  const s = census.states[name];
  const top = s.languages.slice(0, 12);
  const rest = s.languages.slice(12);
  const restSpeakers = rest.reduce((a, [, n]) => a + n, 0);
  // People whose mother tongue is outside the 121 languages (e.g. Mahl on Minicoy, Lakshadweep).
  const outside = s.population - s.languages.reduce((a, [, n]) => a + n, 0);
  const maxShare = top[0][1] / s.population;
  return `
    <button class="back" id="back">← All states</button>
    <h2>${esc(name)}</h2>
    <p class="muted">${big(s.population)} people in 2011${s.note ? ` · ${esc(s.note)}` : ""}</p>
    <div class="kpis">
      <div><b>${s.ldi.toFixed(2)}</b><span>diversity index</span></div>
      <div><b>${s.eff.toFixed(1)}</b><span>effective languages</span></div>
      <div><b>${s.n1pct}</b><span>languages ≥ 1%</span></div>
    </div>
    <p>Pick two people at random: <b>${Math.round(s.ldi * 100)} times in 100</b> they report different mother tongues.
      <button type="button" class="formula-link" data-formulas="${esc(name)}">ƒ How are these calculated?</button></p>
    ${listenHTML(name)}
    <h3>Language families <span class="muted">(of the 121 languages)</span></h3>
    ${familyBar(s.families)}
    ${isScripts() ? stateScriptsHTML(name) : ""}
    <h3>Largest languages</h3>
    <table class="langs">
      <thead><tr><th scope="col">Language</th><th scope="col" class="num">Share</th><th scope="col" class="num">Speakers</th></tr></thead>
      <tbody>${top.map(([l, n, f]) => `<tr>
        <td><i style="background:${langSwatch(l, f, name)}" title="${esc(f)}"></i>${esc(l)}</td>
        <td class="num"><span class="bar" style="width:${(70 * (n / s.population)) / maxShare}px;background:${langSwatch(l, f, name)}"></span>${pct(n / s.population)}</td>
        <td class="num">${big(n)}</td></tr>`).join("")}
      </tbody>
    </table>
    ${outside / s.population >= 0.005 ? `<p class="outside"><b>${pct(outside / s.population)}</b> (${big(outside)} people) reported a mother tongue
      outside the census's 121 languages. The census does not name it in this table.</p>` : ""}
    ${rest.length ? `<p class="muted">Plus ${rest.length} more of the 121 languages with ${big(restSpeakers)} speakers between them (${pct(restSpeakers / s.population)}).</p>` : ""}
    ${caveatsHTML()}`;
}

function caveatsHTML() {
  return `<details class="caveats"><summary>How to read this</summary>
    <ul>
      <li><b>Languages are census groupings.</b> People wrote 19,569 different names for their mother tongue; the census
        sorted these into 1,369 mother tongues (plus 1,474 unclassified names) and grouped them under 121 languages.
        "Hindi" alone includes Bhojpuri, Rajasthani, Chhattisgarhi, Magahi and 51 more (56 mother tongues in all), so the Hindi-speaking states look more uniform here than they sound.</li>
      <li><b>Mother tongue only.</b> Second and third languages people speak are not counted.</li>
      <li><b>2011 boundaries.</b> Andhra Pradesh includes Telangana and Jammu &amp; Kashmir includes Ladakh. Dadra &amp; Nagar Haveli and Daman &amp; Diu are shown separately, as in 2011.</li>
      <li>Speakers of languages outside the 121 (0.15% of India) are counted in each state's population but not as a language.</li>
    </ul>
    <p class="muted">Source: Census of India 2011, <i>Language: India, States and Union Territories</i> (Paper 1 of 2018), Table C-16 and Statement 9.
    Boundaries: <a href="https://github.com/datta07/INDIAN-SHAPEFILES" target="_blank" rel="noopener">INDIAN-SHAPEFILES</a>, merged to 2011 units.</p>
  </details>`;
}

function render() {
  if (REVIEW) return; // the review page owns the panel
  $("#panel-body").innerHTML = state.selected ? stateHTML(state.selected) : homeHTML();
  if (typeof updatePlayer === "function" && voices) updatePlayer();
}

function boundsOf(name) {
  const f = states.features.find((x) => x.properties.name === name);
  const b = new maplibregl.LngLatBounds();
  const walk = (c) => (typeof c[0] === "number" ? b.extend(c) : c.forEach(walk));
  walk(f.geometry.coordinates);
  return b;
}

function select(name) {
  state.selected = name;
  if (REVIEW) {  // just show where the clip is from
    if (map.getLayer("sel")) map.setFilter("sel", ["==", ["get", "name"], name || ""]);
    return map.fitBounds(name ? boundsOf(name) : INDIA, { padding: name ? 60 : pad(), maxZoom: name ? 6.5 : 5, duration: 600 });
  }
  if (map.getLayer("sel")) map.setFilter("sel", ["==", ["get", "name"], name || ""]);
  // Zoom in on small states so they can be seen; go back to all of India otherwise.
  map.fitBounds(name ? boundsOf(name) : INDIA, { padding: name ? 60 : pad(), maxZoom: name ? 6.5 : 5, duration: 600 });
  render();
  $("#panel").scrollTop = 0;
}


// ---------- voices: short speech samples of each state's dominant language ----------
// site/data/voices.json, built by scripts/sample_vaani_states.py from Vaani (CC-BY-4.0).
// A play button sits on every state (all views); the state panel lists the clips.


function playVoice(st, i) {
  const v = voices?.states[st];
  if (!v || !v.clips.length) return;
  if (player.st === st && player.i === i && !audio.paused) { audio.pause(); return updatePlayer(); }
  player.st = st;
  player.i = i % v.clips.length;
  audio.src = v.clips[player.i].file;
  audio.play().catch(() => {});
  updatePlayer();
}
audio.addEventListener("ended", () => { player.i = -1; updatePlayer(); });
audio.addEventListener("pause", updatePlayer);

function updatePlayer() {
  const playing = !audio.paused && player.i >= 0;
  for (const [st, el] of Object.entries(voiceMarkers)) el.classList.toggle("playing", playing && player.st === st);
  document.querySelectorAll("button.clip").forEach((b) =>
    b.classList.toggle("on", playing && b.dataset.st === player.st && +b.dataset.i === player.i));
}

function addVoiceMarkers() {
  if (!voices) return;
  for (const f of states.features) {
    const st = f.properties.name, v = voices.states[st];
    if (!v || !v.clips.length) continue;
    const el = document.createElement("button");
    el.className = "voice-pin";
    el.title = `Hear ${v.language} (${st})`;
    el.setAttribute("aria-label", el.title);
    // Each click plays the next speaker, so a second click is a different voice.
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const next = player.st === st ? (player.i + 1) % v.clips.length : 0;
      if (state.selected !== st) select(st);
      playVoice(st, next < 0 ? 0 : next);
    });
    voiceMarkers[st] = el;
    new maplibregl.Marker({ element: el }).setLngLat([f.properties.lx, f.properties.ly]).addTo(map);
  }
  showVoiceMarkers();
}
function showVoiceMarkers() {
  Object.values(voiceMarkers).forEach((el) => { el.style.display = isVoices() ? "" : "none"; });
}

function listenHTML(name) {
  const v = voices?.states[name];
  if (!v || !v.clips.length) return "";
  const s = census.states[name];
  const row = v.census_rank == null ? null : s.languages[v.census_rank];
  const share = row ? ` the mother tongue of ${pct(row[1] / s.population)} of people here` : "";
  return `<div class="listen">
    <h3>Listen</h3>
    <p><b>${esc(v.language)}</b>,${share}.</p>
    <div class="clips">${v.clips.map((c, i) => `<button class="clip" data-st="${esc(name)}" data-i="${i}"
      title="${esc(c.gender)} speaker recorded in ${esc(c.recorded_in)}">▶ ${c.gender === "Female" ? "♀" : c.gender === "Male" ? "♂" : ""} ${c.duration.toFixed(0)} s</button>`).join("")}</div>
    ${v.note ? `<p class="muted">${esc(v.note)}</p>` : ""}
    ${voiceTotals.reviewed ? "" : `<p class="muted">These clips have not been reviewed yet.</p>`}
    <p class="muted">Speakers describing everyday pictures, from <a href="https://vaani.iisc.ac.in/" target="_blank" rel="noopener">Vaani</a> (IISc &amp; ARTPARK, CC-BY-4.0). Languages are as the speakers stated them.</p>
  </div>`;
}

$("#panel").addEventListener("click", (e) => {
  const b = e.target.closest("button.clip");
  if (b) playVoice(b.dataset.st, +b.dataset.i);
});

$("#panel").addEventListener("click", (e) => {
  if (e.target.closest("#back")) return select(null);
  const go = e.target.closest("[data-goto]");
  if (go) { e.preventDefault(); return select(go.dataset.goto); }
  const row = e.target.closest("tr[data-state]");
  if (row) select(row.dataset.state);
});
$("#panel").addEventListener("keydown", (e) => {
  const row = e.target.closest("tr[data-state]");
  if (row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(row.dataset.state); }
});

render();

if (REVIEW && voices) {
  const { startReview } = await import("./review.js");
  const famOf = (st, v) => (v.census_rank == null ? "" : census.states[st].languages[v.census_rank][2]);
  const clips = Object.entries(voices.states).flatMap(([st, v]) => v.clips.map((c) => ({
    ...c, language: v.language, family: famOf(st, v), district: st,
    districtName: `${st} · recorded in ${c.recorded_in.replace(/([a-z])([A-Z])/g, "$1 $2")}`,
  })));
  await startReview({
    clips, panel: $("#panel-body"),
    families: Object.fromEntries(Object.keys(FAMILY).map((f) => [f, { color: famColor(f) }])),
    showDistrict: (st) => select(st),
  });
}

// Data & credits dialog (footer link)
$("#credits-open")?.addEventListener("click", () => $("#credits").showModal());

// ---------- formulae: diversity index and effective number of languages (KaTeX, loaded on first use) ----------
const KATEX = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/";
let katexReady = null;
function loadKatex() {
  if (katexReady) return katexReady;
  const css = document.createElement("link");
  css.rel = "stylesheet"; css.href = KATEX + "katex.min.css";
  document.head.appendChild(css);
  katexReady = new Promise((ok) => {
    const js = document.createElement("script");
    js.src = KATEX + "katex.min.js";
    js.onload = () => ok(true);
    js.onerror = () => ok(false); // without KaTeX the TeX source is shown as text
    document.head.appendChild(js);
  });
  return katexReady;
}

function formulasHTML(st) {
  // Worked example: the chosen state, or Assam from the home panel.
  const name = st && census.states[st] ? st : "Assam";
  const c = census.states[name];
  const N = c.population;
  const p = c.languages.map(([, n]) => n / N);
  const s2 = p.reduce((a, x) => a + x * x, 0);
  const f = (x, d = 3) => x.toFixed(d);
  const top = c.languages.slice(0, 3);
  const terms = top.map(([, n]) => `${f(n / N)}^2`).join(" + ") + (c.languages.length > 3 ? " + \\dots" : "");
  return `
    <p>For a state with <span class="tex">N</span> people, of whom <span class="tex">n_i</span> report language
    <span class="tex">i</span> (one of the census's 121 languages) as their mother tongue, the share of language
    <span class="tex">i</span> is</p>
    <div class="tex-block">p_i = \\frac{n_i}{N}</div>
    <p>The sum of squared shares, <span class="tex">\\sum_i p_i^2</span>, is the chance that <b>two people picked at random
    share a mother tongue</b>: both speak language <span class="tex">i</span> with probability <span class="tex">p_i \\times p_i</span>,
    added over all languages.</p>
    <h3>Diversity index</h3>
    <div class="tex-block">D = 1 - \\sum_{i} p_i^{2}</div>
    <p>The chance that two random people report <b>different</b> mother tongues (Greenberg 1956). 0 when everyone
    speaks one language; close to 1 when there are many languages of similar size.</p>
    <h3>Effective number of languages</h3>
    <div class="tex-block">L_{\\text{eff}} = \\frac{1}{\\sum_{i} p_i^{2}} = \\frac{1}{1 - D}</div>
    <p>The number of <b>equally large</b> languages that would give the same diversity. With <span class="tex">K</span>
    languages of equal size, each <span class="tex">p_i = 1/K</span>, so
    <span class="tex">\\sum_i p_i^2 = K \\cdot \\tfrac{1}{K^2} = \\tfrac{1}{K}</span> and
    <span class="tex">L_{\\text{eff}} = K</span>. A 50:50 state scores 2; a 90:10 state scores about 1.2.
    It is the same quantity as the "effective number of parties" in political science (Laakso &amp; Taagepera 1979)
    and Hill's diversity number of order 2 in ecology (Hill 1973).</p>
    <h3>Worked example: ${esc(name)}</h3>
    <div class="tex-block">\\sum_i p_i^2 = ${terms} = ${f(s2)}</div>
    <div class="tex-block">D = 1 - ${f(s2)} = ${f(1 - s2, 2)}, \\qquad L_{\\text{eff}} = \\frac{1}{${f(s2)}} = ${f(1 / s2, 1)}</div>
    <p class="muted">${top.map(([l, n]) => `${esc(l)} ${pct(n / N)}`).join(", ")}${c.languages.length > 3 ? `, and ${c.languages.length - 3} more` : ""}.
    <span class="tex">N</span> is the state's whole population, so the few people whose mother tongue is outside the 121
    languages lower every share slightly but are not counted as a language of their own.</p>
    <p class="muted refs">Greenberg, J. H. (1956). The measurement of linguistic diversity. <i>Language</i> 32(1), 109–115.<br>
    Laakso, M. &amp; Taagepera, R. (1979). "Effective" number of parties. <i>Comparative Political Studies</i> 12(1), 3–27.<br>
    Hill, M. O. (1973). Diversity and evenness: a unifying notation and its consequences. <i>Ecology</i> 54(2), 427–432.</p>`;
}

async function openFormulas(st) {
  const dlg = $("#formulas");
  const body = dlg.querySelector(".formulas-body");
  body.innerHTML = formulasHTML(st);
  dlg.showModal();
  if (await loadKatex()) {
    body.querySelectorAll(".tex, .tex-block").forEach((el) => {
      try { katex.render(el.textContent, el, { displayMode: el.classList.contains("tex-block"), throwOnError: false }); } catch {}
    });
  }
}
$("#panel").addEventListener("click", (e) => {
  const b = e.target.closest("[data-formulas]");
  if (b) openFormulas(b.dataset.formulas);
});
