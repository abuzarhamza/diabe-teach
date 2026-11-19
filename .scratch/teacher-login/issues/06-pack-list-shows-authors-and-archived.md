# 06: The pack list shows each pack's author and can include archived packs

**What to build:** Every Curriculum Pack summary in the pack list shows the **author handle** of its latest Pack Version (the part of the account's email before the @, worked out when the pack is read and not stored) and its version, so Game setup can show "by rahman.s · v1.1.0". Packs whose `createdBy` isn't an account show no handle ("by unknown"). The list gains an option to **include archived packs**, marked as archived, so Game setup's "Show archived" works. By default, archived packs stay hidden.

This ticket also finishes the spec's BDD journey: a teacher signs up, registers a pack, sees it listed with their author handle, starts a classroom game on it, and a learner joins.

See spec: `.scratch/teacher-login/spec.md`.

**Blocked by:** 04 (Starting a classroom game needs a signed-in teacher), 05 (Teachers manage the shared pack library with their account)

**Status:** ready-for-agent

- [ ] Handler test: a pack registered by `rahman.s@aku.edu` is listed with author handle `rahman.s` and its latest version
- [ ] Handler test: after teacher B releases v2, the list shows teacher B's handle and v2
- [ ] Handler test: a legacy pack is listed with no author handle
- [ ] Handler test: archived packs are hidden by default and appear, marked archived, with the include-archived option
- [ ] Handler test: no email address other than the handle appears in the list response
- [ ] Cucumber journey: sign up, register a pack, see it listed with the author handle, start a classroom game on it, and a learner joins
- [ ] OpenAPI documents the new summary fields and the include-archived option
- [ ] Typecheck, vitest, BDD (one feature at a time), lint and boundaries are no worse
