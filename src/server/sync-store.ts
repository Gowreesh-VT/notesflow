import { and, asc, gt, sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { sanitizeRecord, type SyncRecord, type SyncResponse } from "@/lib/sync";
import type { Db } from "./db";
import { syncRecords } from "./schema";

export const MAX_CHANGES_PER_REQUEST = 500;
export const MAX_RECORD_BYTES = 200_000;
const PAGE_SIZE = 1000;

/**
 * Applies a client's changes (last write wins per record) and returns every record changed on the server after
 * `cursor`. All reads and writes are scoped to `userId`; the caller must take it from the authenticated session.
 */
export async function syncForUser(
  db: Db,
  userId: string,
  request: { cursor: number; changes: unknown[] },
): Promise<SyncResponse> {
  const cursor =
    Number.isFinite(request.cursor) && request.cursor > 0 ? Math.floor(request.cursor) : 0;

  const valid = request.changes
    .slice(0, MAX_CHANGES_PER_REQUEST)
    .flatMap((raw) => sanitizeRecord(raw) ?? [])
    .filter((record) => JSON.stringify(record.data ?? null).length <= MAX_RECORD_BYTES);

  // Deduplicate by record, keeping the newest, so one INSERT never touches the same row twice.
  const latest = new Map<string, SyncRecord>();
  for (const record of valid) {
    const key = `${record.collection}:${record.id}`;
    const seen = latest.get(key);
    if (!seen || record.updatedAt > seen.updatedAt) latest.set(key, record);
  }

  if (latest.size > 0) {
    await db
      .insert(syncRecords)
      .values(
        [...latest.values()].map((r) => ({
          userId,
          collection: r.collection,
          id: r.id,
          data: r.data,
          updatedAt: r.updatedAt,
          deleted: r.deleted,
        })),
      )
      .onConflictDoUpdate({
        target: [syncRecords.userId, syncRecords.collection, syncRecords.id],
        set: {
          data: sql`excluded.data`,
          updatedAt: sql`excluded.updated_at`,
          deleted: sql`excluded.deleted`,
          seq: sql`nextval('sync_seq')`,
        },
        // Last write wins: ignore a change that is not newer than what the server already has.
        setWhere: sql`excluded.updated_at > ${syncRecords.updatedAt}`,
      });
  }

  const rows = await db
    .select()
    .from(syncRecords)
    .where(and(eq(syncRecords.userId, userId), gt(syncRecords.seq, cursor)))
    .orderBy(asc(syncRecords.seq))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return {
    cursor: page.length > 0 ? page[page.length - 1].seq : cursor,
    hasMore,
    records: page.map((row) => ({
      collection: row.collection as SyncRecord["collection"],
      id: row.id,
      updatedAt: row.updatedAt,
      deleted: row.deleted,
      data: row.data,
    })),
  };
}
