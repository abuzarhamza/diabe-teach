import type { RouteObject } from "react-router";
import { Navigate } from "react-router";
import { LoginPage } from "./features/accounts/LoginPage.tsx";
import { GameSetupPage } from "./features/game-session/GameSetupPage.tsx";
import { SessionShellPage } from "./features/game-session/SessionShellPage.tsx";
import { PackDetailPage } from "./features/packs/PackDetailPage.tsx";
import { PackEditorPage, PackVersionEditorPage } from "./features/packs/PackEditorPage.tsx";
import { PackLibraryPage } from "./features/packs/PackLibraryPage.tsx";
import { requireTeacher } from "./features/shared/require-teacher.ts";
import { TeacherRoute } from "./features/shared/TeacherRoute.tsx";

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  // In-game screens use the tab's Capability Token seat (session-seat-store.ts), not the Account Token.
  { path: "/sessions/:sessionId", element: <SessionShellPage /> },
  // Teacher-only screens: signed-out teachers are sent to /login with the reason.
  {
    loader: requireTeacher,
    element: <TeacherRoute />,
    // Shown while requireTeacher decides, before the first screen opens: nothing.
    hydrateFallbackElement: <></>,
    children: [
      { path: "/setup", element: <GameSetupPage /> },
      { path: "/packs", element: <PackLibraryPage /> },
      // The Pack Editor; React Router ranks this static path above /packs/:packId.
      { path: "/packs/new", element: <PackEditorPage /> },
      { path: "/packs/:packId", element: <PackDetailPage /> },
      // Edit → save as new version: the Pack Editor prefilled from the pack, read again on a reload.
      { path: "/packs/:packId/new-version", element: <PackVersionEditorPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
];
