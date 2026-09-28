-- Login attempt throttling lives here, not in an API replica's heap. An
-- in-memory counter multiplies the effective limit by the replica count, so two
-- replicas would silently allow twice the attempts before blocking.

CREATE TABLE rate_limit_buckets (
    bucket_key text PRIMARY KEY,
    window_started_at timestamptz NOT NULL,
    hits integer NOT NULL
);

-- Nothing expires these on a timer, so callers need a cheap way to drop keys
-- nobody has touched since the previous window.
CREATE INDEX rate_limit_buckets_window ON rate_limit_buckets (window_started_at);
