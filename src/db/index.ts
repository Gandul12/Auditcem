import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { createLocalDb } from "./local-fallback";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

function isLocalPostgresUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

const neonSql = neon(databaseUrl);
const neonDb = drizzleNeonHttp(neonSql, { schema });

type Database = typeof neonDb;

const useLocalFallback = isLocalPostgresUrl(databaseUrl);
const local = useLocalFallback ? createLocalDb(databaseUrl) : null;

export const db: Database = local ? (local.db as unknown as Database) : neonDb;
export const dbRuntime = local ? "local-node-postgres" : "neon-http";

export async function closeDb(): Promise<void> {
  await local?.close();
}
