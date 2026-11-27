import type { RouteObject } from "react-router";
import { Navigate } from "react-router";
import { LoginPage } from "./features/accounts/LoginPage.tsx";
import { GameSetupPage } from "./features/game-session/GameSetupPage.tsx";
import { SessionShellPage } from "./features/game-session/SessionShellPage.tsx";
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
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
];
