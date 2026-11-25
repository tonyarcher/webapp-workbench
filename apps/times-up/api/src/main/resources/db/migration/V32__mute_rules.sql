-- V32: per-user mute rules for promotion veto (R19).
CREATE TABLE IF NOT EXISTS mute_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    terms text NOT NULL,
    match_target varchar(16) NOT NULL DEFAULT 'either',
    enabled boolean NOT NULL DEFAULT true,
    scope_kind varchar(16) NOT NULL DEFAULT 'all',
    scope_folders text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mute_rules_user ON mute_rules (user_id);
