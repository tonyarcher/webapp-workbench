-- V2: portfolio per user. Identity users provision from user-api JWTs
-- (users.subject). Pre-existing single-player rows are adopted under one
-- legacy identity so no paper-trading history is lost. price_cache stays a
-- shared global pool.

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject text NOT NULL UNIQUE,
    username text,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO users (subject) VALUES ('local:legacy')
ON CONFLICT (subject) DO NOTHING;

ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users (id) ON DELETE CASCADE;
UPDATE trades SET user_id = (SELECT id FROM users WHERE subject = 'local:legacy')
WHERE user_id IS NULL;
ALTER TABLE trades ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trades_user_executed ON trades (user_id, executed_at);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users (id) ON DELETE CASCADE;
UPDATE orders SET user_id = (SELECT id FROM users WHERE subject = 'local:legacy')
WHERE user_id IS NULL;
ALTER TABLE orders ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user_pending ON orders (user_id, status, execute_at);

ALTER TABLE game_config ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users (id) ON DELETE CASCADE;
UPDATE game_config SET user_id = (SELECT id FROM users WHERE subject = 'local:legacy')
WHERE user_id IS NULL;
ALTER TABLE game_config ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE game_config DROP CONSTRAINT IF EXISTS game_config_pkey;
ALTER TABLE game_config ADD PRIMARY KEY (user_id, key);
