// API overlay for the Concept Chain screens. Plain browser script (works from file://).
// Needs api-catalog.js (global CC_API_CATALOG) loaded first; reads CC (shared.js) only for live samples.
//
// Pages opt in by marking elements, nothing else:
//   data-api="D"            step letter from CC_API_CATALOG.steps
//   data-api="G.reject"     finer key: CC_API_CATALOG.targets["G.reject"] if present, else step "G"
//   data-api="gap.extend"   UI element with no API: CC_API_CATALOG.gaps.extend
//   data-api="nav.setup"    control that only navigates: CC_API_CATALOG.nav.setup (points at the step on that page)
//   data-api-io="write"     sends a request (dashed outline); "read" shows API data (solid outline)
//   data-api-toggle         optional extra place for the toggle (e.g. a view with no header.top);
//                           a toggle goes into every header.top and every [data-api-toggle], all kept in sync
//
// On/off is kept in tab-scoped sessionStorage (STORE_KEY), so it survives join → lobby → game redirects.
//
// When on, a flow legend (the pages from CC_API_CATALOG.screens, steps P, A → H from CC_API_CATALOG.steps,
// then CC_API_CATALOG.noScreen) sits
// fixed at the bottom right. Steps with no visible element on this page are dimmed and say which
// screen they're on; clicking a step flashes its elements. Collapsed/open is kept in LEGEND_KEY.
//
// Tags are buttons in the overlay layer (after the page in Tab order), labelled with step and
// operation. Hover or focus on an element or its tag shows its card (a tooltip that takes no pointer
// events). Clicking, tapping or pressing Enter on a tag pins the card: a non-modal dialog with copy
// buttons for the path, sample request and sample response body; Esc or × closes it and focus goes
// back to the tag. Cards are kept inside the viewport.
//
// Live samples: an operation's sample(CC.peek(), ctx) fills path, request and response from the demo
// session (null when none is stored: the overlay never creates one). ctx = page data from CCOverlay.setContext(fn) + { variant, key, chainId }, where chainId is
// the nearest [data-api-chain] around the element. Cards refresh on page re-renders, typing in page
// fields and demo-session changes in other tabs (storage events).
//
// The overlay draws in its own layer (appended to <html>, outside the page root), re-scans after
// page re-renders via a MutationObserver on <body>, and never calls preventDefault on page elements.
/* eslint-disable */
const CCOverlay = (() => {
  const SEL = "[data-api]";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const json = (v) => esc(JSON.stringify(v, null, 2));

  const STORE_KEY = "cc-api-overlay"; // own key: separate from the demo session store and the learner identity
  const LEGEND_KEY = "cc-api-legend"; // "collapsed" | "open"; unset = open on wide, tall screens, else collapsed
  const FLASH_MS = 1600;
  let on = false, layer = null, card = null, legend = null, observer = null, frame = 0;
  let currentKey = null, pinned = false, cardHtmlNow = "", copyData = [], copyTimer = 0, quietFocus = false;
  let flash = null, flashTimer = 0; // { letter } while a legend click is flashing that step's elements
  const marks = new Map(); // mark key ("<data-api>#<n>") -> { el, wrap, box, tag }
  const keyOf = new WeakMap(); // page element -> its mark key (set on every draw)
  const toggles = [];
  let contextProvider = null; // set by the page: () => plain data for live samples (see setContext)
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
    if (key.startsWith("nav.")) {
      const nav = c.nav?.[key.slice(4)]; if (!nav) return null;
      return { kind: "nav", letter: null, navStep: nav.step ?? null, title: nav.title, actor: null, ops: [], note: nav.note, variant: null, missing: false };
    }
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

  // Text for a tag's accessible name, e.g. "Step E: Submit Concept Chain (submitConceptChain), learner".
  function tagLabel(info) {
    const actor = info.actor ? cat().actors?.[info.actor] : null;
    const ops = info.ops.length ? ` (${info.ops.join(", ")})` : "";
    if (info.kind === "nav") return `Navigation: ${info.title}${info.navStep ? ` (step ${info.navStep} happens there)` : ""}, no API call. Show API card`;
    const head = info.letter ? `Step ${info.letter}: ${info.title}` : `No API: ${info.title}`;
    return `${head}${ops}${actor ? `, ${actor.label}` : ""}${info.missing ? ", missing API" : ""}. Show API card`;
  }

  // Marks (box + tag button) are kept per key and updated in place, so a focused tag keeps focus
  // across page re-renders. The key is the data-api value plus its occurrence on the page.
  function draw() {
    if (!layer) return;
    const root = layer.querySelector(".cc-api-marks"), present = new Set(), seen = [], counts = {};
    document.querySelectorAll(SEL).forEach((el) => {
      const info = resolve(el.dataset.api); if (!info) return;
      const r = el.getBoundingClientRect(); if (!r.width && !r.height) return; // hidden
      if (info.letter) present.add(info.letter);
      const key = `${el.dataset.api}#${(counts[el.dataset.api] = (counts[el.dataset.api] ?? 0) + 1)}`;
      let m = marks.get(key);
      if (!m) {
        const wrap = document.createElement("div");
        wrap.className = "cc-api-mark";
        wrap.innerHTML = `<div class="cc-api-box"></div><button type="button" class="cc-api-tag" aria-haspopup="dialog" aria-controls="cc-api-card" aria-expanded="false"></button>`;
        m = { wrap, box: wrap.firstChild, tag: wrap.lastChild };
        m.tag.dataset.key = key;
        marks.set(key, m);
      }
      m.el = el; keyOf.set(el, key);
      const x = r.left + scrollX, y = r.top + scrollY;
      const io = el.dataset.apiIo === "read" ? "read" : "write";
      const actor = info.actor ? cat().actors?.[info.actor] : null;
      const text = info.kind === "nav" ? `→ ${info.navStep ?? "page"}` : info.letter ? `${info.letter}${actor ? ` ${actor.badge}` : ""}${info.missing ? " · missing API" : ""}` : "no API";
      const bad = info.kind === "nav" ? " nav" : info.kind === "gap" || info.missing ? " gap" : "";
      const lit = flash && info.letter === flash.letter ? " flash" : "";
      const boxCls = `cc-api-box ${io}${bad}${lit}`, tagCls = `cc-api-tag ${io}${bad}`;
      if (m.box.className !== boxCls) m.box.className = boxCls;
      if (m.tag.className !== tagCls) m.tag.className = tagCls;
      Object.assign(m.box.style, { left: `${x - 3}px`, top: `${y - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` });
      Object.assign(m.tag.style, { left: `${x - 3}px`, top: `${y - 3}px` });
      if (m.tag.textContent !== text) m.tag.textContent = text;
      const label = tagLabel(info);
      if (m.tag.getAttribute("aria-label") !== label) m.tag.setAttribute("aria-label", label);
      m.tag.setAttribute("aria-expanded", String(pinned && currentKey === key));
      seen.push(m);
    });
    // Drop marks whose element is gone; keep the rest in page order (that is also the Tab order).
    const keep = new Set(seen);
    for (const [key, m] of marks) if (!keep.has(m)) { m.wrap.remove(); marks.delete(key); }
    seen.forEach((m, i) => { if (root.children[i] !== m.wrap) root.insertBefore(m.wrap, root.children[i] ?? null); });
    updateLegend(present);
    if (currentKey) {
      if (marks.has(currentKey)) { refreshCard(); placeCard(); }
      else closeCard(pinned && layer.contains(document.activeElement)); // element went away
    }
  }

  // ---- card ----
  // Copy buttons (pinned cards only) refer to copyData by index; the text is exactly what is shown.
  function copyBtn(text, what) {
    copyData.push({ text, what });
    return `<button type="button" class="cc-api-copy" data-copy="${copyData.length - 1}">Copy ${esc(what)}</button>`;
  }

  function opHtml(opId, variant, ctx) {
    const c = cat(), base = c.operations?.[opId];
    // A step/target variant (e.g. "instructor-reject") replaces request/response/errors and appends notes.
    const v = variant ? base?.variants?.[variant] : null;
    const op = v ? { ...base, ...v, notes: [...(base.notes ?? []), ...(v.notes ?? [])] } : base;
    if (!op) return `<section class="cc-api-op"><p class="cc-api-dev">Unknown operation ${esc(opId)}</p></section>`;
    let live = null;
    // shared.js declares `const CC` (a global binding, not a window property), so look it up by name.
    const demo = typeof CC !== "undefined" ? CC : null;
    // peek() reads the stored session without creating one (get() would make a default session on login/setup).
    const state = () => (typeof demo.peek === "function" ? demo.peek() : demo.get());
    if (typeof op.sample === "function" && demo) { try { live = op.sample(state(), { ...ctx, variant }); } catch { live = null; } }
    const req = live?.request ?? op.request, res = live?.response ?? op.response, path = live?.path ?? op.path;
    const liveTag = (part) => (live?.[part] !== undefined ? ` <span class="cc-api-live">example from demo session</span>` : "");
    const copy = (value, what) => (pinned ? copyBtn(typeof value === "string" ? value : JSON.stringify(value, null, 2), what) : "");
    const list = (items, cls = "") => items?.length ? `<ul class="${cls}">${items.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : "";
    const statusCls = { implemented: "good", partial: "warn", "specced-only": "warn", missing: "bad" }[op.status] ?? "warn";
    return `<section class="cc-api-op">
      <div class="cc-api-head"><code class="cc-api-opid">${esc(op.status === "missing" ? `${opId} (proposed)` : opId)}</code><span class="cc-api-status ${statusCls}">${esc(c.statusLabels?.[op.status] ?? op.status)}</span></div>
      ${op.method ? `<div class="cc-api-path"><span><b>${esc(op.method)}</b> <code>${esc(path)}</code>${liveTag("path")}</span>${copy(path, "path")}</div>${path !== op.path ? `<div class="cc-api-tpl"><code>${esc(op.path)}</code></div>` : ""}` : ""}
      ${op.auth?.length ? `<h4>Auth</h4>${list(op.auth.map((a) => c.authLabels?.[a] ?? a))}` : ""}
      ${req !== undefined && req !== null ? `<div class="cc-api-sub"><h4>Sample request${liveTag("request")}</h4>${copy(req, "request")}</div><pre>${json(req)}</pre>` : ""}
      ${res ? `<div class="cc-api-sub"><h4>Sample response${liveTag("response")}</h4>${res.body !== undefined ? copy(res.body, "response") : ""}</div><pre>${esc(res.status)} ${json(res.body)}</pre>` : ""}
      ${op.errors?.length ? `<h4>Errors</h4><ul class="cc-api-errs">${op.errors.map((e) => `<li><b>${esc(e.status)}</b> <code>${esc(e.code)}</code></li>`).join("")}</ul>` : ""}
      ${op.notes?.length ? `<h4>Notes</h4>${list(op.notes)}` : ""}
      ${op.deviations?.length ? `<h4>Code vs spec</h4>${list(op.deviations, "cc-api-dev")}` : ""}
    </section>`;
  }

  // Context for live samples: the page's own state (from setContext) plus what the element says,
  // i.e. the Concept Chain it sits in (nearest [data-api-chain]). Plain data only.
  function sampleCtx(el) {
    let page = {};
    try { page = (typeof contextProvider === "function" && contextProvider()) || {}; } catch { page = {}; }
    return { ...page, key: el?.dataset.api ?? null, chainId: el?.closest("[data-api-chain]")?.dataset.apiChain ?? null };
  }

  function cardHtml(info, el) {
    const ctx = sampleCtx(el);
    copyData = [];
    const actor = info.actor ? cat().actors?.[info.actor] : null;
    const head = info.kind === "nav"
      ? `<span class="cc-api-step nav">→ ${esc(info.navStep ?? "page")}</span> ${esc(info.title)}`
      : info.kind === "gap"
      ? `<span class="cc-api-step gap">no API</span> ${esc(info.title)}`
      : `<span class="cc-api-step">${esc(info.letter)}</span> ${esc(info.title)}${actor ? ` <span class="cc-api-actor">${actor.badge} ${esc(actor.label)}</span>` : ""}`;
    const close = pinned ? `<button type="button" class="cc-api-close" aria-label="Close API card">×</button>` : "";
    return `<div class="cc-api-title"><span class="cc-api-title-text" id="cc-api-card-title">${head}</span>${close}</div>`
      + (info.note ? `<p class="cc-api-note">${esc(info.note)}</p>` : "")
      + info.ops.map((op) => opHtml(op, info.variant, ctx)).join("")
      + (pinned ? `<p class="cc-api-copied visually-hidden" role="status"></p>` : "");
  }

  // Re-render the card from the catalog (live samples may change with the demo state). Only touches
  // the DOM when the HTML changed, and puts focus back on the same button if it was inside the card.
  function refreshCard() {
    const m = marks.get(currentKey); if (!m) return;
    const info = resolve(m.el.dataset.api); if (!info) return;
    const html = cardHtml(info, m.el);
    if (html === cardHtmlNow) return;
    const buttons = () => [...card.querySelectorAll("button")];
    const focusIdx = card.contains(document.activeElement) ? buttons().indexOf(document.activeElement) : -2;
    card.innerHTML = html; cardHtmlNow = html;
    if (focusIdx >= 0) buttons()[focusIdx]?.focus(); else if (focusIdx === -1) card.focus();
  }

  function setDescribed(el) {
    marks.forEach((m) => { if (m.el !== el && m.el.getAttribute("aria-describedby") === card.id) m.el.removeAttribute("aria-describedby"); });
    if (el) el.setAttribute("aria-describedby", card.id);
  }

  // Hover/focus card: a tooltip that never takes pointer events, so it can't swallow clicks.
  function showCard(key) {
    if (pinned || !marks.has(key)) return;
    currentKey = key; cardHtmlNow = "";
    card.classList.remove("pinned");
    card.setAttribute("role", "tooltip"); card.removeAttribute("aria-labelledby"); card.removeAttribute("aria-modal"); card.removeAttribute("tabindex");
    card.hidden = false;
    refreshCard(); setDescribed(marks.get(key).el); placeCard();
  }

  function hideCard() { if (!pinned) closeCard(false); }

  // Pinned card: a non-modal dialog with copy buttons and a close button; focus moves into it.
  function pin(key) {
    const m = marks.get(key); if (!m) return;
    pinned = true; currentKey = key; cardHtmlNow = "";
    card.classList.add("pinned");
    card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "false"); card.setAttribute("aria-labelledby", "cc-api-card-title"); card.tabIndex = -1;
    card.hidden = false;
    marks.forEach((x, k) => x.tag.setAttribute("aria-expanded", String(k === key)));
    refreshCard(); setDescribed(m.el); placeCard();
    card.focus({ preventScroll: true });
  }

  // Close the card; with returnFocus, focus goes back to the tag that opened it (or the toggle if gone).
  function closeCard(returnFocus) {
    const m = currentKey ? marks.get(currentKey) : null;
    pinned = false; currentKey = null; cardHtmlNow = "";
    clearTimeout(copyTimer);
    marks.forEach((x) => x.tag.setAttribute("aria-expanded", "false"));
    if (card) { setDescribed(null); card.hidden = true; card.classList.remove("pinned"); card.setAttribute("role", "tooltip"); card.removeAttribute("aria-labelledby"); card.removeAttribute("aria-modal"); card.removeAttribute("tabindex"); }
    // Returning focus to the tag must not reopen its hover card straight away.
    if (returnFocus) { quietFocus = true; try { (m?.tag ?? toggles[0])?.focus(); } finally { quietFocus = false; } }
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    // Fallback for pages opened as files (no async clipboard): a hidden textarea + execCommand.
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;left:-9999px;top:0";
    layer.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch {}
    ta.remove(); return ok;
  }

  async function onCardClick(e) {
    const t = e.target instanceof Element ? e.target.closest("button") : null; if (!t) return;
    if (t.classList.contains("cc-api-close")) { closeCard(true); return; }
    const item = copyData[Number(t.dataset.copy)]; if (!item) return;
    const ok = await copyText(item.text);
    const msg = ok ? `Copied ${item.what}` : `Couldn't copy ${item.what}`;
    const status = card.querySelector(".cc-api-copied"); if (status) status.textContent = msg;
    clearTimeout(copyTimer);
    card.querySelectorAll(".cc-api-copy.done").forEach((b) => { b.classList.remove("done"); b.textContent = `Copy ${copyData[Number(b.dataset.copy)]?.what ?? ""}`; });
    t.classList.add("done"); t.textContent = ok ? "Copied" : "Copy failed";
    copyTimer = setTimeout(() => { if (t.isConnected) { t.classList.remove("done"); t.textContent = `Copy ${item.what}`; } if (status?.isConnected) status.textContent = ""; }, 1500);
  }

  // Keeps the card inside the viewport. Below the element if it fits, else above, else beside it
  // (right, then left). A large element (e.g. the board) gets the card over its own top-left corner,
  // just under its tag, instead of beside it where it would cover other panels. Otherwise the card
  // goes on the roomier of below/above, shortened and scrollable. Except for large elements the card
  // never covers its element, so its controls stay clickable.
  function placeCard() {
    const m = marks.get(currentKey); if (!m || !card || card.hidden) return;
    const r = m.el.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = innerHeight, gap = 8;
    card.style.left = "0px"; card.style.top = "0px"; card.style.maxHeight = "";
    const w = card.offsetWidth, h = card.offsetHeight;
    const clampX = (x) => Math.max(gap, Math.min(x, vw - w - gap));
    const clampY = (y) => Math.max(gap, Math.min(y, vh - h - gap));
    const below = vh - r.bottom - 2 * gap, above = r.top - 2 * gap;
    const large = r.width > vw * 0.5 || r.height > vh * 0.6;
    let left, top;
    if (h <= below) { left = clampX(r.left); top = r.bottom + gap; }
    else if (h <= above) { left = clampX(r.left); top = r.top - gap - h; }
    else if (!large && vw - r.right - 2 * gap >= w) { left = r.right + gap; top = clampY(r.top); }
    else if (!large && r.left - 2 * gap >= w) { left = r.left - gap - w; top = clampY(r.top); }
    else if (large) {
      const t = m.tag.getBoundingClientRect();
      top = Math.max(gap, Math.min(t.bottom + 4, vh - 200));
      card.style.maxHeight = `${Math.max(120, vh - top - gap)}px`;
      left = clampX(r.left + gap);
      top = Math.max(gap, Math.min(top, vh - card.offsetHeight - gap));
    } else {
      const room = Math.max(below, above, 120);
      card.style.maxHeight = `${room}px`;
      left = clampX(r.left);
      top = below >= above ? r.bottom + gap : Math.max(gap, r.top - gap - Math.min(h, room));
    }
    card.style.left = `${left + scrollX}px`; card.style.top = `${top + scrollY}px`;
  }


  // ---- flow legend ----
  const screenLabel = (id) => cat().screens?.find((s) => s.id === id)?.label ?? id;
  const where = (screens) => `on ${(screens ?? []).map(screenLabel).join(" / ")}`;
  // This page's entry in CC_API_CATALOG.screens, by file name.
  const thisScreen = () => { const file = location.pathname.split("/").pop() || "index.html"; return cat().screens?.find((s) => s.file === file)?.id ?? null; };

  // The pages in flow order, per actor: "Teacher login → Game setup → Teacher screen", this page in bold.
  function screensHtml() {
    const c = cat(), here = thisScreen(), list = c.screens ?? [];
    const rows = ["teacher", "learner"].map((actor) => {
      const items = list.filter((s) => s.actor === actor);
      if (!items.length) return "";
      const a = c.actors?.[actor];
      return `<li>${a ? `<span class="cc-api-actor" title="${esc(a.label)}">${a.badge}</span> ` : ""}${items.map((s) => s.id === here
        ? `<b aria-current="page">${esc(s.label)}</b>` : esc(s.label)).join(" → ")}</li>`;
    }).join("");
    return rows ? `<h4>Screens</h4><ul class="cc-api-leg-screens">${rows}</ul>` : "";
  }
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
    const letters = Object.keys(c.steps ?? {});
    const range = letters.length ? `${letters[0] === "A" ? "" : `${letters[0]}, `}A → ${letters.at(-1)}` : ""; // "P, A → H": the pack step comes first
    return `<div class="cc-api-leg-head"><button type="button" class="cc-api-leg-toggle" aria-controls="cc-api-leg-body">API flow ${esc(range)}</button></div>
      <div class="cc-api-leg-body" id="cc-api-leg-body">
        ${screensHtml()}
        <ol class="cc-api-leg-steps">${steps}</ol>
        ${none ? `<h4>No screen yet</h4><ul class="cc-api-leg-none">${none}</ul>` : ""}
        <p class="cc-api-leg-live visually-hidden" aria-live="polite"></p>
      </div>`;
  }

  function legendCollapsed() {
    try { const v = sessionStorage.getItem(LEGEND_KEY); if (v) return v === "collapsed"; } catch {}
    // Single-column layout or a short window: start collapsed so it doesn't sit over the page.
    return !matchMedia("(min-width: 921px) and (min-height: 801px)").matches;
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

  // Flash every visible element of one step: the page elements themselves get an outline
  // (data-api-flash) and their overlay boxes light up. It pulses only when motion is fine.
  function flashStep(letter) {
    const els = [...document.querySelectorAll(SEL)].filter((el) => {
      const r = el.getBoundingClientRect();
      return (r.width || r.height) && resolve(el.dataset.api)?.letter === letter;
    });
    const live = legend?.querySelector(".cc-api-leg-live");
    if (live) live.textContent = els.length ? `Step ${letter}: ${els.length} element${els.length > 1 ? "s" : ""} highlighted` : `Step ${letter} is not on this screen`;
    if (!els.length) return;
    clearFlash();
    flash = { letter };
    els.forEach((el) => el.setAttribute("data-api-flash", ""));
    const r = els[0].getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) els[0].scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    draw();
    flashTimer = setTimeout(() => { clearFlash(); schedule(); }, FLASH_MS);
  }

  function clearFlash() {
    clearTimeout(flashTimer); flash = null;
    document.querySelectorAll("[data-api-flash]").forEach((el) => el.removeAttribute("data-api-flash"));
  }

  // ---- listeners (delegated, so they survive re-renders) ----
  // Page elements: hover and focus show the card. Tags (in the overlay layer): hover and focus show
  // it too; click, tap, Enter or Space pins it. Esc closes a pinned card and returns focus to its tag.
  const marked = (t) => (t instanceof Element ? t.closest(SEL) : null);
  const tagOf = (t) => (t instanceof Element ? t.closest(".cc-api-tag") : null);
  const keyFor = (t) => { const tag = tagOf(t); if (tag) return tag.dataset.key; const el = marked(t); return el ? keyOf.get(el) ?? null : null; };
  const within = (key, node) => { const m = marks.get(key); return !!node && !!m && (m.el.contains(node) || m.tag === node); };
  function onOver(e) { const key = keyFor(e.target); if (key && key !== currentKey) showCard(key); }
  function onOut(e) {
    const key = keyFor(e.target);
    if (key && key === currentKey && !within(key, e.relatedTarget) && !within(key, document.activeElement)) hideCard();
  }
  function onFocusIn(e) { if (quietFocus) return; const key = keyFor(e.target); if (key) showCard(key); }
  function onFocusOut(e) { const key = keyFor(e.target); if (key && key === currentKey && !within(key, e.relatedTarget)) hideCard(); }
  function onKey(e) {
    if (e.key !== "Escape" || !currentKey) return;
    if (pinned) closeCard(true); else hideCard();
  }
  function onTagClick(e) {
    const tag = tagOf(e.target); if (!tag) return;
    const key = tag.dataset.key;
    if (pinned && currentKey === key) closeCard(true); else { closeCard(false); pin(key); }
  }
  // Typing in a page field changes page state (draft chain, comments, feedback) without a DOM change.
  const onInput = () => schedule();
  const LISTENERS = [["mouseover", onOver], ["mouseout", onOut], ["focusin", onFocusIn], ["focusout", onFocusOut], ["keydown", onKey], ["input", onInput], ["change", onInput]];
  const onScroll = () => { schedule(); placeCard(); }; // redraw too: sticky elements (Game setup's Start box) move as the page scrolls

  // ---- on / off ----
  function enable() {
    if (on) return; on = true;
    layer = document.createElement("div");
    layer.className = "cc-api-layer";
    layer.innerHTML = `<div class="cc-api-marks"></div><div class="cc-api-card" id="cc-api-card" role="tooltip" hidden></div>`;
    document.documentElement.appendChild(layer); // outside <body>, so the observer never sees our own drawing
    card = layer.querySelector(".cc-api-card");
    card.addEventListener("click", onCardClick);
    layer.querySelector(".cc-api-marks").addEventListener("click", onTagClick);
    buildLegend();
    LISTENERS.forEach(([t, fn]) => document.addEventListener(t, fn, true));
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("storage", schedule); // demo session changed in another tab
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-api", "data-api-io", "hidden", "class", "style", "open"] });
    remember(true); pressed();
    draw();
  }

  function disable() {
    if (!on) return; on = false;
    closeCard(false);
    LISTENERS.forEach(([t, fn]) => document.removeEventListener(t, fn, true));
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("storage", schedule);
    observer?.disconnect(); observer = null;
    if (frame) cancelAnimationFrame(frame); frame = 0;
    clearFlash();
    marks.clear();
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

  // Pages register a provider of plain data for live samples, e.g. the learner's draft chain:
  //   CCOverlay.setContext(() => ({ participantId, draft, voteNotes }))
  // It is called on every card render, so it must be cheap and side-effect free.
  function setContext(fn) { contextProvider = typeof fn === "function" ? fn : null; schedule(); }

  return { enable, disable, isOn: () => on, resolve, setContext, refresh: schedule };
})();
