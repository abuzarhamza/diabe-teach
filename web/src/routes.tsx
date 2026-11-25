import type { RouteObject } from "react-router";
import { Navigate } from "react-router";
import { LoginPage } from "./features/accounts/LoginPage.tsx";
import { GameSetupPage } from "./features/game-session/GameSetupPage.tsx";
import { requireTeacher } from "./features/shared/require-teacher.ts";
import { TeacherRoute } from "./features/shared/TeacherRoute.tsx";

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
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
