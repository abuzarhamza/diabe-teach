import type { FakeAnswer, RecordedRequest } from "../../support/fake-fetch.ts";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeFetch } from "../../support/fake-fetch.ts";
import {
  ACCOUNT_KEY,
  instructorAccountView,
  packDetail,
  packDetailReply,
  packListItem,
  packListReply,
  signInTeacher,
  systemPack,
  thyroidPack,
} from "../../support/pack-fixtures.ts";
import { renderApp } from "../../support/render-app.tsx";

const me = { status: 200, body: instructorAccountView };

const TEN_WORDS = "Insulin\nGlucagon\nBeta cell\nAlpha cell\nGLUT4\nGlycogen\nLiver\nMuscle\nKetones\nHbA1c";

// The 201 POST /api/v1/packs answers with, for the pack the request registered.
function registered(request: RecordedRequest) {
  const body = request.body as { id: string; version: string };
  return {
    status: 201,
    body: { packId: body.id, version: body.version, warnings: [] },
  };
}

interface EditorReplies {
  library?: unknown[];
  register?: FakeAnswer;
  extra?: Record<string, FakeAnswer>;
}

// A signed-in teacher with a fake API: the library list, register, and the new pack's detail.
function fakeApi({ library = [systemPack, thyroidPack], register, extra = {} }: EditorReplies = {}) {
  let packs = library;
  return installFakeFetch({
    "GET /api/v1/accounts/me": me,
    "GET /api/v1/packs": async () => packListReply(packs),
    "POST /api/v1/packs": register ?? (async (request) => {
      const body = request.body as { id: string; title: string; version: string };
      packs = [
        ...packs,
        packListItem({
          id: body.id,
          title: body.title,
          version: body.version,
          authorHandle: "rahman.s",
          cardCount: 10,
        }),
      ];
      return registered(request);
    }),
    ...extra,
  });
}

async function pasteWords(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(await screen.findByLabelText("Paste words"));
  await user.paste(text);
  await user.click(screen.getByRole("button", { name: "Add pasted words" }));
}

function chips(): string[] {
  const list = screen.getByRole("list", { name: "Words in the new pack" });
  // Each chip is the word, then its "Remove <word>" button.
  return within(list).queryAllByRole("listitem").map(item => item.querySelector("span")?.textContent ?? "");
}

