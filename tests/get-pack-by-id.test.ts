import { describe, expect, it, vi } from "vitest";
import type { Context } from "@netlify/functions";
import { createApp } from "../src/adapters/inbound/http/create-app.js";
import {
  createGetPackByIdHandler,
  transformGetPackByIdRequest,
} from "../src/adapters/inbound/http/get-pack-by-id.handler.js";
import { FakeCapabilityTokenAdapter } from "../src/adapters/outbound/fake-capability-token-adapter.js";
import { HmacCapabilityTokenAdapter } from "../src/adapters/outbound/hmac-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { MongoCurriculumPackRepository } from "../src/adapters/outbound/mongo-curriculum-pack-repository.js";
import { CurriculumPackDocument } from "../src/adapters/outbound/mongo-curriculum-pack-repository.types.js";
import { DIABE_TEACH_PACK } from "../src/domain/curriculum-pack/diabe-teach-pack.js";
import apiNetlifyHandler, {
  config as apiNetlifyConfig,
} from "../netlify/functions/api.js";
import { createNetlifyFunctionHandler } from "../netlify/config/create-netlify-function-handler.js";
import {
  defineNetlifyRouteConfig,
  loadNetlifyRuntimeEnvConfig,
} from "../netlify/config/netlify-runtime.config.js";

const APPENDIX_1_VERBATIM_KEYWORDS = [
  "Insulin",
  "Glucose",
  "LADA",
  "Hyperglycaemia",
  "Keto-acidosis",
  "Glucosuria",
  "Glycemic index",
  "Sulfonyl-ureas",
  "Dys-lipidaemia",
  "Pancreas",
  "Amylin",
  "Genetic",
  "Smoking",
  "Microalbuminuria",
  "Diet",
  "HbA1c",
  "MODY",
  "Hypo-glycemia",
  "Adiponectin",
  "Glipizide",
  "Beta cells",
  "C-Peptide",
  "Retinopathy",
  "Polyuria",
  "Ulcer",
  "Gastro-paresis",
  "Podiatrist",
  "Metformin",
  "Lipo-hypertrophy",
  "Screening",
  "Polydipsia",
  "GTT",
  "Thiazolidine-diones",
  "Autoimmune",
  "Venous",
  "ACE Inhibitors",
  "Neuropathy",
  "Glucagon",
  "Polyphagia",
  "Weight loss",
  "Glucometer",
  "Pregnancy",
  "Weight",
  "Hypertension",
  "Islet Cells",
  "Transplant",
  "HHS",
  "Fasting",
  "Children",
] as const;

