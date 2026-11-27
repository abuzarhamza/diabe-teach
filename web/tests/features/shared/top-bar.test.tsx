import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeFetch } from "../../support/fake-fetch.ts";
import { renderApp } from "../../support/render-app.tsx";

const ACCOUNT_KEY = "cc-account-token-v1";

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

// A signed-in teacher opens /setup; the server confirms the token.
function openSetupSignedIn() {
  installFakeFetch({
    "GET /api/v1/accounts/me": { status: 200, body: instructorAccountView },
  });
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(storedAccount));
  return renderApp("/setup");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("top bar on teacher screens", () => {
  it("shows who is signed in", async () => {
    openSetupSignedIn();

    expect(await screen.findByText("rahman.s@aku.edu")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("signs out to the Login form with no warning", async () => {
    const { router } = openSetupSignedIn();

    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(await screen.findByLabelText("Email")).toBeTruthy();
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("links to the Pack Library from every teacher screen", async () => {
    const { router } = openSetupSignedIn();

    await userEvent.click(await screen.findByRole("link", { name: "Packs" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/packs"));
    expect(await screen.findByRole("heading", { name: "Pack Library" })).toBeTruthy();
  });
});
