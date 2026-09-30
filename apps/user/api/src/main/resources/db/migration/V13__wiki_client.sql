-- Wiki.js signs in through user-api like every other surface, so a wiki account
-- and an accounts account are the same person. Registered as rows, per the
-- standing rule that the client ACL lives in the database.
--
-- The secret is NOT stored here: Wiki.js reads it from WIKI_OAUTH_SECRET in the
-- untracked deploy/.env, and this row records only the client id.
INSERT INTO oauth_clients (client_id) VALUES
('wiki')
ON CONFLICT (client_id) DO NOTHING;

-- The callback is Wiki.js's own, /_api/auth/{strategy-uuid}/callback, where the
-- uuid is that strategy's row in its own `authentication` table. Wiki.js 3 has
-- no rootUrl setting, so it serves itself on a port rather than behind a gateway
-- prefix -- the 3.x page loads assets from root-relative /_assets/... URLs, which
-- escape a prefix and 404. See tools/seed_wiki_oidc.py, which inserts the
-- strategy with the id below so this URI is stable across a rebuild.
--
-- The id is uuid5(NAMESPACE_DNS, 'wiki.oidc.strategy.thinkpad.lan'), so it can be
-- recomputed rather than copied by hand.
--
-- One row per origin. user-api matches redirect_uri exactly, so a missing row is
-- a 400 at /oauth/authorize, not a warning.
INSERT INTO oauth_redirect_uris (client_id, redirect_uri) VALUES
('wiki', 'http://thinkpad.lan:3001/_api/auth/7696d029-3494-5d9e-a102-ba1a379e5079/callback'),
('wiki', 'http://10.0.0.63:3001/_api/auth/7696d029-3494-5d9e-a102-ba1a379e5079/callback'),
('wiki', 'http://localhost:3001/_api/auth/7696d029-3494-5d9e-a102-ba1a379e5079/callback')
ON CONFLICT (client_id, redirect_uri) DO NOTHING;