describe("Ticket 01 — Walking Skeleton: GET /api/v1/packs/{packId}", () => {
  it("returns 200 OK with the complete 49-card diabe-teach CurriculumPack, 7 SemanticDomains, and Figure 2 CalibrationExamples", async () => {
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const app = createApp({ packRepo });

    const response = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/diabe-teach", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = (await response.json()) as {
      pack: {
        id: string;
        title: string;
        boardConfig: {
          rows: number;
          cols: number;
          minChainLength: number;
          adjacencyRule: string;
        };
        domains: Array<{ id: string; label: string; description: string }>;
        cards: Array<{
          id: string;
          verbatimLabel: string;
          displayLabel: string;
          aliases: string[];
          domainId: string;
          summary: string;
        }>;
        adjudicationRubric: {
          evaluatorPersona: string;
          subjectDomain: string;
          chainContinuityCriteria: string[];
          calibrationBoardCardIds: string[][];
          calibrationExamples: Array<{
            id: string;
            title: string;
            path: Array<{ row: number; col: number }>;
            keywordIds: string[];
            narrativeExplanation: string;
            isValid: boolean;
            invalidReason: string | null;
          }>;
        };
      };
    };

    expect(body.pack.id).toBe("diabe-teach");
    expect(body.pack.boardConfig).toEqual({
      rows: 7,
      cols: 7,
      minChainLength: 4,
      adjacencyRule: "chebyshev-8",
    });
    expect(body.pack.domains).toHaveLength(7);
    expect(body.pack.cards).toHaveLength(49);

    const returnedVerbatimLabels = body.pack.cards.map((c) => c.verbatimLabel);
    expect(new Set(returnedVerbatimLabels)).toEqual(
      new Set(APPENDIX_1_VERBATIM_KEYWORDS),
    );

    expect(body.pack.adjudicationRubric.calibrationBoardCardIds).toHaveLength(7);
    for (const row of body.pack.adjudicationRubric.calibrationBoardCardIds) {
      expect(row).toHaveLength(7);
    }

    const examples = body.pack.adjudicationRubric.calibrationExamples;
    expect(examples).toHaveLength(3);

    const chainA = examples.find((e) => e.id === "fig2-chain-a");
    const chainB = examples.find((e) => e.id === "fig2-chain-b");
    const chainC = examples.find((e) => e.id === "fig2-chain-c");

    expect(chainA?.isValid).toBe(true);
    expect(chainA?.keywordIds).toHaveLength(9);

    expect(chainB?.isValid).toBe(true);
    expect(chainB?.keywordIds).toHaveLength(7);

    expect(chainC?.isValid).toBe(false);
    expect(chainC?.keywordIds).toHaveLength(4);
    expect(chainC?.invalidReason).toContain("touch");
  });

  it("returns 404 PACK_NOT_FOUND conforming to ApiErrorResponse when requesting an unknown packId", async () => {
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const app = createApp({ packRepo });

    const response = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/unknown-pack", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({
      code: "PACK_NOT_FOUND",
      message: "Curriculum Pack 'unknown-pack' was not found.",
      details: {
        packId: "unknown-pack",
      },
    });

    const whitespaceRes = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/%20", {
        method: "GET",
      }),
    );
    expect(whitespaceRes.status).toBe(404);
    expect(await whitespaceRes.json()).toEqual({
      code: "PACK_NOT_FOUND",
      message: "Curriculum Pack ' ' was not found.",
      details: {
        packId: " ",
      },
    });
  });

  it("resolves KeywordCards on the CurriculumPack Aggregate Root by id, verbatimLabel, displayLabel, and clinical aliases in O(1)", () => {
    expect(
      DIABE_TEACH_PACK.resolveCardByLabelOrAlias("Hyperglycemia")?.id,
    ).toBe("hyperglycaemia");
    expect(
      DIABE_TEACH_PACK.resolveCardByLabelOrAlias("Hyperglycaemia")?.id,
    ).toBe("hyperglycaemia");
    expect(
      DIABE_TEACH_PACK.resolveCardByLabelOrAlias("lipodistrophy")?.id,
    ).toBe("lipo-hypertrophy");
    expect(DIABE_TEACH_PACK.resolveCardByLabelOrAlias("Genetics")?.id).toBe(
      "genetic",
    );
  });
});

