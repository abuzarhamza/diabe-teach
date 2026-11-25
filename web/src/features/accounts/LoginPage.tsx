import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { signInInstructor } from "../../api/accounts-api.ts";

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
  const signIn = useMutation({
    mutationFn: ({ email, password }: Credentials) => signInInstructor(email, password),
    onSuccess: () => navigate("/setup"),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signIn.mutate(credentialsFrom(event.currentTarget));
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
            <input type="email" id="email" name="email" maxLength={254} autoComplete="username" required placeholder="name@school.org" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" name="password" maxLength={1024} autoComplete="current-password" required />
          </div>
          <div className="row">
            <button className="btn primary" type="submit">Sign in</button>
            <button className="btn" type="button">Create account</button>
          </div>
          <div className={signIn.error ? "toast err" : "toast"} role="status" aria-live="polite">
            {signIn.error?.message}
          </div>
        </form>

        <p className="foot">Learners don't sign in: they join with the room code on the learner screen.</p>
      </section>
    </div>
  );
}
