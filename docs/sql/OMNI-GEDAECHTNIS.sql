-- Additives Omni-Gedaechtnis: keine bestehenden Tabellen oder Spalten veraendern.
BEGIN;
SELECT pg_advisory_xact_lock(184730028);
CREATE TABLE IF NOT EXISTS v2_omni_memories(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL,content text NOT NULL,category text NOT NULL CHECK(category IN ('preference','knowledge','decision')),project_id uuid,pinned boolean NOT NULL DEFAULT false,archived boolean NOT NULL DEFAULT false,source_message_id uuid,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS v2_omni_memories_owner_idx ON v2_omni_memories(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS v2_omni_memory_versions(memory_id uuid NOT NULL REFERENCES v2_omni_memories(id) ON DELETE CASCADE,user_id text NOT NULL,version integer NOT NULL,title text NOT NULL,content text NOT NULL,category text NOT NULL,project_id uuid,pinned boolean NOT NULL,archived boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(memory_id,version));
CREATE TABLE IF NOT EXISTS v2_omni_memory_receipts(message_id uuid PRIMARY KEY REFERENCES chat_messages(id) ON DELETE CASCADE,user_id text NOT NULL,status text NOT NULL CHECK(status IN ('used','none','disabled','unavailable')),project_id uuid,refs jsonb NOT NULL DEFAULT '[]',created_at timestamptz NOT NULL DEFAULT now());
COMMIT;