describe("Ticket 02 — Role-Aware Answer-Key Redaction & CapabilityToken Verification", () => {
  it("redacts correctIndex and explanation for anonymous callers while returning all 10 Bloom Level 2/3 MCQs and 9 Appendix 2 Likert items", async () => {
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const tokenVerifier = new FakeCapabilityTokenAdapter();
    const app = createApp({ packRepo, tokenVerifier });

    const response = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/diabe-teach"),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      pack: {
        assessmentInstrument: {
          questions: Array<{
            id: string;
            bloomLevel: number;
            stem: string;
            options: string[];
            relatedKeywordIds: string[];
            correctIndex?: number;
            explanation?: string;
          }>;
        } | null;
        perceptionSurvey: {
          items: Array<{ id: string; prompt: string }>;
        } | null;
      };
    };

    expect(body.pack.assessmentInstrument?.questions).toHaveLength(10);
    for (const q of body.pack.assessmentInstrument?.questions ?? []) {
      expect([2, 3]).toContain(q.bloomLevel);
      expect(q.options).toHaveLength(4);
      expect(q.correctIndex).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }

    expect(body.pack.perceptionSurvey?.items).toHaveLength(9);
    expect(body.pack.perceptionSurvey?.items[0]?.prompt).toContain(
      "The rules of the game were easy to understand and simple to follow.",
    );
  });

  it("redacts correctIndex and explanation for a valid participantToken", async () => {
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const tokenVerifier = new FakeCapabilityTokenAdapter({
      "participant-tok-1": {
        role: "participant",
        sessionId: "sess-1",
        participantId: "p-1",
      },
    });
    const app = createApp({ packRepo, tokenVerifier });

    const response = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/diabe-teach", {
        headers: {
          Authorization: "Bearer participant-tok-1",
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      pack: {
        assessmentInstrument: {
          questions: Array<{
            correctIndex?: number;
            explanation?: string;
          }>;
        };
      };
    };

    for (const q of body.pack.assessmentInstrument.questions) {
      expect(q.correctIndex).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }
  });

  it("includes correctIndex and explanation for a valid instructorToken without mutating DIABE_TEACH_PACK for subsequent anonymous requests", async () => {
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const tokenVerifier = new FakeCapabilityTokenAdapter({
      "instructor-tok-1": {
        role: "instructor",
        sessionId: "sess-1",
      },
    });
    const app = createApp({ packRepo, tokenVerifier });

    const instructorRes = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/diabe-teach", {
        headers: {
          Authorization: "Bearer instructor-tok-1",
        },
      }),
    );

    expect(instructorRes.status).toBe(200);
    const instructorBody = (await instructorRes.json()) as {
      pack: {
        assessmentInstrument: {
          questions: Array<{
            correctIndex?: number;
            explanation?: string;
          }>;
        };
      };
    };

    expect(instructorBody.pack.assessmentInstrument.questions).toHaveLength(10);
    for (const q of instructorBody.pack.assessmentInstrument.questions) {
      expect([0, 1, 2, 3]).toContain(q.correctIndex);
      expect(typeof q.explanation).toBe("string");
      expect((q.explanation ?? "").length).toBeGreaterThan(10);
    }

    const anonResAfter = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/diabe-teach"),
    );
    const anonBodyAfter = (await anonResAfter.json()) as {
      pack: {
        assessmentInstrument: {
          questions: Array<{
            correctIndex?: number;
            explanation?: string;
          }>;
        };
      };
    };

    for (const q of anonBodyAfter.pack.assessmentInstrument.questions) {
      expect(q.correctIndex).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }
  });

  it("returns 401 UNAUTHORIZED_TOKEN when Authorization header is malformed or invalid", async () => {
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const tokenVerifier = new FakeCapabilityTokenAdapter();
    const app = createApp({ packRepo, tokenVerifier });

    for (const badHeader of [
      "Basic dXNlcjpwYXNz",
      "Bearer ",
      "Bearer tampered-token",
    ]) {
      const response = await app.fetch(
        new Request("http://localhost:3000/api/v1/packs/diabe-teach", {
          headers: { Authorization: badHeader },
        }),
      );

      expect(response.status).toBe(401);
      const body = (await response.json()) as { code: string; message: string };
      expect(body.code).toBe("UNAUTHORIZED_TOKEN");
      expect(body.message.length).toBeGreaterThan(0);
    }
  });

  it("signs and verifies stateless capability tokens with HmacCapabilityTokenAdapter and rejects tampered tokens", async () => {
    const hmacAdapter = new HmacCapabilityTokenAdapter(
      "test-secret-key-for-hmac-256",
    );

    const instructorToken = await hmacAdapter.signToken({
      role: "instructor",
      sessionId: "sess-42",
    });

    const verified = await hmacAdapter.verifyToken(instructorToken);
    expect(verified).toEqual({
      role: "instructor",
      sessionId: "sess-42",
    });

    const tampered = `${instructorToken}tampered`;
    expect(await hmacAdapter.verifyToken(tampered)).toBeNull();
  });
});

