-- Q1 slice 3: cold bodies may live in the object store. Postgres keeps the key
-- and byte size; content_html stays for hot rows and as a fallback during rollout.
alter table article_bodies add column if not exists storage_key text;
alter table article_bodies add column if not exists byte_size bigint;
alter table article_bodies alter column content_html drop not null;
