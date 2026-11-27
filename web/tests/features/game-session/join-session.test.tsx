import type { FakeReply } from "../../support/fake-fetch.ts";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeFetch } from "../../support/fake-fetch.ts";
import { renderApp } from "../../support/render-app.tsx";

const ACCOUNT_KEY = "cc-account-token-v1";
const SEATS_KEY = "cc-session-seats-v1";

const storedAccount = {
  accountId: "acc_01",
  email: "rahman.s@aku.edu",
  accountToken: "account.header.signature",
  expiresAt: "2099-01-01T12:00:00.000Z",
};

interface Learner {
  participantId: string;
  displayName: string;
  leftAt?: string | null;
}

// A docs/api/openapi.yaml PublicSessionState.
function sessionState(sessionId: string, roomCode: string, learners: Learner[], currentPhase = "pretest") {
  const participants = learners.map(learner => ({
    participantId: learner.participantId,
    displayName: learner.displayName,
    joinedAt: "2026-11-27T09:00:00.000Z",
    leftAt: learner.leftAt ?? null,
  }));
  return {
    sessionId,
    roomCode,
    packId: "diabe-teach",
    packVersion: "1.0.0",
    mode: "classroom",
    adjudicationMode: "peer-instructor",
    currentPhase,
    activeRoundNumber: null,
    phaseStartedAt: "2026-11-27T09:00:00.000Z",
    phaseEndsAt: "2026-11-27T09:15:00.000Z",
    activeBoard: null,
    participantCount: participants.filter(p => p.leftAt === null).length,
    participants,
  };
}

const asha: Learner = { participantId: "par_asha", displayName: "Asha" };
const bilal: Learner = { participantId: "par_bilal", displayName: "Bilal" };

function joinReply(sessionId: string, roomCode: string, learner: Learner, token: string): FakeReply {
  return {
    status: 200,
    body: {
      sessionId,
      participantId: learner.participantId,
      participantToken: token,
      state: sessionState(sessionId, roomCode, [learner]),
    },
  };
}

function stateReply(sessionId: string, roomCode: string, learners: Learner[], currentPhase?: string): FakeReply {
  return {
    status: 200,
    body: {
      state: sessionState(sessionId, roomCode, learners, currentPhase),
    },
  };
}

async function joinAs(user: ReturnType<typeof userEvent.setup>, roomCode: string, displayName: string) {
  const form = await screen.findByRole("form", { name: "Join a game" });
  await user.type(within(form).getByLabelText("Room code"), roomCode);
  await user.type(within(form).getByLabelText("Your name"), displayName);
  await user.click(within(form).getByRole("button", { name: "Join" }));
}

