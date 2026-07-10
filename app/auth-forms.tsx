"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signInAction, signUpAction, type AuthActionState } from "./actions";

const initialState: AuthActionState = {};

function AuthSubmit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="primary-button" type="submit" disabled={pending} aria-busy={pending}>
      <span className="button-content">
        {pending ? <span className="spinner" aria-hidden="true" /> : null}
        {pending ? pendingLabel : label}
      </span>
    </button>
  );
}

export function SignInForm() {
  const [state, formAction] = useFormState(signInAction, initialState);

  return (
    <form className="form-grid" action={formAction}>
      <p className="eyebrow">Sign in</p>
      <h2>Access GridWatch</h2>
      <p className="muted">Sign in to your existing GridWatch account.</p>
      {state.error ? (
        <p className="error" role="alert">
          {state.error}
        </p>
      ) : null}
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <AuthSubmit label="Sign in" pendingLabel="Signing in…" />
    </form>
  );
}

export function SignUpForm() {
  const [state, formAction] = useFormState(signUpAction, initialState);

  return (
    <form className="form-grid" action={formAction}>
      <p className="eyebrow">Create account</p>
      <h2>Sign up with a setup token</h2>
      <p className="notice">
        Public signup is closed. Creating an account requires the private setup token from your
        deployment environment. Each account keeps its own isolated router data.
      </p>
      {state.error ? (
        <p className="error" role="alert">
          {state.error}
        </p>
      ) : null}
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={12} required />
      </label>
      <label className="field">
        <span>Setup token</span>
        <input name="setupToken" type="password" autoComplete="off" required />
      </label>
      <AuthSubmit label="Create account" pendingLabel="Creating account…" />
    </form>
  );
}
