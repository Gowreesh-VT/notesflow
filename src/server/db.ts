import { sql } from "drizzle-orm";
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

export type DatabaseStatus = "ok" | "missing-tables" | "unreachable";

/** Coarse health of the database: reachable, and all tables from the migrations present. Never throws. */
export async function checkDatabase(db: Db): Promise<DatabaseStatus> {
  try {
    const result = await db.execute(sql`
      select (
        to_regclass('public."user"') is not null and
        to_regclass('public.account') is not null and
        to_regclass('public.sync_record') is not null and
        to_regclass('public.auth_attempt') is not null
      ) as ok
    `);
    const rows = (result as unknown as { rows: { ok: boolean }[] }).rows;
    return rows[0]?.ok ? "ok" : "missing-tables";
  } catch (error) {
    console.error(
      "database check failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return "unreachable";
  }
}

let cachedStatus: { at: number; status: DatabaseStatus } | undefined;

/** checkDatabase for the shared database, cached briefly so page loads do not wake the database each time. */
export async function getDatabaseStatus(ttlMs = 30_000): Promise<DatabaseStatus | null> {
  const db = getDb();
  if (!db) return null;
  if (cachedStatus && Date.now() - cachedStatus.at < ttlMs && cachedStatus.status === "ok") {
    return cachedStatus.status;
  }
  const status = await checkDatabase(db);
  cachedStatus = { at: Date.now(), status };
  return status;
}
