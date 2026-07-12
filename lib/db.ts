import { sql } from "./db-client";

let schemaReady = false;

export async function ensureSchema() {
  if (schemaReady) {
    return;
  }

  await sql`
    create table if not exists users (
      id text primary key,
      email text not null unique,
      password_hash text not null,
      password_salt text not null,
      created_at timestamptz not null default now()
    )
  `;

  // Migrate away from the original single-user model: earlier versions enforced
  // exactly one user via a check constraint, a unique index on ((true)), and a
  // singleton column. These are dropped idempotently so existing deployments can
  // support multiple token-gated users.
  await sql`drop index if exists users_singleton_idx`;
  await sql`alter table users drop constraint if exists users_singleton_true`;
  await sql`alter table users drop column if exists singleton`;

  await sql`
    create table if not exists sessions (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists router_profiles (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      router_vendor text,
      router_model text,
      hardware_version text,
      firmware_version text,
      public_ip text,
      router_admin_url text,
      upnp_status text,
      remote_admin_status text,
      port_forwarding_status text,
      wifi_security text,
      extraction_json jsonb not null,
      missing_fields jsonb not null,
      scan_approved boolean not null default false,
      scan_approved_at timestamptz,
      scan_target_ip text,
      image_name text,
      image_mime text,
      image_size integer,
      image_data_base64 text,
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists chat_messages (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      role text not null,
      content text not null,
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    create index if not exists chat_messages_user_created_idx
      on chat_messages (user_id, created_at)
  `;

  // Latest CVE + passive-intel results per user (assessment memory). One row per
  // user; re-running the checks upserts in place.
  await sql`
    create table if not exists security_findings (
      user_id text primary key references users(id) on delete cascade,
      findings jsonb not null,
      checked_at timestamptz not null default now()
    )
  `;

  schemaReady = true;
}
