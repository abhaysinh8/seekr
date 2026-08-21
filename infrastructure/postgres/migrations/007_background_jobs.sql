create table if not exists background_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('bulk_ingestion', 'crawl', 'reindex', 'segment_merge', 'index_optimization', 'snapshot')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  payload jsonb not null,
  progress integer not null default 0 check (progress between 0 and 100),
  attempts integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  idempotency_key text unique,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists background_jobs_claim_idx on background_jobs(status, created_at)
  where status = 'queued';
