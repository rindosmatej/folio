import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { createHandler } from "../api/index.mjs";
import { openPostgres } from "./local-postgres.mjs";

for (const name of [".env.local", ".env"]) {
  try {
    loadEnvFile(name);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const host = "localhost";
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw Error("PORT musí být celé číslo od 1 do 65535.");
}
const origin = `http://${host}:${port}`;
const { SUPABASE_URL, SUPABASE_SERVER_KEY } = process.env;
const useSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVER_KEY);
if (Boolean(SUPABASE_URL) !== Boolean(SUPABASE_SERVER_KEY)) {
  throw Error("Pro Supabase vyplňte SUPABASE_URL i SUPABASE_SERVER_KEY. Pro místní databázi ponechte obě prázdné.");
}

const dataDir = ".folio-local";
let database;
let bucket;
if (!useSupabase) {
  const files = join(dataDir, "files");
  await mkdir(files, { recursive: true });
  database = await openPostgres(join(dataDir, "postgres"));
  function filePath(key) {
    const match = /^files\/([a-f0-9]{48})$/.exec(key);
    if (!match) throw Error("Neplatný identifikátor přílohy.");
    return join(files, match[1]);
  }
  bucket = {
    put: (key, bytes) => writeFile(filePath(key), bytes, { flag: "wx" }),
    async get(key) {
      try {
        return new Response(await readFile(filePath(key)));
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    delete: (key) => rm(filePath(key), { force: true }),
  };
}

const server = createServer(createHandler({ localOrigin: origin, db: database?.binding, bucket }));
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
} catch (error) {
  await database?.pg.close();
  if (error.code === "EADDRINUSE") throw Error(`Port ${port} je obsazený. Ukončete druhý server nebo nastavte PORT.`);
  throw error;
}

console.log(`Folio běží na ${origin} · ${useSupabase ? "Supabase" : "místní databáze"}`);
if ((process.env.FOLIO_MODE || "admin") === "admin") {
  console.log(`Administrace: ${origin}/ucitel`);
}
function shutdown() {
  server.close(() => {
    database?.pg.close().catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
