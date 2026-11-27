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

// The sentence for a request that never reached the API (NETWORK_ERROR), on every screen.
export const NETWORK_ERROR_SENTENCE = "Can't reach the API. Start it with `npm run dev:local`.";

// The API's sign-up rules (docs/api/openapi.yaml, /api/v1/accounts/sign-up), checked before anything is sent.
export const MIN_PASSWORD_LENGTH = 10;
// The same shape the server checks (src/domain/instructor-account/account-email.ts).
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

// The sentence for a field the sign-up rules refuse, whether found here or named by the server's details.field.
const FIELD_SENTENCES: Record<LoginField, string> = {
  email: "Enter a valid email address, like name@school.org.",
  password: `Password too short: use at least ${MIN_PASSWORD_LENGTH} characters.`,
};

function isLoginField(value: unknown): value is LoginField {
  return value === "email" || value === "password";
}

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
    case "EMAIL_ALREADY_REGISTERED":
      return { sentence: "That email is already registered. Sign in instead.", focusField: "email" };
    case "INVALID_REQUEST_BODY": {
      const field = error.details?.field;
      return isLoginField(field)
        ? { sentence: FIELD_SENTENCES[field], focusField: field }
        : { sentence: error.message, focusField: null };
    }
    case "NETWORK_ERROR":
      return { sentence: NETWORK_ERROR_SENTENCE, focusField: null };
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

// Sign-up refuses locally what the API would refuse with 400 INVALID_REQUEST_BODY: an email not shaped like
// x@y.z (after trimming) and a password under MIN_PASSWORD_LENGTH characters. The email is checked first.
export function signUpCredentialsProblem(email: string, password: string): LoginErrorView | null {
  if (!EMAIL_SHAPE.test(email.trim()))
    return { sentence: FIELD_SENTENCES.email, focusField: "email" };
  if (password.length < MIN_PASSWORD_LENGTH)
    return { sentence: FIELD_SENTENCES.password, focusField: "password" };
  return null;
}
