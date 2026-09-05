// ---- DDL for rss-reader server ----

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT 'local',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title)
);

CREATE TABLE IF NOT EXISTS feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  xml_url text NOT NULL,
  site_url text,
  title text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, xml_url)
);

CREATE TABLE IF NOT EXISTS folder_feeds (
  folder_id uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  feed_id uuid NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  PRIMARY KEY (folder_id, feed_id)
);

CREATE TABLE IF NOT EXISTS articles (
  id text PRIMARY KEY,
  feed_id uuid NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  guid text NOT NULL,
  title text NOT NULL,
  link text,
  norm_link text,
  domain text,
  author text,
  summary text,
  content_html text,
  comments integer,
  published_at timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  popularity real NOT NULL DEFAULT 0,
  engagement real NOT NULL DEFAULT 0,
  hot real NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_articles_feed_pub ON articles (feed_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_hot ON articles (hot DESC);
CREATE INDEX IF NOT EXISTS idx_articles_norm_link ON articles (norm_link);

CREATE TABLE IF NOT EXISTS article_state (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  starred boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_state_unread ON article_state (user_id, article_id) WHERE read;

CREATE TABLE IF NOT EXISTS feed_sync (
  feed_id uuid PRIMARY KEY REFERENCES feeds(id) ON DELETE CASCADE,
  etag text,
  last_modified text,
  last_fetched_at timestamptz,
  last_error text
);

CREATE TABLE IF NOT EXISTS pending_article_state (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feed_id uuid NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  guid text,
  norm_link text,
  link text,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  starred boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_state_feed ON pending_article_state (feed_id);

CREATE TABLE IF NOT EXISTS user_affinity (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value real NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
`;
