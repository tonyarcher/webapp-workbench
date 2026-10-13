-- Calendar Sync OAuth client. Same local-gateway seed pattern as V7:
-- production adds rows, not code.

INSERT INTO oauth_clients (client_id) VALUES
('calendar-sync')
ON CONFLICT (client_id) DO NOTHING;

INSERT INTO oauth_redirect_uris (client_id, redirect_uri) VALUES
('calendar-sync', 'http://localhost/calendar-sync/'),
('calendar-sync', 'http://127.0.0.1/calendar-sync/')
ON CONFLICT DO NOTHING;
