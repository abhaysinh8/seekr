alter table api_keys add column if not exists scopes text[] not null default array['search']::text[];
create index if not exists api_keys_project_id_created_at_idx on api_keys(project_id, created_at desc);
create index if not exists api_keys_key_prefix_idx on api_keys(key_prefix) where revoked_at is null;
