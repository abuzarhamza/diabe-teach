import type { FakeReply } from "../../support/fake-fetch.ts";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeFetch } from "../../support/fake-fetch.ts";
import { renderApp } from "../../support/render-app.tsx";

const ACCOUNT_KEY = "cc-account-token-v1";
const SIGN_IN = "POST /api/v1/accounts/sign-in";

const accountTokenResponse = {
  accountId: "acc_01",
  email: "rahman.s@aku.edu",
  accountToken: "header.payload.signature",
  expiresAt: "2099-01-01T12:00:00.000Z",
};

function refusal(status: number, code: string, message: string, details: Record<string, unknown> | null = null): FakeReply {
  return {
    status,
    body: { code, message, details },
  };
}

function localHhMm(iso: string): string {
  const time = new Date(iso);
  return `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
}

async function signInWith(email: string, password: string) {
  const user = userEvent.setup();
  if (email)
    await user.type(screen.getByLabelText("Email"), email);
  if (password)
    await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("teacher Login screen: sign-in refusals (react-login-screen 02)", () => {
  it("401 INVALID_CREDENTIALS: says \"Wrong email or password.\", focuses Password, stays on /login and stores nothing", async () => {
    installFakeFetch({
      [SIGN_IN]: refusal(401, "INVALID_CREDENTIALS", "Invalid email or password."),
    });
    const { router } = renderApp("/login");

    await signInWith("rahman.s@aku.edu", "wrong-password-123");

    expect(await screen.findByText("Wrong email or password.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Wrong email or password.");
    expect(document.activeElement).toBe(screen.getByLabelText("Password"));
    expect(router.state.location.pathname).toBe("/login");
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
  });

  it("423 ACCOUNT_TEMPORARILY_LOCKED with details.lockedUntil: the lock sentence names the local HH:MM it ends", async () => {
    const lockedUntil = "2099-01-01T15:07:00.000Z";
    installFakeFetch({
      [SIGN_IN]: refusal(423, "ACCOUNT_TEMPORARILY_LOCKED", "Account temporarily locked.", { lockedUntil }),
    });
    renderApp("/login");

    await signInWith("rahman.s@aku.edu", "correct-horse-battery");

    const sentence = `Too many wrong passwords: sign-in is temporarily locked until ${localHhMm(lockedUntil)}. Try again later.`;
    expect(await screen.findByText(sentence)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Password"));
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
  });

  it("423 without a readable details.lockedUntil: the lock sentence leaves the time out", async () => {
    installFakeFetch({
      [SIGN_IN]: refusal(423, "ACCOUNT_TEMPORARILY_LOCKED", "Account temporarily locked.", { lockedUntil: "not-a-time" }),
    });
    renderApp("/login");

    await signInWith("rahman.s@aku.edu", "correct-horse-battery");

    expect(await screen.findByText("Too many wrong passwords: sign-in is temporarily locked. Try again later.")).toBeTruthy();
  });

  it("empty email: says \"Enter your email and password.\", focuses Email and sends no request", async () => {
    const requests = installFakeFetch({
      [SIGN_IN]: { status: 200, body: accountTokenResponse },
    });
    renderApp("/login");

    await signInWith("", "correct-horse-battery");

    expect(await screen.findByText("Enter your email and password.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Email"));
    expect(requests).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("empty password: says \"Enter your email and password.\", focuses Password and sends no request", async () => {
    const requests = installFakeFetch({
      [SIGN_IN]: { status: 200, body: accountTokenResponse },
    });
    renderApp("/login");

    await signInWith("rahman.s@aku.edu", "");

    expect(await screen.findByText("Enter your email and password.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Password"));
    expect(requests).toHaveLength(0);
  });

  it("fetch rejects: says the API can't be reached and points at npm run dev:local", async () => {
    installFakeFetch({ [SIGN_IN]: "network-error" });
    const { router } = renderApp("/login");

    await signInWith("rahman.s@aku.edu", "correct-horse-battery");

    expect(await screen.findByText("Can't reach the API. Start it with `npm run dev:local`.")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("disables Sign in and Create account while the request is pending, and re-enables them after", async () => {
    let answer: (reply: FakeReply) => void = () => {};
    installFakeFetch({
      [SIGN_IN]: () => new Promise<FakeReply>((resolve) => {
        answer = resolve;
      }),
    });
    renderApp("/login");
    const signIn = screen.getByRole("button", { name: "Sign in" });
    const createAccount = screen.getByRole("button", { name: "Create account" });

    await signInWith("rahman.s@aku.edu", "wrong-password-123");

    await waitFor(() => expect(signIn.hasAttribute("disabled")).toBe(true));
    expect(createAccount.hasAttribute("disabled")).toBe(true);

    answer(refusal(401, "INVALID_CREDENTIALS", "Invalid email or password."));

    expect(await screen.findByText("Wrong email or password.")).toBeTruthy();
    expect(signIn.hasAttribute("disabled")).toBe(false);
    expect(createAccount.hasAttribute("disabled")).toBe(false);
  });

  it("clears the previous refusal when the teacher signs in again successfully", async () => {
    let reply: FakeReply = refusal(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    installFakeFetch({
      [SIGN_IN]: async () => reply,
    });
    const user = userEvent.setup();
    const { router } = renderApp("/login");

    await signInWith("rahman.s@aku.edu", "wrong-password-123");
    expect(await screen.findByText("Wrong email or password.")).toBeTruthy();

    reply = { status: 200, body: accountTokenResponse };
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/setup"));
  });
});
