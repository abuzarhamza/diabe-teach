import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeFetch } from "../../support/fake-fetch.ts";
import { renderApp } from "../../support/render-app.tsx";

const ACCOUNT_KEY = "cc-account-token-v1";

const SIGN_IN_TO_CONTINUE = "Sign in to continue.";
const EXPIRED = "Your sign-in has expired. Sign in again.";
const NOT_ACCEPTED = "Your sign-in was not accepted (expired or signed out elsewhere). Sign in again.";

const storedAccount = {
  accountId: "acc_01",
  email: "rahman.s@aku.edu",
  accountToken: "header.payload.signature",
  expiresAt: "2099-01-01T12:00:00.000Z",
};

const instructorAccountView = {
  accountId: "acc_01",
  email: "rahman.s@aku.edu",
  createdAt: "2026-01-01T09:00:00.000Z",
};

const tokenRefused = {
  status: 401,
  body: { code: "UNAUTHORIZED_TOKEN", message: "The Account Token is invalid or expired.", details: null },
};

function storeAccount(value: unknown) {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(value));
}

async function expectOnLoginWith(router: ReturnType<typeof renderApp>["router"], sentence: string) {
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toBe(sentence);
  expect(router.state.location.pathname).toBe("/login");
  expect(screen.getByLabelText("Email")).toBeTruthy();
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("teacher screens send signed-out teachers to login (react-login-screen 05)", () => {
  it("sends a visit to /setup with no Account Token to /login with \"Sign in to continue.\"", async () => {
    const requests = installFakeFetch({});
    const { router } = renderApp("/setup");

    await expectOnLoginWith(router, SIGN_IN_TO_CONTINUE);
    expect(requests).toEqual([]);
  });

  it("treats a malformed stored token like no token", async () => {
    installFakeFetch({});
    localStorage.setItem(ACCOUNT_KEY, "not json");
    const { router } = renderApp("/setup");

    await expectOnLoginWith(router, SIGN_IN_TO_CONTINUE);
  });

  it("sends a visit to /setup with an expired Account Token to /login with the expired sentence", async () => {
    const requests = installFakeFetch({});
    storeAccount({ ...storedAccount, expiresAt: "2020-01-01T00:00:00.000Z" });
    const { router } = renderApp("/setup");

    await expectOnLoginWith(router, EXPIRED);
    expect(requests).toEqual([]);
  });

  it("clears the token and lands on /login with the \"not accepted\" sentence when GET /accounts/me answers 401", async () => {
    const requests = installFakeFetch({ "GET /api/v1/accounts/me": tokenRefused });
    storeAccount(storedAccount);
    const { router } = renderApp("/setup");

    await expectOnLoginWith(router, NOT_ACCEPTED);
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    expect(requests).toHaveLength(1);
    expect(requests[0]!.headers.authorization).toBe("Bearer header.payload.signature");
  });

  it("keeps the /setup placeholder when GET /accounts/me confirms the teacher", async () => {
    const requests = installFakeFetch({
      "GET /api/v1/accounts/me": { status: 200, body: instructorAccountView },
    });
    storeAccount(storedAccount);
    const { router } = renderApp("/setup");

    expect(await screen.findByRole("heading", { name: "Game setup" })).toBeTruthy();
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    // Let the confirmation settle, then check the teacher is still here.
    await act(async () => {});
    expect(router.state.location.pathname).toBe("/setup");
    expect(screen.getByRole("heading", { name: "Game setup" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(localStorage.getItem(ACCOUNT_KEY)).not.toBeNull();
  });

  it("shows the reason once: rendering /login again shows no alert", async () => {
    installFakeFetch({});
    const first = renderApp("/setup");
    await expectOnLoginWith(first.router, SIGN_IN_TO_CONTINUE);
    first.unmount();

    renderApp("/login");

    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows no alert on /login when nobody was sent there", () => {
    renderApp("/login");

    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends a teacher on /setup to /login with the expired sentence when the token expires while the page is open", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "Date"],
    });
    vi.setSystemTime(new Date("2026-11-25T12:00:00.000Z"));
    installFakeFetch({
      "GET /api/v1/accounts/me": { status: 200, body: instructorAccountView },
    });
    storeAccount({ ...storedAccount, expiresAt: "2026-11-25T12:01:00.000Z" });
    const { router } = renderApp("/setup");
    await vi.waitFor(() => expect(screen.getByRole("heading", { name: "Game setup" })).toBeTruthy());

    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });

    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    await vi.waitFor(() => expect(screen.getByRole("alert").textContent).toBe(EXPIRED));
  });

  it("switches /login from the signed-in panel to the form when the token expires while it is open", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "Date"],
    });
    vi.setSystemTime(new Date("2026-11-25T12:00:00.000Z"));
    storeAccount({ ...storedAccount, expiresAt: "2026-11-25T12:01:00.000Z" });
    renderApp("/login");
    expect(screen.getByText("Signed in as")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    expect(screen.queryByText("Signed in as")).toBeNull();
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });
});
