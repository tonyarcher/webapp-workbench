CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    label text NOT NULL DEFAULT 'local',
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO users (id, label)
VALUES ('00000000-0000-4000-8000-000000000001', 'local')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS profile (
    user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    sex text,
    birth_year integer,
    height_m real,
    display_unit text NOT NULL DEFAULT 'kg',
    tm_squat_kg real,
    tm_bench_kg real,
    tm_deadlift_kg real,
    tm_press_kg real,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS samples (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    metric text NOT NULL,
    t timestamptz NOT NULL,
    value_si double precision NOT NULL,
    source text NOT NULL,
    origin_id text NOT NULL,
    hidden boolean NOT NULL DEFAULT false,
    note text,
    UNIQUE (user_id, metric, t, source, origin_id)
);

CREATE INDEX IF NOT EXISTS idx_samples_metric_t ON samples (user_id, metric, t DESC);

CREATE TABLE IF NOT EXISTS daily_rollups (
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    metric text NOT NULL,
    day date NOT NULL,
    min_si double precision,
    max_si double precision,
    avg_si double precision,
    sum_si double precision,
    n integer NOT NULL,
    PRIMARY KEY (user_id, metric, day)
);

CREATE TABLE IF NOT EXISTS imports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    source text NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    row_count integer,
    error_count integer,
    errors jsonb
);
