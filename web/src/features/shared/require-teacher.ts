import { redirect } from "react-router";
import { signedOutCause } from "../../api/account-token-store.ts";
import { setLoginReasonUnlessPending, SIGN_IN_EXPIRED, SIGN_IN_TO_CONTINUE } from "../../api/login-reason-store.ts";

// The teacher route guard (prototype: requireTeacher in claudPoc/concept-chain/account-api.js).
// Teacher-only screens are children of one route with this loader and element:
//   { loader: requireTeacher, element: <TeacherRoute />, children: [...] }

// Runs before a teacher screen opens: with no valid Account Token, it leaves the reason for the Login
// screen ("Sign in to continue." / expired) and redirects there. A reason already waiting (a 401's
// "not accepted") is kept.
export function requireTeacher() {
  const cause = signedOutCause();
  if (!cause)
    return null;
  setLoginReasonUnlessPending(cause === "expired"
    ? SIGN_IN_EXPIRED
    : SIGN_IN_TO_CONTINUE);
  return redirect("/login");
}
