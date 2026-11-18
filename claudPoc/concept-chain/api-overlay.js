// API overlay for the Concept Chain screens. Plain browser script (works from file://).
// Needs api-catalog.js (global CC_API_CATALOG) loaded first; reads CC (shared.js) only for live samples.
//
// Pages opt in by marking elements, nothing else:
//   data-api="D"            step letter from CC_API_CATALOG.steps
//   data-api="G.reject"     finer key: CC_API_CATALOG.targets["G.reject"] if present, else step "G"
//   data-api="gap.extend"   UI element with no API: CC_API_CATALOG.gaps.extend
//   data-api-io="write"     sends a request (dashed outline); "read" shows API data (solid outline)
//   data-api-toggle         optional extra place for the toggle (e.g. a view with no header.top);
//                           a toggle goes into every header.top and every [data-api-toggle], all kept in sync
//
// On/off is kept in tab-scoped sessionStorage (STORE_KEY), so it survives join → lobby → game redirects.
//
// When on, a flow legend (steps A → H from CC_API_CATALOG.steps, then CC_API_CATALOG.noScreen) sits
// fixed at the bottom right. Steps with no visible element on this page are dimmed and say which
// screen they're on; clicking a step flashes its elements. Collapsed/open is kept in LEGEND_KEY.
//
// The overlay draws in its own layer (appended to <html>, outside the page root), re-scans after
// page re-renders via a MutationObserver on <body>, and never calls preventDefault on page elements.
/* eslint-disable */
const CCOverlay = (() => {
  const SEL = "[data-api]";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const json = (v) => esc(JSON.stringify(v, null, 2));

  const STORE_KEY = "cc-api-overlay"; // own key: separate from the demo session store and the learner identity
  const LEGEND_KEY = "cc-api-legend"; // "collapsed" | "open"; unset = open on wide screens, collapsed on narrow
  const FLASH_MS = 1600;
  let on = false, layer = null, card = null, legend = null, observer = null, current = null, frame = 0;
  let flash = null, flashTimer = 0; // { letter } while a legend click is flashing that step's elements
  const toggles = [];
  const remember = (value) => { try { if (value) sessionStorage.setItem(STORE_KEY, "on"); else sessionStorage.removeItem(STORE_KEY); } catch {} };
  const remembered = () => { try { return sessionStorage.getItem(STORE_KEY) === "on"; } catch { return false; } };
  const pressed = () => toggles.forEach((t) => t.setAttribute("aria-pressed", String(on)));
  const cat = () => window.CC_API_CATALOG;
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- catalog lookup (by data-api key only) ----
  // `missing` is true when any operation the element needs has status "missing" (drawn in the bad color).
  function resolve(key) {
    const c = cat(); if (!c || !key) return null;
    const target = c.targets?.[key] ?? {};
    const withMissing = (info) => ({ ...info, missing: info.ops.some((op) => c.operations?.[op]?.status === "missing") });
    if (key.startsWith("gap.")) {
      const gap = c.gaps?.[target.gap ?? key.slice(4)]; if (!gap) return null;
      return withMissing({ kind: "gap", letter: null, title: gap.title, actor: null, ops: target.ops ?? gap.ops ?? [], note: target.note ?? gap.note, variant: target.variant ?? null });
    }
    const letter = target.step ?? key.split(".")[0];
    const step = c.steps?.[letter]; if (!step) return null;
    return withMissing({ kind: "step", letter, title: step.title, actor: step.actor, ops: target.ops ?? step.ops, note: target.note ?? null, variant: target.variant ?? step.variant ?? null });
  }

  // ---- drawing ----
  function schedule() { if (on && !frame) frame = requestAnimationFrame(() => { frame = 0; draw(); }); }

  function draw() {
    if (!layer) return;
    const marks = [], present = new Set();
    document.querySelectorAll(SEL).forEach((el) => {
      const info = resolve(el.dataset.api); if (!info) return;
      const r = el.getBoundingClientRect(); if (!r.width && !r.height) return; // hidden
      if (info.letter) present.add(info.letter);
      const x = r.left + scrollX, y = r.top + scrollY;
      const io = el.dataset.apiIo === "read" ? "read" : "write";
      const actor = info.actor ? cat().actors?.[info.actor] : null;
      const label = info.letter ? `${info.letter}${actor ? ` ${actor.badge}` : ""}${info.missing ? " · missing API" : ""}` : "no API";
      const bad = info.kind === "gap" || info.missing ? " gap" : "";
      const lit = flash && info.letter === flash.letter ? " flash" : "";
      marks.push(`<div class="cc-api-box ${io}${bad}${lit}" style="left:${x - 3}px;top:${y - 3}px;width:${r.width + 6}px;height:${r.height + 6}px"></div>`
        + `<span class="cc-api-tag ${io}${bad}" aria-hidden="true" style="left:${x - 3}px;top:${y - 3}px">${esc(label)}</span>`);
    });
    layer.querySelector(".cc-api-marks").innerHTML = marks.join("");
    updateLegend(present);
    if (current) { if (current.isConnected) placeCard(current); else hideCard(); }
  }

  // ---- card ----
  function opHtml(opId, variant) {
    const c = cat(), base = c.operations?.[opId];
    // A step/target variant (e.g. "instructor-reject") replaces request/response/errors and appends notes.
    const v = variant ? base?.variants?.[variant] : null;
    const op = v ? { ...base, ...v, notes: [...(base.notes ?? []), ...(v.notes ?? [])] } : base;
    if (!op) return `<section class="cc-api-op"><p class="cc-api-dev">Unknown operation ${esc(opId)}</p></section>`;
    let live = null;
    if (typeof op.sample === "function" && window.CC) { try { live = op.sample(window.CC.get(), {}); } catch { live = null; } }
    const req = live?.request ?? op.request, res = live?.response ?? op.response;
    const tag = live ? ` <span class="cc-api-live">example from demo session</span>` : "";
    const list = (items, cls = "") => items?.length ? `<ul class="${cls}">${items.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : "";
    const statusCls = { implemented: "good", partial: "warn", "specced-only": "warn", missing: "bad" }[op.status] ?? "warn";
    return `<section class="cc-api-op">
      <div class="cc-api-head"><code class="cc-api-opid">${esc(op.status === "missing" ? `${opId} (proposed)` : opId)}</code><span class="cc-api-status ${statusCls}">${esc(c.statusLabels?.[op.status] ?? op.status)}</span></div>
      ${op.method ? `<div class="cc-api-path"><b>${esc(op.method)}</b> <code>${esc(op.path)}</code></div>` : ""}
      ${op.auth?.length ? `<h4>Auth</h4>${list(op.auth.map((a) => c.authLabels?.[a] ?? a))}` : ""}
      ${req !== undefined && req !== null ? `<h4>Sample request${tag}</h4><pre>${json(req)}</pre>` : ""}
      ${res ? `<h4>Sample response${tag}</h4><pre>${esc(res.status)} ${json(res.body)}</pre>` : ""}
      ${op.errors?.length ? `<h4>Errors</h4><ul class="cc-api-errs">${op.errors.map((e) => `<li><b>${esc(e.status)}</b> <code>${esc(e.code)}</code></li>`).join("")}</ul>` : ""}
      ${op.notes?.length ? `<h4>Notes</h4>${list(op.notes)}` : ""}
      ${op.deviations?.length ? `<h4>Code vs spec</h4>${list(op.deviations, "cc-api-dev")}` : ""}
    </section>`;
  }

  function cardHtml(info) {
    const actor = info.actor ? cat().actors?.[info.actor] : null;
    const head = info.kind === "gap"
      ? `<div class="cc-api-title"><span class="cc-api-step gap">no API</span> ${esc(info.title)}</div>`
      : `<div class="cc-api-title"><span class="cc-api-step">${esc(info.letter)}</span> ${esc(info.title)}${actor ? ` <span class="cc-api-actor">${actor.badge} ${esc(actor.label)}</span>` : ""}</div>`;
    return head + (info.note ? `<p class="cc-api-note">${esc(info.note)}</p>` : "") + info.ops.map((op) => opHtml(op, info.variant)).join("");
  }

  function showCard(el) {
    const info = resolve(el.dataset.api); if (!info) return;
    if (current && current !== el) current.removeAttribute("aria-describedby");
    current = el;
    card.innerHTML = cardHtml(info);
    card.hidden = false;
    el.setAttribute("aria-describedby", card.id);
    placeCard(el);
  }

  function hideCard() {
    if (current) current.removeAttribute("aria-describedby");
    current = null;
    if (card) card.hidden = true;
  }

  // Below the element if it fits, else above, else beside it (right, then left); otherwise on the
  // roomier of below/above with a shorter, scrollable card. Never covers the element, so its
  // controls stay clickable (e.g. a focused join form's Join button).
  function placeCard(el) {
    const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = innerHeight, gap = 8;
    card.style.left = "0px"; card.style.top = "0px"; card.style.maxHeight = "";
    const w = card.offsetWidth, h = card.offsetHeight;
    const clampX = (x) => Math.max(gap, Math.min(x, vw - w - gap));
    const clampY = (y) => Math.max(gap, Math.min(y, vh - h - gap));
    const below = vh - r.bottom - 2 * gap, above = r.top - 2 * gap;
    let left, top;
    if (h <= below) { left = clampX(r.left); top = r.bottom + gap; }
    else if (h <= above) { left = clampX(r.left); top = r.top - gap - h; }
    else if (vw - r.right - 2 * gap >= w) { left = r.right + gap; top = clampY(r.top); }
    else if (r.left - 2 * gap >= w) { left = r.left - gap - w; top = clampY(r.top); }
    else {
      const room = Math.max(below, above, 120);
      card.style.maxHeight = `${room}px`;
      left = clampX(r.left);
      top = below >= above ? r.bottom + gap : Math.max(gap, r.top - gap - Math.min(h, room));
    }
    card.style.left = `${left + scrollX}px`; card.style.top = `${top + scrollY}px`;
  }


  // ---- flow legend ----
  const SCREEN_LABELS = { teacher: "teacher screen", lobby: "lobby", learner: "learner screen" };
  const where = (screens) => `on ${(screens ?? []).map((s) => SCREEN_LABELS[s] ?? s).join(" / ")}`;
  const STATUS_CLS = { implemented: "good", partial: "warn", "specced-only": "warn", missing: "bad" };

  function statusBadges(ops, variant) {
    const c = cat();
    return [...new Set(ops)].map((opId) => {
      const op = c.operations?.[opId]; if (!op) return "";
      const name = variant && op.variants?.[variant] ? `${opId} (${variant})` : opId;
      return `<span class="cc-api-status ${STATUS_CLS[op.status] ?? "warn"}" title="${esc(name)}">${esc(c.statusLabels?.[op.status] ?? op.status)}</span>`;
    }).join("");
  }

  function legendHtml() {
    const c = cat(), actorOf = (a) => c.actors?.[a];
    const steps = Object.entries(c.steps ?? {}).map(([letter, step]) => {
      const actor = actorOf(step.actor);
      return `<li data-step="${esc(letter)}"><button type="button" class="cc-api-leg-step" title="Flash the ${esc(letter)} elements on this page">
        <span class="cc-api-step">${esc(letter)}</span>
        <span class="cc-api-leg-main"><span class="cc-api-leg-title">${esc(step.title)}${actor ? ` <span class="cc-api-actor" title="${esc(actor.label)}">${actor.badge}</span>` : ""}</span>
        <span class="cc-api-leg-where" data-where="${esc(where(step.screens))}"></span></span>
        <span class="cc-api-leg-status">${statusBadges(step.ops, step.variant)}</span>
      </button></li>`;
    }).join("");
    const none = (c.noScreen ?? []).map((entry) => {
      const actor = actorOf(entry.actor);
      return `<li><span class="cc-api-leg-main"><span class="cc-api-leg-title">${esc(entry.title)}${actor ? ` <span class="cc-api-actor" title="${esc(actor.label)}">${actor.badge}</span>` : ""}</span>
        <code class="cc-api-leg-where">${entry.ops.map(esc).join(", ")}</code></span>
        <span class="cc-api-leg-status">${statusBadges(entry.ops)}</span></li>`;
    }).join("");
    return `<div class="cc-api-leg-head"><button type="button" class="cc-api-leg-toggle" aria-controls="cc-api-leg-body">API flow A → ${esc(Object.keys(c.steps ?? {}).slice(-1)[0] ?? "")}</button></div>
      <div class="cc-api-leg-body" id="cc-api-leg-body">
        <ol class="cc-api-leg-steps">${steps}</ol>
        ${none ? `<h4>No screen yet</h4><ul class="cc-api-leg-none">${none}</ul>` : ""}
        <p class="cc-api-leg-live visually-hidden" aria-live="polite"></p>
      </div>`;
  }

  function legendCollapsed() {
    try { const v = sessionStorage.getItem(LEGEND_KEY); if (v) return v === "collapsed"; } catch {}
    return !matchMedia("(min-width: 921px)").matches; // single-column layout: don't sit over the page
  }

  function setCollapsed(collapsed, persist) {
    if (!legend) return;
    legend.classList.toggle("collapsed", collapsed);
    legend.querySelector(".cc-api-leg-toggle").setAttribute("aria-expanded", String(!collapsed));
    legend.querySelector(".cc-api-leg-body").hidden = collapsed;
    if (persist) { try { sessionStorage.setItem(LEGEND_KEY, collapsed ? "collapsed" : "open"); } catch {} }
  }

  function buildLegend() {
    legend = document.createElement("aside");
    legend.className = "cc-api-legend";
    legend.setAttribute("aria-label", "API flow legend");
    legend.innerHTML = legendHtml();
    legend.querySelector(".cc-api-leg-toggle").addEventListener("click", () => setCollapsed(!legend.classList.contains("collapsed"), true));
    legend.querySelector(".cc-api-leg-steps").addEventListener("click", (e) => {
      const li = e.target instanceof Element ? e.target.closest("li[data-step]") : null;
      if (li) flashStep(li.dataset.step);
    });
    layer.appendChild(legend);
    setCollapsed(legendCollapsed(), false);
  }

  // Dim steps with no visible element on this page and say where they happen instead.
  function updateLegend(present) {
    if (!legend) return;
    legend.querySelectorAll("li[data-step]").forEach((li) => {
      const here = present.has(li.dataset.step);
      li.classList.toggle("off", !here);
      const w = li.querySelector(".cc-api-leg-where");
      const text = here ? "on this screen" : w.dataset.where; // dimmed: not visible on this page right now
      if (w.textContent !== text) w.textContent = text;
      li.querySelector("button").setAttribute("aria-disabled", String(!here));
    });
  }

  // Flash every visible element of one step (pulsing outline; a steady highlight with reduced motion).
  function flashStep(letter) {
    const els = [...document.querySelectorAll(SEL)].filter((el) => {
      const r = el.getBoundingClientRect();
      return (r.width || r.height) && resolve(el.dataset.api)?.letter === letter;
    });
    const live = legend?.querySelector(".cc-api-leg-live");
    if (live) live.textContent = els.length ? `Step ${letter}: ${els.length} element${els.length > 1 ? "s" : ""} highlighted` : `Step ${letter} is not on this screen`;
    if (!els.length) return;
    clearTimeout(flashTimer);
    flash = { letter };
    const r = els[0].getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) els[0].scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    draw();
    flashTimer = setTimeout(() => { flash = null; schedule(); }, FLASH_MS);
  }

  // ---- listeners (delegated, so they survive re-renders) ----
  const marked = (t) => (t instanceof Element ? t.closest(SEL) : null);
  function onOver(e) { const el = marked(e.target); if (el && el !== current) showCard(el); }
  function onOut(e) { const el = marked(e.target); if (el && el === current && !el.contains(e.relatedTarget) && document.activeElement !== el) hideCard(); }
  function onFocusIn(e) { const el = marked(e.target); if (el) showCard(el); }
  function onFocusOut(e) { const el = marked(e.target); if (el && el === current && !el.contains(e.relatedTarget)) hideCard(); }
  function onKey(e) { if (e.key === "Escape" && current) hideCard(); }
  const LISTENERS = [["mouseover", onOver], ["mouseout", onOut], ["focusin", onFocusIn], ["focusout", onFocusOut], ["keydown", onKey]];

  // ---- on / off ----
  function enable() {
    if (on) return; on = true;
    layer = document.createElement("div");
    layer.className = "cc-api-layer";
    layer.innerHTML = `<div class="cc-api-marks"></div><div class="cc-api-card" id="cc-api-card" role="tooltip" hidden></div>`;
    document.documentElement.appendChild(layer); // outside <body>, so the observer never sees our own drawing
    card = layer.querySelector(".cc-api-card");
    buildLegend();
    LISTENERS.forEach(([t, fn]) => document.addEventListener(t, fn, true));
    window.addEventListener("resize", schedule);
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-api", "data-api-io", "hidden", "class", "style"] });
    remember(true); pressed();
    draw();
  }

  function disable() {
    if (!on) return; on = false;
    hideCard();
    LISTENERS.forEach(([t, fn]) => document.removeEventListener(t, fn, true));
    window.removeEventListener("resize", schedule);
    observer?.disconnect(); observer = null;
    if (frame) cancelAnimationFrame(frame); frame = 0;
    clearTimeout(flashTimer); flash = null;
    layer?.remove(); layer = null; card = null; legend = null;
    remember(false); pressed();
  }

  function init() {
    if (toggles.length) return;
    document.querySelectorAll("header.top, [data-api-toggle]").forEach((slot) => {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "btn sm cc-api-toggle";
      toggle.textContent = "API overlay";
      toggle.title = "Show which elements call which API operation";
      toggle.addEventListener("click", () => (on ? disable() : enable()));
      slot.appendChild(toggle);
      toggles.push(toggle);
    });
    pressed();
    if (remembered()) enable();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  return { enable, disable, isOn: () => on, resolve };
})();
