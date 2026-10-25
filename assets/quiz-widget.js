/**
 * Shared Interactive Components for the Diabe-Teach 100% Class-Based Hexagonal Course:
 * 1. Step-by-Step Class Request Pipeline Simulator (`initPipelineSimulator`)
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

    // Step 1: Netlify Entrypoint & AppRuntime Class
    steps.push({
      status: "pass",
      label: "Step 1 — Netlify Entrypoint & AppRuntime Class (netlify/functions/api.ts → src/app-runtime.ts)",
      detail:
        "Matches '/api/v1/*' -> AppRuntime.createServerlessHttpHandler() loads AppRuntime.getProductionDependencies() and invokes openApiHttpApp.fetch(request, context).",
    });

    // Step 2: OpenApiHttpApp Class Route Match
    if (routeState === "unknown-route") {
      steps.push({
        status: "stop",
        label: "Step 2 — OpenApiHttpApp Class (src/adapters/inbound/http/create-app.ts)",
        detail:
          "OpenApiHttpApp.fetch() checks docs/api/openapi.yaml -> path '/api/v1/unknown' not in spec -> invokes handlers.notFound -> BaseHttpHandler.jsonResponse(..., 404).",
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
        label: "Step 2 — OpenApiHttpApp Class (src/adapters/inbound/http/create-app.ts)",
        detail:
          "OpenApiHttpApp.fetch() matches GET /api/v1/packs -> operationId 'listCurriculumPacks' has no handler class registered yet -> invokes handlers.notImplemented (501).",
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
        label: "Step 2 — OpenApiHttpApp Class (src/adapters/inbound/http/create-app.ts)",
        detail: `OpenApiHttpApp.fetch() matches GET /api/v1/packs/${routeState} in docs/api/openapi.yaml -> operationId: 'getCurriculumPackById', extracts c.request.params.packId = '${routeState}'.`,
      });
    }

    // Step 3: BaseHttpHandler.verifyApiKeyHeader Security Gate
    if (finalResponse.status) {
      steps.push({
        status: "skip",
        label: "Step 3 — ApiKeyAuth Security Gate (BaseHttpHandler.verifyApiKeyHeader)",
        detail: "Skipped because routing stopped at Step 2.",
      });
    } else if (apiKeyState === "invalid") {
      steps.push({
        status: "stop",
        label: "Step 3 — ApiKeyAuth Security Gate (BaseHttpHandler.verifyApiKeyHeader)",
        detail:
          "BaseHttpHandler.verifyApiKeyHeader('x-api-key', deps) fails timingSafeEqual check -> OpenApiHttpApp invokes handlers.unauthorizedHandler (401).",
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
        label: "Step 3 — ApiKeyAuth Security Gate (BaseHttpHandler.verifyApiKeyHeader)",
        detail:
          "BaseHttpHandler.verifyApiKeyHeader('x-api-key', deps) passes -> OpenApiHttpApp invokes getPackByIdHandler.handle(request, context).",
      });
    }

    // Step 4: GetPackByIdHttpHandler (extends BaseHttpHandler)
    if (finalResponse.status) {
      steps.push({
        status: "skip",
        label: "Step 4 — GetPackByIdHttpHandler.transformRequest (extends BaseHttpHandler)",
        detail: "Skipped because request stopped earlier.",
      });
    } else if (bearerState === "malformed") {
      steps.push({
        status: "stop",
        label: "Step 4 — GetPackByIdHttpHandler.transformRequest (extends BaseHttpHandler)",
        detail:
          "BaseHttpHandler.parseBearerTokenHeader throws UnauthorizedTokenError -> caught by BaseHttpHandler.handle() -> BaseHttpHandler.mapDomainErrorToResponse returns 401.",
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
        label: "Step 4 — GetPackByIdHttpHandler.transformRequest (extends BaseHttpHandler)",
        detail: `BaseHttpHandler.handle() calls this.transformRequest({ request, context }) -> returns { packId: "${routeState}", bearerToken: ${bearerState === "none" ? "null" : `"${bearerState}-token"`} }.`,
      });
    }

    // Step 5: GetCurriculumPackByIdUseCase & MongoCurriculumPackRepository
    if (finalResponse.status) {
      steps.push({
        status: "skip",
        label: "Step 5 — GetCurriculumPackByIdUseCase & MongoCurriculumPackRepository Classes",
        detail: "Skipped because request stopped earlier.",
      });
    } else if (routeState === "missing-pack") {
      steps.push({
        status: "stop",
        label: "Step 5 — GetCurriculumPackByIdUseCase & MongoCurriculumPackRepository Classes",
        detail:
          "MongoCurriculumPackRepository.findById(PackId.create('missing-pack')) checks in-memory DIABE_TEACH_PACK then MongoDB via MongoConnectionManager.getDatabase() -> returns null -> throws PackNotFoundError (404).",
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
          ? "MongoCurriculumPackRepository.findById() resolves in O(1) from built-in in-memory DIABE_TEACH_PACK (0 MongoDB queries)"
          : "MongoCurriculumPackRepository.findById() queries MongoDB via MongoConnectionManager.getDatabase() and rehydrates CurriculumPack.create(doc)";
      steps.push({
        status: "pass",
        label: "Step 5 — GetCurriculumPackByIdUseCase & MongoCurriculumPackRepository Classes",
        detail: `${storageNote}. Caller role resolved as '${bearerState === "none" ? "anonymous" : bearerState}'.`,
      });
    }

    // Step 6: CurriculumPackProjector & BaseHttpHandler.jsonResponse
    if (finalResponse.status) {
      steps.push({
        status: "skip",
        label: "Step 6 — CurriculumPackProjector & BaseHttpHandler.jsonResponse",
        detail: "Skipped because an error response was already produced.",
      });
    } else {
      const includeKeys = bearerState === "instructor";
      steps.push({
        status: "pass",
        label: "Step 6 — CurriculumPackProjector & BaseHttpHandler.jsonResponse",
        detail: `CurriculumPackProjector.toPublicDto(pack, { includeAnswerKeys: ${includeKeys} }) -> BaseHttpHandler.jsonResponse(result, 200) returns 200 OK JSON Response.`,
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
