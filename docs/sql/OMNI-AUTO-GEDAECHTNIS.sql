-- Voraussetzung: bestehendes Omni-Gedaechtnis. Additive Tabellen ohne Umbau.
BEGIN;
SELECT pg_advisory_xact_lock(184730030);
CREATE TABLE IF NOT EXISTS v2_omni_memory_captures(source_id uuid PRIMARY KEY REFERENCES chat_messages(id) ON DELETE CASCADE,assistant_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,user_id text NOT NULL,project_id uuid,status text NOT NULL CHECK(status IN ('processing','done','failed')),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS v2_omni_memory_auto_events(id uuid PRIMARY KEY,user_id text NOT NULL,source_id uuid NOT NULL REFERENCES v2_omni_memory_captures(source_id) ON DELETE CASCADE,slot integer NOT NULL,project_id uuid,target_id uuid NOT NULL,target_version integer,memory_id uuid REFERENCES v2_omni_memories(id) ON DELETE CASCADE,saved_version integer,status text NOT NULL CHECK(status IN ('pending','saved','dismissed')),proposal jsonb,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(source_id,slot));
CREATE INDEX IF NOT EXISTS v2_omni_memory_auto_owner_idx ON v2_omni_memory_auto_events(user_id,created_at DESC);
COMMIT;
