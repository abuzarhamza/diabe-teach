import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeFetch } from "../../support/fake-fetch.ts";
import {
  instructorAccountView,
  packDetail,
  packDetailReply,
  packListReply,
  signInTeacher,
  thyroidPack,
} from "../../support/pack-fixtures.ts";
import { renderApp } from "../../support/render-app.tsx";

const me = { status: 200, body: instructorAccountView };

function section(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pack Detail at /packs/:packId (react-web-ui 03)", () => {
  it("shows the board, Semantic Domains, Keyword Cards, rubric, questions and survey items, without sending the Account Token", async () => {
    const requests = installFakeFetch({
      "GET /api/v1/accounts/me": me,
      "GET /api/v1/packs/thyroid-basics": packDetailReply(packDetail()),
    });
    signInTeacher();
    renderApp("/packs/thyroid-basics");

    expect(await screen.findByRole("heading", { name: "Thyroid basics" })).toBeTruthy();
    expect(screen.getByText("Thyroid hormone, feedback loops and common disorders.")).toBeTruthy();
    expect(within(section("Board")).getByText("5 × 6 board · chains of 3+ cards · any of the 8 neighbouring cards")).toBeTruthy();

    const domains = within(section("Semantic Domains"));
    expect(domains.getByText("Physiology")).toBeTruthy();
    expect(domains.getByText("How the thyroid axis works.")).toBeTruthy();

    const cards = within(section("Keyword Cards"));
    expect(cards.getByText("TSH")).toBeTruthy();
    expect(cards.getByText("Thyroid-stimulating hormone")).toBeTruthy();
    expect(cards.getByText("Pituitary signal that drives the thyroid.")).toBeTruthy();
    expect(cards.getByText("Also: thyrotropin")).toBeTruthy();

    const rubric = within(section("Adjudication Rubric"));
    expect(rubric.getByText("A senior endocrinologist")).toBeTruthy();
    expect(rubric.getByText("No step skips a mechanism.")).toBeTruthy();
    expect(rubric.getByText("TSH → T4")).toBeTruthy();
    expect(rubric.getByText("Valid")).toBeTruthy();

    const questions = within(section("Assessment questions"));
    expect(questions.getByText("Which hormone does the pituitary release to stimulate the thyroid?")).toBeTruthy();
    expect(questions.getByText("Calcitonin")).toBeTruthy();

    expect(within(section("Survey items")).getByText("The game helped me link concepts.")).toBeTruthy();

    const detail = requests.find(r => r.path === "/api/v1/packs/thyroid-basics")!;
    expect(detail.method).toBe("GET");
    expect(detail.headers.authorization).toBeUndefined();
  });

  it("says so when the pack has no assessment questions or no survey (null)", async () => {
    installFakeFetch({
      "GET /api/v1/accounts/me": me,
      "GET /api/v1/packs/thyroid-basics": packDetailReply(packDetail({ assessmentInstrument: null, perceptionSurvey: null })),
    });
    signInTeacher();
    renderApp("/packs/thyroid-basics");
    await screen.findByRole("heading", { name: "Thyroid basics" });

    expect(within(section("Assessment questions")).getByText("This pack has no assessment questions.")).toBeTruthy();
    expect(within(section("Survey items")).getByText("This pack has no perception survey.")).toBeTruthy();
  });

  it("marks a System Pack", async () => {
    installFakeFetch({
      "GET /api/v1/accounts/me": me,
      "GET /api/v1/packs/diabe-teach": packDetailReply(packDetail({ id: "diabe-teach", title: "Diabe-teach", isSystemPack: true })),
    });
    signInTeacher();
    renderApp("/packs/diabe-teach");

    expect(await screen.findByRole("heading", { name: "Diabe-teach" })).toBeTruthy();
    expect(screen.getByText("System Pack")).toBeTruthy();
  });

  it("explains a 404 in the ErrorBanner", async () => {
    installFakeFetch({
      "GET /api/v1/accounts/me": me,
      "GET /api/v1/packs/missing": {
        status: 404,
        body: {
          code: "PACK_NOT_FOUND",
          message: "Curriculum Pack 'missing' was not found.",
          details: { packId: "missing" },
        },
      },
    });
    signInTeacher();
    renderApp("/packs/missing");

    expect(await screen.findByText("Curriculum Pack 'missing' was not found.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to the Pack Library" })).toBeTruthy();
  });

  it("opens from the Pack Library and starts a game with the pack", async () => {
    installFakeFetch({
      "GET /api/v1/accounts/me": me,
      "GET /api/v1/packs": packListReply([thyroidPack]),
      "GET /api/v1/packs/thyroid-basics": packDetailReply(packDetail()),
    });
    signInTeacher();
    const user = userEvent.setup();
    const { router } = renderApp("/packs");

    await user.click(await screen.findByRole("link", { name: "Thyroid basics" }));
    expect(await screen.findByRole("heading", { name: "Thyroid basics" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/packs/thyroid-basics");

    await user.click(screen.getByRole("link", { name: "Start Game with Pack Thyroid basics" }));
    expect(router.state.location.pathname).toBe("/setup");
    expect(router.state.location.search).toBe("?packId=thyroid-basics");
  });

  it("sends a signed-out teacher to /login with \"Sign in to continue.\"", async () => {
    const requests = installFakeFetch({});
    const { router } = renderApp("/packs/thyroid-basics");

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Sign in to continue.");
    expect(router.state.location.pathname).toBe("/login");
    expect(requests).toEqual([]);
  });
});
