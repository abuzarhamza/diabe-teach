# Credential in the ADR-0003 working copy

**2026-11-17.** While preparing commits, Claude found that an uncommitted edit to `docs/adr/0003-platform-database-naming-concept-chain.md` appended what looks like a database username, password and MongoDB Atlas cluster host. The values are deliberately not recorded here.

- `git log --all -S` found the strings in no commit.
- Claude excluded the file from every commit and left it modified for the user to decide.
- Suggested: move the values to a gitignored `.env*` file (already ignored by `.gitignore`), revert the ADR edit, and rotate the password if it was shared anywhere else.
- A possible environment fix: a pre-commit secret scanner (see the `setup-pre-commit` skill). Tracked in the [backlog](environment-backlog.md).

## Update 2026-11-17
- The user asked to add the file to `.gitignore`. That has no effect on a tracked file, so Claude instead ran `git update-index --skip-worktree` on it (local only). Git now ignores the local edit: it no longer shows in `git status`, and `git add -A` does not stage it.
- The credentials are still on disk in that file. Undo with `git update-index --no-skip-worktree docs/adr/0003-platform-database-naming-concept-chain.md`.
- Agents no longer need the "never stage ADR-0003" instruction, but keeping it is harmless.

## Resolved 2026-11-17
- Claude checked that the same username and password were already in `.env.dev.yaml` (gitignored by `.env*`; read by `AppRuntime`). Claude then cleared skip-worktree and restored ADR-0003 to its committed version. The credentials are now only in `.env.dev.yaml`, and they never entered git history.
- Remaining for the user: rotate the password if it was ever shared outside this machine.
