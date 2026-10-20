-- Additive account-security documentation; no existing account/vault records are changed.
BEGIN;
SELECT pg_advisory_xact_lock(184730021);
CREATE TABLE IF NOT EXISTS v2_account_security (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL,
    connected_account_id uuid REFERENCES connected_accounts(id) ON DELETE SET NULL,
    details jsonb NOT NULL, manual_reviewed_at timestamptz, version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS v2_account_security_user ON v2_account_security(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS v2_account_security_connection ON v2_account_security(user_id,connected_account_id) WHERE connected_account_id IS NOT NULL;
COMMIT;
