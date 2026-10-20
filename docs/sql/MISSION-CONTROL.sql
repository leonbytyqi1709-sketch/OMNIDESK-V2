-- Additive Mission-Control-Tabellen. Bestehende Daten bleiben unveraendert.
BEGIN;
SELECT pg_advisory_xact_lock(184730021);
CREATE TABLE IF NOT EXISTS v2_mission_settings(project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,user_id text NOT NULL,monitor_ids jsonb NOT NULL,version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS v2_mission_visits(project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,user_id text NOT NULL,visit_id uuid NOT NULL,baseline jsonb,baseline_at timestamptz,latest jsonb NOT NULL,last_visit_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(project_id,user_id,visit_id));
CREATE TABLE IF NOT EXISTS v2_mission_ai_limits(user_id text PRIMARY KEY,next_at timestamptz NOT NULL);
COMMIT;
