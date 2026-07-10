"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { sendChatMessageAction, type ChatActionState } from "../actions";

function SendButton() {
  const { pending } = useFormStatus();

  return (
    <button className="primary-button" type="submit" disabled={pending}>
      <span className="button-content">
        {pending ? <span className="spinner" aria-hidden="true" /> : null}
        {pending ? "Thinking..." : "Send"}
      </span>
    </button>
  );
}

export function ChatForm() {
  const [state, formAction] = useFormState<ChatActionState, FormData>(sendChatMessageAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clear the input after a successful send (no error returned).
  useEffect(() => {
    if (!state?.error && textareaRef.current) {
      textareaRef.current.value = "";
    }
  }, [state]);

  return (
    <form action={formAction} ref={formRef} className="chat-form">
      {state?.error ? <p className="error">{state.error}</p> : null}
      <textarea
        ref={textareaRef}
        name="message"
        placeholder="Ask about your home network security, e.g. 'Is it safe to leave UPnP on?'"
        maxLength={2000}
        rows={2}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      />
      <SendButton />
    </form>
  );
}
