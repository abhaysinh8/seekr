create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists indexes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  index_id uuid not null references indexes(id) on delete cascade,
  external_id text not null,
  fields jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (index_id, external_id)
);

create table if not exists crawl_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  index_id uuid not null references indexes(id) on delete cascade,
  name text not null,
  start_url text not null,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references crawl_sources(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists search_queries (
  id uuid primary key default gen_random_uuid(),
  index_id uuid not null references indexes(id) on delete cascade,
  query text not null,
  result_count integer not null check (result_count >= 0),
  duration_ms integer not null check (duration_ms >= 0),
  searched_at timestamptz not null default now()
);

create table if not exists search_events (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references search_queries(id) on delete cascade,
  event_type text not null check (event_type in ('view', 'click', 'conversion')),
  document_id uuid references documents(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  interaction_type text not null,
  weight double precision not null default 1,
  occurred_at timestamptz not null default now()
);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists documents_index_id_idx on documents(index_id);
create index if not exists crawl_jobs_source_id_created_at_idx on crawl_jobs(source_id, created_at desc);
create index if not exists search_queries_index_id_searched_at_idx on search_queries(index_id, searched_at desc);
create index if not exists interactions_project_user_idx on interactions(project_id, user_id);
create index if not exists interactions_document_idx on interactions(document_id);
