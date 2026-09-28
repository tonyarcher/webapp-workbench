-- Grafana signs in through user-api like every other surface, so log access uses
-- the same identity rather than a second set of credentials. Registered here as
-- a row, per the standing rule that the client ACL lives in the database.
--
-- The shared secret is NOT stored here: Grafana reads it from
-- GRAFANA_OAUTH_SECRET in the untracked deploy/.env, and the client row only
-- records the id. See deploy/.env.example.

INSERT INTO oauth_clients (client_id) VALUES
('grafana')
ON CONFLICT (client_id) DO NOTHING;

-- One row per origin the viewer is served from. The callback path is Grafana's
-- /login/generic_oauth appended to its root_url, so it moves with the prefix.
-- Add a row for any additional host rather than changing code -- see the
-- oauth_redirect_uris example in deploy/.env.example.
INSERT INTO oauth_redirect_uris (client_id, redirect_uri) VALUES
('grafana', 'http://localhost/logs/login/generic_oauth'),
('grafana', 'http://127.0.0.1/logs/login/generic_oauth')
ON CONFLICT (client_id, redirect_uri) DO NOTHING;
