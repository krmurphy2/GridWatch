"use client";

import { useFormStatus } from "react-dom";

export function ExtractSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <>
      <button className="primary-button" type="submit" disabled={pending} aria-busy={pending}>
        <span className="button-content">
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {pending ? "Extracting router details…" : "Extract and save router profile"}
        </span>
      </button>
      {pending ? (
        <p className="pending-note" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          Uploading your screenshot and asking the extraction agent to read it. This can take a few seconds — please keep this tab open.
        </p>
      ) : null}
    </>
  );
}
