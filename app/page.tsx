import Link from "next/link";
import { getCurrentUser, getUserCount } from "@/lib/auth";
import { setupFirstUserAction, signInAction } from "./actions";

export default async function HomePage() {
  const [user, userCount] = await Promise.all([getCurrentUser(), getUserCount()]);
  const needsFirstUser = userCount === 0;

  return (
    <main className="page-shell">
      <div className="container hero">
        <section>
          <p className="eyebrow">External-first home network security</p>
          <h1>GridWatch setup console</h1>
          <p className="lead">
            Upload router admin screenshots, extract the useful security details, and capture explicit approval before any public-IP exposure scan is attempted.
          </p>
          <div className="kpi-grid">
            <div className="kpi">
              <strong>1 user</strong>
              <span className="muted">No public signup path</span>
            </div>
            <div className="kpi">
              <strong>Server-side</strong>
              <span className="muted">Tokens stay off the browser</span>
            </div>
            <div className="kpi">
              <strong>Approval</strong>
              <span className="muted">Scan consent is retained</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-inner">
            {user ? (
              <div className="stack">
                <p className="eyebrow">Authenticated</p>
                <h2>Continue setup</h2>
                <p className="muted">You are signed in as {user.email}.</p>
                <Link className="primary-button" href="/setup">
                  Open information gathering
                </Link>
              </div>
            ) : needsFirstUser ? (
              <FirstUserForm />
            ) : (
              <SignInForm />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function FirstUserForm() {
  return (
    <form className="form-grid" action={setupFirstUserAction}>
      <p className="eyebrow">First user setup</p>
      <h2>Create the only allowed user</h2>
      <p className="notice">
        Public signup is disabled. This form only works while no users exist and requires the private setup token from your Vercel environment.
      </p>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={12} required />
      </label>
      <label className="field">
        <span>First user setup token</span>
        <input name="setupToken" type="password" autoComplete="off" required />
      </label>
      <button className="primary-button" type="submit">Create secure user</button>
    </form>
  );
}

function SignInForm() {
  return (
    <form className="form-grid" action={signInAction}>
      <p className="eyebrow">Sign in</p>
      <h2>Access GridWatch</h2>
      <p className="muted">Only the first configured user can access this MVP deployment.</p>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button className="primary-button" type="submit">Sign in</button>
    </form>
  );
}
