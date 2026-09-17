-- OAuth client ACL lives in tables, not in Kotlin. Seed is local gateway
-- defaults. Add rows for other hosts instead of hardcoding product lists.

CREATE TABLE oauth_clients (
    client_id text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE oauth_redirect_uris (
    client_id text NOT NULL REFERENCES oauth_clients (client_id) ON DELETE CASCADE,
    redirect_uri text NOT NULL,
    PRIMARY KEY (client_id, redirect_uri)
);

INSERT INTO oauth_clients (client_id) VALUES
    ('fitness'),
    ('rss-reader'),
    ('user-web');

INSERT INTO oauth_redirect_uris (client_id, redirect_uri) VALUES
    ('fitness', 'http://localhost/fitness/'),
    ('fitness', 'http://127.0.0.1/fitness/'),
    ('rss-reader', 'http://localhost/rss-reader/'),
    ('rss-reader', 'http://127.0.0.1/rss-reader/'),
    ('user-web', 'http://localhost/auth/'),
    ('user-web', 'http://127.0.0.1/auth/');
