import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

/** Any Drizzle Postgres database (node-postgres in production, PGlite in tests). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;

let cached: Db | null | undefined;

/** The shared database, or null when DATABASE_URL is not configured (the app then stays local-only). */
export function getDb(): Db | null {
  if (cached !== undefined) return cached;
  const url = process.env.DATABASE_URL;
  cached = url ? drizzle(new Pool({ connectionString: url, max: 3 }), { schema }) : null;
  return cached;
}

export function isCloudConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.AUTH_SECRET);
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}
