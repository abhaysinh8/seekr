alter table interactions alter column document_id drop not null;
alter table interactions add column if not exists index_id uuid references indexes(id) on delete cascade;
alter table interactions add column if not exists external_user_id text;
alter table interactions add column if not exists external_item_id text;

create index if not exists interactions_index_user_idx on interactions(index_id, external_user_id);
create index if not exists interactions_index_item_idx on interactions(index_id, external_item_id);
