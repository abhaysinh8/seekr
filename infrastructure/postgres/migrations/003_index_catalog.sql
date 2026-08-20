alter table indexes add column if not exists status text not null default 'ready'
  check (status in ('ready', 'indexing', 'error'));
alter table indexes add column if not exists last_indexed_at timestamptz;
alter table documents add column if not exists metadata jsonb not null default '{}'::jsonb;
