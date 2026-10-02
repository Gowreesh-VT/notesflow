// Local development database: a real Postgres wire-protocol server backed by PGlite, with the app's migrations
// applied. No Docker or account needed:  npm run db:dev   then use the printed DATABASE_URL.
// Data is kept in .pglite/ between runs (delete that folder to start fresh).
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const port = Number(process.env.DEV_DB_PORT ?? 54329);
const dataDir = process.env.DEV_DB_MEMORY === "1" ? undefined : ".pglite";

const client = await PGlite.create(dataDir);
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });

const server = new PGLiteSocketServer({ db: client, port, host: "127.0.0.1", maxConnections: 10 });
await server.start();

console.log(`Local Postgres ready (${dataDir ?? "in memory"}).`);
console.log(`DATABASE_URL=postgres://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`);

const stop = async () => {
  await server.stop();
  await client.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
