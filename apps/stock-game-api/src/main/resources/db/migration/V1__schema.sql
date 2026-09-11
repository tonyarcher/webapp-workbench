CREATE TABLE IF NOT EXISTS game_config (
    key text PRIMARY KEY,
    value text NOT NULL
);

CREATE TABLE IF NOT EXISTS price_cache (
    symbol text NOT NULL,
    interval text NOT NULL,
    date bigint NOT NULL,
    open double precision NOT NULL,
    high double precision NOT NULL,
    low double precision NOT NULL,
    close double precision NOT NULL,
    volume bigint NOT NULL,
    PRIMARY KEY (symbol, interval, date)
);

CREATE TABLE IF NOT EXISTS trades (
    id bigserial PRIMARY KEY,
    symbol text NOT NULL,
    side text NOT NULL CHECK (side IN ('buy', 'sell', 'short', 'cover')),
    qty integer NOT NULL CHECK (qty > 0),
    price double precision NOT NULL,
    cash_delta_cents bigint NOT NULL,
    mode text NOT NULL CHECK (mode IN ('backdated', 'scheduled')),
    executed_at bigint NOT NULL,
    created_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id bigserial PRIMARY KEY,
    symbol text NOT NULL,
    side text NOT NULL CHECK (side IN ('buy', 'sell', 'short', 'cover')),
    qty integer NOT NULL CHECK (qty > 0),
    execute_at bigint NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'filled', 'cancelled')),
    created_at bigint NOT NULL,
    trade_id bigint UNIQUE REFERENCES trades (id),
    order_type text NOT NULL DEFAULT 'market'
        CHECK (order_type IN ('market', 'limit', 'stop', 'stopLimit')),
    tif text NOT NULL DEFAULT 'GTC' CHECK (tif IN ('DAY', 'GTC')),
    limit_price double precision,
    stop_price double precision,
    expires_at bigint,
    fill_price_source text NOT NULL DEFAULT 'last'
);

CREATE INDEX IF NOT EXISTS idx_price_cache_lookup ON price_cache (symbol, interval);
CREATE INDEX IF NOT EXISTS idx_trades_executed ON trades (executed_at);
CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders (status, execute_at);
