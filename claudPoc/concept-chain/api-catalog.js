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
//   noScreen[]       = { title, actor, ops: opId[] }  (operations no screen uses yet; legend only)
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
        title: "Start game",
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
          "\"Start game\" on Game setup creates a brand-new Game Session with a new room code; \"Reset session\" and \"Start a new session\" on the teacher screen go back to Game setup. Nothing ends the old session.",
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
      // Operations with no screen in this prototype yet: listed in the legend's "no screen yet" section only.
      submitAssessmentAttempt: {
        method: "POST",
        path: "/api/v1/sessions/{sessionId}/assessments/{stage}",
        pathParams: { stage: ["pretest", "posttest"] },
        auth: ["apiKey", "participant"],
        errors: [
          { status: 401, code: "UNAUTHORIZED_TOKEN" },
          { status: 404, code: "SESSION_NOT_FOUND" },
          { status: 409, code: "ASSESSMENT_ALREADY_SUBMITTED" },
          { status: 409, code: "PHASE_CLOSED_FOR_SUBMISSIONS" },
          { status: 409, code: "CONCURRENT_UPDATE_CONFLICT" },
          { status: 422, code: "ASSESSMENT_INCOMPLETE" },
        ],
        status: "implemented",
        deviations: ["An unknown `stage` returns 400 INVALID_STAGE with an `{ error, message }` body; the spec declares no 400 here."],
        notes: ["Pretest returns an ungraded receipt; Posttest returns the LearnerMetacognitiveReport. Handler exists; not re-audited in detail for the overlay."],
      },
      submitPerceptionSurvey: {
        method: "POST",
        path: "/api/v1/sessions/{sessionId}/survey",
        auth: ["apiKey", "participant"],
        errors: [
          { status: 401, code: "UNAUTHORIZED_TOKEN" },
          { status: 404, code: "SESSION_NOT_FOUND" },
          { status: 409, code: "SURVEY_ALREADY_SUBMITTED" },
          { status: 409, code: "PHASE_CLOSED_FOR_SUBMISSIONS" },
          { status: 409, code: "CONCURRENT_UPDATE_CONFLICT" },
          { status: 422, code: "INVALID_SURVEY_RESPONSE" },
          { status: 422, code: "SURVEY_COMMENTS_TOO_LONG" },
        ],
        status: "implemented",
        deviations: [],
        notes: ["5-point Likert ratings, once per participant, in the feedback-survey phase. Handler exists; not re-audited in detail for the overlay."],
      },
      getSessionAnalytics: {
        method: "GET",
        path: "/api/v1/sessions/{sessionId}/analytics",
        auth: ["apiKey", "instructor", "participant"],
        errors: [
          { status: 401, code: "UNAUTHORIZED_TOKEN" },
          { status: 404, code: "SESSION_NOT_FOUND" },
        ],
        status: "specced-only",
        deviations: ["No handler: nothing in src/ or netlify/functions/ serves this route yet."],
      },
    },

    gaps: {
      extend: {
        title: "Extend the phase (+1 min)",
        note: "No API can extend a phase: `phaseEndsAt` is fixed from the session's timerConfig when the phase starts, and a timerConfig can only be set at createGameSession. The demo changes its local timer only.",
      },
    },

    // Operations no screen uses yet (Pre-test, Post-test, survey, analytics). Shown at the bottom of the
    // flow legend as "no screen yet"; no letter, so later steps can still be appended without re-lettering.
    noScreen: [
      { title: "Pretest / Posttest Assessment Attempt", actor: "learner", ops: ["submitAssessmentAttempt"] },
      { title: "Perception survey", actor: "learner", ops: ["submitPerceptionSurvey"] },
      { title: "Session analytics", actor: "both", ops: ["getSessionAnalytics"] },
    ],

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

  // ---- live samples ----
  // operations[op].sample(state, ctx) builds request/response JSON from the demo session, in API shapes.
  // Pure and deterministic: no DOM, no clock, no randomness. A pinned card re-renders on every redraw and
  // its copy buttons copy exactly what this returns.
  //   state = CC.get():  { session: PublicSessionState (+ activeBoard), participants: [], chains: SubmittedChain-like[] }
  //   ctx (built by api-overlay.js, plain data only):
  //     variant        the step/target variant (e.g. "peer-challenge", "instructor-reject")
  //     chainId        the Concept Chain under the cursor (from the nearest [data-api-chain]), or null
  //     participantId  this tab's learner, when the page knows it
  //     draft          learner's chain being built: { path: GridCoord[], links: string[], story: string }
  //     voteNotes      { [chainId]: comment draft }  (learner)
  //     rulings        { [chainId]: { feedback, score } }  (teacher's ruling drafts)
  // Returns { path?, request?, response? }; anything left out falls back to the fixed example.
  // Values the demo can't know (tokens, ids and times the server assigns) stay as <placeholders>.
  const PHASES = ["pretest", "trial-orientation", "round-1:chain-mapping", "round-1:peer-adjudication", "round-1:round-summary",
    "round-2:chain-mapping", "round-2:peer-adjudication", "round-2:round-summary", "posttest", "feedback-survey", "completed"];
  const TIMER_SEC = { "chain-mapping": 300, "peer-adjudication": 240 }; // the createGameSession sample's timerConfig

  const fillPath = (template, params) => template.replace(/\{(\w+)\}/g, (whole, name) => (params[name] ?? null) === null ? whole : String(params[name]));

  function publicState(state) {
    const ss = state.session;
    return {
      sessionId: ss.sessionId, roomCode: ss.roomCode, packId: ss.packId, mode: ss.mode, adjudicationMode: ss.adjudicationMode,
      currentPhase: ss.currentPhase, activeRoundNumber: ss.activeRoundNumber ?? null,
      phaseStartedAt: ss.phaseStartedAt, phaseEndsAt: ss.phaseEndsAt ?? null,
      participantCount: state.participants.length, // no activeBoard: the backend never returns it
    };
  }

  function publicChain(c) {
    return {
      chainId: c.chainId, sessionId: c.sessionId, roundNumber: c.roundNumber, participantId: c.participantId,
      path: c.path, keywordIds: c.keywordIds, narrativeExplanation: c.narrativeExplanation,
      stepRationales: c.stepRationales ?? [], status: c.status, verdict: c.verdict ?? null,
      peerVotes: c.peerVotes ?? [], submittedAt: c.submittedAt,
    };
  }

  const roundOf = (state, ctxChain) => ctxChain?.roundNumber ?? state.session.activeRoundNumber ?? null;
  const chainById = (state, id) => (id ? state.chains.find((c) => c.chainId === id) ?? null : null);

  // The learner's draft chain as a SubmitChainRequest (same conversion as participant.html's submit()).
  function draftRequest(draft) {
    const path = (draft?.path ?? []).map((c) => ({ row: c.row, col: c.col }));
    if (!path.length) return null;
    return {
      path,
      narrativeExplanation: (draft.story ?? "").trim(),
      stepRationales: path.slice(1).map((c, i) => ({ fromCoord: path[i], toCoord: c, rationale: (draft.links?.[i] ?? "").trim() })),
    };
  }

  // Ranking as the demo shows it: longest approved Concept Chain, then number approved, then name.
  function standingsFor(state, round) {
    return state.participants.map((p) => {
      const ok = state.chains.filter((c) => c.roundNumber === round && c.participantId === p.participantId && c.status === "approved");
      return { participantId: p.participantId, displayName: p.displayName, longestValidChainLength: Math.max(0, ...ok.map((c) => c.path.length)),
        totalValidChainsCount: ok.length, cumulativeRationaleScore: 0, approvedChainIds: ok.map((c) => c.chainId) };
    }).sort((a, b) => b.longestValidChainLength - a.longestValidChainLength || b.totalValidChainsCount - a.totalValidChainsCount || a.displayName.localeCompare(b.displayName))
      .map((r, i) => ({ rank: i + 1, ...r }));
  }

  function nextState(state) {
    const cur = publicState(state), i = PHASES.indexOf(cur.currentPhase);
    if (i < 0 || i >= PHASES.length - 1) return cur; // completed: 200 with the state unchanged (see deviations)
    const phase = PHASES[i + 1], m = /^round-(\d)/.exec(phase), sec = TIMER_SEC[phase.split(":")[1]];
    return { ...cur, currentPhase: phase, activeRoundNumber: m ? Number(m[1]) : null, phaseStartedAt: "<server time>",
      phaseEndsAt: sec ? `<phaseStartedAt + ${sec} s>` : null };
  }

  const ops = catalog.operations;
  const sid = (state) => ({ sessionId: state.session.sessionId });

  ops.createGameSession.sample = (state) => {
    const st = publicState(state), fresh = st.currentPhase === "pretest";
    return {
      response: { status: 201, body: {
        sessionId: st.sessionId, roomCode: st.roomCode, instructorToken: "<instructorToken>", participantId: null, participantToken: null,
        state: { ...st, currentPhase: "pretest", activeRoundNumber: null, phaseStartedAt: fresh ? st.phaseStartedAt : "<createdAt>", phaseEndsAt: fresh ? st.phaseEndsAt : null, participantCount: 0 },
      } },
    };
  };

  ops.joinGameSession.sample = (state, ctx = {}) => {
    const me = state.participants.find((p) => p.participantId === ctx.participantId);
    return {
      request: { roomCode: state.session.roomCode, displayName: me?.displayName ?? "Amira" },
      response: { status: 200, body: { sessionId: state.session.sessionId, participantId: me?.participantId ?? "<participantId>", participantToken: "<participantToken>", state: publicState(state) } },
    };
  };

  ops.getGameSessionState.sample = (state) => ({
    path: fillPath(ops.getGameSessionState.path, sid(state)),
    response: { status: 200, body: { state: publicState(state) } },
  });

  ops.streamGameSessionEvents.sample = (state) => {
    const st = publicState(state);
    return {
      path: fillPath(ops.streamGameSessionEvents.path, sid(state)),
      response: { status: 200, body: { event: "phase.changed", data: { currentPhase: st.currentPhase, activeRoundNumber: st.activeRoundNumber, phaseStartedAt: st.phaseStartedAt, phaseEndsAt: st.phaseEndsAt } } },
    };
  };

  ops.transitionSessionPhase.sample = (state) => ({
    path: fillPath(ops.transitionSessionPhase.path, sid(state)),
    response: { status: 200, body: { state: nextState(state) } },
  });

  ops.submitConceptChain.sample = (state, ctx = {}) => {
    const round = roundOf(state, null), request = draftRequest(ctx.draft);
    const out = { path: fillPath(ops.submitConceptChain.path, { ...sid(state), roundNumber: round }) };
    if (!request) return out; // nothing built yet: fixed example body
    const board = state.session.activeBoard;
    out.request = request;
    out.response = { status: 201, body: { chain: {
      chainId: "<chainId>", sessionId: state.session.sessionId, roundNumber: round ?? "<roundNumber>", participantId: ctx.participantId ?? "<participantId>",
      path: request.path, keywordIds: request.path.map((c) => board?.cells?.[c.row]?.[c.col]?.keywordId ?? "<keywordId>"),
      narrativeExplanation: request.narrativeExplanation, stepRationales: request.stepRationales,
      status: "pending-review", verdict: null, peerVotes: [], submittedAt: "<submittedAt>",
    } } };
    return out;
  };

  ops.listRoundChains.sample = (state) => {
    const round = roundOf(state, null);
    if (round === null) return { path: fillPath(ops.listRoundChains.path, sid(state)) };
    return {
      path: fillPath(ops.listRoundChains.path, { ...sid(state), roundNumber: round }),
      response: { status: 200, body: { roundNumber: round, chains: state.chains.filter((c) => c.roundNumber === round).map(publicChain) } },
    };
  };

  ops.adjudicateConceptChain.sample = (state, ctx = {}) => {
    const chain = chainById(state, ctx.chainId), round = roundOf(state, chain);
    const out = { path: fillPath(ops.adjudicateConceptChain.path, { ...sid(state), roundNumber: round, chainId: chain?.chainId ?? null }) };
    if (!chain) return out;
    const action = ctx.variant ?? "peer-approve", base = publicChain(chain);
    if (action.startsWith("peer-")) {
      const decision = action === "peer-challenge" ? "challenge" : "approve";
      const comment = (ctx.voteNotes?.[chain.chainId] ?? "").trim();
      const voter = ctx.participantId ?? "<participantId>";
      out.request = comment ? { action, comment } : { action };
      out.response = { status: 200, body: { chain: { ...base,
        peerVotes: [...base.peerVotes.filter((v) => v.voterParticipantId !== voter), { voterParticipantId: voter, decision, comment: comment || null, votedAt: "<votedAt>" }] } } };
      return out;
    }
    if (chain.verdict?.isLocked) { // already ruled (G.verdict): the call that produced this verdict
      const v = chain.verdict;
      out.request = { action: v.isApproved ? "instructor-approve" : "instructor-reject", feedback: v.overallFeedback, qualityScore: v.qualityScore };
      out.response = { status: 200, body: { chain: base } };
      return out;
    }
    const draft = ctx.rulings?.[chain.chainId] ?? {}, approve = action === "instructor-approve";
    const feedback = (draft.feedback ?? "").trim() || "<feedback (required)>", qualityScore = Number(draft.score ?? 7);
    out.request = { action, feedback, qualityScore };
    out.response = { status: 200, body: { chain: { ...base, status: approve ? "approved" : "rejected",
      verdict: { isApproved: approve, adjudicatorType: "instructor-final", isLocked: true, qualityScore, transitionEvaluations: [], overallFeedback: feedback, suggestedRefinements: null } } } };
    return out;
  };

  ops.getRoundStandings.sample = (state) => {
    const round = roundOf(state, null);
    if (round === null) return { path: fillPath(ops.getRoundStandings.path, sid(state)) };
    const summary = PHASES.indexOf(`round-${round}:round-summary`);
    return {
      path: fillPath(ops.getRoundStandings.path, { ...sid(state), roundNumber: round }),
      response: { status: 200, body: { roundNumber: round, isFinalized: PHASES.indexOf(state.session.currentPhase) >= summary, standings: standingsFor(state, round) } },
    };
  };

  catalog.phases = PHASES;

  root.CC_API_CATALOG = catalog;
})(typeof globalThis !== "undefined" ? globalThis : this);
