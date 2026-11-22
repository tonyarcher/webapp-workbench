-- Q1 slice 2b: a short excerpt and a derived image URL stay on the article row
-- so list reads never need the body column. Backfilled by the API in bounded
-- batches; the V15-generated search_text still covers existing rows until a
-- follow-up migration switches it to this column.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS excerpt text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image text;
