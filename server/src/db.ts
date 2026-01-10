import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..", "..");
const defaultDatabasePath = resolve(projectRoot, "data", "nebula.db");
const databasePath = process.env.DATABASE_PATH ?? defaultDatabasePath;

mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.run("PRAGMA journal_mode = WAL;");
db.run("PRAGMA foreign_keys = ON;");