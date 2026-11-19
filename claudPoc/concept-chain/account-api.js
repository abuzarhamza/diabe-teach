// The real API calls of the Concept Chain prototype: teacher sign-up and sign-in, and the shared pack library.
// Everything in a running game (Start game, lobby, learner screen) stays faked in shared.js (decision of 2026-11-19).
//
// The pages are served by netlify dev on the API's own origin (`npm run dev:prototype`, then
// http://localhost:8888/claudPoc/concept-chain/login.html), so calls use relative /api/v1 paths and need no CORS.
// That server has the x-api-key check turned off: no API key is ever put in a page.
//
// The Account Token lives in localStorage under its own key (ACCOUNT_KEY); "Sign out" removes it.
// Pure helpers (account storage, pack conversion, the next version) need only localStorage, so tests can load this
// file in a vm with a stub; the request helpers also use fetch, location and sessionStorage.
/* eslint-disable */
const CCApi = (() => {
  const ACCOUNT_KEY = "cc-account-token-v1";
  const LOGIN_MESSAGE_KEY = "cc-login-message-v1"; // sessionStorage: why the teacher was sent back to Teacher login
  const MIN_PASSWORD = 10;
  const LOGIN_URL = "login.html";

  function apiError(code, message, status = 0, details = null) {
    const e = new Error(message); e.code = code; e.status = status; e.details = details; return e;
  }

  // ---- Account Token storage ----
  function storedAccount() {
    try {
      const a = JSON.parse(localStorage.getItem(ACCOUNT_KEY));
      return a && typeof a.accountToken === "string" && a.accountToken && typeof a.email === "string" ? a : null;
    }
    catch { return null; }
  }
  const isExpired = (a, now = Date.now()) => !a.expiresAt || !(Date.parse(a.expiresAt) > now);
  // The signed-in teacher { accountId, email, accountToken, expiresAt }, or null when there is no token or it has expired.
  function account(now = Date.now()) { const a = storedAccount(); return a && !isExpired(a, now) ? a : null; }
  function saveAccount(body) {
    const a = { accountId: body.accountId, email: body.email, accountToken: body.accountToken, expiresAt: body.expiresAt };
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a));
    return a;
  }
  function signOut() { localStorage.removeItem(ACCOUNT_KEY); }

  // ---- Sending the teacher back to Teacher login ----
  function setLoginMessage(message) { try { sessionStorage.setItem(LOGIN_MESSAGE_KEY, message); } catch {} }
  function takeLoginMessage() {
    try { const m = sessionStorage.getItem(LOGIN_MESSAGE_KEY); sessionStorage.removeItem(LOGIN_MESSAGE_KEY); return m; }
    catch { return null; }
  }
  function sendToLogin(message) {
    signOut(); setLoginMessage(message);
    document.documentElement.style.visibility = "hidden";
    location.replace(LOGIN_URL);
  }
  // Guard for teacher pages: returns the signed-in teacher, or hides the page and sends the browser to Teacher login.
  function requireTeacher() {
    const stored = storedAccount(), a = account();
    if (a) return a;
    sendToLogin(stored ? "Your sign-in has expired. Sign in again." : "Sign in to continue.");
    return null;
  }

  // ---- HTTP ----
  // Error bodies are ApiErrorResponse { code, message, details } on most routes; registerCurriculumPack's 409 and 422
  // (and the 400 MISSING_PACK_ID) still send { error: { code, message } }. Both are read here.
  async function request(method, path, { body, auth = false } = {}) {
    const headers = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (auth) {
      const a = account();
      if (!a) { sendToLogin(storedAccount() ? "Your sign-in has expired. Sign in again." : "Sign in to continue."); throw apiError("UNAUTHORIZED_TOKEN", "Sign in to continue.", 401); }
      headers.authorization = `Bearer ${a.accountToken}`;
    }
    let res;
    try { res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw apiError("NETWORK_ERROR", "Can't reach the API. Start it with `npm run dev:prototype` and open the page from http://localhost:8888."); }
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
    if (res.ok) return data;
    const err = data?.error && typeof data.error === "object" ? data.error : data ?? {};
    const code = err.code ?? `HTTP_${res.status}`;
    const message = err.message ?? (res.status === 404 ? "Not found. Open the prototype through `npm run dev:prototype` (http://localhost:8888)." : `Request failed (${res.status}).`);
    // A token the server rejects (expired, tampered, signed with another secret) sends the teacher back to sign in.
    if (auth && res.status === 401) sendToLogin("Your sign-in was not accepted (expired or signed out elsewhere). Sign in again.");
    throw apiError(code, message, res.status, err.details ?? null);
  }

  // ---- Accounts ----
  function checkCredentials(email, password) {
    const e = String(email ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw apiError("INVALID_REQUEST_BODY", "Enter a valid email address, like name@school.org.", 0, { field: "email" });
    if (String(password ?? "").length < MIN_PASSWORD) throw apiError("INVALID_REQUEST_BODY", `Password too short: use at least ${MIN_PASSWORD} characters.`, 0, { field: "password" });
    return { email: e, password: String(password) };
  }
  async function signUp(email, password) {
    return saveAccount(await request("POST", "/api/v1/accounts/sign-up", { body: checkCredentials(email, password) }));
  }
  async function signIn(email, password) {
    const e = String(email ?? "").trim();
    if (!e || !password) throw apiError("INVALID_REQUEST_BODY", "Enter your email and password.", 0, { field: e ? "password" : "email" });
    return saveAccount(await request("POST", "/api/v1/accounts/sign-in", { body: { email: e, password: String(password) } }));
  }
  // Asks the server whether the stored token is still good (a rejected one sends the teacher to Teacher login).
  const me = () => request("GET", "/api/v1/accounts/me", { auth: true });

  // The sentence Teacher login shows for an API error.
  function loginErrorText(e) {
    switch (e?.code) {
      case "INVALID_CREDENTIALS": return "Wrong email or password.";
      case "EMAIL_ALREADY_REGISTERED": return "That email is already registered. Sign in instead.";
      case "ACCOUNT_TEMPORARILY_LOCKED": {
        const until = Date.parse(e.details?.lockedUntil ?? "");
        return `Too many wrong passwords: sign-in is temporarily locked${Number.isNaN(until) ? "" : ` until ${new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}. Try again later.`;
      }
      case "INVALID_REQUEST_BODY":
        return e.details?.field === "password" ? `Password too short: use at least ${MIN_PASSWORD} characters.` : e.message;
      default: return e?.message ?? "Something went wrong.";
    }
  }

  // ---- Shared pack library ----
  async function listPacks({ includeArchived = false } = {}) {
    const data = await request("GET", `/api/v1/packs${includeArchived ? "?includeArchived=true" : ""}`);
    return data?.packs ?? [];
  }
  // No Authorization header: this route reads a bearer token as an instructor Capability Token, so an Account Token gets 401.
  async function getPack(packId) { return (await request("GET", `/api/v1/packs/${encodeURIComponent(packId)}`))?.pack ?? null; }
  const archivePack = (packId) => request("POST", `/api/v1/packs/${encodeURIComponent(packId)}/archive`, { auth: true });
  const unarchivePack = (packId) => request("POST", `/api/v1/packs/${encodeURIComponent(packId)}/unarchive`, { auth: true });
  const validatePack = (input) => request("POST", "/api/v1/packs/validate", { body: input, auth: true });
  const registerPack = (input) => request("POST", "/api/v1/packs", { body: input, auth: true });

  // "by rahman.s · v1.1.0" ("by unknown" for System Packs and packs released before accounts existed).
  const byline = (item) => `by ${item.authorHandle ?? "unknown"} · v${item.version}`;

  // A PublicCurriculumPack as the in-browser game plays it (shared.js's pack shape): the keywords are the cards' labels.
  function toGamePack(pack, item = null) {
    const keywords = (pack.cards ?? []).map((c) => c.displayLabel || c.verbatimLabel).filter(Boolean);
    return {
      packId: pack.id, name: pack.title, version: pack.version, description: pack.description ?? "",
      authorHandle: item?.authorHandle ?? null, keywords,
      boardSize: Math.min(7, Math.floor(Math.sqrt(keywords.length))), builtIn: false,
    };
  }

  const slug = (text) => String(text ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  // The next Pack Version: a minor bump ("1.0.0" → "1.1.0").
  function nextVersion(version) {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version ?? ""));
    return m ? `${m[1]}.${Number(m[2]) + 1}.0` : "1.0.0";
  }
  // A unique card id for each keyword (a slug, made unique with -2, -3…).
  function cardIds(keywords, taken = new Set()) {
    return keywords.map((k) => {
      const base = slug(k) || "card"; let id = base, n = 2;
      while (taken.has(id)) id = `${base}-${n++}`;
      taken.add(id); return id;
    });
  }

  // A CurriculumPackInput from Game setup's editor. With `base` (a PublicCurriculumPack) it is a new Pack Version of that
  // pack: same id, next version, its domains, rubric, assessment and survey, and its cards kept for keywords it still has.
  // Without `base` it is a new pack: one Semantic Domain, plain cards, a one-line rubric.
  function packInput({ name, level = "", objective = "", keywords, base = null, packId = null }) {
    const title = String(name ?? "").trim().replace(/\s+/g, " ");
    const description = [level, objective].map((x) => String(x ?? "").trim()).filter(Boolean).join(" · ");
    const size = Math.max(3, Math.min(7, Math.floor(Math.sqrt(keywords.length))));
    if (base) {
      const byLabel = new Map((base.cards ?? []).map((c) => [String(c.displayLabel || c.verbatimLabel).toLowerCase(), c]));
      const kept = keywords.map((k) => byLabel.get(k.toLowerCase()) ?? null);
      const domainId = base.domains?.[0]?.id ?? "general";
      const ids = cardIds(keywords.filter((k, i) => !kept[i]), new Set(kept.filter(Boolean).map((c) => c.id)));
      let next = 0;
      const cards = keywords.map((k, i) => kept[i] ?? { id: ids[next++], verbatimLabel: k, displayLabel: k, aliases: [], domainId, summary: k });
      const rows = Math.min(base.boardConfig?.rows ?? size, Math.floor(Math.sqrt(cards.length)));
      return {
        ...base, title: title || base.title, version: nextVersion(base.version), description: description || base.description,
        boardConfig: { ...base.boardConfig, rows: Math.max(3, rows), cols: Math.max(3, rows) }, cards,
      };
    }
    return {
      id: packId ?? slug(title), title, version: "1.0.0", description: description || title,
      boardConfig: { rows: size, cols: size, minChainLength: 2, adjacencyRule: "chebyshev-8" },
      domains: [{ id: "general", label: "General", description: `Keywords of ${title}` }],
      cards: cardIds(keywords).map((id, i) => ({ id, verbatimLabel: keywords[i], displayLabel: keywords[i], aliases: [], domainId: "general", summary: keywords[i] })),
      adjudicationRubric: { evaluatorPersona: "Teacher", subjectDomain: title, chainContinuityCriteria: ["Each link names a cause, mechanism or consequence"], calibrationExamples: [] },
      assessmentInstrument: null, perceptionSurvey: null,
    };
  }

  // The sentence Game setup shows for a pack call's error.
  function packErrorText(e) {
    switch (e?.code) {
      case "PACK_IS_SYSTEM_PACK": return "Built-in System Packs can't be archived or given new versions.";
      case "PACK_ALREADY_EXISTS": return "That version already exists: someone released it first. Reload the list and try again.";
      case "PACK_ALREADY_ARCHIVED": return "That pack is already archived.";
      case "PACK_NOT_ARCHIVED": return "That pack is not archived.";
      case "MISSING_PACK_ID": return "The server refused this pack (built-in System Packs can't be archived).";
      default: return e?.message ?? "Something went wrong.";
    }
  }

  return { ACCOUNT_KEY, MIN_PASSWORD, account, storedAccount, saveAccount, signOut, requireTeacher, takeLoginMessage, sendToLogin,
    signUp, signIn, me, loginErrorText, listPacks, getPack, archivePack, unarchivePack, validatePack, registerPack,
    byline, toGamePack, nextVersion, packInput, packErrorText, slug };
})();
