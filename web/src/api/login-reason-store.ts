// "Why you were sent here": the one-shot reason the Login screen shows once, kept in sessionStorage.
// The key and the sentences are the prototype's (claudPoc/concept-chain/account-api.js: setLoginMessage,
// takeLoginMessage, requireTeacher), so both screens say the same thing.

export const LOGIN_REASON_KEY = "cc-login-message-v1";

export const SIGN_IN_TO_CONTINUE = "Sign in to continue.";
export const SIGN_IN_EXPIRED = "Your sign-in has expired. Sign in again.";
export const SIGN_IN_NOT_ACCEPTED = "Your sign-in was not accepted (expired or signed out elsewhere). Sign in again.";

export function setLoginReason(sentence: string): void {
  sessionStorage.setItem(LOGIN_REASON_KEY, sentence);
}

// Keeps a reason already waiting (the more specific "not accepted" from a 401 wins over the guard's own).
export function setLoginReasonUnlessPending(sentence: string): void {
  if (sessionStorage.getItem(LOGIN_REASON_KEY) === null)
    setLoginReason(sentence);
}

// A deliberate Sign out from a teacher screen: leaves an empty reason waiting, so the teacher route
// guard adds none (setLoginReasonUnlessPending keeps it) and the Login screen shows no warning.
export function markSignedOutOnPurpose(): void {
  setLoginReason("");
}

// Reads the reason and removes it, so it is shown once: a reload of /login finds nothing.
export function takeLoginReason(): string | null {
  const sentence = sessionStorage.getItem(LOGIN_REASON_KEY);
  sessionStorage.removeItem(LOGIN_REASON_KEY);
  return sentence;
}
