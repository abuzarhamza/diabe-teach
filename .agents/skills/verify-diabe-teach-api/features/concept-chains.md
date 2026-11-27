# Concept chains and adjudication

During a round's chain-mapping phase, a learner traces a path of adjacent Keyword Cards on the dealt board and explains the connections. The server checks the path's shape. In peer adjudication, classmates cast peer votes, and the instructor's Final Ruling approves or rejects a chain and locks its verdict. Round standings rank learners by longest valid chain and approved chains.

## Sub-features

- `chain-submit` accepts a Chebyshev-8 adjacent, non-repeating path of at least `minChainLength` cells (4 for `diabe-teach`). The server resolves the `keywordIds`.
- `chain-topology-invalid` refuses a path that is too short, not adjacent, repeats a cell or leaves the board.
- `chain-duplicate` refuses the same path, or its reverse, from the same learner in a round.
- `chain-phase-closed` refuses a submission outside `round-N:chain-mapping`, or for a round that is not active.
- `chain-list-visibility` lets the instructor see every chain. A learner sees only their own chains during mapping, and everyone's from peer adjudication on.
- `chain-peer-vote` records `peer-approve` or `peer-reject` with a reason.
- `chain-final-ruling` handles `instructor-approve` or `instructor-reject` (feedback required, `qualityScore` 1..10). It locks the verdict, so later votes get `409`.
- `chain-ruling-forbidden` refuses a learner's attempt at an instructor ruling.
- `round-standings` ranks learners (`rank`, `longestValidChainLength`, `approvedChainCount`, `totalSubmittedChains`).

## How to get to it (user POV)

- `POST /api/v1/sessions/:sessionId/rounds/:roundNumber/chains` (participant token).
- `GET /api/v1/sessions/:sessionId/rounds/:roundNumber/chains` (either role).
- `POST /api/v1/sessions/:sessionId/rounds/:roundNumber/chains/:chainId/adjudicate` (peer vote: either role; ruling: instructor).
- `GET /api/v1/sessions/:sessionId/rounds/:roundNumber/standings` (either role).
- Bruno: `docs/api/bruno/05-Chains-and-Adjudication/`. Its submit request advances the phase by itself in a pre-request script.

## Driving it with vapi

Preconditions:

- Baseline from the [README](./README.md).
- A classroom session in `round-1:chain-mapping` with two learners. Build it with the bullets below. They reuse the [session-lifecycle](./session-lifecycle.md) routes.

