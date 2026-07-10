import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SignInForm, SignUpForm } from "./auth-forms";

export default async function HomePage() {
  const user = await getCurrentUser();

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
              <strong>Per user</strong>
              <span className="muted">Each account is isolated</span>
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
                <h2>Welcome back</h2>
                <p className="muted">You are signed in as {user.email}.</p>
                <Link className="primary-button" href="/dashboard">
                  Open security dashboard
                </Link>
              </div>
            ) : (
              <div className="stack">
                <SignInForm />
                <SignUpForm />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

