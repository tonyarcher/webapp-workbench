-- Add the gateway hostname's callback, so a sign-in that starts on
-- wiki.thinkpad.lan comes back to the gateway rather than to the published
-- fallback port.
--
-- The strategy id is the same pinned uuid5 as the rows below, because it is the
-- same Wiki.js strategy row (tools/seed_wiki_oidc.py inserts it under that id).
-- user-api matches redirect_uri exactly, so a missing row is a 400 at
-- /oauth/authorize rather than a warning.
INSERT INTO oauth_redirect_uris (client_id, redirect_uri) VALUES
('wiki', 'http://wiki.thinkpad.lan/_api/auth/7696d029-3494-5d9e-a102-ba1a379e5079/callback'),
('wiki', 'https://wiki.thinkpad.lan/_api/auth/7696d029-3494-5d9e-a102-ba1a379e5079/callback')
ON CONFLICT (client_id, redirect_uri) DO NOTHING;
