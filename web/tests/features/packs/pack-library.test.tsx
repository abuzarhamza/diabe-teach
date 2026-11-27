import type { FakeReply } from "../../support/fake-fetch.ts";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeFetch } from "../../support/fake-fetch.ts";
import {
  ACCOUNT_KEY,
  archivedPack,
  instructorAccountView,
  packListReply,
  signInTeacher,
  systemPack,
  thyroidPack,
} from "../../support/pack-fixtures.ts";
import { renderApp } from "../../support/render-app.tsx";

const me = { status: 200, body: instructorAccountView };

// GET /api/v1/packs answers from `current()` each time, so a test can change the library mid-test.
function liveList(current: () => unknown[]): () => Promise<FakeReply> {
  return async () => packListReply(current());
}

function packItem(title: string): HTMLElement {
  return screen.getByRole("listitem", { name: title });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pack Library at /packs (react-web-ui 03)", () => {
  it("lists the active Curriculum Packs with their byline, without sending the Account Token", async () => {
    const requests = installFakeFetch({
      "GET /api/v1/accounts/me": me,
      "GET /api/v1/packs": packListReply([systemPack, thyroidPack]),
    });
    signInTeacher();
    renderApp("/packs");

    expect(await screen.findByRole("heading", { name: "Pack Library" })).toBeTruthy();
    await screen.findByRole("listitem", { name: "Thyroid basics" });
    expect(within(packItem("Thyroid basics")).getByText("by rahman.s · v1.1.0")).toBeTruthy();
    expect(within(packItem("Diabe-teach")).getByText("by unknown · v1.0.0")).toBeTruthy();
    const list = requests.find(r => r.path === "/api/v1/packs")!;
    expect(list.method).toBe("GET");
    expect(list.query).toEqual({});
    expect(list.headers.authorization).toBeUndefined();
  });

  it("sends includeArchived=true when \"Show archived\" is ticked, and lists the archived packs", async () => {
    const requests = installFakeFetch({
      "GET /api/v1/accounts/me": me,
      "GET /api/v1/packs": async request => packListReply(request.query.includeArchived === "true"
        ? [thyroidPack, archivedPack]
        : [thyroidPack]),
    });
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs");
    await screen.findByRole("listitem", { name: "Thyroid basics" });
    expect(screen.queryByRole("listitem", { name: "Old renal pack" })).toBeNull();

    await user.click(screen.getByRole("checkbox", { name: "Show archived" }));

    expect(await screen.findByRole("listitem", { name: "Old renal pack" })).toBeTruthy();
    expect(within(packItem("Old renal pack")).getByText("Archived")).toBeTruthy();
    expect(requests.filter(r => r.path === "/api/v1/packs").map(r => r.query)).toEqual([
      {},
      { includeArchived: "true" },
    ]);
  });

  it("archives a pack with the Account Token and refreshes the list", async () => {
    let library = [thyroidPack];
    const requests = installFakeFetch({
      "GET /api/v1/accounts/me": me,
      "GET /api/v1/packs": liveList(() => library),
      "POST /api/v1/packs/thyroid-basics/archive": async () => {
        library = [];
        return {
          status: 200,
          body: {
            packId: "thyroid-basics",
            isArchived: true,
            archivedAt: "2026-11-27T10:00:00.000Z",
            archivedBy: "acc_01",
          },
        };
      },
    });
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs");
    await screen.findByRole("listitem", { name: "Thyroid basics" });

    await user.click(screen.getByRole("button", { name: "Archive pack Thyroid basics" }));

    await waitFor(() => expect(screen.queryByRole("listitem", { name: "Thyroid basics" })).toBeNull());
    const archive = requests.find(r => r.path === "/api/v1/packs/thyroid-basics/archive")!;
    expect(archive.method).toBe("POST");
    expect(archive.headers.authorization).toBe("Bearer account.header.signature");
    expect(requests.filter(r => r.path === "/api/v1/packs")).toHaveLength(2);
  });

  it("unarchives an archived pack with the Account Token and refreshes the list", async () => {
    let library = [thyroidPack, archivedPack];
    const requests = installFakeFetch({
      "GET /api/v1/accounts/me": me,
      "GET /api/v1/packs": liveList(() => library),
      "POST /api/v1/packs/old-renal/unarchive": async () => {
        library = [
          thyroidPack,
          { ...archivedPack, isArchived: false },
        ];
        return {
          status: 200,
          body: {
            packId: "old-renal",
            isArchived: false,
            unarchivedAt: "2026-11-27T10:00:00.000Z",
            unarchivedBy: "acc_01",
          },
        };
      },
    });
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs");
    await screen.findByRole("listitem", { name: "Thyroid basics" });
    await user.click(screen.getByRole("checkbox", { name: "Show archived" }));
    await screen.findByRole("listitem", { name: "Old renal pack" });

    await user.click(screen.getByRole("button", { name: "Unarchive pack Old renal pack" }));

    await waitFor(() => expect(within(packItem("Old renal pack")).queryByText("Archived")).toBeNull());
    const unarchive = requests.find(r => r.path === "/api/v1/packs/old-renal/unarchive")!;
    expect(unarchive.method).toBe("POST");
    expect(unarchive.headers.authorization).toBe("Bearer account.header.signature");
    expect(requests.filter(r => r.path === "/api/v1/packs").map(r => r.query)).toEqual([
      {},
      { includeArchived: "true" },
      { includeArchived: "true" },
    ]);
    expect(within(packItem("Old renal pack")).getByRole("button", { name: "Archive pack Old renal pack" })).toBeTruthy();
  });

  it("shows no Archive or Unarchive control on a System Pack", async () => {
    installFakeFetch({
      "GET /api/v1/accounts/me": me,
      "GET /api/v1/packs": packListReply([
        systemPack,
        {
          ...systemPack,
          id: "old-system",
          title: "Old system pack",
          isArchived: true,
        },
        thyroidPack,
      ]),
    });
    signInTeacher();
    renderApp("/packs");
    await screen.findByRole("listitem", { name: "Diabe-teach" });

    expect(within(packItem("Diabe-teach")).getByText("System Pack")).toBeTruthy();
    for (const title of ["Diabe-teach", "Old system pack"]) {
      expect(within(packItem(title)).queryByRole("button", { name: /archive/i })).toBeNull();
    }
    expect(within(packItem("Thyroid basics")).getByRole("button", { name: "Archive pack Thyroid basics" })).toBeTruthy();
  });

  it("explains a 403 PACK_IS_SYSTEM_PACK in the ErrorBanner when the flag was missed", async () => {
    installFakeFetch({
      "GET /api/v1/accounts/me": me,
      "GET /api/v1/packs": packListReply([thyroidPack]),
      "POST /api/v1/packs/thyroid-basics/archive": {
        status: 403,
        body: { code: "PACK_IS_SYSTEM_PACK", message: "System Packs cannot be archived.", details: null },
      },
    });
    signInTeacher();
    const user = userEvent.setup();
    renderApp("/packs");
    await screen.findByRole("listitem", { name: "Thyroid basics" });

    await user.click(screen.getByRole("button", { name: "Archive pack Thyroid basics" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Built-in System Packs can't be archived or given new versions."));
    expect(screen.getByRole("listitem", { name: "Thyroid basics" })).toBeTruthy();
  });

  it("links \"Start Game with Pack\" to Game Setup with the pack's id", async () => {
    installFakeFetch({
      "GET /api/v1/accounts/me": me,
      "GET /api/v1/packs": packListReply([thyroidPack, archivedPack]),
    });
    signInTeacher();
    const user = userEvent.setup();
    const { router } = renderApp("/packs");
    await screen.findByRole("listitem", { name: "Thyroid basics" });

    expect(within(packItem("Old renal pack")).queryByRole("link", { name: /start game/i })).toBeNull();
    await user.click(within(packItem("Thyroid basics")).getByRole("link", { name: "Start Game with Pack Thyroid basics" }));

    expect(router.state.location.pathname).toBe("/setup");
    expect(router.state.location.search).toBe("?packId=thyroid-basics");
  });

  it("sends a signed-out teacher to /login with \"Sign in to continue.\"", async () => {
    const requests = installFakeFetch({});
    const { router } = renderApp("/packs");

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Sign in to continue.");
    expect(router.state.location.pathname).toBe("/login");
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    expect(requests).toEqual([]);
  });
});
