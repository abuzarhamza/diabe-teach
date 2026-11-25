import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeFetch } from "../../support/fake-fetch.ts";
import { renderApp } from "../../support/render-app.tsx";

const ACCOUNT_KEY = "cc-account-token-v1";

const accountTokenResponse = {
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("teacher Login screen (react-login-screen 01)", () => {
  it("shows labelled Email and Password fields, Sign in and Create account buttons, and the learner note", () => {
    renderApp("/login");

    const email = screen.getByLabelText("Email");
    expect(email.getAttribute("type")).toBe("email");
    expect(email.getAttribute("maxlength")).toBe("254");
    expect(email.getAttribute("autocomplete")).toBe("username");
    expect(email.hasAttribute("required")).toBe(true);

    const password = screen.getByLabelText("Password");
    expect(password.getAttribute("type")).toBe("password");
    expect(password.getAttribute("maxlength")).toBe("1024");
    expect(password.getAttribute("autocomplete")).toBe("current-password");
    expect(password.hasAttribute("required")).toBe(true);

    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
    expect(screen.getByText(/Learners don't sign in: they join with the room code/)).toBeTruthy();
  });

  it("signs in with a trimmed email, stores the Account Token and lands on Game Setup", async () => {
    const requests = installFakeFetch({
      "POST /api/v1/accounts/sign-in": { status: 200, body: accountTokenResponse },
      "GET /api/v1/accounts/me": { status: 200, body: instructorAccountView },
    });
    const user = userEvent.setup();
    const { router } = renderApp("/login");

    await user.type(screen.getByLabelText("Email"), "  Rahman.S@AKU.edu ");
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Game setup" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/setup");
    // The sign-in, then Game Setup's guard confirming the teacher (react-login-screen 05).
    expect(requests[0]).toMatchObject({
      method: "POST",
      path: "/api/v1/accounts/sign-in",
      body: { email: "Rahman.S@AKU.edu", password: "correct-horse-battery" },
    });
    expect(requests[0]!.headers.authorization).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "null")).toEqual(accountTokenResponse);
  });

  it("signs in when the teacher presses Enter in the form", async () => {
    installFakeFetch({
      "POST /api/v1/accounts/sign-in": { status: 200, body: accountTokenResponse },
    });
    const user = userEvent.setup();
    const { router } = renderApp("/login");

    await user.type(screen.getByLabelText("Email"), "rahman.s@aku.edu");
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery{Enter}");

    await waitFor(() => expect(router.state.location.pathname).toBe("/setup"));
    expect(localStorage.getItem(ACCOUNT_KEY)).not.toBeNull();
  });

  it("redirects unknown routes to /login", async () => {
    const { router } = renderApp("/no-such-page");

    expect(await screen.findByLabelText("Email")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("renders the Game Setup placeholder at /setup for a signed-in teacher", async () => {
    installFakeFetch({
      "GET /api/v1/accounts/me": { status: 200, body: instructorAccountView },
    });
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accountTokenResponse));
    renderApp("/setup");

    expect(await screen.findByRole("heading", { name: "Game setup" })).toBeTruthy();
  });
});
