export const SCHEMA = `
CREATE TABLE IF NOT EXISTS tracks (
  id uuid PRIMARY KEY,
  mbid text UNIQUE,
  artist text NOT NULL,
  title text NOT NULL,
  duration_ms integer NOT NULL,
  year integer,
  genre text NOT NULL,
  era text NOT NULL,
  rotation text NOT NULL,
  rank integer NOT NULL,
  explicit boolean NOT NULL DEFAULT false,
  radio_edit boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_tracks_rotation_rank ON tracks (rotation, rank);
CREATE INDEX IF NOT EXISTS idx_tracks_era ON tracks (era);

CREATE TABLE IF NOT EXISTS stations (
  id text PRIMARY KEY,
  name text NOT NULL,
  format text NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
  id uuid PRIMARY KEY,
  station_id text NOT NULL REFERENCES stations(id),
  seed text NOT NULL,
  starts_at timestamptz NOT NULL,
  duration_ms bigint NOT NULL,
  weights jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (station_id, seed, starts_at, weights)
);

CREATE TABLE IF NOT EXISTS playlist_entries (
  playlist_id uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  idx integer NOT NULL,
  track_id uuid NOT NULL REFERENCES tracks(id),
  starts_at timestamptz NOT NULL,
  duration_ms integer NOT NULL,
  PRIMARY KEY (playlist_id, idx)
);

CREATE INDEX IF NOT EXISTS idx_playlist_entries_start ON playlist_entries (playlist_id, starts_at);
`;
