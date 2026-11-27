// Contract-shaped Curriculum Pack bodies (docs/api/openapi.yaml CurriculumPackListItem and
// CurriculumPackDetail) for the fake fetch, shared by the pack screen tests.

export const ACCOUNT_KEY = "cc-account-token-v1";

export const storedAccount = {
  accountId: "acc_01",
  email: "rahman.s@aku.edu",
  accountToken: "account.header.signature",
  expiresAt: "2099-01-01T12:00:00.000Z",
};

export const instructorAccountView = {
  accountId: "acc_01",
  email: "rahman.s@aku.edu",
  createdAt: "2026-01-01T09:00:00.000Z",
};

export function signInTeacher(): void {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(storedAccount));
}

const boardConfig = {
  rows: 7,
  cols: 7,
  minChainLength: 4,
  adjacencyRule: "chebyshev-8",
};

interface ListItemOverrides {
  id: string;
  title: string;
  version?: string;
  authorHandle?: string | null;
  isArchived?: boolean;
  isSystemPack?: boolean;
  cardCount?: number;
}

// A CurriculumPackListItem.
export function packListItem(overrides: ListItemOverrides) {
  return {
    version: "1.0.0",
    subjectDomain: "Endocrinology",
    boardConfig,
    cardCount: 49,
    domainCount: 5,
    hasAssessmentInstrument: true,
    hasPerceptionSurvey: true,
    authorHandle: null,
    isArchived: false,
    isSystemPack: false,
    ...overrides,
  };
}

export const systemPack = packListItem({
  id: "diabe-teach",
  title: "Diabe-teach",
  isSystemPack: true,
  cardCount: 72,
});
export const thyroidPack = packListItem({
  id: "thyroid-basics",
  title: "Thyroid basics",
  version: "1.1.0",
  authorHandle: "rahman.s",
  cardCount: 50,
});
export const archivedPack = packListItem({
  id: "old-renal",
  title: "Old renal pack",
  authorHandle: "khan.a",
  isArchived: true,
});

export function packListReply(packs: unknown[]) {
  return {
    status: 200,
    body: { packs },
  };
}

// A CurriculumPackDetail.
export function packDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "thyroid-basics",
    title: "Thyroid basics",
    version: "1.1.0",
    description: "Thyroid hormone, feedback loops and common disorders.",
    boardConfig: {
      rows: 5,
      cols: 6,
      minChainLength: 3,
      adjacencyRule: "chebyshev-8",
    },
    domains: [
      { id: "physiology", label: "Physiology", description: "How the thyroid axis works." },
      { id: "disorders", label: "Disorders", description: "What goes wrong." },
    ],
    cards: [
      {
        id: "tsh",
        verbatimLabel: "Thyroid-stimulating hormone",
        displayLabel: "TSH",
        aliases: ["thyrotropin"],
        domainId: "physiology",
        summary: "Pituitary signal that drives the thyroid.",
      },
      {
        id: "t4",
        verbatimLabel: "Thyroxine",
        displayLabel: "T4",
        aliases: [],
        domainId: "physiology",
        summary: "The main hormone the thyroid releases.",
      },
      {
        id: "graves",
        verbatimLabel: "Graves disease",
        displayLabel: "Graves disease",
        aliases: [],
        domainId: "disorders",
        summary: "Autoimmune hyperthyroidism.",
      },
    ],
    adjudicationRubric: {
      evaluatorPersona: "A senior endocrinologist",
      subjectDomain: "Endocrinology",
      chainContinuityCriteria: ["Each step follows from the last.", "No step skips a mechanism."],
      calibrationExamples: [
        {
          id: "ex1",
          title: "Feedback loop",
          path: [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
          ],
          keywordIds: ["tsh", "t4"],
          narrativeExplanation: "TSH drives T4 release.",
          isValid: true,
        },
      ],
    },
    assessmentInstrument: {
      questions: [
        {
          id: "q1",
          bloomLevel: 2,
          stem: "Which hormone does the pituitary release to stimulate the thyroid?",
          options: ["TSH", "T4", "T3", "Calcitonin"],
          relatedKeywordIds: ["tsh"],
        },
      ],
    },
    perceptionSurvey: {
      items: [
        { id: "s1", prompt: "The game helped me link concepts." },
      ],
    },
    isSystemPack: false,
    ...overrides,
  };
}

export function packDetailReply(pack: unknown) {
  return {
    status: 200,
    body: { pack },
  };
}
