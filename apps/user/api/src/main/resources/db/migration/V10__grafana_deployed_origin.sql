-- V9 shipped only the localhost callback origins, which is right for a
-- developer's browser but not for the deployed host: Grafana is served from the
-- gateway at the VPN address, and user-api matches redirect_uri exactly, so the
-- authorize request is rejected without a row for that origin.
--
-- This is a new migration rather than an edit to V9, because V9 is already
-- applied on the deployed database and Flyway validates its checksum. Migrating
-- the origin into V9 would stop user-api booting on the next start.
--
-- Add a row per additional host rather than changing code. See the
-- oauth_redirect_uris example in deploy/.env.example.

INSERT INTO oauth_redirect_uris (client_id, redirect_uri) VALUES
('grafana', 'http://10.0.0.63/logs/login/generic_oauth')
ON CONFLICT (client_id, redirect_uri) DO NOTHING;
