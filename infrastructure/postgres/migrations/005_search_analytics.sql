alter table search_queries add column if not exists filters jsonb not null default '[]'::jsonb;
alter table search_queries add column if not exists session_hash text;

alter table search_events add column if not exists external_document_id text;
alter table search_events add column if not exists result_position integer check (result_position is null or result_position > 0);

create table if not exists search_impressions (
  search_id uuid not null references search_queries(id) on delete cascade,
  external_document_id text not null,
  result_position integer not null check (result_position > 0),
  created_at timestamptz not null default now(),
  primary key (search_id, external_document_id, result_position)
);

create index if not exists search_impressions_search_document_idx
  on search_impressions(search_id, external_document_id);
create index if not exists search_events_query_type_idx on search_events(query_id, event_type);
