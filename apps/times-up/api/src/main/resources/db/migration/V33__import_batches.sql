-- V33: import batch status for progress/resume (R22).
CREATE TABLE IF NOT EXISTS import_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    fingerprint varchar(64) NOT NULL,
    state varchar(16) NOT NULL DEFAULT 'running',
    parsed int NOT NULL DEFAULT 0,
    resolved int NOT NULL DEFAULT 0,
    discovered int NOT NULL DEFAULT 0,
    failed int NOT NULL DEFAULT 0,
    pending int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_import_batches_user ON import_batches (user_id);
