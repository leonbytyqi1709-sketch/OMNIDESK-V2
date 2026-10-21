-- Nur additive Browser-Kommandoebene-Tabellen; bestehende Daten bleiben erhalten.
BEGIN;
SELECT pg_advisory_xact_lock(184730022);
CREATE TABLE IF NOT EXISTS v2_browser_items(id uuid PRIMARY KEY,user_id text NOT NULL,url text NOT NULL,title text NOT NULL,selection text NOT NULL,annotation text NOT NULL,project_id uuid REFERENCES projects(id) ON DELETE SET NULL,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS v2_browser_items_owner_url ON v2_browser_items(user_id,url,updated_at DESC);
CREATE TABLE IF NOT EXISTS v2_browser_pairings(code_hash text PRIMARY KEY,user_id text NOT NULL,challenge text NOT NULL,expires_at timestamptz NOT NULL,consumed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS v2_browser_devices(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,token_hash text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,last_used_at timestamptz,revoked_at timestamptz);
COMMIT;
