import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getChatMessages } from "@/lib/chat";
import { getLatestRouterProfile } from "@/lib/router-profile";
import { clearChatAction, signOutAction } from "../actions";
import { ChatForm } from "./chat-form";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await requireUser();
  const [messages, profile] = await Promise.all([
    getChatMessages(user.id),
    getLatestRouterProfile(user.id)
  ]);

  return (
    <main className="page-shell">
      <div className="container">
        <div className="header-row">
          <div>
            <p className="eyebrow">Home network overview</p>
            <h1>Security assistant</h1>
            <p className="muted">Signed in as {user.email}</p>
          </div>
          <div className="header-actions">
            <Link className="secondary-button" href="/dashboard">
              Back to dashboard
            </Link>
            <form action={signOutAction}>
              <button className="secondary-button" type="submit">Sign out</button>
            </form>
          </div>
        </div>

        <section className="card">
          <div className="card-inner stack">
            <div className="chat-intro">
              <div>
                <p className="eyebrow">Ask GridWatch</p>
                <h2>Plain-English security help</h2>
                <p className="muted">
                  Ask about your own home network and router. I keep answers simple unless you
                  ask for technical detail, and I only cover home-network security.
                </p>
              </div>
              {messages.length > 0 ? (
                <form action={clearChatAction}>
                  <button className="secondary-button" type="submit">Clear chat</button>
                </form>
              ) : null}
            </div>

            {!profile ? (
              <div className="notice">
                <p>
                  You haven&apos;t added any router evidence yet. <Link href="/setup">Upload a
                  screenshot</Link> so I can tailor answers to your actual router.
                </p>
              </div>
            ) : null}

            <div className="chat-thread">
              {messages.length === 0 ? (
                <div className="chat-empty muted">
                  <p>No messages yet. Try asking:</p>
                  <ul>
                    <li>&ldquo;What&apos;s the most important thing to fix on my network?&rdquo;</li>
                    <li>&ldquo;Is it safe to leave remote administration on?&rdquo;</li>
                    <li>&ldquo;Explain my Wi-Fi security setting in simple terms.&rdquo;</li>
                  </ul>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`chat-bubble chat-${message.role}`}>
                    <span className="chat-role">
                      {message.role === "user" ? "You" : "GridWatch"}
                    </span>
                    <p>{message.content}</p>
                  </div>
                ))
              )}
            </div>

            <ChatForm />
          </div>
        </section>
      </div>
    </main>
  );
}
