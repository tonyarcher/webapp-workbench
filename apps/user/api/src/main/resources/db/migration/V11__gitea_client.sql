-- Gitea signs in through user-api like every other surface, so a forge account
-- and an accounts account are the same person. Registered as rows, per the
-- standing rule that the client ACL lives in the database and adding a client
-- is not a code change.
--
-- The secret is NOT stored here: Gitea reads it from GITEA_OAUTH_SECRET in the
-- untracked deploy/.env, and this row records only the id. See
-- deploy/.env.example.
INSERT INTO oauth_clients (client_id) VALUES
('gitea')
ON CONFLICT (client_id) DO NOTHING;

-- One row per origin Gitea is served from. The callback is the path Gitea
-- derives from its own ROOT_URL plus the auth source's name, so it moves with
-- both: a subpath deployment puts it under /git/, and a local run does not.
--
-- user-api matches redirect_uri exactly, so an origin without a row is rejected
-- at /oauth/authorize. Add a row for any further host rather than changing
-- code.
INSERT INTO oauth_redirect_uris (client_id, redirect_uri) VALUES
('gitea', 'http://localhost/git/user/oauth2/user-api/callback'),
('gitea', 'http://127.0.0.1/git/user/oauth2/user-api/callback'),
('gitea', 'http://10.0.0.63/git/user/oauth2/user-api/callback')
ON CONFLICT (client_id, redirect_uri) DO NOTHING;
