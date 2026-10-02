import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Monotonic counter used as the sync cursor, so pulling never depends on device clocks. */
export const syncSeq = pgSequence("sync_seq");

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  /** scrypt hash; null for accounts that only use Google sign-in. */
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })],
);

/**
 * One row per synced record (task/note, list or folder). `data` holds the full record as JSON, so adding a
 * field to the app never needs a schema change. Deleted records stay as tombstones (`deleted = true`).
 */
export const syncRecords = pgTable(
  "sync_record",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collection: text("collection").notNull(),
    id: text("id").notNull(),
    data: jsonb("data"),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
    deleted: boolean("deleted").notNull().default(false),
    seq: bigint("seq", { mode: "number" })
      .notNull()
      .default(sql`nextval('sync_seq')`),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.collection, table.id] }),
    index("sync_record_user_seq_idx").on(table.userId, table.seq),
  ],
);

export const authAttempts = pgTable("auth_attempt", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: bigint("window_start", { mode: "number" }).notNull(),
});
