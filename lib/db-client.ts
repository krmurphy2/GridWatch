import { neon } from "@neondatabase/serverless";

// Centralized Neon serverless Postgres client.
//
// This replaces @vercel/postgres. The client is created lazily on first query
// so that local development (USE_LOCAL_FILE_DB=true) never needs a connection
// string and importing this module can never throw at load time.
//
// `fullResults: true` makes tagged-template queries return an object shaped like
// { rows, rowCount, ... }, matching the API the rest of the codebase already
// relies on from @vercel/postgres.

export type QueryResult<T> = {
  rows: T[];
  rowCount: number | null;
};

type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

let client: SqlTag | null = null;

function getClient(): SqlTag {
  if (!client) {
    const connectionString =
      process.env.DATABASE_URL ??
      process.env.POSTGRES_URL ??
      process.env.POSTGRES_PRISMA_URL ??
      process.env.POSTGRES_URL_NON_POOLING;

    if (!connectionString) {
      throw new Error(
        "No Postgres connection string found. Set DATABASE_URL (or POSTGRES_URL) for hosted persistence, or set USE_LOCAL_FILE_DB=true for local file-backed storage."
      );
    }

    client = neon(connectionString, { fullResults: true }) as unknown as SqlTag;
  }

  return client;
}

export function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult<T>> {
  return getClient()(strings, ...values) as unknown as Promise<QueryResult<T>>;
}
