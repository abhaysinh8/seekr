alter table crawl_jobs add column if not exists discovered integer not null default 0 check (discovered >= 0);
alter table crawl_jobs add column if not exists fetched integer not null default 0 check (fetched >= 0);
alter table crawl_jobs add column if not exists indexed integer not null default 0 check (indexed >= 0);
alter table crawl_jobs add column if not exists skipped integer not null default 0 check (skipped >= 0);
alter table crawl_jobs add column if not exists failed integer not null default 0 check (failed >= 0);

create index if not exists crawl_sources_project_id_idx on crawl_sources(project_id);
create index if not exists crawl_sources_index_id_idx on crawl_sources(index_id);
create index if not exists crawl_jobs_status_created_at_idx on crawl_jobs(status, created_at);
