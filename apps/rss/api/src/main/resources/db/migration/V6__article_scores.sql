-- V6: server-scored front-page signals (Phase 1).
-- worthy/interest are signal blends; topic/popularity_outlook/readability stay
-- nullable so Phase 2 (Jev) can fill them without a schema change.
CREATE TABLE IF NOT EXISTS article_scores (
    article_id TEXT PRIMARY KEY REFERENCES articles (id) ON DELETE CASCADE,
    worthy DOUBLE PRECISION NULL,
    interest DOUBLE PRECISION NULL,
    topic TEXT NULL,
    popularity_outlook DOUBLE PRECISION NULL,
    readability DOUBLE PRECISION NULL,
    scored_at TIMESTAMPTZ NULL,
    model TEXT NULL
);
