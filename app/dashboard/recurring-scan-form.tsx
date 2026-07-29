"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  runRecurringScanNowAction,
  updateScanScheduleAction,
  type RunNowState,
  type ScanScheduleState
} from "../actions";
import type { NotificationPayload } from "@/lib/types";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="secondary-button" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Saving…" : "Save schedule"}
    </button>
  );
}

function RunNowButton() {
  const { pending } = useFormStatus();
  return (
    <button className="secondary-button" type="submit" disabled={pending} aria-busy={pending}>
      <span className="button-content">
        {pending ? <span className="spinner" aria-hidden="true" /> : null}
        {pending ? "Running scan & sending…" : "Run scan & email now"}
      </span>
    </button>
  );
}

export function RecurringScanForm({
  enabled,
  email,
  lastNotification
}: {
  enabled: boolean;
  email: string;
  lastNotification: NotificationPayload | null;
}) {
  const [scheduleState, scheduleAction] = useFormState<ScanScheduleState, FormData>(
    updateScanScheduleAction,
    {}
  );
  const [runState, runAction] = useFormState<RunNowState, FormData>(runRecurringScanNowAction, {});

  return (
    <div className="stack">
      <form action={scheduleAction} className="stack">
        <label className="checkbox-row">
          <input type="checkbox" name="recurringEnabled" defaultChecked={enabled} />
          <span>Run this scan automatically once a day</span>
        </label>
        <label className="stack">
          <span className="muted">Send results to</span>
          <input type="email" name="notifyEmail" defaultValue={email} placeholder="you@example.com" />
        </label>
        {scheduleState?.error ? <p className="error">{scheduleState.error}</p> : null}
        {scheduleState?.ok ? <p className="success">Schedule saved.</p> : null}
        <SaveButton />
      </form>

      <form action={runAction} className="stack">
        <RunNowButton />
        {runState?.error ? <p className="error">{runState.error}</p> : null}
        {runState?.ok ? <p className="success">Scan complete — a notification was generated below.</p> : null}
      </form>

      {lastNotification ? (
        <details className="raw-json">
          <summary>Most recent notification email</summary>
          <p className="muted">
            Sent to {lastNotification.to} · {new Date(lastNotification.sentAt).toLocaleString()}
            {lastNotification.delivery === "logged"
              ? " · delivery stubbed (logged server-side for this build)"
              : ""}
          </p>
          <p>
            <b>Subject:</b> {lastNotification.subject}
          </p>
          <pre>{lastNotification.body}</pre>
        </details>
      ) : null}
    </div>
  );
}
