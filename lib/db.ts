import { sql } from "@vercel/postgres";

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
      singleton boolean not null default true,
      created_at timestamptz not null default now(),
      constraint users_singleton_true check (singleton)
    )
  `;

  await sql`
    create unique index if not exists users_singleton_idx on users ((true))
  `;

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

  schemaReady = true;
}
