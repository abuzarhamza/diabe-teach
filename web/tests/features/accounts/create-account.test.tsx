import type { FakeReply } from "../../support/fake-fetch.ts";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeFetch } from "../../support/fake-fetch.ts";
import { renderApp } from "../../support/render-app.tsx";

const ACCOUNT_KEY = "cc-account-token-v1";
const SIGN_UP = "POST /api/v1/accounts/sign-up";

const accountTokenResponse = {
  accountId: "acc_02",
  email: "new.teacher@aku.edu",
  accountToken: "header.payload.signature",
  expiresAt: "2099-01-01T12:00:00.000Z",
};

function refusal(status: number, code: string, message: string, details: Record<string, unknown> | null = null): FakeReply {
  return {
    status,
    body: { code, message, details },
  };
}

async function createAccountWith(email: string, password: string) {
  const user = userEvent.setup();
  if (email)
    await user.type(screen.getByLabelText("Email"), email);
  if (password)
    await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("teacher Login screen: Create account (react-login-screen 03)", () => {
  it("shows the hint \"At least 10 characters.\" under the password field", () => {
    renderApp("/login");

    const hint = screen.getByText("At least 10 characters.");
    expect(screen.getByLabelText("Password").getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("201 AccountTokenResponse: signs up with a trimmed email, stores the Account Token and lands on Game Setup", async () => {
    const requests = installFakeFetch({
      [SIGN_UP]: { status: 201, body: accountTokenResponse },
    });
    const { router } = renderApp("/login");

    await createAccountWith("  New.Teacher@AKU.edu ", "correct-horse-battery");

    expect(await screen.findByRole("heading", { name: "Game setup" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/setup");
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: "POST",
      path: "/api/v1/accounts/sign-up",
      body: { email: "New.Teacher@AKU.edu", password: "correct-horse-battery" },
    });
    expect(requests[0]!.headers.authorization).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "null")).toEqual(accountTokenResponse);
  });

  it("password of 9 characters: says it is too short, focuses Password and sends no request", async () => {
    const requests = installFakeFetch({
      [SIGN_UP]: { status: 201, body: accountTokenResponse },
    });
    renderApp("/login");

    await createAccountWith("new.teacher@aku.edu", "123456789");

    expect(await screen.findByText("Password too short: use at least 10 characters.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Password"));
    expect(requests).toHaveLength(0);
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
  });

  it("email not shaped like an email: says so, focuses Email and sends no request", async () => {
    const requests = installFakeFetch({
      [SIGN_UP]: { status: 201, body: accountTokenResponse },
    });
    renderApp("/login");

    await createAccountWith("new.teacher@aku", "correct-horse-battery");

    expect(await screen.findByText("Enter a valid email address, like name@school.org.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Email"));
    expect(requests).toHaveLength(0);
  });

  it("409 EMAIL_ALREADY_REGISTERED: says \"That email is already registered. Sign in instead.\" and focuses Email", async () => {
    installFakeFetch({
      [SIGN_UP]: refusal(409, "EMAIL_ALREADY_REGISTERED", "An Instructor Account already has this email."),
    });
    const { router } = renderApp("/login");

    await createAccountWith("rahman.s@aku.edu", "correct-horse-battery");

    expect(await screen.findByText("That email is already registered. Sign in instead.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("That email is already registered. Sign in instead.");
    expect(document.activeElement).toBe(screen.getByLabelText("Email"));
    expect(router.state.location.pathname).toBe("/login");
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
  });

  it("400 INVALID_REQUEST_BODY with details.field \"password\": the password sentence, focus on Password", async () => {
    installFakeFetch({
      [SIGN_UP]: refusal(400, "INVALID_REQUEST_BODY", "password must be at least 10 characters.", { field: "password" }),
    });
    renderApp("/login");

    await createAccountWith("new.teacher@aku.edu", "correct-horse-battery");

    expect(await screen.findByText("Password too short: use at least 10 characters.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Password"));
  });

  it("400 INVALID_REQUEST_BODY with details.field \"email\": the email sentence, focus on Email", async () => {
    installFakeFetch({
      [SIGN_UP]: refusal(400, "INVALID_REQUEST_BODY", "email is not a valid email address.", { field: "email" }),
    });
    renderApp("/login");

    await createAccountWith("new.teacher@aku.edu", "correct-horse-battery");

    expect(await screen.findByText("Enter a valid email address, like name@school.org.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Email"));
  });

  it("disables Sign in and Create account while the sign-up is pending", async () => {
    let answer: (reply: FakeReply) => void = () => {};
    installFakeFetch({
      [SIGN_UP]: () => new Promise<FakeReply>((resolve) => {
        answer = resolve;
      }),
    });
    const { router } = renderApp("/login");
    const signIn = screen.getByRole("button", { name: "Sign in" });
    const createAccount = screen.getByRole("button", { name: "Create account" });

    await createAccountWith("new.teacher@aku.edu", "correct-horse-battery");

    await waitFor(() => expect(createAccount.hasAttribute("disabled")).toBe(true));
    expect(signIn.hasAttribute("disabled")).toBe(true);

    answer({ status: 201, body: accountTokenResponse });

    await waitFor(() => expect(router.state.location.pathname).toBe("/setup"));
  });
});
