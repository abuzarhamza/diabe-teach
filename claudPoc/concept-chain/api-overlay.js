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
// The overlay draws in its own layer (appended to <html>, outside the page root), re-scans after
// page re-renders via a MutationObserver on <body>, and never calls preventDefault on page elements.
/* eslint-disable */
const CCOverlay = (() => {
  const SEL = "[data-api]";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const json = (v) => esc(JSON.stringify(v, null, 2));

  const STORE_KEY = "cc-api-overlay"; // own key: separate from the demo session store and the learner identity
  let on = false, layer = null, card = null, observer = null, current = null, frame = 0;
  const toggles = [];
  const remember = (value) => { try { if (value) sessionStorage.setItem(STORE_KEY, "on"); else sessionStorage.removeItem(STORE_KEY); } catch {} };
  const remembered = () => { try { return sessionStorage.getItem(STORE_KEY) === "on"; } catch { return false; } };
  const pressed = () => toggles.forEach((t) => t.setAttribute("aria-pressed", String(on)));
  const cat = () => window.CC_API_CATALOG;

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
    const marks = [];
    document.querySelectorAll(SEL).forEach((el) => {
      const info = resolve(el.dataset.api); if (!info) return;
      const r = el.getBoundingClientRect(); if (!r.width && !r.height) return; // hidden
      const x = r.left + scrollX, y = r.top + scrollY;
      const io = el.dataset.apiIo === "read" ? "read" : "write";
      const actor = info.actor ? cat().actors?.[info.actor] : null;
      const label = info.letter ? `${info.letter}${actor ? ` ${actor.badge}` : ""}${info.missing ? " · missing API" : ""}` : "no API";
      const bad = info.kind === "gap" || info.missing ? " gap" : "";
      marks.push(`<div class="cc-api-box ${io}${bad}" style="left:${x - 3}px;top:${y - 3}px;width:${r.width + 6}px;height:${r.height + 6}px"></div>`
        + `<span class="cc-api-tag ${io}${bad}" aria-hidden="true" style="left:${x - 3}px;top:${y - 3}px">${esc(label)}</span>`);
    });
    layer.querySelector(".cc-api-marks").innerHTML = marks.join("");
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
    layer?.remove(); layer = null; card = null;
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
