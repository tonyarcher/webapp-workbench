ALTER TABLE users ADD COLUMN webauthn_handle bytea;

CREATE TABLE passkeys (
    credential_id bytea PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_handle bytea NOT NULL,
    public_key bytea NOT NULL,
    sign_count bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_passkeys_user_id ON passkeys (user_id);

CREATE TABLE webauthn_challenges (
    id text PRIMARY KEY,
    kind text NOT NULL,
    user_id uuid REFERENCES users (id) ON DELETE CASCADE,
    payload text NOT NULL,
    expires_at timestamptz NOT NULL
);
