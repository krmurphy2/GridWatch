import { randomUUID } from "node:crypto";
import { sql } from "./db-client";
import { ensureSchema } from "./db";
import {
  localAppendChatMessage,
  localClearChatMessages,
  localGetChatMessages
} from "./local-store";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

function useLocalFileDb() {
  return process.env.USE_LOCAL_FILE_DB === "true";
}

// All chat access is scoped by userId so one user can never read or write
// another user's conversation.
export async function getChatMessages(userId: string): Promise<ChatMessage[]> {
  if (useLocalFileDb()) {
    return (await localGetChatMessages(userId)) as ChatMessage[];
  }

  await ensureSchema();

  const result = await sql<{
    id: string;
    role: ChatRole;
    content: string;
    created_at: string;
  }>`
    select id, role, content, created_at
    from chat_messages
    where user_id = ${userId}
    order by created_at asc
  `;

  return result.rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: new Date(String(row.created_at)).toISOString()
  }));
}

export async function appendChatMessage(
  userId: string,
  role: ChatRole,
  content: string
): Promise<ChatMessage> {
  if (useLocalFileDb()) {
    return (await localAppendChatMessage({ userId, role, content })) as ChatMessage;
  }

  await ensureSchema();

  const id = randomUUID();
  await sql`
    insert into chat_messages (id, user_id, role, content)
    values (${id}, ${userId}, ${role}, ${content})
  `;

  return { id, role, content, createdAt: new Date().toISOString() };
}

export async function clearChatMessages(userId: string): Promise<void> {
  if (useLocalFileDb()) {
    await localClearChatMessages(userId);
    return;
  }

  await ensureSchema();
  await sql`delete from chat_messages where user_id = ${userId}`;
}
