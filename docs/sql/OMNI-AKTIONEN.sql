-- Additive Omni-Aktionen: neue Tabellen und atomare Ausführungsfunktion.
-- Mit derselben Datenbankrolle wie DATABASE_URL ausführen. Keine bestehenden Tabellen verändern.
BEGIN;
SELECT pg_advisory_xact_lock(184730027);
CREATE TABLE IF NOT EXISTS v2_omni_action_plans(id uuid PRIMARY KEY,user_id text NOT NULL,request_id uuid NOT NULL,prompt text NOT NULL,time_zone text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','executed','cancelled')),operations jsonb NOT NULL,previews jsonb NOT NULL,result_links jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',executed_at timestamptz,UNIQUE(user_id,request_id));
CREATE INDEX IF NOT EXISTS v2_omni_action_plans_owner_idx ON v2_omni_action_plans(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS v2_omni_action_limits(user_id text PRIMARY KEY,next_plan_at timestamptz NOT NULL);
CREATE OR REPLACE FUNCTION public.omnidesk_execute_actions_v2(p_user text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $omni$
 DECLARE plan public.v2_omni_action_plans%ROWTYPE;op jsonb;a jsonb;target_id uuid;parent_id uuid;fingerprint text;
 BEGIN
 SELECT * INTO plan FROM public.v2_omni_action_plans WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OMNI_NOT_FOUND'; END IF;
 IF plan.status='executed' THEN RETURN jsonb_build_object('ok',true); END IF;
 IF plan.status<>'pending' OR plan.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'OMNI_EXPIRED'; END IF;
 FOR op IN SELECT value FROM jsonb_array_elements(plan.operations) LOOP
  a:=op->'after';target_id:=(op->>'id')::uuid;
  IF op->>'kind' IN ('create_project_task','update_project_task','append_project_note') THEN
   parent_id:=(op->>'projectId')::uuid;
   SELECT md5(to_jsonb(p)::text) INTO fingerprint FROM public.projects p WHERE p.id=parent_id AND p.user_id=p_user FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'OMNI_CONFLICT'; END IF;
   IF op->>'kind' IN ('create_project_task','append_project_note') AND fingerprint IS DISTINCT FROM op->>'projectVersion' THEN RAISE EXCEPTION 'OMNI_CONFLICT'; END IF;
  END IF;
  CASE op->>'kind'
  WHEN 'create_task' THEN
   INSERT INTO public.tasks(id,user_id,title,description,priority,status,due_date) VALUES(target_id,p_user,a->>'title',a->>'description',a->>'priority',a->>'status',(a->>'dueDate')::timestamptz);
  WHEN 'update_task' THEN
   SELECT md5(to_jsonb(t)::text) INTO fingerprint FROM public.tasks t WHERE t.id=target_id AND t.user_id=p_user FOR UPDATE;
   IF NOT FOUND OR fingerprint IS DISTINCT FROM op->'before'->>'version' THEN RAISE EXCEPTION 'OMNI_CONFLICT'; END IF;
   UPDATE public.tasks t SET title=CASE WHEN a?'title' THEN a->>'title' ELSE t.title END,
    description=CASE WHEN a?'description' THEN a->>'description' ELSE t.description END,
    priority=CASE WHEN a?'priority' THEN a->>'priority' ELSE t.priority END,
    status=CASE WHEN a?'status' THEN a->>'status' ELSE t.status END,
    due_date=CASE WHEN a?'dueDate' THEN (a->>'dueDate')::timestamptz ELSE t.due_date END,updated_at=clock_timestamp()
    WHERE t.id=target_id AND t.user_id=p_user;
  WHEN 'create_project_task' THEN
   INSERT INTO public.project_tasks(id,user_id,project_id,title,priority,status) VALUES(target_id,p_user,parent_id,a->>'title',a->>'priority',a->>'status');
  WHEN 'update_project_task' THEN
   SELECT md5(to_jsonb(t)::text) INTO fingerprint FROM public.project_tasks t WHERE t.id=target_id AND t.user_id=p_user AND t.project_id=parent_id FOR UPDATE;
   IF NOT FOUND OR fingerprint IS DISTINCT FROM op->'before'->>'version' THEN RAISE EXCEPTION 'OMNI_CONFLICT'; END IF;
   UPDATE public.project_tasks t SET title=CASE WHEN a?'title' THEN a->>'title' ELSE t.title END,
    priority=CASE WHEN a?'priority' THEN a->>'priority' ELSE t.priority END,
    status=CASE WHEN a?'status' THEN a->>'status' ELSE t.status END,updated_at=clock_timestamp()
    WHERE t.id=target_id AND t.user_id=p_user AND t.project_id=parent_id;
  WHEN 'append_project_note' THEN
   UPDATE public.projects SET description=a->>'description',updated_at=clock_timestamp() WHERE id=parent_id AND user_id=p_user;
  WHEN 'create_appointment' THEN
   INSERT INTO public.appointments(id,user_id,title,description,location,priority,starts_at,ends_at) VALUES(target_id,p_user,a->>'title',a->>'description',a->>'location',a->>'priority',(a->>'startsAt')::timestamptz,(a->>'endsAt')::timestamptz);
  ELSE RAISE EXCEPTION 'OMNI_INVALID';
  END CASE;
 END LOOP;
 UPDATE public.v2_omni_action_plans SET status='executed',executed_at=clock_timestamp() WHERE id=p_id AND user_id=p_user;
 RETURN jsonb_build_object('ok',true);
 END;
 $omni$;
COMMIT;
