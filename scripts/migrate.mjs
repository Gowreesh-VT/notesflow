// Applies the database migrations in ./drizzle to a Postgres database.
//   npm run db:migrate                      prompts for the connection string (input is hidden)
//   DATABASE_URL="postgresql://…" npm run db:migrate
// Use the direct (non-pooled) connection string from the Neon dashboard.
import readline from "node:readline";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    let muted = false;
    const write = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (text) => {
      if (!muted) write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

let url = process.env.DATABASE_URL?.trim();
if (!url)
  url = (
    await promptHidden("Paste your Postgres connection string (hidden), then press Enter: ")
  ).trim();

if (!/^postgres(ql)?:\/\/[^\s]+$/i.test(url)) {
  console.error(
    "That does not look like a Postgres connection string. It should start with postgresql:// and come from " +
      "the Neon dashboard (Connect -> direct connection). Nothing was changed.",
  );
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 20_000 });
try {
  await pool.query("select 1");
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  const { rows } = await pool.query(
    `select to_regclass('public."user"') is not null as ok_user, to_regclass('public.sync_record') is not null as ok_sync`,
  );
  if (!rows[0].ok_user || !rows[0].ok_sync)
    throw new Error("tables are still missing after migrating");
  console.log("Migrations applied. The database is ready.");
} catch (error) {
  console.error(`Migration failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
