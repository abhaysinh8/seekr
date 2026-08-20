import { readFile } from 'node:fs/promises';

import { loadApiEnvironment } from '@seekr/config';

import { createDatabase } from './client.js';

const migrationName = '001_initial_schema.sql';
const migrationUrl = new URL(
  `../../../../infrastructure/postgres/migrations/${migrationName}`,
  import.meta.url,
);

const environment = loadApiEnvironment();
const database = createDatabase(environment.DATABASE_URL);

try {
  const migration = await readFile(migrationUrl, 'utf8');

  await database.sql.begin(async (transaction) => {
    await transaction`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `;

    const applied = await transaction<{ exists: boolean }[]>`
      select exists(select 1 from schema_migrations where name = ${migrationName}) as exists
    `;

    if (!applied[0]?.exists) {
      await transaction.unsafe(migration);
      await transaction`insert into schema_migrations (name) values (${migrationName})`;
    }
  });

  process.stdout.write(`Applied database migrations through ${migrationName}\n`);
} finally {
  await database.close();
}
