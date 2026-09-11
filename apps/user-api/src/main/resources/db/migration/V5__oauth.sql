CREATE TABLE oauth_signing_keys (
    kid text PRIMARY KEY,
    jwk text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE oauth_auth_codes (
    code_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    client_id text NOT NULL,
    redirect_uri text NOT NULL,
    code_challenge text NOT NULL,
    expires_at timestamptz NOT NULL
);

CREATE TABLE oauth_refresh_tokens (
    token_hash text PRIMARY KEY,
    family_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    client_id text NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_oauth_refresh_family ON oauth_refresh_tokens (family_id);
