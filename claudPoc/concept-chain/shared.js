// Shared in-browser mock of the Game Session API for the Concept Chain prototype screens.
// State mirrors docs/api/openapi.yaml (PublicSessionState, SubmittedChain, PlayerRoundStanding)
// and is kept in localStorage so a teacher tab and participant tabs stay in sync.
/* eslint-disable */
const CC = (() => {
  const KEY = "cc-demo-session-v1";
  const GRACE_MS = 5000; // fixed grace period after phaseEndsAt (see submitConceptChain 409)

  // Diabe-teach keywords (49 = 7x7 board).
  const WORDS = ["Retinopathy","Pancreas","Ulcer","Sulfonylureas","Metformin","Beta cells","Diet","Autoimmune","Glycemic index","Hypoglycemia","Weight loss","Adiponectin","Glucose","Hyperglycemia","Islet cells","Transplant","HHS","Amylin","Thiazolidinediones","Podiatrist","Polyphagia","ACE inhibitors","Screening","Microalbuminuria","Smoking","Genetic","Fasting","GTT","Glucagon","Neuropathy","Dyslipidaemia","Insulin","Weight","Polyuria","Glucometer","Polydipsia","Gastroparesis","C-Peptide","Venous","Ketoacidosis","Glucosuria","Hypertension","MODY","Lipohypertrophy","Children","Pregnancy","LADA","Glipizide","HbA1c"];

  const PHASES = ["pretest","trial-orientation","round-1:chain-mapping","round-1:peer-adjudication","round-1:round-summary","round-2:chain-mapping","round-2:peer-adjudication","round-2:round-summary","posttest","feedback-survey","completed"];
  const PHASE_LABEL = {
    "pretest":"Pre-test","trial-orientation":"Trial round",
    "round-1:chain-mapping":"R1 · Chain mapping","round-1:peer-adjudication":"R1 · Peer review","round-1:round-summary":"R1 · Summary",
    "round-2:chain-mapping":"R2 · Chain mapping","round-2:peer-adjudication":"R2 · Peer review","round-2:round-summary":"R2 · Summary",
    "posttest":"Post-test","feedback-survey":"Survey","completed":"Completed",
  };
  // Seconds per phase; null = instructor-driven (phaseEndsAt null).
  const TIMERS = { "round-1:chain-mapping":300, "round-1:peer-adjudication":240, "round-2:chain-mapping":300, "round-2:peer-adjudication":240 };

  const listeners = [];
  const now = () => Date.now();
  const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 8)}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

  function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = hash(seed); return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function shuffleBoard(seed) {
    const r = rng(seed); const w = WORDS.slice();
    for (let i = w.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [w[i], w[j]] = [w[j], w[i]]; }
    const rows = 7, cols = 7, cells = [];
    for (let row = 0; row < rows; row++) cells.push(w.slice(row * cols, row * cols + cols).map((label) => ({ keywordId: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label })));
    return { seed, rows, cols, cells };
  }

  function fresh() {
    const roomCode = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    return {
      session: { sessionId: uid("ses"), roomCode, packId: "diabe-teach", mode: "classroom", adjudicationMode: "peer-instructor",
        currentPhase: "pretest", activeRoundNumber: null, phaseStartedAt: new Date().toISOString(), phaseEndsAt: null, activeBoard: null, participantCount: 0 },
      participants: [], chains: [],
    };
  }

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
  function get() { let s = load(); if (!s) { s = fresh(); localStorage.setItem(KEY, JSON.stringify(s)); } return s; }
  function save(s) { s.session.participantCount = s.participants.length; localStorage.setItem(KEY, JSON.stringify(s)); listeners.forEach((fn) => fn(s)); }
  function update(mut) { const s = get(); const out = mut(s); save(s); return out; }
  function subscribe(fn) { listeners.push(fn); window.addEventListener("storage", (e) => { if (e.key === KEY) fn(get()); }); }
  function reset() { const s = fresh(); save(s); return s; }

  function apiError(code, message) { const e = new Error(message); e.code = code; return e; }

  function enterPhase(s, phase) {
    const ss = s.session;
    ss.currentPhase = phase;
    const m = /^round-(\d)/.exec(phase);
    ss.activeRoundNumber = m ? Number(m[1]) : null;
    if (phase.endsWith(":chain-mapping")) ss.activeBoard = shuffleBoard(`${ss.sessionId}-r${ss.activeRoundNumber}-${now()}`);
    if (!m) ss.activeBoard = null;
    ss.phaseStartedAt = new Date().toISOString();
    ss.phaseEndsAt = TIMERS[phase] ? new Date(now() + TIMERS[phase] * 1000).toISOString() : null;
  }
  function advance() { return update((s) => { const i = PHASES.indexOf(s.session.currentPhase); if (i >= PHASES.length - 1) throw apiError("INVALID_PHASE_TRANSITION", "Session already completed."); enterPhase(s, PHASES[i + 1]); }); }
  function extend(sec) { return update((s) => { const ss = s.session; const base = ss.phaseEndsAt ? Math.max(now(), Date.parse(ss.phaseEndsAt)) : now(); ss.phaseEndsAt = new Date(base + sec * 1000).toISOString(); }); }

  function join(roomCode, displayName) {
    return update((s) => {
      if (roomCode.trim().toUpperCase() !== s.session.roomCode) throw apiError("SESSION_NOT_FOUND", "No session with that room code.");
      const p = { participantId: uid("par"), displayName: displayName.trim() || "Learner", joinedAt: new Date().toISOString() };
      s.participants.push(p); return p;
    });
  }

  const adjacent = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col)) === 1; // chebyshev-8
  function topologyError(path) {
    if (path.length < 2) return "A chain needs at least two keywords.";
    const seen = new Set();
    for (let i = 0; i < path.length; i++) {
      const k = `${path[i].row},${path[i].col}`; if (seen.has(k)) return "A keyword can only appear once in a chain."; seen.add(k);
      if (i && !adjacent(path[i - 1], path[i])) return "Each keyword must touch the previous one (sideways, up/down or diagonal).";
    }
    return null;
  }
  function submissionsOpen(s) {
    const ss = s.session;
    if (!ss.currentPhase.endsWith(":chain-mapping")) return false;
    return !ss.phaseEndsAt || now() <= Date.parse(ss.phaseEndsAt) + GRACE_MS;
  }

  function submitChain(participantId, path, narrativeExplanation, stepRationales) {
    return update((s) => {
      if (!submissionsOpen(s)) throw apiError("PHASE_CLOSED_FOR_SUBMISSIONS", "Chain mapping is closed for this round.");
      const err = topologyError(path); if (err) throw apiError("CHAIN_TOPOLOGY_INVALID", err);
      if (!narrativeExplanation.trim()) throw apiError("INVALID_REQUEST_BODY", "Add a narrative explanation.");
      const b = s.session.activeBoard;
      const chain = { chainId: uid("chn"), sessionId: s.session.sessionId, roundNumber: s.session.activeRoundNumber, participantId,
        path, keywordIds: path.map((c) => b.cells[c.row][c.col].keywordId), labels: path.map((c) => b.cells[c.row][c.col].label),
        narrativeExplanation: narrativeExplanation.trim(), stepRationales, status: "pending-review", verdict: null, peerVotes: [], submittedAt: new Date().toISOString() };
      s.chains.push(chain); return chain;
    });
  }

  // Demo peer-consensus rule: 2+ votes and a clear majority settles an unlocked chain.
  function applyPeerConsensus(c) {
    if (c.verdict?.isLocked) return;
    const up = c.peerVotes.filter((v) => v.decision === "approve").length, down = c.peerVotes.length - up;
    if (c.peerVotes.length >= 2 && up !== down) {
      c.status = up > down ? "approved" : "rejected";
      c.verdict = { isApproved: up > down, adjudicatorType: "peer-consensus", isLocked: false, qualityScore: Math.max(1, Math.round((up / c.peerVotes.length) * 10)), transitionEvaluations: [], overallFeedback: `${up} approve · ${down} challenge`, suggestedRefinements: null };
    } else { c.status = "pending-review"; c.verdict = null; }
  }

  function vote(chainId, voterParticipantId, decision, comment) {
    return update((s) => {
      const c = s.chains.find((x) => x.chainId === chainId); if (!c) throw apiError("CHAIN_NOT_FOUND", "Chain not found.");
      if (!s.session.currentPhase.endsWith(":peer-adjudication")) throw apiError("PHASE_CLOSED", "Peer review is not open.");
      if (c.participantId === voterParticipantId) throw apiError("FORBIDDEN_ROLE", "You can't vote on your own chain.");
      if (c.verdict?.isLocked) throw apiError("ADJUDICATION_LOCKED_BY_INSTRUCTOR", "Your teacher has already ruled on this chain.");
      c.peerVotes = c.peerVotes.filter((v) => v.voterParticipantId !== voterParticipantId);
      c.peerVotes.push({ voterParticipantId, decision, comment: comment?.trim() || null, votedAt: new Date().toISOString() });
      applyPeerConsensus(c); return c;
    });
  }

  function rule(chainId, approve, feedback, qualityScore) {
    return update((s) => {
      const c = s.chains.find((x) => x.chainId === chainId); if (!c) throw apiError("CHAIN_NOT_FOUND", "Chain not found.");
      if (c.verdict?.isLocked) throw apiError("ADJUDICATION_LOCKED_BY_INSTRUCTOR", "This chain already has a final ruling.");
      if (!feedback.trim()) throw apiError("INVALID_REQUEST_BODY", "Feedback is required for a final ruling.");
      c.status = approve ? "approved" : "rejected";
      c.verdict = { isApproved: approve, adjudicatorType: "instructor-final", isLocked: true, qualityScore, transitionEvaluations: [], overallFeedback: feedback.trim(), suggestedRefinements: null };
      return c;
    });
  }

  // Longest approved chain first, then number of approved chains.
  function standings(s, round) {
    return s.participants.map((p) => {
      const ok = s.chains.filter((c) => c.roundNumber === round && c.participantId === p.participantId && c.status === "approved");
      return { participantId: p.participantId, displayName: p.displayName, longestValidChainLength: Math.max(0, ...ok.map((c) => c.path.length)),
        totalValidChainsCount: ok.length, pendingCount: s.chains.filter((c) => c.roundNumber === round && c.participantId === p.participantId && c.status === "pending-review").length };
    }).sort((a, b) => b.longestValidChainLength - a.longestValidChainLength || b.totalValidChainsCount - a.totalValidChainsCount || a.displayName.localeCompare(b.displayName))
      .map((r, i) => ({ rank: i + 1, ...r }));
  }

  // Demo helper: add learners and, during a round, a few random valid chains for them.
  function seedSampleLearners() {
    return update((s) => {
      for (const name of ["Aisha", "Ben", "Chen"]) if (!s.participants.some((p) => p.displayName === name)) s.participants.push({ participantId: uid("par"), displayName: name, joinedAt: new Date().toISOString() });
      const b = s.session.activeBoard; if (!b) return;
      const r = rng(`${b.seed}-sample-${s.chains.length}`);
      for (const p of s.participants.filter((x) => ["Aisha", "Ben", "Chen"].includes(x.displayName))) {
        const len = 3 + Math.floor(r() * 3), path = [{ row: Math.floor(r() * b.rows), col: Math.floor(r() * b.cols) }];
        while (path.length < len) {
          const last = path.at(-1), opts = [];
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const n = { row: last.row + dr, col: last.col + dc }; if ((dr || dc) && n.row >= 0 && n.col >= 0 && n.row < b.rows && n.col < b.cols && !path.some((q) => q.row === n.row && q.col === n.col)) opts.push(n); }
          if (!opts.length) break; path.push(opts[Math.floor(r() * opts.length)]);
        }
        const labels = path.map((c) => b.cells[c.row][c.col].label);
        s.chains.push({ chainId: uid("chn"), sessionId: s.session.sessionId, roundNumber: s.session.activeRoundNumber, participantId: p.participantId, path,
          keywordIds: path.map((c) => b.cells[c.row][c.col].keywordId), labels,
          narrativeExplanation: `${labels.join(" leads to ")} — sample narrative from ${p.displayName}.`,
          stepRationales: path.slice(1).map((c, i) => ({ fromCoord: path[i], toCoord: c, rationale: `${labels[i]} relates to ${labels[i + 1]}.` })),
          status: "pending-review", verdict: null, peerVotes: [], submittedAt: new Date().toISOString() });
      }
    });
  }

  function clock(s) {
    const ends = s.session.phaseEndsAt;
    if (!ends) return { text: "—:—", note: "Teacher-paced", over: false };
    const ms = Date.parse(ends) - now(), t = Math.max(0, Math.ceil(ms / 1000));
    return { text: `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`, note: ms <= 0 ? "Time's up" : "remaining", over: ms <= 0, low: ms > 0 && ms < 30000 };
  }

  // Renders the board grid plus an SVG overlay drawing `path` (array of {row,col}).
  function renderBoard(shell, board, { path = [], color = "var(--pick)", onTap, tappable } = {}) {
    if (!board) { shell.innerHTML = `<div class="board-empty">The board appears when a round starts.</div>`; return; }
    const at = (r, c) => path.findIndex((p) => p.row === r && p.col === c);
    const last = path.at(-1);
    let html = `<div class="board" style="grid-template-columns:repeat(${board.cols},1fr);grid-template-rows:repeat(${board.rows},1fr)">`;
    board.cells.forEach((row, r) => row.forEach((cell, c) => {
      const i = at(r, c), near = tappable && last && i < 0 && adjacent(last, { row: r, col: c });
      html += `<button type="button" class="tile${i >= 0 ? " in" : ""}${near ? " near" : ""}" data-r="${r}" data-c="${c}" ${tappable ? "" : "tabindex=-1"} aria-pressed="${i >= 0}" aria-label="${esc(cell.label)}${i >= 0 ? `, step ${i + 1}` : ""}">${i >= 0 ? `<span class="ord">${i + 1}</span>` : ""}${esc(cell.label)}</button>`;
    }));
    html += `</div><svg class="overlay" aria-hidden="true"></svg>`;
    shell.innerHTML = html;
    shell.style.setProperty("--tile-fs", `${Math.max(9, Math.min(15, shell.clientWidth / board.cols / 6.2))}px`);
    if (onTap) shell.querySelectorAll(".tile").forEach((t) => t.addEventListener("click", () => onTap({ row: +t.dataset.r, col: +t.dataset.c }, t)));
    requestAnimationFrame(() => {
      const svg = shell.querySelector("svg.overlay"); if (!svg || path.length < 2) return;
      const box = shell.getBoundingClientRect();
      const pts = path.map((p) => { const el = shell.querySelector(`.tile[data-r="${p.row}"][data-c="${p.col}"]`).getBoundingClientRect(); return `${el.left - box.left + el.width / 2},${el.top - box.top + el.height / 2}`; });
      svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      svg.innerHTML = `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>`;
    });
  }

  const STATUS = { "pending-review": ["pending", "To check"], approved: ["valid", "Approved"], rejected: ["invalid", "Not approved"] };
  function statusBadge(c) {
    const [cls, txt] = STATUS[c.status];
    const by = c.verdict ? (c.verdict.adjudicatorType === "instructor-final" ? " · teacher ruling 🔒" : " · peer consensus") : "";
    return `<span class="status ${cls}">${txt}${by}</span>`;
  }
  const chainText = (c) => c.labels.map((l) => `<b>${esc(l)}</b>`).join(` <span class="arrow">→</span> `);

  return { PHASES, PHASE_LABEL, get, subscribe, reset, advance, extend, join, submitChain, vote, rule, standings, seedSampleLearners,
    topologyError, submissionsOpen, adjacent, clock, renderBoard, statusBadge, chainText, esc };
})();
