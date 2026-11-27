# 01: Teacher publishes a new pack from pasted words

**What to build:** A signed-in teacher clicks **New pack** in the Pack Library and lands on `/packs/new`. The editor looks like the prototype's "New pack" panel. The teacher pastes words (one per line, or separated by commas, semicolons or tabs). Blanks and case-insensitive duplicates are dropped, and the words show as chips with a running count. The teacher enters a **Pack name**, and optionally a **Learner level** (with the prototype's suggestions) and a **Learning objective**. **Publish** registers the pack in the shared library and takes the teacher to its Pack Detail page, which shows version 1.0.0. The library list shows the new pack without a reload. **Cancel** returns to the library without saving. The editor sits under the existing teacher guard.

The pack body is built by a pure UI-domain rule ported from the prototype (`packInput` and `cleanKeywords`; see spec, Implementation Decisions):
- version 1.0.0
- one Semantic Domain `general`, and one card per word
- a one-line Adjudication Rubric
- `minChainLength` 2, Chebyshev-8
- board size `floor(sqrt(n))`, clamped to 3..7
- no assessment and no survey

The pack id is a slug of the name, made unique with `-2`, `-3`… against every pack id, archived ones included.

This tracer also adds the register call to the packs API module, and a named publish hook that invalidates the pack list and the pack's detail query.

**Blocked by:** react-web-ui 03 (Pack Library and Pack Detail: the packs API module, pack hooks, the `/packs` and `/packs/:packId` screens)

**Status:** ready-for-agent

**Spec:** `../spec.md`

- [ ] Screen test (rendered `/packs/new` over the fake fetch): paste with a duplicate in other case and a blank line → one chip per distinct word, and the count is right.
- [ ] Screen test: Publish sends `POST /api/v1/packs` with the Account Token. Its body has the slug id, version 1.0.0, one card per word, the `general` domain, and a board size that matches the word count.
- [ ] Screen test: when the slug is taken by an **archived** pack, the id gets `-2` (the list is read with `includeArchived=true`).
- [ ] Screen test: after a 201, the teacher is on `/packs/<packId>` and the library query is invalidated (no `useEffect`).
- [ ] Screen test: fewer than 9 distinct words, or an empty name, gives a plain sentence with focus on the field to fix, and the fake `fetch` is never called for registering.
- [ ] Screen test: a signed-out teacher opening `/packs/new` is sent to `/login` with the reason.
- [ ] Only `*-hooks.ts` files import TanStack Query. The pack-building and id rules are pure UI-domain code (no React, no fetch).
- [ ] Manual check in Chrome against `dev:prototype` (no `VITE_API_KEY`): publish a pack and see it in the library and on its detail page.