function storedSeats(): Record<string, unknown> {
  return JSON.parse(sessionStorage.getItem(SEATS_KEY) ?? "{}") as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("learner joins by room code and lands in the Lobby (react-web-ui 02)", () => {
  it("joins with the room code and name, stores the seat and shows the Lobby with the room code and roster", async () => {
    const requests = installFakeFetch({
      "POST /api/v1/sessions/join": joinReply("ses_1", "K7Q2MX", asha, "cap.asha"),
      "GET /api/v1/sessions/ses_1": stateReply("ses_1", "K7Q2MX", [asha]),
    });
    const user = userEvent.setup();
    const { router } = renderApp("/login");

    await joinAs(user, "k7q2mx", " Asha ");

    expect(await screen.findByRole("heading", { name: "You're in, Asha!" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/sessions/ses_1");
    expect(screen.getByText("K7Q2MX")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "In the room" })).getByText("Asha (you)")).toBeTruthy();
    expect(requests[0]).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/join",
      body: { roomCode: "K7Q2MX", displayName: "Asha" },
    });
    expect(requests[0]!.headers.authorization).toBeUndefined();
    expect(storedSeats()).toEqual({
      ses_1: {
        sessionId: "ses_1",
        role: "participant",
        token: "cap.asha",
        participantId: "par_asha",
        displayName: "Asha",
        roomCode: "K7Q2MX",
      },
    });
  });

  it("polls the session state with that seat's Capability Token", async () => {
    const requests = installFakeFetch({
      "POST /api/v1/sessions/join": joinReply("ses_1", "K7Q2MX", asha, "cap.asha"),
      "GET /api/v1/sessions/ses_1": stateReply("ses_1", "K7Q2MX", [asha]),
    });
    const user = userEvent.setup();
    renderApp("/login");

    await joinAs(user, "K7Q2MX", "Asha");

    await waitFor(() => expect(requests.some(r => r.method === "GET" && r.path === "/api/v1/sessions/ses_1")).toBe(true));
    const poll = requests.find(r => r.method === "GET" && r.path === "/api/v1/sessions/ses_1")!;
    expect(poll.headers.authorization).toBe("Bearer cap.asha");
  });

  it("keeps the first session's seat when joining a second session", async () => {
    installFakeFetch({
      "POST /api/v1/sessions/join": joinReply("ses_1", "K7Q2MX", asha, "cap.asha"),
      "GET /api/v1/sessions/ses_1": stateReply("ses_1", "K7Q2MX", [asha]),
      "GET /api/v1/sessions/ses_2": stateReply("ses_2", "P3RT9W", [bilal]),
    });
    const user = userEvent.setup();
    const { router } = renderApp("/login");
    await joinAs(user, "K7Q2MX", "Asha");
    await screen.findByRole("heading", { name: "You're in, Asha!" });

    installFakeFetch({
      "POST /api/v1/sessions/join": joinReply("ses_2", "P3RT9W", bilal, "cap.bilal"),
      "GET /api/v1/sessions/ses_2": stateReply("ses_2", "P3RT9W", [bilal]),
    });
    await router.navigate("/login");
    await joinAs(user, "P3RT9W", "Bilal");
    await screen.findByRole("heading", { name: "You're in, Bilal!" });

    expect(Object.keys(storedSeats()).sort()).toEqual(["ses_1", "ses_2"]);
    expect(storedSeats().ses_1).toMatchObject({ token: "cap.asha", participantId: "par_asha" });
    expect(storedSeats().ses_2).toMatchObject({ token: "cap.bilal", participantId: "par_bilal" });

    const reopened = installFakeFetch({
      "GET /api/v1/sessions/ses_1": stateReply("ses_1", "K7Q2MX", [asha]),
    });
    await router.navigate("/sessions/ses_1");
    expect(await screen.findByRole("heading", { name: "You're in, Asha!" })).toBeTruthy();
    expect(reopened.find(r => r.path === "/api/v1/sessions/ses_1")!.headers.authorization).toBe("Bearer cap.asha");
  });

  it("leaves a signed-in teacher's Account Token untouched and never sends it", async () => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(storedAccount));
    const requests = installFakeFetch({
      "POST /api/v1/sessions/join": joinReply("ses_1", "K7Q2MX", asha, "cap.asha"),
      "GET /api/v1/sessions/ses_1": stateReply("ses_1", "K7Q2MX", [asha]),
    });
    const user = userEvent.setup();
    renderApp("/login");

    await joinAs(user, "K7Q2MX", "Asha");
    await screen.findByRole("heading", { name: "You're in, Asha!" });

    expect(JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "null")).toEqual(storedAccount);
    expect(requests.every(r => r.headers.authorization !== `Bearer ${storedAccount.accountToken}`)).toBe(true);
    expect(localStorage.getItem(SEATS_KEY)).toBeNull();
  });

  it("shows the server's error code in the ErrorBanner for an unknown room code, and stores no seat", async () => {
    installFakeFetch({
      "POST /api/v1/sessions/join": {
        status: 404,
        body: {
          code: "ROOM_CODE_NOT_FOUND",
          message: "No active session found with room code 'ZZZZZZ'.",
          details: { roomCode: "ZZZZZZ" },
        },
      },
    });
    const user = userEvent.setup();
    const { router } = renderApp("/login");

    await joinAs(user, "ZZZZZZ", "Asha");

    const form = screen.getByRole("form", { name: "Join a game" });
    const banner = await within(form).findByRole("status");
    await waitFor(() => expect(banner.textContent).toContain("No active session found with room code 'ZZZZZZ'."));
    expect(banner.textContent).toContain("ROOM_CODE_NOT_FOUND");
    expect(router.state.location.pathname).toBe("/login");
    expect(sessionStorage.getItem(SEATS_KEY)).toBeNull();
  });

  it("asks for the room code before sending anything", async () => {
    const requests = installFakeFetch({});
    const user = userEvent.setup();
    renderApp("/login");

    const form = screen.getByRole("form", { name: "Join a game" });
    await user.type(within(form).getByLabelText("Your name"), "Asha");
    await user.click(within(form).getByRole("button", { name: "Join" }));

    expect(within(form).getByRole("status").textContent).toContain("Enter the room code from your teacher.");
    expect(requests).toEqual([]);
  });

  it("asks for the learner's name before sending anything, and puts the cursor there", async () => {
    const requests = installFakeFetch({});
    const user = userEvent.setup();
    renderApp("/login");

    const form = screen.getByRole("form", { name: "Join a game" });
    await user.type(within(form).getByLabelText("Room code"), "K7Q2MX");
    await user.type(within(form).getByLabelText("Your name"), "   ");
    await user.click(within(form).getByRole("button", { name: "Join" }));

    expect(within(form).getByRole("status").textContent).toContain("Enter your name, as your class will see it.");
    expect(document.activeElement).toBe(within(form).getByLabelText("Your name"));
    expect(requests).toEqual([]);
  });

  it("shows a classmate who joins in the roster at the next 2-second poll, and marks departed learners", async () => {
    let polls = 0;
    installFakeFetch({
      "POST /api/v1/sessions/join": joinReply("ses_1", "K7Q2MX", asha, "cap.asha"),
      "GET /api/v1/sessions/ses_1": async () => {
        polls += 1;
        return polls === 1
          ? stateReply("ses_1", "K7Q2MX", [asha])
          : stateReply("ses_1", "K7Q2MX", [
              asha,
              bilal,
              { participantId: "par_chen", displayName: "Chen", leftAt: "2026-11-27T09:05:00.000Z" },
            ]);
      },
    });
    const user = userEvent.setup();
    renderApp("/login");
    await joinAs(user, "K7Q2MX", "Asha");
    const roster = await screen.findByRole("list", { name: "In the room" });
    expect(within(roster).queryByText("Bilal")).toBeNull();

    expect(await within(roster).findByText("Bilal", {}, { timeout: 3500 })).toBeTruthy();
    expect(within(roster).getByText("Chen (left)")).toBeTruthy();
    expect(screen.getByText("2 in the room")).toBeTruthy();
  });

  it("asks a visitor with no seat for this session to join first, and sends nothing", async () => {
    const requests = installFakeFetch({});
    renderApp("/sessions/ses_9");

    expect(await screen.findByRole("heading", { name: "You haven't joined this game" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Join with a room code" }).getAttribute("href")).toBe("/login");
    expect(requests).toEqual([]);
  });

  it("shows a coming-soon placeholder for a phase whose view is not built yet", async () => {
    sessionStorage.setItem(SEATS_KEY, JSON.stringify({
      ses_1: {
        sessionId: "ses_1",
        role: "participant",
        token: "cap.asha",
        participantId: "par_asha",
        displayName: "Asha",
        roomCode: "K7Q2MX",
      },
    }));
    installFakeFetch({
      "GET /api/v1/sessions/ses_1": stateReply("ses_1", "K7Q2MX", [asha], "round-1:chain-mapping"),
    });
    renderApp("/sessions/ses_1");

    expect(await screen.findByRole("heading", { name: "Round 1: build chains" })).toBeTruthy();
    expect(screen.getByText(/coming soon/)).toBeTruthy();
  });

  it("shows the poll's refusal code in the ErrorBanner", async () => {
    sessionStorage.setItem(SEATS_KEY, JSON.stringify({
      ses_1: {
        sessionId: "ses_1",
        role: "participant",
        token: "cap.asha",
        participantId: "par_asha",
        displayName: "Asha",
        roomCode: "K7Q2MX",
      },
    }));
    installFakeFetch({
      "GET /api/v1/sessions/ses_1": {
        status: 403,
        body: { code: "FORBIDDEN_ROLE", message: "The token belongs to another Game Session.", details: null },
      },
    });
    renderApp("/sessions/ses_1");

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("FORBIDDEN_ROLE"));
  });
});
