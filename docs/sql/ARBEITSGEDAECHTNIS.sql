-- Additive Tabellen, eigene Funktionen und Trigger; keine vorhandenen Daten bereinigen.
BEGIN;
SELECT pg_advisory_xact_lock(184730024);
CREATE TABLE IF NOT EXISTS v2_history_settings(user_id text PRIMARY KEY,enabled boolean NOT NULL DEFAULT true,retention_days integer NOT NULL DEFAULT 90 CHECK(retention_days IN (7,30,90,365)),max_versions integer NOT NULL DEFAULT 50 CHECK(max_versions IN (10,25,50)));
CREATE TABLE IF NOT EXISTS v2_history_heads(user_id text NOT NULL,kind text NOT NULL,object_id uuid NOT NULL,revision integer NOT NULL,PRIMARY KEY(user_id,kind,object_id));
CREATE TABLE IF NOT EXISTS v2_working_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,kind text NOT NULL CHECK(kind IN ('note','task','project_task')),object_id uuid NOT NULL,revision integer NOT NULL,snapshot jsonb NOT NULL,operation text NOT NULL,source text NOT NULL,captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(user_id,kind,object_id,revision));
CREATE INDEX IF NOT EXISTS v2_working_history_lookup ON v2_working_history(user_id,kind,object_id,captured_at DESC);
CREATE OR REPLACE FUNCTION public.omnidesk_history_snapshot_v2(k text,r jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $history$
    SELECT CASE k WHEN 'note' THEN jsonb_build_object('title',r->'title','content',r->'content')
      WHEN 'task' THEN jsonb_build_object('title',r->'title','description',r->'description','priority',r->'priority','status',r->'status','dueDate',r->'due_date','tags',r->'tags','subtasks',r->'subtasks')
      WHEN 'project_task' THEN jsonb_build_object('title',r->'title','status',r->'status','priority',r->'priority') END
    $history$;
CREATE OR REPLACE FUNCTION public.omnidesk_history_prune_v2(u text) RETURNS void LANGUAGE sql SET search_path=pg_catalog,public AS $history$
    DELETE FROM public.v2_working_history WHERE id IN (
      SELECT id FROM (SELECT h.id,h.captured_at,row_number() OVER(PARTITION BY h.kind,h.object_id ORDER BY h.revision DESC) AS n,
        coalesce(s.retention_days,90) AS days,coalesce(s.max_versions,50) AS cap
        FROM public.v2_working_history h LEFT JOIN public.v2_history_settings s ON s.user_id=h.user_id WHERE h.user_id=u) q
      WHERE captured_at<clock_timestamp()-days*interval '1 day' OR n>cap)
    $history$;
CREATE OR REPLACE FUNCTION public.omnidesk_history_record_v2(u text,k text,o uuid,s jsonb,op text,src text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $history$
    DECLARE n integer;
    BEGIN
      INSERT INTO public.v2_history_heads(user_id,kind,object_id,revision) VALUES(u,k,o,1)
      ON CONFLICT(user_id,kind,object_id) DO UPDATE SET revision=v2_history_heads.revision+1 RETURNING revision INTO n;
      INSERT INTO public.v2_working_history(user_id,kind,object_id,revision,snapshot,operation,source) VALUES(u,k,o,n,s,op,src);
    END $history$;
CREATE OR REPLACE FUNCTION public.omnidesk_history_capture_v2() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $history$
    DECLARE k text:=TG_ARGV[0];u text;o uuid;before_state jsonb;after_state jsonb;src text;active boolean;days integer;cap integer;
    BEGIN
      IF TG_OP='DELETE' THEN
        PERFORM pg_advisory_xact_lock_shared(hashtextextended('working-history:'||OLD.user_id,0));
        DELETE FROM public.v2_working_history WHERE user_id=OLD.user_id AND kind=k AND object_id=OLD.id;
        DELETE FROM public.v2_history_heads WHERE user_id=OLD.user_id AND kind=k AND object_id=OLD.id;
        RETURN OLD;
      END IF;
      u:=NEW.user_id;o:=NEW.id;
      PERFORM pg_advisory_xact_lock_shared(hashtextextended('working-history:'||u,0));
      IF TG_OP='UPDATE' AND OLD.user_id IS DISTINCT FROM u THEN
        DELETE FROM public.v2_working_history WHERE user_id=OLD.user_id AND kind=k AND object_id=o;
        DELETE FROM public.v2_history_heads WHERE user_id=OLD.user_id AND kind=k AND object_id=o;
      END IF;
      SELECT coalesce(s.enabled,true),coalesce(s.retention_days,90),coalesce(s.max_versions,50) INTO active,days,cap FROM (SELECT 1) q LEFT JOIN public.v2_history_settings s ON s.user_id=u;
      IF NOT active THEN RETURN NEW; END IF;
      IF k='project_task' THEN
        IF NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=NEW.project_id AND p.user_id=u) THEN RETURN NEW; END IF;
      END IF;
      after_state:=public.omnidesk_history_snapshot_v2(k,to_jsonb(NEW));
      src:=coalesce(nullif(current_setting('omnidesk.history_source',true),''),'module');
      IF src NOT IN ('module','omni','restore') THEN src:='module'; END IF;
      IF TG_OP='UPDATE' AND OLD.user_id=u THEN
        before_state:=public.omnidesk_history_snapshot_v2(k,to_jsonb(OLD));
        IF before_state=after_state THEN RETURN NEW; END IF;
        IF NOT EXISTS(SELECT 1 FROM public.v2_history_heads WHERE user_id=u AND kind=k AND object_id=o) THEN
          PERFORM public.omnidesk_history_record_v2(u,k,o,before_state,'baseline','module');
        END IF;
      END IF;
      PERFORM public.omnidesk_history_record_v2(u,k,o,after_state,CASE WHEN src='restore' THEN 'restored' WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,src);
      DELETE FROM public.v2_working_history WHERE user_id=u AND kind=k AND object_id=o AND
        (captured_at<clock_timestamp()-days*interval '1 day' OR id IN(SELECT id FROM public.v2_working_history WHERE user_id=u AND kind=k AND object_id=o ORDER BY revision DESC OFFSET cap));
      RETURN NEW;
    END $history$;
DO $history$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='v2_history_notes' AND tgrelid='public.notes'::regclass) THEN CREATE TRIGGER v2_history_notes AFTER INSERT OR UPDATE OR DELETE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.omnidesk_history_capture_v2('note'); END IF; END $history$;
DO $history$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='v2_history_tasks' AND tgrelid='public.tasks'::regclass) THEN CREATE TRIGGER v2_history_tasks AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.omnidesk_history_capture_v2('task'); END IF; END $history$;
DO $history$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='v2_history_project_tasks' AND tgrelid='public.project_tasks'::regclass) THEN CREATE TRIGGER v2_history_project_tasks AFTER INSERT OR UPDATE OR DELETE ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.omnidesk_history_capture_v2('project_task'); END IF; END $history$;
SELECT pg_advisory_xact_lock(184730031);
CREATE TABLE IF NOT EXISTS v2_mission_records(id uuid PRIMARY KEY,user_id text NOT NULL,creation_hash text NOT NULL,title text NOT NULL,project_id uuid REFERENCES projects(id) ON DELETE SET NULL,state text NOT NULL CHECK(state IN ('active','paused','archived')),context text NOT NULL,decisions text NOT NULL,outcome text NOT NULL,questions text NOT NULL,next_steps text NOT NULL,sources jsonb NOT NULL,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),archived_at timestamptz);
CREATE INDEX IF NOT EXISTS v2_mission_records_owner ON v2_mission_records(user_id,state,updated_at DESC);
COMMIT;
