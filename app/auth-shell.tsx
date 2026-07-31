import type { ReactNode } from "react";

// Shared chrome for the sign-in and sign-up pages: the marketing hero on the left
// and a single focused card on the right. Keeping it in one place means the two
// auth pages stay visually consistent.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="page-shell">
      <div className="container hero">
        <section>
          <p className="eyebrow">External-first home network security</p>
          <h1>GridWatch</h1>
          <p className="lead">
            Understand your router&apos;s risk and public internet exposure in plain English — from your
            browser, with no software to install.
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
              <strong>Read-only</strong>
              <span className="muted">Nothing is actively scanned</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-inner">{children}</div>
        </section>
      </div>
    </main>
  );
}