- **Set up the session.** Run `vapi req concept-chains sign-up POST /api/v1/accounts/sign-up --json '{"email":"chains.teacher@example.edu","password":"correct horse battery"}' --expect 201 --save accountToken=accountToken`. Then `vapi set packId=diabe-teach` and `vapi req concept-chains create POST /api/v1/sessions --auth accountToken --bru-body docs/api/bruno/04-Game-Sessions/01-create-session.bru --expect 201 --save sessionId=sessionId --save roomCode=roomCode --save instructorToken=instructorToken`. Then `vapi req concept-chains join-alice POST /api/v1/sessions/join --json '{"roomCode":"{{roomCode}}","displayName":"Alice"}' --expect 200 --save aliceToken=participantToken` and `vapi req concept-chains join-bob POST /api/v1/sessions/join --json '{"roomCode":"{{roomCode}}","displayName":"Bob"}' --expect 200 --save bobToken=participantToken`.
- **Too early.** In `pretest`, run `vapi req concept-chains submit-too-early POST /api/v1/sessions/{{sessionId}}/rounds/1/chains --auth aliceToken --bru-body docs/api/bruno/05-Chains-and-Adjudication/01-submit-chain.bru --expect 409 --expect-code PHASE_CLOSED_FOR_SUBMISSIONS`.
- **Open round 1.** Run `vapi req concept-chains advance-1 POST /api/v1/sessions/{{sessionId}}/phase --auth instructorToken --json '{"action":"advance"}' --expect 200` and `vapi req concept-chains advance-2 POST /api/v1/sessions/{{sessionId}}/phase --auth instructorToken --json '{"action":"advance"}' --expect 200 --expect-field state.currentPhase=round-1:chain-mapping`.
- **Alice submits a valid chain.** Run `vapi req concept-chains submit POST /api/v1/sessions/{{sessionId}}/rounds/1/chains --auth aliceToken --bru-body docs/api/bruno/05-Chains-and-Adjudication/01-submit-chain.bru --expect 201 --expect-field chain.chainLength=4 --save chainId=chain.chainId`. The path is `(0,0)(0,1)(1,1)(1,2)`, and `chain.keywordIds` has 4 ids.
- **Same path again.** Repeat with label `submit-duplicate` and `--expect 409 --expect-code CHAIN_ALREADY_SUBMITTED`.
- **Broken path.** Run `vapi req concept-chains submit-not-adjacent POST /api/v1/sessions/{{sessionId}}/rounds/1/chains --auth aliceToken --json '{"path":[{"row":0,"col":0},{"row":0,"col":2},{"row":1,"col":2},{"row":2,"col":2}],"narrativeExplanation":"Not adjacent.","stepRationales":["a","b","c"]}' --expect 422 --expect-code CHAIN_TOPOLOGY_INVALID`.
- **Wrong round.** Run the valid body against `/rounds/2/chains` with label `submit-wrong-round` and `--expect 409 --expect-code PHASE_CLOSED_FOR_SUBMISSIONS`.
- **Visibility during mapping.** Run `vapi req concept-chains list-bob-mapping GET /api/v1/sessions/{{sessionId}}/rounds/1/chains --auth bobToken --expect 200`: `chains` is empty. Run `vapi req concept-chains list-instructor GET /api/v1/sessions/{{sessionId}}/rounds/1/chains --auth instructorToken --expect 200 --expect-field chains.0.chainId={{chainId}} --expect-field chains.0.participantDisplayName=Alice`.
- **Open peer adjudication.** Run `vapi req concept-chains advance-3 POST /api/v1/sessions/{{sessionId}}/phase --auth instructorToken --json '{"action":"advance"}' --expect 200 --expect-field state.currentPhase=round-1:peer-adjudication`. Then `vapi req concept-chains list-bob-adjudication GET /api/v1/sessions/{{sessionId}}/rounds/1/chains --auth bobToken --expect 200 --expect-field chains.0.chainId={{chainId}}` shows Bob can now see Alice's chain.
- **Bob votes.** Run `vapi req concept-chains peer-vote POST /api/v1/sessions/{{sessionId}}/rounds/1/chains/{{chainId}}/adjudicate --auth bobToken --json '{"action":"peer-approve","reason":"Consecutive cards are physiologically connected."}' --expect 200`. A re-list shows the vote with `voterDisplayName: "Bob"`.
- **Learner tries to rule.** Run `vapi req concept-chains ruling-as-participant POST /api/v1/sessions/{{sessionId}}/rounds/1/chains/{{chainId}}/adjudicate --auth bobToken --bru-body docs/api/bruno/05-Chains-and-Adjudication/03-adjudicate-chain.bru --expect 403 --expect-code FORBIDDEN_ROLE`.
- **Reject with no feedback.** Run `vapi req concept-chains ruling-no-feedback POST /api/v1/sessions/{{sessionId}}/rounds/1/chains/{{chainId}}/adjudicate --auth instructorToken --json '{"action":"instructor-reject","feedback":""}' --expect 400 --expect-code INVALID_REQUEST_BODY`.
- **Instructor Final Ruling.** Run `vapi req concept-chains ruling POST /api/v1/sessions/{{sessionId}}/rounds/1/chains/{{chainId}}/adjudicate --auth instructorToken --bru-body docs/api/bruno/05-Chains-and-Adjudication/03-adjudicate-chain.bru --expect 200 --expect-field chain.status=approved --expect-field chain.verdict.isLocked=true`.
- **Locked.** Run the peer vote again with label `peer-vote-locked` and `--expect 409 --expect-code ADJUDICATION_LOCKED_BY_INSTRUCTOR`.
- **Unknown chain.** Run `vapi req concept-chains ruling-unknown-chain POST /api/v1/sessions/{{sessionId}}/rounds/1/chains/no-such-chain/adjudicate --auth instructorToken --bru-body docs/api/bruno/05-Chains-and-Adjudication/03-adjudicate-chain.bru --expect 404 --expect-code CHAIN_NOT_FOUND`.
- **Standings.** Run `vapi req concept-chains standings GET /api/v1/sessions/{{sessionId}}/rounds/1/standings --auth aliceToken --expect 200 --expect-field standings.0.displayName=Alice --expect-field standings.0.approvedChainCount=1 --expect-field standings.0.longestValidChainLength=4`.

## Gotchas

- The board is dealt when the session enters `round-1:chain-mapping`. Which card lands on `(0,0)` depends on the `seed`, but a path's validity depends only on its coordinates.
- `stepRationales` comes back as plain strings, while OpenAPI documents `StepRationale` objects. This is known drift; don't count it as a failure of this feature.
- Peer votes are not deduplicated, and nothing stops an author voting on their own chain (known backlog item). Don't build a proof that relies on either being refused.
- `:roundNumber` must be `1` or `2`. Anything else returns `400 INVALID_REQUEST_BODY` on the list route.
- If the phase has a timer and it runs out, submissions close after `phaseEndsAt` plus a 5 s grace period. Long pauses between bullets can make submit fail with `PHASE_CLOSED_FOR_SUBMISSIONS`. Use `phase/extend` or relaunch rather than weakening the step.
