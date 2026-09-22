-- V7: generated newspaper editions (Phase A: deterministic clustering + chat-model summaries).
-- Status is building|ready|failed. Body holds the edition JSON; Phase B enriches it via the EditionEnrichment seam.
CREATE TABLE IF NOT EXISTS editions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CONSTRAINT chk_editions_status CHECK (status IN ('building', 'ready', 'failed')),
    body TEXT NULL,
    model TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_editions_created ON editions (created_at DESC);
