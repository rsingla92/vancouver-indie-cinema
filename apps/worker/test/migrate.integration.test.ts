import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BOOTSTRAP_APPLIED, migrate, MIGRATIONS_DIR } from "../src/jobs/migrate.js";

// Runs only against a database that has the migrations applied: DATABASE_URL=postgres://... npx vitest run
const databaseUrl = process.env.DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite("migration runner against Postgres", () => {
  let sql: postgres.Sql;
  let scratch: string;

  beforeAll(async () => {
    sql = postgres(databaseUrl ?? "", { max: 1, prepare: false });
    scratch = await mkdtemp(path.join(tmpdir(), "migrations-"));
    await writeFile(path.join(scratch, "900_probe.sql"), "begin;\ncreate table if not exists migrate_probe (id int);\ncommit;\n");
  });
  afterAll(async () => {
    await sql`drop table if exists migrate_probe`;
    await sql`delete from schema_migrations where name = '900_probe.sql'`;
    await sql.end();
    await rm(scratch, { recursive: true, force: true });
  });

  it("records hand-applied files, applies the rest once, then does nothing", async () => {
    const first = await migrate(sql, MIGRATIONS_DIR);
    for (const name of BOOTSTRAP_APPLIED) expect(first.applied).not.toContain(name);
    const second = await migrate(sql, MIGRATIONS_DIR);
    expect(second.applied).toEqual([]);
    expect(second.skipped.length).toBeGreaterThanOrEqual(BOOTSTRAP_APPLIED.length);
  });

  it("applies a new file and records it", async () => {
    expect((await migrate(sql, scratch)).applied).toEqual(["900_probe.sql"]);
    expect((await sql`select to_regclass('public.migrate_probe') is not null as exists`)[0]).toEqual({ exists: true });
    expect((await migrate(sql, scratch)).applied).toEqual([]);
  });
});
