-- Stock game OAuth client. Same local-gateway seed pattern as V6:
-- production adds rows, not code.

INSERT INTO oauth_clients (client_id) VALUES
    ('stock-game')
ON CONFLICT (client_id) DO NOTHING;

INSERT INTO oauth_redirect_uris (client_id, redirect_uri) VALUES
    ('stock-game', 'http://localhost/stock-game/'),
    ('stock-game', 'http://127.0.0.1/stock-game/')
ON CONFLICT DO NOTHING;
