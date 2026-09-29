-- V11 shipped the localhost origins and the VPN address, but this deployment
-- serves Gitea from https://thinkpad.lan/git/, and Gitea builds its callback
-- from GITEA_ROOT_URL: <root>/user/oauth2/<source>/callback. user-api matches
-- redirect_uri exactly, so the authorize request is rejected without a row for
-- the origin Gitea actually uses -- and it fails at the last hop, after the user
-- has already signed in, which reads as "sign-in is broken" with every
-- component reporting itself healthy.
--
-- A new migration rather than an edit to V11, because V11 is applied on the
-- deployed database and Flyway validates its checksum.
--
-- Add a row per additional host rather than changing code. The same applies to
-- the Grafana rows in V9 and V10: the deployed origin is whatever
-- GITEA_ROOT_URL and GRAFANA_ROOT_URL say, and the database has to know it.
INSERT INTO oauth_redirect_uris (client_id, redirect_uri) VALUES
('gitea', 'https://thinkpad.lan/git/user/oauth2/user-api/callback')
ON CONFLICT (client_id, redirect_uri) DO NOTHING;
