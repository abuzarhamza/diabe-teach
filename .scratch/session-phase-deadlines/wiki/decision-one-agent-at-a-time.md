# Decision: one agent at a time, checks run one at a time

**2026-11-19.** The user reported that running tasks together was crashing their machine, and asked that BDD tests run one by one. Two earlier chief-of-staff sessions had stopped partway through board ticket 02 (see the [ticket log](ticket-log.md)).

Decided on 2026-11-19 (Claude, adapting the chief-of-staff skill; the user asked for the skill and for sequential runs):
- At most **one** implementation subagent runs at a time, even when two tickets are both unblocked (for example teacher-login 01 and 03).
- No `isolation: worktree`. On 2026-11-18 the worktree started from `2976821`, not HEAD, and lacked the gitignored `.env.dev.yaml` (see the [environment backlog](environment-backlog.md)).
- Agents run checks one after another: typecheck, then `npx vitest run --no-file-parallelism`, then `npm run test:bdd` against `npm run dev:local`, then lint and boundaries. Agents stop the dev server when they're done.
- As of `2c24245`, `npm run test:bdd` runs each feature file in its own cucumber process, one after another (`scripts/run-bdd-sequential.ts`). Plain `netlify dev` against the remote MongoDB failed with TLS errors on 2026-11-19, so use `dev:local`.
- **2026-11-19 (update):** Agents start the dev server with `npm run dev:local`, wait for the single `DEV READY http://localhost:8888` line (printed only after every function has loaded and `GET /api/v1/packs` answers non-404), and stop it with `npm run dev:local:stop` (SIGTERM, then SIGKILL after 5s, then a check that port 8888 is free). `npm run test:bdd` also waits up to 60s for the server to be ready before running features. Don't use `pkill -f "netlify dev"`.

Related: [working preferences](user-preferences.md).
