-- Create the Gitea database on fresh postgres init.
-- Runs only when pgdata is first created. Existing volumes need the manual
-- CREATE DATABASE step in deploy/README.md.
SELECT 'CREATE DATABASE gitea' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'gitea') \gexec
