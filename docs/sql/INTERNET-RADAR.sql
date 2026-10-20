-- Additiver Internet-Radar. Keine bestehenden Tabellen veraendern.
BEGIN;
SELECT pg_advisory_xact_lock(184730031);
CREATE TABLE IF NOT EXISTS v2_radar_topics(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,keywords jsonb NOT NULL,project_id uuid,enabled boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS v2_radar_sources(id uuid PRIMARY KEY,user_id text NOT NULL,topic_id uuid NOT NULL REFERENCES v2_radar_topics(id) ON DELETE CASCADE,name text NOT NULL,url text NOT NULL,category text NOT NULL CHECK(category IN ('news','security','release','status')),enabled boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,last_attempt timestamptz,last_success timestamptz,last_scheduler_at timestamptz,error text,etag text,modified text,lease_token uuid,lease_until timestamptz,UNIQUE(user_id,topic_id,url));
CREATE TABLE IF NOT EXISTS v2_radar_items(id uuid PRIMARY KEY,user_id text NOT NULL,source_id uuid NOT NULL REFERENCES v2_radar_sources(id) ON DELETE CASCADE,title text NOT NULL,url text NOT NULL,excerpt text NOT NULL,published_at timestamptz,found_at timestamptz NOT NULL DEFAULT now(),read boolean NOT NULL DEFAULT false,saved boolean NOT NULL DEFAULT false,project_id uuid,project_override boolean NOT NULL DEFAULT false,memory_id uuid NOT NULL DEFAULT gen_random_uuid(),explanation jsonb,explanation_at timestamptz,UNIQUE(source_id,url));
CREATE INDEX IF NOT EXISTS v2_radar_items_owner_idx ON v2_radar_items(user_id,found_at DESC);
COMMIT;
