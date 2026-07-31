import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getLatestRouterProfile } from "@/lib/router-profile";
import { SignUpForm } from "../auth-forms";
import { AuthShell } from "../auth-shell";

export default async function SignUpPage() {
  // Already signed in? There's nothing to create — send them to their landing page.
  const user = await getCurrentUser();
  if (user) {
    const profile = await getLatestRouterProfile(user.id);
    redirect(profile ? "/dashboard" : "/setup");
  }

  return (
    <AuthShell>
      <div className="stack">
        <SignUpForm />
        <p className="muted auth-switch">
          Already have an account? <Link href="/">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
}
