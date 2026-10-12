-- V2: Trakt credential vault. One row per user: the user's own Trakt app
-- credentials plus the OAuth tokens from the device flow. Tokens never leave
-- the server except to api.trakt.tv; API responses carry status only.
CREATE TABLE IF NOT EXISTS trakt_credentials (
    user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    access_token text,
    refresh_token text,
    expires_at timestamptz
);
