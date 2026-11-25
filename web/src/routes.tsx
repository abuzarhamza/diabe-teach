import type { RouteObject } from "react-router";
import { Navigate } from "react-router";
import { LoginPage } from "./features/accounts/LoginPage.tsx";
import { GameSetupPage } from "./features/game-session/GameSetupPage.tsx";

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  { path: "/setup", element: <GameSetupPage /> },
  { path: "*", element: <Navigate to="/login" replace /> },
];
