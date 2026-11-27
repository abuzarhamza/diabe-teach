import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "../../support/render-app.tsx";

const ACCOUNT_KEY = "cc-account-token-v1";

const storedAccount = {
  accountId: "acc_01",
  email: "rahman.s@aku.edu",
  accountToken: "header.payload.signature",
  expiresAt: "2099-01-01T12:00:00.000Z",
};

function storeAccount(value: unknown) {
  localStorage.setItem(ACCOUNT_KEY, typeof value === "string"
    ? value
    : JSON.stringify(value));
}

// What the browser does in this tab when another tab changes localStorage.
function anotherTabChanges(key: string, newValue: string | null) {
  const oldValue = localStorage.getItem(key);
  if (newValue === null)
    localStorage.removeItem(key);
  else
    localStorage.setItem(key, newValue);
  act(() => {
    window.dispatchEvent(new StorageEvent("storage", {
      key,
      oldValue,
      newValue,
      storageArea: localStorage,
    }));
  });
}

describe("signed-in panel and Sign out (react-login-screen 04)", () => {
  it("shows \"Signed in as <email>\" instead of the form when a valid Account Token is stored", () => {
    storeAccount(storedAccount);
    renderApp("/login");

    expect(screen.getByText("Signed in as")).toBeTruthy();
    expect(screen.getByText("rahman.s@aku.edu")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("goes to Game Setup from Continue to Game setup", async () => {
    storeAccount(storedAccount);
    const user = userEvent.setup();
    const { router } = renderApp("/login");

    await user.click(screen.getByRole("link", { name: /Continue to Game setup/ }));

    expect(await screen.findByRole("heading", { name: "Game setup" })).toBeTruthy();
    expect(router.state.location.pathname).toBe("/setup");
  });

  it.each([
    [
      "past expiresAt",
      { ...storedAccount, expiresAt: "2000-01-01T00:00:00.000Z" },
    ],
    [
      "unreadable expiresAt",
      { ...storedAccount, expiresAt: "soon" },
    ],
    [
      "missing accountToken",
      { ...storedAccount, accountToken: undefined },
    ],
    ["not JSON", "{not json"],
    ["JSON null", "null"],
  ])("shows the form when the stored token is %s", (_case, value) => {
    storeAccount(value);
    renderApp("/login");

    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByText("Signed in as")).toBeNull();
  });

  it("signs out: removes the Account Token, shows the form and puts the cursor in Email", async () => {
    storeAccount(storedAccount);
    const user = userEvent.setup();
    renderApp("/login");

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    const email = screen.getByLabelText("Email");
    expect(document.activeElement).toBe(email);
    expect(screen.queryByText("Signed in as")).toBeNull();
  });

  it("switches to the form when another tab signs out", () => {
    storeAccount(storedAccount);
    renderApp("/login");
    expect(screen.getByText("rahman.s@aku.edu")).toBeTruthy();

    anotherTabChanges(ACCOUNT_KEY, null);

    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.queryByText("Signed in as")).toBeNull();
  });

  it("switches to the signed-in panel when another tab signs in", async () => {
    renderApp("/login");
    expect(screen.getByLabelText("Email")).toBeTruthy();

    anotherTabChanges(ACCOUNT_KEY, JSON.stringify(storedAccount));

    await waitFor(() => expect(screen.getByText("rahman.s@aku.edu")).toBeTruthy());
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("ignores storage events for other keys, such as a Capability Token (ADR-0007)", () => {
    storeAccount(storedAccount);
    renderApp("/login");

    anotherTabChanges("cc-capability-token-v1", "capability.token.value");

    expect(screen.getByText("rahman.s@aku.edu")).toBeTruthy();
    expect(localStorage.getItem(ACCOUNT_KEY)).not.toBeNull();
  });
});
