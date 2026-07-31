import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SignInForm } from "./auth-forms";
import { AuthShell } from "./auth-shell";
import { signOutAction } from "./actions";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <AuthShell>
      {user ? (
        <div className="stack">
          <p className="eyebrow">Authenticated</p>
          <h2>Welcome back</h2>
          <p className="muted">You are signed in as {user.email}.</p>
          <Link className="primary-button" href="/dashboard">
            Open security dashboard
          </Link>
          <form action={signOutAction}>
            <button className="secondary-button" type="submit">Sign out</button>
          </form>
        </div>
      ) : (
        <div className="stack">
          <SignInForm />
          <p className="muted auth-switch">
            First-time setup? <Link href="/signup">Create your account</Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
