// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { checkDatabase, type Db } from "./db";
import * as schema from "./schema";
import { createTestDb } from "./test-db";

describe("checkDatabase", () => {
  it("reports ok once the migrations have been applied", async () => {
    expect(await checkDatabase(await createTestDb())).toBe("ok");
  }, 60_000);

  it("reports missing tables on an empty database", async () => {
    const empty = drizzle(new PGlite(), { schema }) as unknown as Db;
    expect(await checkDatabase(empty)).toBe("missing-tables");
  }, 60_000);

  it("reports unreachable instead of throwing when the query fails", async () => {
    const broken = {
      execute: async () => {
        throw new Error("connection refused");
      },
    } as unknown as Db;
    expect(await checkDatabase(broken)).toBe("unreachable");
  });
});
