# 02: Concept Chain topology, duplicate/reversed chains, phase jump, and post-leave refusals in classroom BDD

**What to build:** Complete the remaining non-happy-path edge cases for a Classroom Game Session in the classroom BDD feature:
1. **Concept Chain minimum length and duplicate/reversed refusals:**
   - During Chain-Mapping, a learner submitting a Concept Chain shorter than the Curriculum Pack's `minChainLength` (2 cells when 4 are required) is refused with `422 CHAIN_TOPOLOGY_INVALID` (using the existing short-chain step definition).
   - After submitting a valid 4-cell Concept Chain (`201`), the same learner re-submitting the identical path in the same Gameplay Round is refused with `409 CHAIN_ALREADY_SUBMITTED`.
   - The same learner submitting the exact reverse of that 4-cell path in the same Gameplay Round is also refused with `409 CHAIN_ALREADY_SUBMITTED`.
   - A different learner in the same Gameplay Round submitting that same 4-cell path is accepted (`201`).
2. **Phase transition `jump` refusals and invalid round URL parameter:**
   - An instructor jumping ahead to skip phases (e.g. from `pretest` to `completed`, using the existing phase-jump step definition) is refused with `409 INVALID_PHASE_TRANSITION`.
   - An instructor sending a `jump` transition without `targetPhase` is refused with `400 INVALID_REQUEST_BODY` naming `targetPhase`.
   - Requesting a round's Concept Chains with an out-of-range Gameplay Round number in the URL (e.g. round `3`) is refused with `400 INVALID_REQUEST_BODY`.
   - Calling a session `BearerAuth` route (listing round chains) with an Instructor Account's Account Token instead of a session Capability Token is refused with `401 UNAUTHORIZED_TOKEN`.
3. **Comprehensive post-leave write refusals (`PARTICIPANT_HAS_LEFT`) and instructor `leave` refusal:**
   - A learner who has left the Game Session is refused with `403 PARTICIPANT_HAS_LEFT` when attempting to submit an Assessment Attempt, cast a peer vote, or submit the perception survey.
   - An instructor calling the learner `leave` endpoint with an instructor Capability Token is refused with `403 FORBIDDEN_ROLE`.

See spec: `.scratch/bdd-non-happy-path-coverage/spec.md`.

**Blocked by:** 01 (Adjudication lifecycle, Instructor Final Ruling lock, and standings in BDD and handler tests)

**Status:** ready-for-agent

- [ ] BDD classroom scenario: `< minChainLength` returns `422 CHAIN_TOPOLOGY_INVALID`, same learner re-submitting identical or reversed path returns `409 CHAIN_ALREADY_SUBMITTED`, and a classmate submitting that path succeeds (`201`)
- [ ] BDD classroom scenario: skipping phases via `jump` returns `409 INVALID_PHASE_TRANSITION`, `jump` without `targetPhase` returns `400 INVALID_REQUEST_BODY` naming `targetPhase`, out-of-range round `3` on chain listing returns `400 INVALID_REQUEST_BODY`, and an Account Token on chain listing returns `401 UNAUTHORIZED_TOKEN`
- [ ] BDD classroom scenario: a departed learner gets `403 PARTICIPANT_HAS_LEFT` on Assessment Attempt submission, peer voting, and perception survey submission, and an instructor calling `leave` gets `403 FORBIDDEN_ROLE`
- [ ] Zero wall-clock sleeps added
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (`classroom-session-journey`), lint (≤ 29) and boundaries (≤ 6) are no worse
