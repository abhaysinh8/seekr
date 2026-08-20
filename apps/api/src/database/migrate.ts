import { readdir, readFile } from 'node:fs/promises';

import { loadApiEnvironment } from '@seekr/config';

import { createDatabase } from './client.js';

const migrationsUrl = new URL('../../../../infrastructure/postgres/migrations/', import.meta.url);

const environment = loadApiEnvironment();
const database = createDatabase(environment.DATABASE_URL);

try {
  const migrationNames = (await readdir(migrationsUrl))
    .filter((name) => /^\d+_.+\.sql$/u.test(name))
    .sort((left, right) => left.localeCompare(right));

  await database.sql.begin(async (transaction) => {
    await transaction`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `;

    for (const migrationName of migrationNames) {
      const applied = await transaction<{ exists: boolean }[]>`
        select exists(select 1 from schema_migrations where name = ${migrationName}) as exists
      `;
      if (!applied[0]?.exists) {
        const migration = await readFile(new URL(migrationName, migrationsUrl), 'utf8');
        await transaction.unsafe(migration);
        await transaction`insert into schema_migrations (name) values (${migrationName})`;
      }
    }
  });

  process.stdout.write(`Applied ${migrationNames.length} available database migrations\n`);
} finally {
  await database.close();
}
