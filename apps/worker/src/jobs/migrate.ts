import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import postgres from "postgres";

/**
 * Files that were applied by hand before this runner existed. When the tracking
 * table is created on a database that already has the schema, they are recorded
 * as applied instead of being run again.
 */
export const BOOTSTRAP_APPLIED = [
  "001_initial_schema.sql",
  "002_normalization_pipeline.sql",
  "003_seed_theatres.sql",
  "004_seed_park_theatre.sql",
  "005_list_unmatched_showtimes.sql",
];

/** db/migrations, resolved from this file so the runner works from any working directory. */
export const MIGRATIONS_DIR = fileURLToPath(new URL("../../../../db/migrations", import.meta.url));

export interface MigrateResult {
  applied: string[];
  skipped: string[];
}

/**
 * Apply every `*.sql` file in `directory`, in name order, that is not yet recorded in
 * `schema_migrations`. Each file carries its own transaction, so a failing file
 * leaves the database as it was and stops the run.
 */
export async function migrate(sql: postgres.Sql, directory: string, log: (message: string) => void = () => undefined): Promise<MigrateResult> {
  const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;

  const [tracked] = await sql<{ count: number }[]>`select count(*)::int as count from schema_migrations`;
  if (tracked!.count === 0) {
    const [schema] = await sql<{ exists: boolean }[]>`select to_regclass('public.theatres') is not null as exists`;
    if (schema!.exists) {
      for (const name of BOOTSTRAP_APPLIED.filter((known) => files.includes(known))) {
        await sql`insert into schema_migrations (name) values (${name}) on conflict do nothing`;
      }
      log(`recorded ${BOOTSTRAP_APPLIED.length} migrations already applied by hand`);
    }
  }

  const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((row) => row.name));
  const result: MigrateResult = { applied: [], skipped: [] };
  for (const name of files) {
    if (done.has(name)) {
      result.skipped.push(name);
      continue;
    }
    await sql.unsafe(await readFile(path.join(directory, name), "utf8"));
    await sql`insert into schema_migrations (name) values (${name})`;
    result.applied.push(name);
    log(`applied ${name}`);
  }
  return result;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set. Add it as a repository secret, or to .env.local for a local run.");
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const result = await migrate(sql, MIGRATIONS_DIR, (message) => console.log(message));
    console.log(`migrations: ${result.applied.length} applied, ${result.skipped.length} already applied`);
  } finally {
    await sql.end();
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
