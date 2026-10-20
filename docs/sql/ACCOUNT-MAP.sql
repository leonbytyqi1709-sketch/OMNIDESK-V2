-- Requires the shared account-security table; adds only private relation storage.
BEGIN;
SELECT pg_advisory_xact_lock(184730023);
CREATE TABLE IF NOT EXISTS v2_account_relations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL,
    from_account_id uuid NOT NULL REFERENCES v2_account_security(id) ON DELETE CASCADE,
    to_account_id uuid NOT NULL REFERENCES v2_account_security(id) ON DELETE CASCADE,
    type text NOT NULL, login_dependency text,
    manual_reviewed_at timestamptz,version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT v2_account_relations_no_self CHECK(from_account_id <> to_account_id),
    CONSTRAINT v2_account_relations_type CHECK(type IN ('login','recovery_email','recovery_other')),
    CONSTRAINT v2_account_relations_dependency CHECK((type='login' AND login_dependency IS NOT NULL AND login_dependency IN ('only_known','alternative_known','unknown')) OR (type<>'login' AND login_dependency IS NULL)));
CREATE INDEX IF NOT EXISTS v2_account_relations_user ON v2_account_relations(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS v2_account_relations_pair ON v2_account_relations(user_id,from_account_id,to_account_id,type);
COMMIT;
