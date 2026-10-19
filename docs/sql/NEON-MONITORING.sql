-- Additive V2 monitoring storage; no existing tables are altered.
BEGIN;
SELECT pg_advisory_xact_lock(184730019);
CREATE TABLE IF NOT EXISTS v2_neon_config (
    project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    user_id text NOT NULL, resource_key text NOT NULL, settings jsonb NOT NULL,
    last_attempt_at timestamptz, last_success_at timestamptz, last_scheduler_at timestamptz,
    last_snapshot jsonb, last_sql jsonb, failures integer NOT NULL DEFAULT 0,
    lease_token uuid, lease_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS v2_neon_samples (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id text NOT NULL, resource_key text NOT NULL, checked_at timestamptz NOT NULL, bucket timestamptz NOT NULL,
    source text NOT NULL CHECK (source IN ('manual','scheduler')), snapshot jsonb, sql_check jsonb,
    complete boolean NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS v2_neon_samples_unique ON v2_neon_samples(project_id, user_id, resource_key, bucket);
CREATE INDEX IF NOT EXISTS v2_neon_samples_lookup ON v2_neon_samples(project_id, user_id, resource_key, checked_at);
CREATE TABLE IF NOT EXISTS v2_neon_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id text NOT NULL, resource_key text NOT NULL, code text NOT NULL, message text NOT NULL,
    severity text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, acknowledged_at timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS v2_neon_alerts_open ON v2_neon_alerts(project_id, user_id, resource_key, code) WHERE resolved_at IS NULL;
COMMIT;
