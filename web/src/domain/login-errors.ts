// Login refusals as the teacher reads them (react-login-screen spec, "Error to message mapping").
// Pure rules: no React, no fetch, no storage. The wording copies the prototype's loginErrorText
// (claudPoc/concept-chain/account-api.js) so both screens say the same thing.

export type LoginField = "email" | "password";

// What the screen shows for a refusal, and the field the cursor goes to (null: no field to fix).
export interface LoginErrorView {
  sentence: string;
  focusField: LoginField | null;
}

// The shape of an API refusal (ApiHttpError satisfies it), kept structural so this layer never imports the API layer.
export interface ApiRefusal {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
}

export const EMPTY_CREDENTIALS_SENTENCE = "Enter your email and password.";

// "HH:MM" in the browser's local time zone, or null when the value is not a readable time.
function localHhMm(value: unknown): string | null {
  if (typeof value !== "string")
    return null;
  const time = new Date(value);
  if (Number.isNaN(time.getTime()))
    return null;
  return `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
}

export function loginErrorView(error: ApiRefusal): LoginErrorView {
  switch (error.code) {
    // Same sentence for an unknown email and a wrong password: the screen never reveals which emails exist.
    case "INVALID_CREDENTIALS":
      return { sentence: "Wrong email or password.", focusField: "password" };
    case "ACCOUNT_TEMPORARILY_LOCKED": {
      const until = localHhMm(error.details?.lockedUntil);
      return {
        sentence: `Too many wrong passwords: sign-in is temporarily locked${until
          ? ` until ${until}`
          : ""}. Try again later.`,
        focusField: "password",
      };
    }
    case "NETWORK_ERROR":
      return { sentence: "Can't reach the API. Start it with `npm run dev:local`.", focusField: null };
    default:
      return { sentence: error.message, focusField: null };
  }
}

// Sign-in checks only that both fields are filled: anything else gets the API's single 401 INVALID_CREDENTIALS.
export function signInCredentialsProblem(email: string, password: string): LoginErrorView | null {
  if (!email.trim())
    return { sentence: EMPTY_CREDENTIALS_SENTENCE, focusField: "email" };
  if (!password)
    return { sentence: EMPTY_CREDENTIALS_SENTENCE, focusField: "password" };
  return null;
}
