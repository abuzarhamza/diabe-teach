import type { InstructorAccountView } from "../../api/accounts-api.ts";
import type { ApiHttpError } from "../../api/http-client.ts";
import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation } from "react-router";
import { getCurrentAccount } from "../../api/accounts-api.ts";
import { useSignedInAccount } from "../accounts/use-signed-in-account.ts";
import { ErrorBanner } from "./ErrorBanner.tsx";

// The teacher route guard's element; its loader is requireTeacher (require-teacher.ts).

const MAX_RETRIES = 3;

// Confirms the teacher with GET /api/v1/accounts/me while the screen shows. A 401 clears the token
// (http-client.ts); the token expiring, or another tab signing out, clears it too. Any of these makes the
// signed-in teacher null, and this guard then re-opens the current screen so requireTeacher sends the
// teacher to /login with the reason.
export function TeacherRoute() {
  const account = useSignedInAccount();
  const location = useLocation();
  const confirmation = useQuery<InstructorAccountView, ApiHttpError>({
    queryKey: ["accounts", "me", account?.accountId],
    queryFn: getCurrentAccount,
    enabled: account !== null,
    retry: (failureCount, error) => error.status !== 401 && failureCount < MAX_RETRIES,
  });

  if (!account)
    return <Navigate to={location} replace />;

  return (
    <>
      {confirmation.error && confirmation.error.status !== 401 && (
        <ErrorBanner error={confirmation.error} />
      )}
      <Outlet />
    </>
  );
}
