import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { sql } from "@vercel/postgres";
import { ensureSchema } from "./db";
import {
  localCreateSession,
  localCreateUser,
  localDeleteSession,
  localFindUserByEmail,
  localGetUserBySession,
  localGetUserCount
} from "./local-store";

const sessionCookieName = "gridwatch_session";
const sessionDays = 7;

type UserRow = {
  id: string;
  email: string;
};

function useLocalFileDb() {
  return process.env.USE_LOCAL_FILE_DB === "true";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = Buffer.from(hashPassword(password, salt).hash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export async function getUserCount() {
  if (useLocalFileDb()) {
    return localGetUserCount();
  }

  await ensureSchema();
  const result = await sql<{ count: string }>`select count(*)::text as count from users`;
  return Number(result.rows[0]?.count ?? "0");
}

export async function createUser(email: string, password: string, setupToken: string) {
  if (!process.env.FIRST_USER_SETUP_TOKEN) {
    throw new Error("FIRST_USER_SETUP_TOKEN is not configured.");
  }

  if (setupToken !== process.env.FIRST_USER_SETUP_TOKEN) {
    throw new Error("Invalid setup token.");
  }

  const passwordResult = hashPassword(password);

  if (useLocalFileDb()) {
    const existing = await localFindUserByEmail(email);

    if (existing) {
      throw new Error("An account with this email already exists.");
    }

    const user = await localCreateUser({
      email,
      passwordHash: passwordResult.hash,
      passwordSalt: passwordResult.salt
    });
    await createSession(user.id);
    return;
  }

  await ensureSchema();

  const existing = await sql`select 1 from users where lower(email) = lower(${email}) limit 1`;

  if ((existing.rowCount ?? 0) > 0) {
    throw new Error("An account with this email already exists.");
  }

  const id = randomUUID();

  await sql`
    insert into users (id, email, password_hash, password_salt)
    values (${id}, ${email}, ${passwordResult.hash}, ${passwordResult.salt})
  `;

  await createSession(id);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);

  if (useLocalFileDb()) {
    await localCreateSession({
      userId,
      tokenHash,
      expiresAt: expiresAt.toISOString()
    });
  } else {
    await ensureSchema();
    const id = randomUUID();

    await sql`
      insert into sessions (id, user_id, token_hash, expires_at)
      values (${id}, ${userId}, ${tokenHash}, ${expiresAt.toISOString()})
    `;
  }

  cookies().set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function signIn(email: string, password: string) {
  if (useLocalFileDb()) {
    const user = await localFindUserByEmail(email);

    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      throw new Error("Invalid email or password.");
    }

    await createSession(user.id);
    return;
  }

  await ensureSchema();

  const result = await sql<{
    id: string;
    password_hash: string;
    password_salt: string;
  }>`select id, password_hash, password_salt from users where lower(email) = lower(${email}) limit 1`;

  const user = result.rows[0];

  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    throw new Error("Invalid email or password.");
  }

  await createSession(user.id);
}

export async function signOut() {
  const token = cookies().get(sessionCookieName)?.value;

  if (token) {
    if (useLocalFileDb()) {
      await localDeleteSession(hashToken(token));
    } else {
      await ensureSchema();
      await sql`delete from sessions where token_hash = ${hashToken(token)}`;
    }
  }

  cookies().delete(sessionCookieName);
}

export async function getCurrentUser() {
  const token = cookies().get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  if (useLocalFileDb()) {
    return localGetUserBySession(hashToken(token));
  }

  await ensureSchema();

  const result = await sql<UserRow>`
    select users.id, users.email
    from sessions
    join users on users.id = sessions.user_id
    where sessions.token_hash = ${hashToken(token)}
      and sessions.expires_at > now()
    limit 1
  `;

  return result.rows[0] ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  return user;
}
