import {LOCAL_USER_ID} from './env.js';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT 'local',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO users (id, label)
VALUES ('${LOCAL_USER_ID}', 'local')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS profile (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
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
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric text NOT NULL,
  t timestamptz NOT NULL,
  value_si double precision NOT NULL,
  source text NOT NULL,
  origin_id text NOT NULL,
  UNIQUE (user_id, metric, t, source, origin_id)
);

CREATE INDEX IF NOT EXISTS idx_samples_metric_t ON samples (user_id, metric, t DESC);

CREATE TABLE IF NOT EXISTS daily_rollups (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric text NOT NULL,
  day date NOT NULL,
  min_si double precision,
  max_si double precision,
  avg_si double precision,
  sum_si double precision,
  n integer NOT NULL,
  PRIMARY KEY (user_id, metric, day)
);

CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  discarded_at timestamptz,
  program_template text,
  cycle integer,
  week integer,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sets (
  id uuid PRIMARY KEY,
  workout_id uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  lift text NOT NULL,
  slot text NOT NULL,
  set_index integer NOT NULL,
  weight_kg real NOT NULL,
  reps integer NOT NULL,
  amrap boolean NOT NULL DEFAULT false,
  completed boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS programs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  cycle integer NOT NULL DEFAULT 1,
  started_on date NOT NULL,
  ended_on date
);

CREATE TABLE IF NOT EXISTS phases (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text NOT NULL,
  started_on date NOT NULL,
  ended_on date,
  color text,
  notes text
);

CREATE TABLE IF NOT EXISTS thresholds (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric text NOT NULL,
  comparator text NOT NULL,
  value_si double precision NOT NULL,
  band text NOT NULL,
  phase_id uuid REFERENCES phases(id) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  row_count integer,
  error_count integer,
  errors jsonb
);

CREATE TABLE IF NOT EXISTS nutrition_days (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  source text NOT NULL,
  kcal real,
  protein_g real,
  carb_g real,
  fat_g real,
  extras jsonb,
  PRIMARY KEY (user_id, day, source)
);

CREATE TABLE IF NOT EXISTS outbox_acks (
  op_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applied_at timestamptz NOT NULL DEFAULT now()
);
`;
