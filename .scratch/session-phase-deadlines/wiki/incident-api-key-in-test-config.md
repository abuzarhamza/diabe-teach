# Incident: the real API key is committed in the BDD test config

**2026-11-19.** Claude checked whether any real value from the gitignored `.env.dev.yaml` appeared in git history. It compared the values without printing them. Three of the four keys checked (the Mongo URI and both token secrets) appear nowhere in history. The **`api_key`** value does:
- It's in `tests/integration/test-config.yaml` (line 8), first committed in `3e37faf` on 2026-11-17, and still there as of `8279368`.
- `3e37faf` has been pushed to `origin/main` and three feature branches, and `gh repo view` reports the repository as **PUBLIC**.
- The value is deliberately not recorded here.

The check was prompted by the example-config fix (`8279368`). That fix found the then-uncommitted `.env.dev.yaml.example` held the same real values and replaced them with placeholders before its first commit.

Recommended to the user on 2026-11-19:
1. Rotate the API key in `.env.dev.yaml` and in Netlify's `API_KEY` for every deployed site.
2. Have the test config refer to an environment variable instead of the value; `test-config-loader.ts` already reads `process.env`.
3. Don't rewrite history (`git filter-repo` plus force-pushes); once the key is rotated, the leaked value is useless.

Waiting for the user's decision. Related: [credential in ADR-0003](incident-adr-0003-credentials.md) (2026-11-17, never committed).
- **2026-11-19:** The user chose: the test config reads the API key from an environment variable; the user rotates the key; history is not rewritten.
