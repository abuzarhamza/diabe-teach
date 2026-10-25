/**
 * Shared Interactive Components for the Diabe-Teach Hexagonal Architecture Course:
 * 1. Step-by-Step Request Pipeline Simulator (`initPipelineSimulator`)
 * 2. Retrieval-Practice Quiz Widget (`initRetrievalQuiz`)
 */

function initPipelineSimulator(containerId) {
  const root = document.getElementById(containerId);
  if (!root) return;

  const apiKeySelect = root.querySelector('[data-sim="apiKey"]');
  const routeSelect = root.querySelector('[data-sim="route"]');
  const bearerSelect = root.querySelector('[data-sim="bearer"]');
  const traceOutput = root.querySelector('[data-sim="trace"]');
  const responseOutput = root.querySelector('[data-sim="response"]');

  function renderTrace() {
    const apiKeyState = apiKeySelect.value;
    const routeState = routeSelect.value;
    const bearerState = bearerSelect.value;

    const steps = [];
    let finalResponse = {};

    // Step 1: Netlify Entrypoint
    steps.push({
      status: "pass",
      label: "Step 1 — Netlify Entrypoint (netlify/functions/api.ts)",
      detail:
        "Matches path '/api/v1/*' and forwards (request, context) into createNetlifyFunctionHandler() -> app.fetch(request, context).",
    });

    // Step 2: OpenAPI-Backend Route Match
    if (routeState === "unknown-route") {
      steps.push({
        status: "stop",
        label: "Step 2 — OpenAPI-Backend Router (src/adapters/inbound/http/create-app.ts)",
        detail:
          "Checks docs/api/openapi.yaml -> path '/api/v1/unknown' not in spec -> invokes handlers.notFound (404).",
      });
      finalResponse = {
        status: 404,
        body: {
          code: "INVALID_REQUEST_BODY",
          message: "Route GET /api/v1/unknown is not supported.",
        },
      };
    } else if (routeState === "unimplemented-op") {
      steps.push({
        status: "stop",
        label: "Step 2 — OpenAPI-Backend Router (src/adapters/inbound/http/create-app.ts)",
        detail:
          "Matches GET /api/v1/packs -> operationId 'listCurriculumPacks' has no handler registered yet -> invokes handlers.notImplemented (501).",
      });
      finalResponse = {
        status: 501,
        body: {
          code: "INVALID_REQUEST_BODY",
          message: "Operation 'listCurriculumPacks' is not implemented yet.",
        },
      };
    } else {
      steps.push({
        status: "pass",
        label: "Step 2 — OpenAPI-Backend Router (src/adapters/inbound/http/create-app.ts)",
        detail: `Matches GET /api/v1/packs/${routeState} in docs/api/openapi.yaml -> operationId: 'getCurriculumPackById', extracts c.request.params.packId = '${routeState}'.`,
      });
    }

    // Step 3: x-api-key Security Gate
    if (finalResponse.status) {
      steps.push({
        status: "skip",
        label: "Step 3 — ApiKeyAuth Security Gate (securityHandlers.ApiKeyAuth)",
        detail: "Skipped because routing stopped at Step 2.",
      });
    } else if (apiKeyState === "invalid") {
      steps.push({
        status: "stop",
        label: "Step 3 — ApiKeyAuth Security Gate (securityHandlers.ApiKeyAuth)",
        detail:
          "verifyApiKeyHeader('x-api-key') fails timingSafeEqual check -> invokes handlers.unauthorizedHandler (401).",
      });
      finalResponse = {
        status: 401,
        body: {
          code: "UNAUTHORIZED_TOKEN",
          message: "Missing or invalid x-api-key header.",
        },
      };
    } else {
      steps.push({
        status: "pass",
        label: "Step 3 — ApiKeyAuth Security Gate (securityHandlers.ApiKeyAuth)",
        detail:
          "verifyApiKeyHeader('x-api-key') passes -> proceeds to operationId handler 'getCurriculumPackById'.",
      });
    }

    // Step 4: Inbound Request Transformer
    if (finalResponse.status) {
      steps.push({
        status: "skip",
        label: "Step 4 — Request Transformer (transformGetPackByIdRequest)",
        detail: "Skipped because request stopped earlier.",
      });
    } else if (bearerState === "malformed") {
      steps.push({
        status: "stop",
        label: "Step 4 — Request Transformer (transformGetPackByIdRequest)",
        detail:
          "parseBearerTokenHeader throws UnauthorizedTokenError -> caught by createEndpointHandler -> mapDomainErrorToResponse returns 401.",
      });
      finalResponse = {
        status: 401,
        body: {
          code: "UNAUTHORIZED_TOKEN",
          message: "Malformed Authorization header. Expected 'Bearer <token>'.",
        },
      };
    } else {
      steps.push({
        status: "pass",
        label: "Step 4 — Request Transformer (transformGetPackByIdRequest)",
        detail: `Produces typed query: { packId: "${routeState}", bearerToken: ${bearerState === "none" ? "null" : `"${bearerState}-token"`} }.`,
      });
    }

    // Step 5: Application Use Case & Outbound Repository
    if (finalResponse.status) {
      steps.push({
        status: "skip",
        label: "Step 5 — Application Use Case & Outbound Repository (GetCurriculumPackByIdUseCase)",
        detail: "Skipped because request stopped earlier.",
      });
    } else if (routeState === "missing-pack") {
      steps.push({
        status: "stop",
        label: "Step 5 — Application Use Case & Outbound Repository (GetCurriculumPackByIdUseCase)",
        detail:
          "MongoCurriculumPackRepository checks in-memory DIABE_TEACH_PACK then MongoDB 'curriculum_packs' -> returns null -> throws PackNotFoundError (404).",
      });
      finalResponse = {
        status: 404,
        body: {
          code: "PACK_NOT_FOUND",
          message: "Curriculum Pack 'missing-pack' was not found.",
          details: { packId: "missing-pack" },
        },
      };
    } else {
      const storageNote =
        routeState === "diabe-teach"
          ? "Resolved in O(1) from built-in in-memory DIABE_TEACH_PACK (0 MongoDB queries)"
          : "Loaded from MongoDB 'curriculum_packs' collection and rehydrated into CurriculumPack Aggregate Root";
      steps.push({
        status: "pass",
        label: "Step 5 — Application Use Case & Outbound Repository (GetCurriculumPackByIdUseCase)",
        detail: `${storageNote}. Caller role resolved as '${bearerState === "none" ? "anonymous" : bearerState}'.`,
      });
    }

    // Step 6: Role-Aware DTO Projector & JSON Response
    if (finalResponse.status) {
      steps.push({
        status: "skip",
        label: "Step 6 — Role-Aware Projector & JSON Response (CurriculumPackProjector)",
        detail: "Skipped because an error response was already produced.",
      });
    } else {
      const includeKeys = bearerState === "instructor";
      steps.push({
        status: "pass",
        label: "Step 6 — Role-Aware Projector & JSON Response (CurriculumPackProjector)",
        detail: `CurriculumPackProjector.toPublicDto(pack, { includeAnswerKeys: ${includeKeys} }) -> createEndpointHandler wraps in 200 OK JSON Response.`,
      });
      finalResponse = {
        status: 200,
        body: {
          pack: {
            id: routeState,
            boardConfig: { rows: 7, cols: 7, minChainLength: 4, adjacencyRule: "chebyshev-8" },
            assessmentInstrument: {
              questions: [
                includeKeys
                  ? {
                      id: "q1",
                      bloomLevel: 2,
                      correctIndex: 1,
                      explanation: "Full answer key included for verified instructorToken.",
                    }
                  : {
                      id: "q1",
                      bloomLevel: 2,
                      "// note": "correctIndex and explanation omitted for anonymous/participant",
                    },
              ],
            },
          },
        },
      };
    }

    traceOutput.innerHTML = steps
      .map(
        (s) => `
      <div class="sim-trace-step ${s.status}">
        <strong>${s.label}</strong><br/>
        <span>${s.detail}</span>
      </div>
    `,
      )
      .join("");

    responseOutput.textContent = `HTTP ${finalResponse.status}\n${JSON.stringify(finalResponse.body, null, 2)}`;
  }

  apiKeySelect.addEventListener("change", renderTrace);
  routeSelect.addEventListener("change", renderTrace);
  bearerSelect.addEventListener("change", renderTrace);
  renderTrace();
}

