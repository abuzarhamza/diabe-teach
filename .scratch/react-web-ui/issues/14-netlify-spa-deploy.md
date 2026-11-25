# 14: Serve the SPA from Netlify alongside `/api/v1/*`

**Status:** ready-for-agent
**Blocked by:** 01

**What to build:** Netlify `publish = "web/dist"`, build runs `npm run build:web`, SPA fallback so `/login`, `/sessions/:id` etc. render `index.html`. Must not add any `/api/v1` redirect (existing test refuses it).

## Acceptance criteria
- [ ] Deep-link reload of `/sessions/:id` works under `netlify dev`.
- [ ] Existing redirect-guard test still passes.