function registerRequests(requests: RecordedRequest[]) {
  return requests.filter(r => r.method === "POST" && r.path === "/api/v1/packs");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pack Editor at /packs/new (react-pack-editor 01)", () => {
  it("shows one chip per distinct pasted word, dropping blanks and duplicates in other case, with the count", async () => {
    fakeApi();
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    expect(await screen.findByRole("heading", { name: "New pack" })).toBeTruthy();
    await pasteWords(user, "Insulin\n\nglucagon, INSULIN; Beta cell\tGlucagon\n");

    expect(chips()).toEqual(["Insulin", "glucagon", "Beta cell"]);
    expect(screen.getByText("3 words")).toBeTruthy();
  });

  it("publishes with the Account Token: slug id, version 1.0.0, one general card per word, board size from the word count", async () => {
    const requests = fakeApi({
      extra: {
        "GET /api/v1/packs/diabetes-basics": packDetailReply(packDetail({ id: "diabetes-basics", title: "Diabetes basics", version: "1.0.0" })),
      },
    });
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    await pasteWords(user, TEN_WORDS);
    await user.type(screen.getByLabelText("Pack name"), "Diabetes basics");
    await user.type(screen.getByLabelText(/Learner level/), "Year 2 undergraduate");
    await user.type(screen.getByLabelText(/Learning objective/), "Explain insulin resistance");
    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(registerRequests(requests)).toHaveLength(1));
    const register = registerRequests(requests)[0]!;
    expect(register.headers.authorization).toBe("Bearer account.header.signature");
    const body = register.body as Record<string, any>;
    expect(body.id).toBe("diabetes-basics");
    expect(body.title).toBe("Diabetes basics");
    expect(body.version).toBe("1.0.0");
    expect(body.description).toBe("Year 2 undergraduate · Explain insulin resistance");
    expect(body.boardConfig).toEqual({
      rows: 3,
      cols: 3,
      minChainLength: 2,
      adjacencyRule: "chebyshev-8",
    });
    expect(body.domains).toEqual([
      { id: "general", label: "General", description: "Keywords of Diabetes basics" },
    ]);
    expect(body.cards).toHaveLength(10);
    expect(body.cards[2]).toEqual({
      id: "beta-cell",
      verbatimLabel: "Beta cell",
      displayLabel: "Beta cell",
      aliases: [],
      domainId: "general",
      summary: "Beta cell",
    });
    expect(body.adjudicationRubric).toEqual({
      evaluatorPersona: "Teacher",
      subjectDomain: "Diabetes basics",
      chainContinuityCriteria: ["Each link names a cause, mechanism or consequence"],
      calibrationExamples: [],
    });
    expect(body.assessmentInstrument).toBeNull();
    expect(body.perceptionSurvey).toBeNull();
  });

  it("sizes the board floor(sqrt(n)), at most 7 × 7", async () => {
    const requests = fakeApi({
      register: {
        status: 500,
        body: { code: "INTERNAL", message: "stop here", details: null },
      },
    });
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    await pasteWords(user, Array.from({ length: 64 }, (_, i) => `Word ${i + 1}`).join("\n"));
    await user.type(screen.getByLabelText("Pack name"), "Big pack");
    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(registerRequests(requests)).toHaveLength(1));
    const body = registerRequests(requests)[0]!.body as Record<string, any>;
    expect(body.boardConfig).toMatchObject({ rows: 7, cols: 7 });
    expect(body.description).toBe("Big pack");
  });

  it("makes the id unique against archived packs too, reading the list with includeArchived=true", async () => {
    const archivedSameName = packListItem({ id: "diabetes-basics", title: "Diabetes basics", isArchived: true });
    const requests = fakeApi({
      library: [systemPack, archivedSameName],
      extra: {
        "GET /api/v1/packs/diabetes-basics-2": packDetailReply(packDetail({ id: "diabetes-basics-2", title: "Diabetes basics", version: "1.0.0" })),
      },
    });
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    await pasteWords(user, TEN_WORDS);
    await user.type(screen.getByLabelText("Pack name"), "Diabetes basics");
    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(registerRequests(requests)).toHaveLength(1));
    expect((registerRequests(requests)[0]!.body as { id: string }).id).toBe("diabetes-basics-2");
    const listBeforeRegister = requests.slice(0, requests.indexOf(registerRequests(requests)[0]!)).filter(r => r.path === "/api/v1/packs");
    expect(listBeforeRegister.at(-1)!.query).toEqual({ includeArchived: "true" });
  });

  it("opens from New pack in the library, lands on the new pack's detail at v1.0.0, and the library lists it without a reload", async () => {
    fakeApi({
      extra: {
        "GET /api/v1/packs/diabetes-basics": packDetailReply(packDetail({ id: "diabetes-basics", title: "Diabetes basics", version: "1.0.0" })),
      },
    });
    signInTeacher();
    const user = userEvent.setup();
    const { router } = renderApp("/packs");
    await screen.findByRole("listitem", { name: "Thyroid basics" });

    await user.click(screen.getByRole("link", { name: "New pack" }));
    expect(router.state.location.pathname).toBe("/packs/new");
    await pasteWords(user, TEN_WORDS);
    await user.type(screen.getByLabelText("Pack name"), "Diabetes basics");
    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/packs/diabetes-basics"));
    expect(await screen.findByRole("heading", { name: "Diabetes basics" })).toBeTruthy();
    expect(screen.getByText("v1.0.0")).toBeTruthy();

    await user.click(screen.getByRole("link", { name: "Back to the Pack Library" }));
    expect(await screen.findByRole("listitem", { name: "Diabetes basics" })).toBeTruthy();
  });

  it("cancel returns to the library without registering anything", async () => {
    const requests = fakeApi();
    signInTeacher();
    const user = userEvent.setup();
    const { router } = renderApp("/packs/new");

    await pasteWords(user, TEN_WORDS);
    await user.click(screen.getByRole("link", { name: "Cancel" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/packs"));
    expect(registerRequests(requests)).toHaveLength(0);
  });

  it("refuses fewer than 9 distinct words with a sentence and focus on the paste box, sending nothing", async () => {
    const requests = fakeApi();
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    await pasteWords(user, "Insulin\nGlucagon\ninsulin\nLiver");
    await user.type(screen.getByLabelText("Pack name"), "Too small");
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect((await screen.findByRole("alert")).textContent)
      .toBe("A pack needs at least 9 different words (a 3 × 3 board); this one has 3.");
    expect(document.activeElement).toBe(screen.getByLabelText("Paste words"));
    expect(registerRequests(requests)).toHaveLength(0);
  });

  it("refuses an empty name with a sentence and focus on the name, sending nothing", async () => {
    const requests = fakeApi();
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    await pasteWords(user, TEN_WORDS);
    await user.type(screen.getByLabelText("Pack name"), "   ");
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Give the pack a name.");
    expect(document.activeElement).toBe(screen.getByLabelText("Pack name"));
    expect(registerRequests(requests)).toHaveLength(0);
  });

  it("sends a signed-out teacher opening /packs/new to /login with the reason", async () => {
    const requests = installFakeFetch({});
    const { router } = renderApp("/packs/new");

    expect((await screen.findByRole("alert")).textContent).toBe("Sign in to continue.");
    expect(router.state.location.pathname).toBe("/login");
    expect(registerRequests(requests)).toHaveLength(0);
  });
});

function addedNote(): string {
  return screen.getByRole("status", { name: "Words added" }).textContent ?? "";
}

// The note on how many words are needed or what board the list allows: the word list's description.
function sizeNote(): string {
  const list = screen.getByRole("list", { name: "Words in the new pack" });
  return document.getElementById(list.getAttribute("aria-describedby") ?? "")?.textContent ?? "";
}

describe("pack Editor word list tools (react-pack-editor 02)", () => {
  it("uploads a .csv in the browser: quoted values are unquoted, a repeated word is dropped, and the note says so", async () => {
    const requests = fakeApi();
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    const csv = new File(["\"Insulin\",\"Beta cell\"\nGlucagon,insulin\n\n\"Liver\"\n"], "words.csv", { type: "text/csv" });
    await user.upload(await screen.findByLabelText("Upload .txt or .csv…"), csv);

    await waitFor(() => expect(chips()).toEqual([
      "Insulin",
      "Beta cell",
      "Glucagon",
      "Liver",
    ]));
    expect(screen.getByText("4 words")).toBeTruthy();
    expect(addedNote()).toBe("From words.csv: added 4 words. Dropped 1 duplicate and 1 blank entry.");
    expect(requests.filter(r => r.method !== "GET")).toHaveLength(0);
  });

  it("refuses a file that is not .txt or .csv with a sentence", async () => {
    fakeApi();
    signInTeacher();
    const user = userEvent.setup({ applyAccept: false });
    renderApp("/packs/new");

    await user.upload(await screen.findByLabelText("Upload .txt or .csv…"), new File(["x"], "words.pdf", { type: "application/pdf" }));

    expect((await screen.findByRole("alert")).textContent).toBe("“words.pdf” isn't a .txt or .csv file.");
    expect(chips()).toEqual([]);
  });

  it("copy its words adds the chosen pack's card labels, skipping words already in the list", async () => {
    const requests = fakeApi({
      extra: {
        "GET /api/v1/packs/thyroid-basics": packDetailReply(packDetail()),
      },
    });
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    await pasteWords(user, "tsh, Insulin");
    await user.selectOptions(await screen.findByLabelText("Start from an existing pack"), await screen.findByRole("option", { name: "Thyroid basics" }));
    await user.click(screen.getByRole("button", { name: "Copy its words" }));

    await waitFor(() => expect(chips()).toEqual([
      "tsh",
      "Insulin",
      "T4",
      "Graves disease",
    ]));
    expect(addedNote()).toBe("From Thyroid basics: added 2 words. Dropped 1 duplicate.");
    expect(requests.some(r => r.method === "GET" && r.path === "/api/v1/packs/thyroid-basics")).toBe(true);
    expect((screen.getByLabelText("Pack name") as HTMLInputElement).value).toBe("Thyroid basics (my copy)");
  });

  it("remove <word> and Clear all update the chips and the count", async () => {
    fakeApi();
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    await pasteWords(user, "Insulin, Glucagon, Liver");
    await user.click(screen.getByRole("button", { name: "Remove Glucagon" }));
    expect(chips()).toEqual(["Insulin", "Liver"]);
    expect(screen.getByText("2 words")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove Liver" }));

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(chips()).toEqual([]);
    expect(screen.getByText("0 words")).toBeTruthy();
  });

  it("says how many more words are needed below 9, and names the board size the list allows", async () => {
    fakeApi();
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    await pasteWords(user, "A1, A2, A3, A4, A5");
    expect(sizeNote()).toBe("Add at least 4 more to publish (a pack needs 9, for a 3 × 3 board).");

    await pasteWords(user, Array.from({ length: 11 }, (_, i) => `B${i + 1}`).join("\n"));
    expect(sizeNote()).toBe("16 words: enough for a 4 × 4 board.");
  });

  it("announces the added/dropped note politely, and every chip has a remove button", async () => {
    fakeApi();
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    await pasteWords(user, "Insulin\n\ninsulin\nLiver");
    const note = screen.getByRole("status", { name: "Words added" });
    expect(note.getAttribute("aria-live")).toBe("polite");
    expect(note.textContent).toBe("Added 2 words. Dropped 1 duplicate and 1 blank entry.");
    const list = screen.getByRole("list", { name: "Words in the new pack" });
    expect(within(list).getAllByRole("button").map(b => b.getAttribute("aria-label"))).toEqual(["Remove Insulin", "Remove Liver"]);
  });

  it("refuses a word longer than 60 characters with a sentence, sending nothing", async () => {
    const requests = fakeApi();
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    const long = `Glucose${"x".repeat(60)}`;
    await pasteWords(user, `${TEN_WORDS}\n${long}`);
    await user.type(screen.getByLabelText("Pack name"), "Long words");
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect((await screen.findByRole("alert")).textContent)
      .toBe(`Keep each word to 60 characters or fewer (“${long.slice(0, 30)}…”).`);
    expect(registerRequests(requests)).toHaveLength(0);
  });
});

const VALIDATE = "POST /api/v1/packs/validate";

function validateRequests(requests: RecordedRequest[]) {
  return requests.filter(r => r.method === "POST" && r.path === "/api/v1/packs/validate");
}

const missingSurvey = {
  path: "perceptionSurvey",
  code: "OPTIONAL_FIELD_MISSING",
  message: "Perception survey is not provided. Post-session surveys will not be available.",
};
const duplicateCard = {
  path: "cards[3].id",
  code: "DUPLICATE_ID",
  message: "Card id \"liver\" is used more than once.",
};
const badRows = {
  path: "boardConfig.rows",
  code: "INVALID_VALUE",
  message: "Board rows must be between 3 and 7.",
};

// A teacher with a ready pack: ten pasted words and a name.
async function fillPack(user: ReturnType<typeof userEvent.setup>) {
  await pasteWords(user, TEN_WORDS);
  await user.type(screen.getByLabelText("Pack name"), "Diabetes basics");
}

function issueList(name: "Errors" | "Warnings"): string[] {
  return within(screen.getByRole("list", { name })).getAllByRole("listitem").map(item => item.textContent ?? "");
}

function refusal(status: number, code: string, message: string, details: Record<string, unknown> | null = null): FakeAnswer {
  return {
    status,
    body: { code, message, details },
  };
}

describe("pack Editor Check pack and publish refusals (react-pack-editor 03)", () => {
  it("check pack lists errors and warnings apart, each naming its part and path, and registers nothing", async () => {
    const requests = fakeApi({
      extra: {
        [VALIDATE]: {
          status: 200,
          body: {
            valid: false,
            errors: [duplicateCard, badRows],
            warnings: [missingSurvey],
          },
        },
      },
    });
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    await fillPack(user);
    await user.click(screen.getByRole("button", { name: "Check pack" }));

    expect((await screen.findByRole("alert")).textContent).toBe("2 errors to fix before publishing.");
    expect(issueList("Errors")).toEqual([
      "Keyword Card 4 (cards[3].id): Card id \"liver\" is used more than once.",
      "Board (boardConfig.rows): Board rows must be between 3 and 7.",
    ]);
    expect(issueList("Warnings")).toEqual([
      "Perception survey (perceptionSurvey): Perception survey is not provided. Post-session surveys will not be available.",
    ]);
    const check = validateRequests(requests)[0]!;
    expect(check.headers.authorization).toBe("Bearer account.header.signature");
    expect((check.body as { id: string; cards: unknown[] }).id).toBe("diabetes-basics");
    expect((check.body as { cards: unknown[] }).cards).toHaveLength(10);
    expect(registerRequests(requests)).toHaveLength(0);
  });

  it("check pack with only warnings keeps Publish enabled; publishing succeeds and the warnings show on the detail page", async () => {
    const requests = fakeApi({
      register: async request => ({
        ...registered(request),
        body: {
          ...registered(request).body,
          warnings: [missingSurvey],
        },
      }),
      extra: {
        [VALIDATE]: {
          status: 200,
          body: {
            valid: true,
            errors: [],
            warnings: [missingSurvey],
          },
        },
        "GET /api/v1/packs/diabetes-basics": packDetailReply(packDetail({ id: "diabetes-basics", title: "Diabetes basics", version: "1.0.0" })),
      },
    });
    signInTeacher();
    const user = userEvent.setup();
    const { router } = renderApp("/packs/new");

    await fillPack(user);
    await user.click(screen.getByRole("button", { name: "Check pack" }));

    expect((await screen.findByText("No errors: the pack can be published."))).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Errors" })).toBeNull();
    expect(issueList("Warnings")).toHaveLength(1);
    const publish = screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement;
    expect(publish.disabled).toBe(false);

    await user.click(publish);
    await waitFor(() => expect(router.state.location.pathname).toBe("/packs/diabetes-basics"));
    expect(registerRequests(requests)).toHaveLength(1);
    const published = await screen.findByRole("region", { name: "Published with warnings" });
    expect(within(published).getByRole("listitem").textContent).toContain("perceptionSurvey");
  });

  it.each([
    {
      reply: refusal(409, "PACK_ALREADY_EXISTS", "Pack diabetes-basics@1.0.0 already exists."),
      sentence: "Someone released that version of this pack first. Reload the page and try again.",
    },
    {
      reply: refusal(403, "PACK_IS_SYSTEM_PACK", "System pack."),
      sentence: "Built-in System Packs can't be archived or given new versions.",
    },
    {
      reply: refusal(400, "INVALID_REQUEST_BODY", "Invalid body.", { field: "cards[0].aliases", reason: "must be array" }),
      sentence: "The server refused Keyword Card 1 (cards[0].aliases): must be array.",
    },
    {
      reply: refusal(422, "PACK_VALIDATION_FAILED", "Failed.", {
        errors: [badRows],
        warnings: [missingSurvey],
      }),
      sentence: "The server refused the pack: 1 error to fix, listed below.",
    },
    {
      reply: "network-error" as const,
      sentence: "Can't reach the API. Start it with `npm run dev:local`.",
    },
  ])("publish refused with $sentence keeps the teacher on the editor with the words", async ({ reply, sentence }) => {
    const requests = fakeApi({ register: reply });
    signInTeacher();
    const user = userEvent.setup();
    const { router } = renderApp("/packs/new");

    await fillPack(user);
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect((await screen.findByRole("alert")).textContent).toContain(sentence);
    expect(router.state.location.pathname).toBe("/packs/new");
    expect(chips()).toHaveLength(10);
    expect(registerRequests(requests)).toHaveLength(1);
  });

  it("lists a 422 refusal's errors and warnings apart", async () => {
    fakeApi({
      register: refusal(422, "PACK_VALIDATION_FAILED", "Failed.", {
        errors: [badRows],
        warnings: [missingSurvey],
      }),
    });
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    await fillPack(user);
    await user.click(screen.getByRole("button", { name: "Publish" }));

    await screen.findByRole("alert");
    expect(issueList("Errors")).toEqual(["Board (boardConfig.rows): Board rows must be between 3 and 7."]);
    expect(issueList("Warnings")).toHaveLength(1);
  });

  it("a 401 on Publish clears the Account Token and sends the teacher to /login with the reason", async () => {
    fakeApi({
      register: refusal(401, "UNAUTHORIZED_TOKEN", "Token expired."),
    });
    signInTeacher();
    const user = userEvent.setup();
    const { router } = renderApp("/packs/new");

    await fillPack(user);
    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect((await screen.findByRole("alert")).textContent)
      .toBe("Your sign-in was not accepted (expired or signed out elsewhere). Sign in again.");
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
  });

  it("disables Check pack and Publish while a check is running, so a double click sends one request", async () => {
    let answer: (reply: { status: number; body: unknown }) => void = () => {};
    const requests = fakeApi({
      extra: {
        [VALIDATE]: () => new Promise((resolve) => {
          answer = resolve;
        }),
      },
    });
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    await fillPack(user);
    const check = screen.getByRole("button", { name: "Check pack" }) as HTMLButtonElement;
    const publish = screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement;
    await user.dblClick(check);

    await waitFor(() => expect(validateRequests(requests)).toHaveLength(1));
    expect(check.disabled).toBe(true);
    expect(publish.disabled).toBe(true);
    await user.click(publish);
    expect(registerRequests(requests)).toHaveLength(0);

    answer({
      status: 200,
      body: { valid: true, errors: [], warnings: [] },
    });
    await waitFor(() => expect(check.disabled).toBe(false));
    expect(publish.disabled).toBe(false);
    expect(validateRequests(requests)).toHaveLength(1);
  });

  it("disables both buttons while a publish is running", async () => {
    let answer: (reply: { status: number; body: unknown }) => void = () => {};
    const requests = fakeApi({
      register: () => new Promise((resolve) => {
        answer = resolve;
      }),
    });
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs/new");

    await fillPack(user);
    const publish = screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement;
    await user.dblClick(publish);

    await waitFor(() => expect(registerRequests(requests)).toHaveLength(1));
    expect(publish.disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Check pack" }) as HTMLButtonElement).disabled).toBe(true);
    answer({
      status: 409,
      body: { code: "PACK_ALREADY_EXISTS", message: "exists", details: null },
    });
    await screen.findByRole("alert");
    expect(registerRequests(requests)).toHaveLength(1);
  });
});
