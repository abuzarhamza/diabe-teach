import type { FormEvent } from "react";
import type { StoredAccount } from "../../api/account-token-store.ts";
import type { ApiHttpError } from "../../api/http-client.ts";
import type { LoginErrorView, LoginField } from "../../domain/login-errors.ts";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { signInInstructor } from "../../api/accounts-api.ts";
import { loginErrorView, signInCredentialsProblem } from "../../domain/login-errors.ts";
import { ErrorBanner } from "../shared/ErrorBanner.tsx";

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

// Teacher login (claudPoc/concept-chain/login.html): sign in to an Instructor Account, then Game Setup.
export function LoginPage() {
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // A refusal found before anything is sent (empty field); server refusals come from the mutation.
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

  // Derived during render: the sentence to show, from the local check or the server's refusal.
  const shown = localProblem ?? (signIn.error
    ? loginErrorView(signIn.error)
    : null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const credentials = credentialsFrom(event.currentTarget);
    const problem = signInCredentialsProblem(credentials.email, credentials.password);
    setLocalProblem(problem);
    if (problem) {
      signIn.reset();
      focusField(problem.focusField);
      return;
    }
    signIn.mutate(credentials);
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

        <form className="col" noValidate onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input ref={emailRef} type="email" id="email" name="email" maxLength={254} autoComplete="username" required placeholder="name@school.org" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input ref={passwordRef} type="password" id="password" name="password" maxLength={1024} autoComplete="current-password" required />
          </div>
          <div className="row">
            <button className="btn primary" type="submit" disabled={signIn.isPending}>Sign in</button>
            <button className="btn" type="button" disabled={signIn.isPending}>Create account</button>
          </div>
          <ErrorBanner sentence={shown?.sentence} error={localProblem ? null : signIn.error} />
        </form>

        <p className="foot">Learners don't sign in: they join with the room code on the learner screen.</p>
      </section>
    </div>
  );
}
