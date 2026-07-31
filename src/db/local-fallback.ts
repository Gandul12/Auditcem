import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as typeof globalThis & {
  __auditCrucibleLocalPool?: Pool;
};

export function createLocalDb(databaseUrl: string) {
  const pool = globalForDb.__auditCrucibleLocalPool ?? new Pool({ connectionString: databaseUrl });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__auditCrucibleLocalPool = pool;
  }

  return {
    db: drizzle(pool, { schema }),
    close: () => pool.end(),
  };
}
