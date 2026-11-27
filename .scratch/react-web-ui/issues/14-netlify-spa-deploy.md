# 14: Serve the SPA from Netlify alongside `/api/v1/*`

**Status:** ready-for-agent
**Blocked by:** 01 (done, satisfied); the `VITE_API_KEY` decision below

**What to build:** Netlify `publish = "web/dist"`, build runs `npm run build:web`, SPA fallback so `/login`, `/sessions/:id` etc. render `index.html`.

- `tests/adapters/netlify-toml-redirects.test.ts` refuses any redirect `from` `/api/v1` or `/api/v1/*`. Every API function routes itself by its own `config.path` and `method`. So the SPA fallback must not catch API paths: an unknown `/api/v1/...` path must still answer from the functions (a JSON 404), never with `index.html`. Check this under `netlify dev`.
- **Open decision (needs the user):** the HTTP client sends `x-api-key` from `VITE_API_KEY`. Vite copies every `VITE_*` value into the built JavaScript, so a production build with it set publishes the key to every visitor (`web/README.md`). Decide how production authenticates the browser before this ships (for example: no API key on the routes the browser calls, or another scheme).

## Acceptance criteria
- [ ] Deep-link reload of `/sessions/:id` works under `netlify dev`.
- [ ] Existing redirect-guard test still passes.
- [ ] An unknown `/api/v1/...` path returns JSON, not the SPA page.
- [ ] The production bundle contains no API key, or the user has accepted the chosen approach.
