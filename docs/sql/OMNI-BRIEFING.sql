-- Additive Omni-Briefing-Tabellen; keine bestehenden Tabellen verändern.
BEGIN;
SELECT pg_advisory_xact_lock(184730025);
CREATE TABLE IF NOT EXISTS v2_briefing_state(user_id text PRIMARY KEY,preferences jsonb NOT NULL,version integer NOT NULL DEFAULT 1,
    last_visit_at timestamptz,ai_digest text,ai_message jsonb,ai_generated_at timestamptz,next_ai_at timestamptz,lease_token uuid,lease_until timestamptz);
CREATE TABLE IF NOT EXISTS v2_briefing_visits(user_id text NOT NULL,visit_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),previous_visit_at timestamptz,PRIMARY KEY(user_id,visit_id));
COMMIT;
