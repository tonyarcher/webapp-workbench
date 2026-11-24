-- Rename the reader OAuth client while preserving every registered origin.
-- Fresh databases still pass through V6 first; this migration makes the final
-- client id and redirect paths match the Times Up product name.
INSERT INTO oauth_clients (client_id)
VALUES ('times-up')
ON CONFLICT (client_id) DO NOTHING;

INSERT INTO oauth_redirect_uris (client_id, redirect_uri)
SELECT 'times-up', replace(redirect_uri, '/rss-reader/', '/times-up/')
FROM oauth_redirect_uris
WHERE client_id = 'rss-reader'
ON CONFLICT (client_id, redirect_uri) DO NOTHING;

UPDATE oauth_refresh_tokens SET client_id = 'times-up' WHERE client_id = 'rss-reader';
DELETE FROM oauth_redirect_uris WHERE client_id = 'rss-reader';
DELETE FROM oauth_clients WHERE client_id = 'rss-reader';
