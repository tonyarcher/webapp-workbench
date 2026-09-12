-- V3: identity users (user-api sub) + one shared global feed pool.
--
-- Users are provisioned from user-api JWTs (users.subject). Anonymous
-- rss_uid rows keep working under a synthetic local: subject.
--
-- Feeds become global: one row per xml_url, fetched once. Per-user reading
-- moves to subscriptions; folders, states, and affinity stay per user.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
UPDATE users SET subject = 'local:' || id::text WHERE subject IS NULL;
ALTER TABLE users ALTER COLUMN subject SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_subject ON users (subject);

CREATE TABLE IF NOT EXISTS subscriptions (
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    feed_id uuid NOT NULL REFERENCES feeds (id) ON DELETE CASCADE,
    added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, feed_id)
);

-- One survivor per xml_url (earliest added). Everything else remaps to it.
CREATE TEMP TABLE feed_survivor AS
SELECT DISTINCT ON (xml_url) id AS survivor_id, xml_url
FROM feeds ORDER BY xml_url, added_at ASC, id ASC;

CREATE TEMP TABLE feed_remap AS
SELECT f.id AS dup_id, s.survivor_id
FROM feeds f JOIN feed_survivor s ON s.xml_url = f.xml_url
WHERE f.id <> s.survivor_id;

INSERT INTO subscriptions (user_id, feed_id, added_at)
SELECT f.user_id, COALESCE(r.survivor_id, f.id), f.added_at
FROM feeds f LEFT JOIN feed_remap r ON r.dup_id = f.id
ON CONFLICT DO NOTHING;

-- Copy dup-feed articles under the survivor id (sha256hex(feed_id || LF || guid)).
-- Newest copy wins when two dupes share a guid.
INSERT INTO articles (
    id, feed_id, guid, title, link, norm_link, domain, author, summary,
    content_html, comments, published_at, fetched_at, popularity, engagement, hot
)
SELECT encode(digest(r.survivor_id::text || chr(10) || a.guid, 'sha256'), 'hex'),
    r.survivor_id, a.guid, a.title, a.link, a.norm_link, a.domain, a.author, a.summary,
    a.content_html, a.comments, a.published_at, a.fetched_at, a.popularity, a.engagement, a.hot
FROM articles a JOIN feed_remap r ON r.dup_id = a.feed_id
ORDER BY a.published_at DESC
ON CONFLICT (id) DO NOTHING;

-- Merge read/starred state onto the survivor article ids (OR semantics).
INSERT INTO article_state (user_id, article_id, read, read_at, starred)
SELECT st.user_id,
    encode(digest(r.survivor_id::text || chr(10) || a.guid, 'sha256'), 'hex'),
    st.read, st.read_at, st.starred
FROM article_state st
JOIN articles a ON a.id = st.article_id
JOIN feed_remap r ON r.dup_id = a.feed_id
ON CONFLICT (user_id, article_id) DO UPDATE SET
    read = article_state.read OR EXCLUDED.read,
    starred = article_state.starred OR EXCLUDED.starred,
    read_at = COALESCE(
        LEAST(article_state.read_at, EXCLUDED.read_at),
        article_state.read_at,
        EXCLUDED.read_at
    );

DELETE FROM articles WHERE feed_id IN (SELECT dup_id FROM feed_remap);

INSERT INTO folder_feeds (folder_id, feed_id)
SELECT ff.folder_id, r.survivor_id
FROM folder_feeds ff JOIN feed_remap r ON r.dup_id = ff.feed_id
ON CONFLICT DO NOTHING;
DELETE FROM folder_feeds WHERE feed_id IN (SELECT dup_id FROM feed_remap);

UPDATE pending_article_state p SET feed_id = r.survivor_id
FROM feed_remap r WHERE r.dup_id = p.feed_id;

DELETE FROM feed_sync WHERE feed_id IN (SELECT dup_id FROM feed_remap);
DELETE FROM feeds WHERE id IN (SELECT dup_id FROM feed_remap);

ALTER TABLE feeds DROP COLUMN user_id;
ALTER TABLE feeds ADD CONSTRAINT uq_feeds_xml_url UNIQUE (xml_url);