describe("Ticket 03 — Hybrid MongoDB Persistence & Netlify Functions v2 Composition Root", () => {
  const customCardioPackDoc: CurriculumPackDocument = {
    _id: "cardio-teach",
    title: "Cardio-teach: Heart Failure & Arrhythmia Reasoning",
    version: "1.0.0",
    description: "Custom cardiology pack stored in MongoDB.",
    boardConfig: {
      rows: 3,
      cols: 3,
      minChainLength: 3,
      adjacencyRule: "chebyshev-8",
    },
    domains: [
      {
        id: "hemodynamics",
        label: "Hemodynamics",
        description: "Preload, afterload, and contractility.",
      },
    ],
    cards: Array.from({ length: 9 }, (_, i) => ({
      id: `cardio-card-${i + 1}`,
      verbatimLabel: `Cardio Term ${i + 1}`,
      displayLabel: `Cardio Term ${i + 1}`,
      aliases: [],
      domainId: "hemodynamics",
      summary: `Summary for cardio term ${i + 1}`,
    })),
    adjudicationRubric: {
      evaluatorPersona: "Board-Certified Cardiologist",
      subjectDomain: "Cardiovascular Pathophysiology",
      chainContinuityCriteria: ["Link hemodynamic mechanisms sequentially."],
      calibrationExamples: [],
    },
    assessmentInstrument: {
      questions: [
        {
          id: "cardio-q1",
          bloomLevel: 2,
          stem: "How does elevated left ventricular end-diastolic pressure cause orthopnea?",
          options: [
            "Pulmonary venous congestion increases when supine venous return rises.",
            "Systemic arterial vasodilation reduces coronary perfusion.",
            "Right atrial baroreceptors inhibit diaphragmatic contraction.",
            "Pericardial fluid evaporates at body temperature.",
          ],
          correctIndex: 0,
          relatedKeywordIds: ["cardio-card-1"],
          explanation:
            "Supine posture redistributes peripheral edema into the central circulation, raising pulmonary capillary hydrostatic pressure.",
        },
      ],
    },
    perceptionSurvey: null,
  };

  it("serves built-in diabe-teach in O(1) from memory with zero MongoDB findOne calls", async () => {
    const findOneSpy = vi.fn(async () => null);
    const repo = new MongoCurriculumPackRepository({
      getCollection: async () => ({
        findOne: findOneSpy,
      }),
    });
    const app = createApp({ packRepo: repo });

    const response = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/diabe-teach"),
    );

    expect(response.status).toBe(200);
    expect(findOneSpy).not.toHaveBeenCalled();
  });

  it("loads custom packs from MongoDB curriculum_packs collection and applies role-aware answer-key redaction", async () => {
    const findOneSpy = vi.fn(async (filter: { _id: string }) =>
      filter._id === "cardio-teach" ? customCardioPackDoc : null,
    );
    const repo = new MongoCurriculumPackRepository({
      getCollection: async () => ({
        findOne: findOneSpy,
      }),
    });
    const tokenVerifier = new FakeCapabilityTokenAdapter({
      "instructor-tok": {
        role: "instructor",
        sessionId: "sess-cardio",
      },
    });
    const app = createApp({ packRepo: repo, tokenVerifier });

    const anonRes = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/cardio-teach"),
    );
    expect(anonRes.status).toBe(200);
    expect(findOneSpy).toHaveBeenCalledWith({ _id: "cardio-teach" });
    const anonBody = (await anonRes.json()) as {
      pack: {
        id: string;
        assessmentInstrument: {
          questions: Array<{ correctIndex?: number; explanation?: string }>;
        };
      };
    };
    expect(anonBody.pack.id).toBe("cardio-teach");
    expect(
      anonBody.pack.assessmentInstrument.questions[0]?.correctIndex,
    ).toBeUndefined();

    const instRes = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/cardio-teach", {
        headers: { Authorization: "Bearer instructor-tok" },
      }),
    );
    expect(instRes.status).toBe(200);
    const instBody = (await instRes.json()) as {
      pack: {
        assessmentInstrument: {
          questions: Array<{ correctIndex?: number; explanation?: string }>;
        };
      };
    };
    expect(
      instBody.pack.assessmentInstrument.questions[0]?.correctIndex,
    ).toBe(0);
    expect(
      instBody.pack.assessmentInstrument.questions[0]?.explanation,
    ).toContain("Supine posture");
  });

  it("returns 404 PACK_NOT_FOUND when a packId is absent from both built-in packs and MongoDB", async () => {
    const repo = new MongoCurriculumPackRepository({
      getCollection: async () => ({
        findOne: async () => null,
      }),
    });
    const app = createApp({ packRepo: repo });

    const res = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/missing-mongo-pack"),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      code: "PACK_NOT_FOUND",
      message: "Curriculum Pack 'missing-mongo-pack' was not found.",
      details: { packId: "missing-mongo-pack" },
    });
  });

  it("transforms HTTP Request + Context into a clean GetCurriculumPackByIdQuery via transformGetPackByIdRequest", () => {
    const query = transformGetPackByIdRequest({
      request: new Request("https://internal.lambda.local/invoke", {
        headers: { Authorization: "Bearer my-token-123" },
      }),
      context: { params: { packId: "diabe-teach" } },
    });

    expect(query).toEqual({
      packId: "diabe-teach",
      bearerToken: "my-token-123",
    });
  });

  it("resolves packId from context.params (Netlify Context / AWS Lambda pathParameters) even on internal invocation URLs", async () => {
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const handler = createGetPackByIdHandler({ packRepo });

    const response = await handler(
      new Request("https://internal.lambda.local/invoke", {
        method: "GET",
      }),
      { params: { packId: "diabe-teach" } },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { pack: { id: string } };
    expect(body.pack.id).toBe("diabe-teach");
  });

  it("loads Netlify runtime config defaults and adapts createApp via createNetlifyFunctionHandler", async () => {
    const envConfig = loadNetlifyRuntimeEnvConfig({
      MONGODB_URI: "  mongodb+srv://cluster.example.net  ",
      MONGODB_DB_NAME: "",
      CAPABILITY_TOKEN_SECRET: "  my-secret  ",
    });

    expect(envConfig).toEqual({
      mongoUri: "mongodb+srv://cluster.example.net",
      mongoDbName: "diabe_teach",
      capabilityTokenSecret: "my-secret",
    });

    const routeConfig = defineNetlifyRouteConfig({
      path: "/api/v1/*",
      method: "GET",
    });
    expect(routeConfig).toEqual({
      path: "/api/v1/*",
      method: "GET",
    });

    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const wrappedNetlifyHandler = createNetlifyFunctionHandler({ packRepo });

    const res = await wrappedNetlifyHandler(
      new Request("http://localhost:3000/api/v1/packs/diabe-teach"),
      {} as unknown as Context,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pack: { id: string } };
    expect(body.pack.id).toBe("diabe-teach");
  });

  it("routes /api/v1/* centrally via openapi-backend reading docs/api/openapi.yaml (operationId: getCurriculumPackById)", async () => {
    expect(apiNetlifyConfig.path).toBe("/api/v1/*");

    const res = await apiNetlifyHandler(
      new Request("http://localhost:3000/api/v1/packs/diabe-teach", {
        method: "GET",
      }),
      {} as unknown as Context,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pack: { id: string } };
    expect(body.pack.id).toBe("diabe-teach");

    const notFoundRes = await apiNetlifyHandler(
      new Request("http://localhost:3000/api/v1/non-existent-route", {
        method: "GET",
      }),
      {} as unknown as Context,
    );
    expect(notFoundRes.status).toBe(404);

    const notImplementedRes = await apiNetlifyHandler(
      new Request("http://localhost:3000/api/v1/packs", {
        method: "GET",
        headers: { "x-api-key": "netlify-prod-key" },
      }),
      {} as unknown as Context,
    );
    expect(notImplementedRes.status).toBe(501);
  });
});

