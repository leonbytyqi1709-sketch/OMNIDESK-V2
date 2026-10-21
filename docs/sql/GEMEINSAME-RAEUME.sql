-- Additiv; keine Änderungen an bestehenden Tabellen.
BEGIN;
SELECT pg_advisory_xact_lock(184730023);
CREATE TABLE IF NOT EXISTS v2_shared_rooms(id uuid PRIMARY KEY,owner_id text NOT NULL,creation_hash text NOT NULL,title text NOT NULL,description text NOT NULL,expires_at timestamptz NOT NULL,closed boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS v2_shared_rooms_owner ON v2_shared_rooms(owner_id);
CREATE TABLE IF NOT EXISTS v2_room_members(id uuid PRIMARY KEY,room_id uuid NOT NULL REFERENCES v2_shared_rooms(id) ON DELETE CASCADE,user_id text NOT NULL,name text NOT NULL,role text NOT NULL CHECK(role IN ('reader','editor')),revoked boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,UNIQUE(room_id,user_id));
CREATE INDEX IF NOT EXISTS v2_room_members_user ON v2_room_members(user_id);
CREATE TABLE IF NOT EXISTS v2_room_invites(id uuid PRIMARY KEY,room_id uuid NOT NULL REFERENCES v2_shared_rooms(id) ON DELETE CASCADE,token_hash text NOT NULL UNIQUE,role text NOT NULL CHECK(role IN ('reader','editor')),expires_at timestamptz NOT NULL,revoked boolean NOT NULL DEFAULT false,consumed_by text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS v2_room_items(id uuid PRIMARY KEY,room_id uuid NOT NULL REFERENCES v2_shared_rooms(id) ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN ('list','pin')),text text NOT NULL,done boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS v2_room_items_room ON v2_room_items(room_id);
COMMIT;
