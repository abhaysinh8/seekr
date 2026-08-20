import postgres from 'postgres';

import type { HealthDependency } from '../services/health-dependency.js';

export interface Database extends HealthDependency {
  readonly sql: ReturnType<typeof postgres>;
}

export function createDatabase(connectionString: string): Database {
  const sql = postgres(connectionString, {
    connect_timeout: 5,
    idle_timeout: 20,
    max: 10,
    transform: postgres.camel,
  });

  return {
    sql,
    async ping() {
      await sql`select 1`;
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}
