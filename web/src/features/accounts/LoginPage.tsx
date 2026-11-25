import type { FormEvent, MouseEvent } from "react";
import type { StoredAccount } from "../../api/account-token-store.ts";
import type { ApiHttpError } from "../../api/http-client.ts";
import type { LoginErrorView, LoginField } from "../../domain/login-errors.ts";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { clearAccount } from "../../api/account-token-store.ts";
import { signInInstructor, signUpInstructor } from "../../api/accounts-api.ts";
import { loginErrorView, MIN_PASSWORD_LENGTH, signInCredentialsProblem, signUpCredentialsProblem } from "../../domain/login-errors.ts";
import { ErrorBanner } from "../shared/ErrorBanner.tsx";
import { useSignedInAccount } from "./use-signed-in-account.ts";

interface Credentials {
  email: string;
  password: string;
}

function credentialsFrom(form: HTMLFormElement): Credentials {
  const data = new FormData(form);
  return {
    email: String(data.get("email") ?? ""),
    password: String(data.get("password") ?? ""),
  };
}

// Teacher login (claudPoc/concept-chain/login.html): sign in to an Instructor Account, or create one
// (sign-up signs the teacher in at once), then Game Setup.
// A teacher who is already signed in sees the signed-in panel instead of the form.
export function LoginPage() {
  const navigate = useNavigate();
  const account = useSignedInAccount();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const focusEmailOnShowRef = useRef(false);
  // A refusal found before anything is sent (pre-checks); server refusals come from the mutations.
  const [localProblem, setLocalProblem] = useState<LoginErrorView | null>(null);

  function focusField(field: LoginField | null) {
    if (field === "email")
      emailRef.current?.focus();
    else if (field === "password")
      passwordRef.current?.focus();
  }

  const signIn = useMutation<StoredAccount, ApiHttpError, Credentials>({
    mutationFn: ({ email, password }) => signInInstructor(email, password),
    onSuccess: () => navigate("/setup"),
    onError: error => focusField(loginErrorView(error).focusField),
  });

  const signUp = useMutation<StoredAccount, ApiHttpError, Credentials>({
    mutationFn: ({ email, password }) => signUpInstructor(email, password),
    onSuccess: () => navigate("/setup"),
    onError: error => focusField(loginErrorView(error).focusField),
  });

  // Derived during render: only one mutation holds an error at a time (each send resets the other).
  const isPending = signIn.isPending || signUp.isPending;
  const serverError = signIn.error ?? signUp.error;
  const shown = localProblem ?? (serverError
    ? loginErrorView(serverError)
    : null);

  // Runs the pre-check, then sends with `send` (one mutation) after clearing every earlier refusal.
  function attempt(credentials: Credentials, problem: LoginErrorView | null, send: typeof signIn) {
    setLocalProblem(problem);
    signIn.reset();
    signUp.reset();
    if (problem) {
      focusField(problem.focusField);
      return;
    }
    send.mutate(credentials);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const credentials = credentialsFrom(event.currentTarget);
    attempt(credentials, signInCredentialsProblem(credentials.email, credentials.password), signIn);
  }

  function handleCreateAccount(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form)
      return;
    const credentials = credentialsFrom(form);
    attempt(credentials, signUpCredentialsProblem(credentials.email, credentials.password), signUp);
  }

  function handleSignOut() {
    // The Email field does not exist until the form renders, so its ref callback takes the cursor then.
    focusEmailOnShowRef.current = true;
    clearAccount();
  }

  function attachEmail(input: HTMLInputElement | null) {
    emailRef.current = input;
    if (input && focusEmailOnShowRef.current) {
      focusEmailOnShowRef.current = false;
      input.focus();
    }
  }

  return (
    <div className="wrap">
      <section className="panel login">
        <div className="brand">
          <h1>
            Concept
            {" "}
            <span>Chain</span>
          </h1>
          <p>Teacher login</p>
        </div>

        {account
          ? (
              <div className="col">
                <p>
                  Signed in as
                  {" "}
                  <b>{account.email}</b>
                </p>
                <div className="row">
                  <Link className="btn primary" to="/setup">Continue to Game setup →</Link>
                  <button className="btn sm" type="button" onClick={handleSignOut}>Sign out</button>
                </div>
              </div>
            )
          : (
              <form className="col" noValidate onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input ref={attachEmail} type="email" id="email" name="email" maxLength={254} autoComplete="username" required placeholder="name@school.org" />
                </div>
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <input ref={passwordRef} type="password" id="password" name="password" maxLength={1024} autoComplete="current-password" required aria-describedby="password-hint" />
                  <span className="note" id="password-hint">{`At least ${MIN_PASSWORD_LENGTH} characters.`}</span>
                </div>
                <div className="row">
                  <button className="btn primary" type="submit" disabled={isPending}>Sign in</button>
                  <button className="btn" type="button" disabled={isPending} onClick={handleCreateAccount}>Create account</button>
                </div>
                <ErrorBanner sentence={shown?.sentence} error={localProblem ? null : serverError} />
              </form>
            )}

        <p className="foot">Learners don't sign in: they join with the room code on the learner screen.</p>
      </section>
    </div>
  );
}
