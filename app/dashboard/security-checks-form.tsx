"use client";

import { useFormState, useFormStatus } from "react-dom";
import { runSecurityChecksAction, type SecurityChecksState } from "../actions";

function RunButton({ hasResults }: { hasResults: boolean }) {
  const { pending } = useFormStatus();

  return (
    <>
      <button className="secondary-button" type="submit" disabled={pending} aria-busy={pending}>
        <span className="button-content">
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {pending ? "Running checks…" : hasResults ? "Re-run checks" : "Run vulnerability & exposure checks"}
        </span>
      </button>
      {pending ? (
        <p className="pending-note" role="status" aria-live="polite">
          Querying NIST NVD for known router vulnerabilities, Shodan InternetDB for public exposure, and
          AbuseIPDB for your public IP&apos;s reputation. This can take a few seconds.
        </p>
      ) : null}
    </>
  );
}

export function SecurityChecksForm({ hasResults }: { hasResults: boolean }) {
  const [state, formAction] = useFormState<SecurityChecksState, FormData>(runSecurityChecksAction, {});

  return (
    <form action={formAction} className="stack">
      {state?.error ? <p className="error">{state.error}</p> : null}
      <RunButton hasResults={hasResults} />
    </form>
  );
}
