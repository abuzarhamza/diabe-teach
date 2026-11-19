# 05: Teachers manage the shared pack library with their account

**What to build:** The Curriculum Pack routes for validating, registering, archiving and unarchiving accept an **Account Token** instead of an instructor Capability Token, so a teacher can prepare packs before ever starting a game. The library is shared: **any** signed-in teacher can register a new pack, release a new **Pack Version** of any pack (by registering the same pack id with a new version, including a pack a colleague made), and archive or unarchive any pack. Rules that stay the same:

- **System Packs** stay protected from archiving and from new versions by users.
- Registering an existing pack id with an existing version is still 409.
- There is still no delete.

Each Pack Version's `createdBy` becomes the registering account's id. Archiving and unarchiving record the acting account and the time. Packs registered before this change keep their old `createdBy`.

Fix or work around the `netlify.toml` redirect that sends every method on the pack collection path to the list function, so that registering at the documented path reaches the register function.

See spec: `.scratch/teacher-login/spec.md`.

**Blocked by:** 01 (Teachers sign up and sign in with an email and password)

**Status:** ready-for-agent

- [ ] Handler test: validate and register work with an Account Token and no Game Session; without a token they return 401, and with a Capability Token they return 401
- [ ] Handler test: teacher B can register v2 of a pack teacher A created; v1 is unchanged, and v2's `createdBy` is teacher B
- [ ] Handler test: teacher B can archive and unarchive teacher A's pack; the record shows teacher B and the time
- [ ] Handler test: archiving, or registering a new version of, a System Pack is refused as today
- [ ] Handler test: registering an existing pack id and version returns 409
- [ ] A POST to the documented pack registration path reaches the register function (checked against `npm run dev:local`)
- [ ] Curriculum pack repository coverage: `createdBy` as an account id, and the archive actor and time, round-trip in Mongo
- [ ] OpenAPI documents the Account Token on the pack routes and drops the Capability Token requirement there
- [ ] Typecheck, vitest, BDD (one feature at a time), lint and boundaries are no worse
