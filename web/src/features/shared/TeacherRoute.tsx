import { Navigate, Outlet, useLocation } from "react-router";
import { useCurrentAccount } from "../accounts/account-hooks.ts";
import { useSignedInAccount } from "../accounts/use-signed-in-account.ts";
import { ErrorBanner } from "./ErrorBanner.tsx";
import { TopBar } from "./TopBar.tsx";

// The teacher route guard's element; its loader is requireTeacher (require-teacher.ts).

// Confirms the teacher with GET /api/v1/accounts/me while the screen shows. A 401 clears the token
// (http-client.ts); the token expiring, or another tab signing out, clears it too. Any of these makes the
// signed-in teacher null, and this guard then re-opens the current screen so requireTeacher sends the
// teacher to /login with the reason.
export function TeacherRoute() {
  const account = useSignedInAccount();
  const location = useLocation();
  const confirmation = useCurrentAccount(account);

  if (!account)
    return <Navigate to={location} replace />;

  return (
    <>
      <TopBar />
      {confirmation.error && confirmation.error.status !== 401 && (
        <ErrorBanner error={confirmation.error} />
      )}
      <Outlet />
    </>
  );
}
