import { useNavigate } from "react-router";
import { clearAccount } from "../../api/account-token-store.ts";
import { markSignedOutOnPurpose } from "../../api/login-reason-store.ts";
import { useSignedInAccount } from "../accounts/use-signed-in-account.ts";

// The bar at the top of every teacher-only screen: who is signed in, and Sign out.
export function TopBar() {
  const account = useSignedInAccount();
  const navigate = useNavigate();

  // Say first that this sign-out is on purpose: the teacher route guard may see the missing token
  // before the move to /login renders, and must not then show "Sign in to continue.".
  function handleSignOut() {
    markSignedOutOnPurpose();
    clearAccount();
    navigate("/login", { replace: true });
  }

  if (!account)
    return null;

  return (
    <header className="top">
      <p>
        Signed in as
        {" "}
        <b>{account.email}</b>
      </p>
      <button className="btn sm" type="button" onClick={handleSignOut}>Sign out</button>
    </header>
  );
}
