import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

export async function openPostgres(dataDir) {
  const pg = new PGlite(dataDir);
  try {
    const { rows: [state] } = await pg.query(
      "SELECT to_regnamespace('folio') IS NOT NULL AS initialized",
    );
    if (!state.initialized) {
      const migration = await readFile(
        new URL("../supabase/migrations/20261123000100_folio.sql", import.meta.url),
        "utf8",
      );
      // Put the Supabase prerequisites in the same transaction as the migration.
      await pg.exec(migration.replace(/^BEGIN;\r?\n/, `BEGIN;
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE ROLE service_role;
        CREATE SCHEMA storage;
        CREATE TABLE storage.buckets (
          id text PRIMARY KEY, name text, public boolean, file_size_limit bigint
        );
      `));
    }
    return {
      pg,
      binding: {
        async rpc(name, args) {
          const read = name === "folio_read";
          const statement = read
            ? "SELECT public.folio_read($1) AS value"
            : "SELECT public.folio_commit($1, $2) AS value";
          const params = read ? [args.known] : [args.expected, JSON.stringify(args.changes)];
          const { rows: [row] } = await pg.query(statement, params);
          return row.value;
        },
      },
    };
  } catch (error) {
    await pg.close();
    throw error;
  }
}
