import { sql } from "drizzle-orm";
import type { Db } from "./db";
import { authAttempts } from "./schema";

/**
 * Fixed-window counter stored in the database (serverless instances share no memory).
 * Returns true while the caller is within `limit` attempts per `windowMs` for this key.
 */
export async function withinRateLimit(
  db: Db,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<boolean> {
  const expired = sql`${authAttempts.windowStart} < ${now - windowMs}`;
  const [row] = await db
    .insert(authAttempts)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: authAttempts.key,
      set: {
        count: sql`case when ${expired} then 1 else ${authAttempts.count} + 1 end`,
        windowStart: sql`case when ${expired} then ${now} else ${authAttempts.windowStart} end`,
      },
    })
    .returning({ count: authAttempts.count });
  return row.count <= limit;
}