describe("Ticket 07 — x-api-key Header Validation (ApiKeyAuth) & Fail-Closed Production Security", () => {
  it("rejects missing or invalid x-api-key with 401 UNAUTHORIZED_TOKEN when apiKey is configured on createApp", async () => {
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const app = createApp({
      packRepo,
      apiKey: "valid-client-api-key-123",
    });

    const missingKeyRes = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/diabe-teach"),
    );
    expect(missingKeyRes.status).toBe(401);
    expect(await missingKeyRes.json()).toEqual({
      code: "UNAUTHORIZED_TOKEN",
      message: "Missing or invalid x-api-key header.",
    });

    const wrongKeyRes = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/diabe-teach", {
        headers: { "x-api-key": "wrong-key" },
      }),
    );
    expect(wrongKeyRes.status).toBe(401);
    expect(await wrongKeyRes.json()).toEqual({
      code: "UNAUTHORIZED_TOKEN",
      message: "Missing or invalid x-api-key header.",
    });
  });

  it("allows requests with valid x-api-key and composes with Authorization: Bearer role redaction", async () => {
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const tokenVerifier = new FakeCapabilityTokenAdapter({
      "inst-token": {
        role: "instructor",
        sessionId: "sess-1",
      },
    });
    const app = createApp({
      packRepo,
      tokenVerifier,
      apiKey: "valid-client-api-key-123",
    });

    const anonWithKeyRes = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/diabe-teach", {
        headers: { "x-api-key": "valid-client-api-key-123" },
      }),
    );
    expect(anonWithKeyRes.status).toBe(200);
    const anonBody = (await anonWithKeyRes.json()) as {
      pack: {
        assessmentInstrument: {
          questions: Array<{ correctIndex?: number }>;
        };
      };
    };
    expect(
      anonBody.pack.assessmentInstrument.questions[0]?.correctIndex,
    ).toBeUndefined();

    const instWithKeyRes = await app.fetch(
      new Request("http://localhost:3000/api/v1/packs/diabe-teach", {
        headers: {
          "x-api-key": "valid-client-api-key-123",
          Authorization: "Bearer inst-token",
        },
      }),
    );
    expect(instWithKeyRes.status).toBe(200);
    const instBody = (await instWithKeyRes.json()) as {
      pack: {
        assessmentInstrument: {
          questions: Array<{ correctIndex?: number }>;
        };
      };
    };
    expect(
      instBody.pack.assessmentInstrument.questions[0]?.correctIndex,
    ).toBeDefined();
  });

  it("enforces fail-closed x-api-key validation in Netlify runtime config when requireApiKey is true", async () => {
    const packRepo = new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]);
    const failClosedApp = createApp({
      packRepo,
      requireApiKey: true,
      apiKey: undefined,
    });

    const res = await failClosedApp.fetch(
      new Request("http://localhost:3000/api/v1/packs/diabe-teach", {
        headers: { "x-api-key": "any-key" },
      }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      code: "UNAUTHORIZED_TOKEN",
      message: "Missing or invalid x-api-key header.",
    });

    const envConfig = loadNetlifyRuntimeEnvConfig({
      MONGODB_URI: "mongodb+srv://cluster.example.net",
      API_KEY: "  prod-api-key-999  ",
    });
    expect(envConfig.apiKey).toBe("prod-api-key-999");
  });
});
