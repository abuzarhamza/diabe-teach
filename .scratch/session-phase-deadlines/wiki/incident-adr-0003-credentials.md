# Credential in the ADR-0003 working copy

**2026-11-17.** While preparing commits, Claude found that an uncommitted edit to `docs/adr/0003-platform-database-naming-concept-chain.md` appended what looks like a database username, password and MongoDB Atlas cluster host. The values are deliberately not recorded here.

- `git log --all -S` found the strings in no commit.
- Claude excluded the file from every commit and left it modified for the user to decide.
- Suggested: move the values to a gitignored `.env*` file (already ignored by `.gitignore`), revert the ADR edit, and rotate the password if it was shared anywhere else.
- A possible environment fix: a pre-commit secret scanner (see the `setup-pre-commit` skill). Tracked in the [backlog](environment-backlog.md).