function initRetrievalQuiz(containerId, questions) {
  const root = document.getElementById(containerId);
  if (!root) return;

  root.innerHTML = questions
    .map(
      (q, qIdx) => `
    <div class="quiz-question" data-q-index="${qIdx}">
      <div class="quiz-prompt">${qIdx + 1}. ${q.prompt}</div>
      <div class="quiz-options">
        ${q.options
          .map(
            (opt, oIdx) => `
          <button type="button" class="quiz-option-btn" data-opt-index="${oIdx}">
            ${opt}
          </button>
        `,
          )
          .join("")}
      </div>
      <div class="quiz-feedback" data-feedback></div>
    </div>
  `,
    )
    .join("");

  root.querySelectorAll(".quiz-question").forEach((qEl) => {
    const qIdx = Number(qEl.getAttribute("data-q-index"));
    const question = questions[qIdx];
    const feedbackEl = qEl.querySelector("[data-feedback]");
    const buttons = qEl.querySelectorAll(".quiz-option-btn");

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const chosenIdx = Number(btn.getAttribute("data-opt-index"));
        buttons.forEach((b) => b.classList.remove("correct", "incorrect"));

        if (chosenIdx === question.correctIndex) {
          btn.classList.add("correct");
          feedbackEl.style.color = "var(--accent-green)";
          feedbackEl.textContent = `Correct — ${question.explanation}`;
        } else {
          btn.classList.add("incorrect");
          feedbackEl.style.color = "var(--accent-crimson)";
          feedbackEl.textContent = `Not quite — ${question.hint}`;
        }
      });
    });
  });
}
