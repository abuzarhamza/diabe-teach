// API catalog for the Concept Chain screens' API overlay.
// Pure data: no DOM access. Loaded as a plain browser script (works from file://)
// and evaluated by tests/claudpoc-api-catalog-drift.test.ts against docs/api/openapi.yaml.
//
// Contracts are hand-written from docs/api/openapi.yaml with $refs resolved.
// Statuses and deviations were checked against src/ and netlify/functions/ on 2026-11-17.
// When a backend gap closes, update `status` and `deviations` here.
//
// Shape (see .scratch/concept-chain-screens-api-overlay/spec.md):
//   steps[letter]    = { title, actor: "teacher"|"learner"|"both", ops: opId[], screens: string[] }
//   operations[opId] = { method, path, pathParams, auth, request, response: { status, body },
//                        errors: [{ status, code }], status, deviations, notes?, sample?(session, ctx),
//                        variants?: { [name]: { auth?, request?, response?, errors?, notes?, deviations? } } }
//   (a step or target may name a `variant`; its fields replace the operation's, and its notes are appended)
//   gaps[key]        = { title, note, ops?: opId[] }   (UI elements with no API; ops may name "missing" operations)
//   targets[key]     = { step?, gap?, ops?, note?, variant? }  (optional finer keys used as data-api="G.reject")
// An element whose operations include a `missing` one is drawn in the bad (red) color.
//
// Pages mark elements with data-api="<letter>" | "<letter>.<detail>" | "gap.<key>"
// and data-api-io="write" (sends a request, dashed) | "read" (shows API data, solid).
/* eslint-disable */
(function (root) {
  // PublicSessionState as the backend returns it today (no activeBoard key at all).
  const sampleState = {
    sessionId: "<sessionId>",
    roomCode: "K7QX2M",
    packId: "diabe-teach",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
    currentPhase: "round-1:chain-mapping",
    activeRoundNumber: 1,
    phaseStartedAt: "2026-11-17T09:00:00.000Z",
    phaseEndsAt: "2026-11-17T09:20:00.000Z",
    participantCount: 3,
  };

  const sampleChain = {
    chainId: "<chainId>",
    sessionId: "<sessionId>",
    roundNumber: 1,
    participantId: "<participantId>",
    path: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }],
    keywordIds: ["insulin", "glut4", "glucose-uptake", "hyperglycaemia"],
    narrativeExplanation: "Insulin moves GLUT4 to the membrane, so glucose uptake rises; without it, blood glucose stays high.",
    stepRationales: [{ fromCoord: { row: 0, col: 0 }, toCoord: { row: 0, col: 1 }, rationale: "Insulin signalling translocates GLUT4." }],
    status: "pending-review",
    verdict: null,
    peerVotes: [{ voterParticipantId: "<otherParticipantId>", decision: "approve", comment: null, votedAt: "2026-11-17T09:22:00.000Z" }],
    submittedAt: "2026-11-17T09:12:00.000Z",
  };

  const rulingNotes = [
    "Instructor Final Ruling: needs the instructor Capability Token (a participant gets 403 FORBIDDEN_ROLE).",
    "`feedback` is required (non-empty); `qualityScore` is optional, 1-10.",
    "The ruling locks the chain: any later vote or ruling on it returns 409 ADJUDICATION_LOCKED_BY_INSTRUCTOR, so disable re-ruling in the UI.",
  ];

  const peerErrors = [
    { status: 401, code: "UNAUTHORIZED_TOKEN" },
    { status: 403, code: "FORBIDDEN_ROLE" },
    { status: 404, code: "SESSION_NOT_FOUND" },
    { status: 404, code: "CHAIN_NOT_FOUND" },
    { status: 409, code: "ADJUDICATION_LOCKED_BY_INSTRUCTOR" },
    { status: 409, code: "CONCURRENT_UPDATE_CONFLICT" },
  ];

  const peerNotes = [
    "Peer vote: needs the learner's participant Capability Token (an instructor token gets 403 FORBIDDEN_ROLE).",
    "Learners can't vote on their own Concept Chain (403 FORBIDDEN_ROLE) or on a chain locked by an Instructor Final Ruling (409 ADJUDICATION_LOCKED_BY_INSTRUCTOR).",
    "`comment` is optional; say which link is weak when challenging.",
  ];

  const peerDeviations = [
    "Voting on your own chain is not rejected by the backend (the demo rejects it with 403 FORBIDDEN_ROLE).",
    "Each vote is appended: voting again adds a second vote instead of replacing the first.",
    "Peer votes never settle a chain: no `peer-consensus` verdict is set, so status stays `pending-review` until the Instructor Final Ruling (the demo settles on 2+ votes with a clear majority).",
    "A vote is accepted in any phase, and the path's `roundNumber` is not checked against the chain's round.",
    "A missing `action` defaults to `peer-approve`.",
    "The returned chain has no `sessionId` or `stepRationales`, and adds `chainLength`.",
  ];

  const catalog = {
    basePath: "/api/v1",

    actors: {
      teacher: { badge: "👩‍🏫", label: "Teacher" },
      learner: { badge: "🎓", label: "Learner" },
      both: { badge: "👩‍🏫🎓", label: "Teacher and learner" },
    },

    authLabels: {
      apiKey: "x-api-key header (only when the server has API_KEY set)",
      instructor: "Authorization: Bearer <instructor Capability Token>",
      participant: "Authorization: Bearer <participant Capability Token>",
    },

    statusLabels: {
      implemented: "Implemented",
      partial: "Partial",
      "specced-only": "Spec only",
      missing: "Missing",
    },

    steps: {
      A: {
        title: "Create session",
        actor: "teacher",
        ops: ["createGameSession"],
        screens: ["teacher"],
      },
      B: {
        title: "Join session",
        actor: "learner",
        ops: ["joinGameSession"],
        screens: ["learner"],
      },
      C: {
        title: "Watch session",
        actor: "both",
        ops: ["getGameSessionState", "streamGameSessionEvents"],
        screens: ["teacher", "lobby", "learner"],
      },
      D: {
        title: "Advance phase",
        actor: "teacher",
        ops: ["transitionSessionPhase"],
        screens: ["teacher"],
      },
      E: {
        title: "Submit Concept Chain",
        actor: "learner",
        ops: ["submitConceptChain"],
        screens: ["learner"],
      },
      F: {
        title: "Peer vote",
        actor: "learner",
        ops: ["adjudicateConceptChain"],
        variant: "peer-approve",
        screens: ["learner"],
      },
      G: {
        title: "Instructor Final Ruling",
        actor: "teacher",
        ops: ["adjudicateConceptChain"],
        variant: "instructor-approve",
        screens: ["teacher"],
      },
      H: {
        title: "Round standings",
        actor: "both",
        ops: ["getRoundStandings"],
        screens: ["teacher", "learner"],
      },
    },

    operations: {
      createGameSession: {
        method: "POST",
        path: "/api/v1/sessions",
        pathParams: {},
        auth: ["apiKey"],
        request: {
          packId: "diabe-teach",
          mode: "classroom",
          adjudicationMode: "peer-instructor",
          timerConfig: { roundMappingSec: 300, roundAdjudicationSec: 240 },
        },
        response: {
          status: 201,
          body: {
            sessionId: "<sessionId>",
            roomCode: "K7QX2M",
            instructorToken: "<instructorToken>",
            participantId: null,
            participantToken: null,
            state: { ...sampleState, currentPhase: "pretest", activeRoundNumber: null, phaseEndsAt: "2026-11-17T09:15:00.000Z", participantCount: 0 },
          },
        },
        errors: [
          { status: 400, code: "INVALID_REQUEST_BODY" },
          { status: 404, code: "PACK_NOT_FOUND" },
        ],
        status: "partial",
        notes: [
          "No Capability Token is needed: this call issues the instructor token. Keep `instructorToken` for every teacher call (D, G, and the reads in C and H).",
          "Share `roomCode` with learners; they join with it (step B).",
          "`timerConfig` durations are whole seconds 1-86400; `null` makes that phase teacher-paced (no deadline). Omitted fields use the defaults (20 min mapping, 10 min peer review).",
          "\"Reset session\" and \"Start a new session\" both create a brand-new Game Session with a new room code; nothing ends the old one.",
        ],
        deviations: [
          "Every session starts in `pretest`, including solo mode (the spec summary says solo auto-starts Round 1; it only auto-joins the creator).",
          "`state` has no `activeBoard` key and no board is dealt; `seed` is ignored.",
          "`mode` and `adjudicationMode` are not validated; only `timerConfig` is (400 INVALID_REQUEST_BODY).",
          "Malformed JSON is not mapped to 400 INVALID_REQUEST_BODY.",
        ],
      },

      joinGameSession: {
        method: "POST",
        path: "/api/v1/sessions/join",
        pathParams: {},
        auth: ["apiKey"],
        request: { roomCode: "K7QX2M", displayName: "Amira" },
        response: {
          status: 200,
          body: {
            sessionId: "<sessionId>",
            participantId: "<participantId>",
            participantToken: "<participantToken>",
            state: { ...sampleState, currentPhase: "pretest", activeRoundNumber: null, phaseEndsAt: "2026-11-17T09:15:00.000Z" },
          },
        },
        errors: [
          { status: 404, code: "ROOM_CODE_NOT_FOUND" },
          { status: 409, code: "CONCURRENT_UPDATE_CONFLICT" },
        ],
        status: "implemented",
        notes: [
          "No Capability Token is needed: this call issues the learner's participant token.",
          "Keep `participantId` and `participantToken` (the demo keeps them in sessionStorage for this tab). Send `Authorization: Bearer <participantToken>` on every later learner call: C (state), E (submit), F (peer vote) and H (standings).",
          "The room code is trimmed and upper-cased before lookup.",
          "A 409 CONCURRENT_UPDATE_CONFLICT is safe to retry.",
        ],
        deviations: [
          "Joining is accepted in any phase, including `completed`.",
          "A missing `displayName` becomes \"Anonymous\"; joining twice creates two participants.",
          "A missing `roomCode` or malformed JSON is not mapped to 400 INVALID_REQUEST_BODY (unmapped server error).",
        ],
      },

      submitConceptChain: {
        method: "POST",
        path: "/api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains",
        pathParams: { sessionId: "Game Session id", roundNumber: "1 or 2 (must be the active Gameplay Round)" },
        auth: ["apiKey", "participant"],
        request: {
          path: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }],
          narrativeExplanation: sampleChain.narrativeExplanation,
          stepRationales: [
            { fromCoord: { row: 0, col: 0 }, toCoord: { row: 0, col: 1 }, rationale: "Insulin signalling translocates GLUT4." },
            { fromCoord: { row: 0, col: 1 }, toCoord: { row: 1, col: 1 }, rationale: "GLUT4 at the membrane lets glucose in." },
            { fromCoord: { row: 1, col: 1 }, toCoord: { row: 2, col: 1 }, rationale: "Without that uptake, blood glucose stays high." },
          ],
        },
        response: { status: 201, body: { chain: { ...sampleChain, peerVotes: [] } } },
        errors: [
          { status: 401, code: "UNAUTHORIZED_TOKEN" },
          { status: 404, code: "SESSION_NOT_FOUND" },
          { status: 409, code: "PHASE_CLOSED_FOR_SUBMISSIONS" },
          { status: 409, code: "CHAIN_ALREADY_SUBMITTED" },
          { status: 409, code: "CONCURRENT_UPDATE_CONFLICT" },
          { status: 422, code: "CHAIN_TOPOLOGY_INVALID" },
        ],
        status: "partial",
        notes: [
          "Send the participant Capability Token from step B.",
          "`path` is the tapped Keyword Cards as GridCoord `{ row, col }` in order; each cell must touch the previous one (sideways, up/down or diagonal) and no cell may repeat, else 422 CHAIN_TOPOLOGY_INVALID.",
          "409 PHASE_CLOSED_FOR_SUBMISSIONS: not in Chain-Mapping, not the active round, or more than 5 s (grace period) after `phaseEndsAt`.",
          "409 CHAIN_ALREADY_SUBMITTED: this learner already sent the same cells in this round (same or reversed order). Learners may submit several different chains.",
        ],
        deviations: [
          "A chain needs at least 4 cells (fixed, not read from the Curriculum Pack); the spec says `minItems: 2` and the demo accepts 2.",
          "`stepRationales` is stored as plain strings, not the spec's StepRationale objects; `keywordIds` is read from the body although the spec doesn't define it, and isn't derived from a board (no board is dealt).",
          "An empty `narrativeExplanation` is accepted (spec `minLength: 1`).",
          "The returned chain has no `sessionId`, `stepRationales`, `peerVotes` or `verdict`, and adds `chainLength` and `keywordIds`.",
          "An instructor token, or a token for another Game Session, gets 403 FORBIDDEN_ROLE, which the spec doesn't declare for this route.",
          "Malformed JSON is not mapped to 400 INVALID_REQUEST_BODY.",
        ],
      },

      getGameSessionState: {
        method: "GET",
        path: "/api/v1/sessions/{sessionId}",
        pathParams: { sessionId: "Game Session id (from createGameSession)" },
        auth: ["apiKey", "instructor"],
        request: null,
        response: { status: 200, body: { state: sampleState } },
        errors: [{ status: 404, code: "SESSION_NOT_FOUND" }],
        status: "partial",
        notes: [
          "Poll this while the stream (streamGameSessionEvents) is not implemented.",
          "Either Capability Token works: the teacher's instructor token or a learner's participant token for this Game Session.",
        ],
        deviations: [
          "Requires a Bearer token for this Game Session (401 UNAUTHORIZED_TOKEN without one, 403 FORBIDDEN_ROLE for another session's token); the spec declares no security and only 404.",
          "`activeBoard` is in the spec but never returned: the board can't come from the server yet.",
          "Only `participantCount` is returned, not the participants; names and per-learner data have no read endpoint.",
          "Round Summary and Completed report `phaseEndsAt` equal to `phaseStartedAt` instead of null.",
        ],
      },

      streamGameSessionEvents: {
        method: "GET",
        path: "/api/v1/sessions/{sessionId}/stream",
        pathParams: { sessionId: "Game Session id" },
        auth: ["apiKey"],
        request: null,
        response: {
          status: 200,
          body: { event: "chain.submitted", data: { chainId: "<chainId>", participantId: "<participantId>", roundNumber: 1 } },
        },
        errors: [{ status: 404, code: "SESSION_NOT_FOUND" }],
        status: "specced-only",
        notes: [
          "text/event-stream of `{ event, data }` envelopes: session.snapshot, participant.joined, phase.changed, chain.submitted, chain.adjudicated, standings.updated.",
          "The spec does not define the `data` payload of each event.",
        ],
        deviations: [
          "Not implemented: there is no Netlify function for this route, so screens must poll getGameSessionState.",
        ],
      },

      listRoundChains: {
        method: "GET",
        path: "/api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains",
        pathParams: { sessionId: "Game Session id", roundNumber: "1 or 2" },
        auth: ["apiKey", "instructor"],
        request: null,
        response: { status: 200, body: { roundNumber: 1, chains: [sampleChain] } },
        errors: [],
        status: "missing",
        notes: [
          "Proposed endpoint: the same path with GET, returning every SubmittedChain of the Gameplay Round (with peer votes and verdict).",
        ],
        deviations: [
          "Neither the spec nor the backend has a way to list a round's Concept Chains. The teacher's review list (and per-learner chain counts) can only be built from the specced-only chain.submitted / chain.adjudicated stream events.",
        ],
      },

      adjudicateConceptChain: {
        method: "POST",
        path: "/api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains/{chainId}/adjudicate",
        pathParams: { sessionId: "Game Session id", roundNumber: "1 or 2", chainId: "Concept Chain id" },
        auth: ["apiKey", "instructor"],
        request: { action: "instructor-approve", feedback: "Clear mechanism; name the transporter in step 2.", qualityScore: 7 },
        response: {
          status: 200,
          body: {
            chain: {
              ...sampleChain,
              status: "approved",
              verdict: {
                isApproved: true,
                adjudicatorType: "instructor-final",
                isLocked: true,
                qualityScore: 7,
                transitionEvaluations: [],
                overallFeedback: "Clear mechanism; name the transporter in step 2.",
                suggestedRefinements: null,
              },
            },
          },
        },
        errors: [
          { status: 401, code: "UNAUTHORIZED_TOKEN" },
          { status: 403, code: "FORBIDDEN_ROLE" },
          { status: 404, code: "SESSION_NOT_FOUND" },
          { status: 404, code: "CHAIN_NOT_FOUND" },
          { status: 409, code: "ADJUDICATION_LOCKED_BY_INSTRUCTOR" },
          { status: 409, code: "CONCURRENT_UPDATE_CONFLICT" },
        ],
        status: "partial",
        notes: [
          "One endpoint, several actions: `peer-approve` / `peer-challenge` (learners, step F), `instructor-approve` / `instructor-reject` (teacher, step G), `ai-evaluate`.",
        ],
        variants: {
          "peer-approve": {
            auth: ["apiKey", "participant"],
            request: { action: "peer-approve", comment: "Every link holds up." },
            response: {
              status: 200,
              body: {
                chain: {
                  ...sampleChain,
                  peerVotes: [{ voterParticipantId: "<participantId>", decision: "approve", comment: "Every link holds up.", votedAt: "2026-11-17T09:22:00.000Z" }],
                },
              },
            },
            errors: peerErrors,
            notes: peerNotes,
            deviations: peerDeviations,
          },
          "peer-challenge": {
            auth: ["apiKey", "participant"],
            request: { action: "peer-challenge", comment: "Step 3 is weak: say why glucose uptake falls." },
            response: {
              status: 200,
              body: {
                chain: {
                  ...sampleChain,
                  peerVotes: [{ voterParticipantId: "<participantId>", decision: "challenge", comment: "Step 3 is weak: say why glucose uptake falls.", votedAt: "2026-11-17T09:22:00.000Z" }],
                },
              },
            },
            errors: peerErrors,
            notes: peerNotes,
            deviations: peerDeviations,
          },
          "instructor-approve": {
            notes: rulingNotes,
          },
          "instructor-reject": {
            request: { action: "instructor-reject", feedback: "Step 3 does not follow: glucose uptake does not cause hyperglycaemia.", qualityScore: 3 },
            response: {
              status: 200,
              body: {
                chain: {
                  ...sampleChain,
                  status: "rejected",
                  verdict: {
                    isApproved: false,
                    adjudicatorType: "instructor-final",
                    isLocked: true,
                    qualityScore: 3,
                    transitionEvaluations: [],
                    overallFeedback: "Step 3 does not follow: glucose uptake does not cause hyperglycaemia.",
                    suggestedRefinements: null,
                  },
                },
              },
            },
            notes: rulingNotes,
          },
        },
        deviations: [
          "`feedback` is not enforced: an empty or missing feedback is accepted. `qualityScore` is not range-checked.",
          "The verdict comes back as `{ isApproved, isLocked, feedback, qualityScore, decidedBy: \"instructor\", decidedAt }`, not the spec's AdjudicationVerdict (no `adjudicatorType`, `overallFeedback`, `transitionEvaluations`).",
          "The returned chain has no `sessionId` or `stepRationales`, and adds `chainLength`.",
          "A ruling is accepted in any phase, and the path's `roundNumber` is not checked against the chain's round.",
          "A missing `action` defaults to `peer-approve`; an unknown action changes nothing and still returns 200.",
          "`ai-evaluate` is a placeholder that always approves with `qualityScore: 75`.",
        ],
      },

      getRoundStandings: {
        method: "GET",
        path: "/api/v1/sessions/{sessionId}/rounds/{roundNumber}/standings",
        pathParams: { sessionId: "Game Session id", roundNumber: "1 or 2" },
        auth: ["apiKey", "instructor"],
        request: null,
        response: {
          status: 200,
          body: {
            roundNumber: 1,
            isFinalized: false,
            standings: [
              { rank: 1, participantId: "<participantId>", displayName: "Amira", longestValidChainLength: 6, totalValidChainsCount: 2, cumulativeRationaleScore: 0, approvedChainIds: ["<chainId>", "<chainId2>"] },
            ],
          },
        },
        errors: [{ status: 404, code: "SESSION_NOT_FOUND" }],
        status: "partial",
        notes: [
          "Ranked by longest approved Concept Chain, then number of approved chains.",
          "`isFinalized` turns true once the round reaches its Round Summary (or any later phase).",
          "Either Capability Token works (instructor or participant of this Game Session).",
          "Equal results get consecutive ranks (list order); there is no shared rank.",
        ],
        deviations: [
          "Requires a Bearer token for this Game Session (401 / 403); the spec declares no security and only 404.",
          "Learners with no approved chain are left out; the screen lists every learner, so it must merge with its own roster.",
          "No `cumulativeRationaleScore` is returned, and identical paths are not deduplicated.",
          "There is no pending-review count: the \"To check\" column has no API field.",
        ],
      },

      transitionSessionPhase: {
        method: "POST",
        path: "/api/v1/sessions/{sessionId}/phase",
        pathParams: { sessionId: "Game Session id (from createGameSession)" },
        auth: ["apiKey", "instructor"],
        request: { action: "advance" },
        response: {
          status: 200,
          body: { state: sampleState },
        },
        errors: [
          { status: 401, code: "UNAUTHORIZED_TOKEN" },
          { status: 403, code: "FORBIDDEN_ROLE" },
          { status: 404, code: "SESSION_NOT_FOUND" },
          { status: 409, code: "INVALID_PHASE_TRANSITION" },
          { status: 409, code: "CONCURRENT_UPDATE_CONFLICT" },
        ],
        status: "partial",
        notes: [
          "The server never auto-advances: a phase changes only when the teacher calls this.",
          "It only moves to the next phase in the Game Session order; there is no skipping or going back.",
          "A write conflict is retried up to 3 times; a 409 CONCURRENT_UPDATE_CONFLICT is safe to retry.",
        ],
        deviations: [
          "No Keyword Card board is shuffled on Round 1 or Round 2 entry, and `seed` is ignored; `activeBoard` is never returned.",
          "`jump` is accepted but can only target the next phase (otherwise 409 INVALID_PHASE_TRANSITION).",
          "Advancing from `completed` returns 200 with the unchanged state instead of 409.",
          "A missing `action` defaults to `advance` although the spec makes it required.",
          "Round Summary and Completed report `phaseEndsAt` equal to `phaseStartedAt` instead of null.",
          "Only the instructor token is accepted (a participant gets 403 FORBIDDEN_ROLE).",
          "x-api-key is checked when the server has API_KEY set, but the spec does not declare it here.",
          "Malformed JSON is not mapped to 400 INVALID_REQUEST_BODY.",
        ],
      },
    },

    gaps: {
      extend: {
        title: "Extend the phase (+1 min)",
        note: "No API can extend a phase: `phaseEndsAt` is fixed from the session's timerConfig when the phase starts, and a timerConfig can only be set at createGameSession. The demo changes its local timer only.",
      },
    },

    // Finer keys for data-api="<letter>.<detail>". Keys not listed here fall back to the step letter.
    targets: {
      "A.roomCode": {
        note: "Shows `roomCode` from the createGameSession response (also in every `state`).",
      },
      "C.phase": {
        note: "The phase (teacher's phase steps, the lobby's and learner's phase pill) comes from `state.currentPhase` (and `activeRoundNumber`). The server never advances on its own; only step D changes the phase.",
      },
      "C.count": {
        ops: ["getGameSessionState"],
        note: "\"N joined\" is `state.participantCount`.",
      },
      "C.timer": {
        note: "The countdown is `state.phaseEndsAt` minus now. `phaseEndsAt: null` means the phase is teacher-paced: no deadline, it lasts until the teacher clicks Next phase. When the Chain-Mapping time runs out, submissions are still accepted for a fixed 5 s grace period, then rejected with 409 PHASE_CLOSED_FOR_SUBMISSIONS; the phase stays current (closed) until the teacher advances.",
      },
      "C.board": {
        note: "Meant to be `state.activeBoard` (a BoardGridView of Keyword Cards). It is in the spec but the backend never returns it and deals no board, so today the board can only be built on the client.",
      },
      "C.roster": {
        ops: ["getGameSessionState", "streamGameSessionEvents", "listRoundChains"],
        note: "No endpoint lists the participants: `state` has only `participantCount`, and names would arrive via the specced-only `participant.joined` stream event. The per-learner chain counts need the missing list-round-chains endpoint.",
      },
      "C.review": {
        ops: ["listRoundChains", "streamGameSessionEvents"],
        note: "Needs a missing endpoint: nothing lists a Gameplay Round's Concept Chains. Proposed: GET /api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains, then keep it fresh from `chain.submitted` / `chain.adjudicated` stream events.",
      },
      "C.classmates": {
        ops: ["getGameSessionState", "streamGameSessionEvents"],
        note: "No endpoint lists the participants: `state` has only `participantCount`. Each classmate's name would arrive in a `participant.joined` stream event (specced only), so today the list can't come from the server.",
      },
      "C.timeline": {
        ops: ["getGameSessionState"],
        note: "The session timeline marks `state.currentPhase` as now; the order of phases is fixed by the Game Session, not returned by the API.",
      },
      "C.classChains": {
        ops: ["listRoundChains", "streamGameSessionEvents"],
        note: "Classmates' Concept Chains to review need a missing endpoint: nothing lists a Gameplay Round's chains. Proposed: GET /api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains, kept fresh from `chain.submitted` / `chain.adjudicated` stream events.",
      },
      "C.myChains": {
        ops: ["listRoundChains", "streamGameSessionEvents"],
        note: "Each chain the learner submitted comes back in the step E response, but later peer votes and the Instructor Final Ruling on it can only arrive from the missing list-round-chains endpoint or `chain.adjudicated` stream events.",
      },
      "E.builder": {
        note: "Builds the submitConceptChain body: tapped Keyword Cards → `path` (GridCoord), each link's reason → `stepRationales`, the story → `narrativeExplanation`.",
      },
      "F.approve": { variant: "peer-approve" },
      "F.challenge": { variant: "peer-challenge" },
      "G.approve": { variant: "instructor-approve" },
      "G.reject": { variant: "instructor-reject" },
      "G.verdict": {
        variant: "instructor-approve",
        note: "Shows the locked verdict (feedback and quality score) returned by the Instructor Final Ruling. The chain can't be ruled or voted on again (409 ADJUDICATION_LOCKED_BY_INSTRUCTOR).",
      },
    },

    globalNotes: [
      "Paths use the /api/v1 base path.",
      "When the server has API_KEY set, every route checks the x-api-key header.",
    ],
  };

  root.CC_API_CATALOG = catalog;
})(typeof globalThis !== "undefined" ? globalThis : this);
