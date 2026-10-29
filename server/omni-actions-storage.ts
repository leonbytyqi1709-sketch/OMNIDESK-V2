import { randomUUID } from 'node:crypto'
import { connectionsDdl } from './connections-storage'
import { monitoringSql } from './neon-storage'
import { retireWorkingHistory } from './retire-working-history'
import { OmniActionError } from './omni-actions-policy'
import type { prepareOmniOperations } from './omni-actions-prepare'
import type { OmniActionPlan } from '../src/types/omni-actions'
export const omniActionsDdl = [
  // Omni kann seit dem 29.10.2026 auch verknüpfen; die Tabelle dafür stammt
  // aus der Verknüpfungs-Ebene und wird hier nur mit angelegt.
  ...connectionsDdl,
  // Bewusst plpgsql: Eine SQL-Funktion würde beim Anlegen sofort gegen alle
  // genannten Tabellen geprüft und scheitern, solange eine davon fehlt.
  `CREATE OR REPLACE FUNCTION public.omnidesk_owns_entity(p_user text,p_kind text,p_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $owns$
   BEGIN
   RETURN CASE p_kind
     WHEN 'note' THEN EXISTS(SELECT 1 FROM public.notes WHERE id=p_id AND user_id=p_user)
     WHEN 'task' THEN EXISTS(SELECT 1 FROM public.tasks WHERE id=p_id AND user_id=p_user)
     WHEN 'appointment' THEN EXISTS(SELECT 1 FROM public.appointments WHERE id=p_id AND user_id=p_user)
     WHEN 'contact' THEN EXISTS(SELECT 1 FROM public.contacts WHERE id=p_id AND user_id=p_user)
     WHEN 'project' THEN EXISTS(SELECT 1 FROM public.projects WHERE id=p_id AND user_id=p_user)
     ELSE false END;
   END;
  $owns$`,
  `CREATE TABLE IF NOT EXISTS v2_omni_action_plans(id uuid PRIMARY KEY,user_id text NOT NULL,request_id uuid NOT NULL,prompt text NOT NULL,time_zone text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','executed','cancelled')),operations jsonb NOT NULL,previews jsonb NOT NULL,result_links jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',executed_at timestamptz,UNIQUE(user_id,request_id))`,
  `CREATE INDEX IF NOT EXISTS v2_omni_action_plans_owner_idx ON v2_omni_action_plans(user_id,created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS v2_omni_action_limits(user_id text PRIMARY KEY,next_plan_at timestamptz NOT NULL)`,
  `CREATE OR REPLACE FUNCTION public.omnidesk_execute_actions_v3(p_user text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $omni$
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
  WHEN 'update_appointment' THEN
   SELECT md5(to_jsonb(x)::text) INTO fingerprint FROM public.appointments x WHERE x.id=target_id AND x.user_id=p_user FOR UPDATE;
   IF NOT FOUND OR fingerprint IS DISTINCT FROM op->'before'->>'version' THEN RAISE EXCEPTION 'OMNI_CONFLICT'; END IF;
   UPDATE public.appointments x SET title=CASE WHEN a?'title' THEN a->>'title' ELSE x.title END,
    description=CASE WHEN a?'description' THEN a->>'description' ELSE x.description END,
    location=CASE WHEN a?'location' THEN a->>'location' ELSE x.location END,
    priority=CASE WHEN a?'priority' THEN a->>'priority' ELSE x.priority END,
    starts_at=CASE WHEN a?'startsAt' THEN (a->>'startsAt')::timestamptz ELSE x.starts_at END,
    ends_at=CASE WHEN a?'endsAt' THEN (a->>'endsAt')::timestamptz ELSE x.ends_at END,updated_at=clock_timestamp()
    WHERE x.id=target_id AND x.user_id=p_user;
  WHEN 'create_note' THEN
   INSERT INTO public.notes(id,user_id,title,content) VALUES(target_id,p_user,a->>'title',a->>'content');
  WHEN 'append_note' THEN
   SELECT md5(to_jsonb(n)::text) INTO fingerprint FROM public.notes n WHERE n.id=target_id AND n.user_id=p_user FOR UPDATE;
   IF NOT FOUND OR fingerprint IS DISTINCT FROM op->'before'->>'version' THEN RAISE EXCEPTION 'OMNI_CONFLICT'; END IF;
   UPDATE public.notes n SET content=a->>'content',updated_at=clock_timestamp() WHERE n.id=target_id AND n.user_id=p_user;
  WHEN 'create_contact' THEN
   INSERT INTO public.contacts(id,user_id,first_name,last_name,email,phone,company) VALUES(target_id,p_user,a->>'firstName',a->>'lastName',a->>'email',a->>'phone',a->>'company');
  WHEN 'link_objects' THEN
   IF NOT public.omnidesk_owns_entity(p_user,a->>'aKind',(a->>'aId')::uuid) OR NOT public.omnidesk_owns_entity(p_user,a->>'bKind',(a->>'bId')::uuid) THEN RAISE EXCEPTION 'OMNI_CONFLICT'; END IF;
   INSERT INTO public.v2_connections(id,user_id,a_kind,a_id,b_kind,b_id) VALUES(target_id,p_user,a->>'aKind',(a->>'aId')::uuid,a->>'bKind',(a->>'bId')::uuid) ON CONFLICT DO NOTHING;
  ELSE RAISE EXCEPTION 'OMNI_INVALID';
  END CASE;
 END LOOP;
 UPDATE public.v2_omni_action_plans SET status='executed',executed_at=clock_timestamp() WHERE id=p_id AND user_id=p_user;
 RETURN jsonb_build_object('ok',true);
 END;
 $omni$`,
]
export async function initializeOmniActions() {
  const sql = monitoringSql()
  const [exists] =
    await sql`SELECT to_regclass('public.v2_omni_action_plans') IS NOT NULL AND to_regclass('public.v2_omni_action_limits') IS NOT NULL AND to_regclass('public.v2_connections') IS NOT NULL AND to_regprocedure('public.omnidesk_execute_actions_v3(text,uuid)') IS NOT NULL AS ready`
  if (exists?.ready) return
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(184730027)`,
    ...omniActionsDdl.map((ddl) => sql.query(ddl)),
  ])
}
function serialize(row: Record<string, unknown>): OmniActionPlan {
  const expired =
    row.status === 'pending' &&
    new Date(String(row.expires_at)).getTime() <= Date.now()
  return {
    id: String(row.id),
    status: expired ? 'expired' : (row.status as OmniActionPlan['status']),
    prompt: String(row.prompt),
    timeZone: String(row.time_zone),
    createdAt: new Date(String(row.created_at)).toISOString(),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
    previews: row.previews as OmniActionPlan['previews'],
    results:
      row.status === 'executed'
        ? (row.result_links as OmniActionPlan['results'])
        : [],
  }
}
export async function readOmniPlans(userId: string) {
  await initializeOmniActions()
  const sql = monitoringSql()
  return (
    await sql`SELECT id,status,prompt,time_zone,created_at,expires_at,previews,result_links FROM v2_omni_action_plans WHERE user_id=${userId} ORDER BY created_at DESC,id LIMIT 20`
  ).map(serialize)
}
export async function findOmniRequest(userId: string, requestId: string) {
  const sql = monitoringSql()
  const [row] =
    await sql`SELECT id,status,prompt,time_zone,created_at,expires_at,previews,result_links FROM v2_omni_action_plans WHERE user_id=${userId} AND request_id=${requestId}`
  return row ? serialize(row) : null
}
export async function claimOmniPlanning(userId: string) {
  const sql = monitoringSql()
  const rows =
    await sql`INSERT INTO v2_omni_action_limits(user_id,next_plan_at) VALUES(${userId},now()+interval '20 seconds') ON CONFLICT(user_id) DO UPDATE SET next_plan_at=excluded.next_plan_at WHERE v2_omni_action_limits.next_plan_at<=now() RETURNING user_id`
  if (!rows.length)
    throw new OmniActionError(
      'Bitte kurz warten: Omni kann alle 20 Sekunden einen neuen Vorschlag planen.',
      429,
    )
}
export async function saveOmniPlan(
  userId: string,
  requestId: string,
  prompt: string,
  timeZone: string,
  prepared: ReturnType<typeof prepareOmniOperations>,
) {
  const sql = monitoringSql()
  const [row] =
    await sql`INSERT INTO v2_omni_action_plans(id,user_id,request_id,prompt,time_zone,operations,previews,result_links) VALUES(${randomUUID()},${userId},${requestId},${prompt},${timeZone},${JSON.stringify(prepared.stored)}::jsonb,${JSON.stringify(prepared.previews)}::jsonb,${JSON.stringify(prepared.results)}::jsonb) ON CONFLICT(user_id,request_id) DO UPDATE SET request_id=excluded.request_id RETURNING id,status,prompt,time_zone,created_at,expires_at,previews,result_links`
  return serialize(row)
}
export async function executeOmniPlan(userId: string, id: string) {
  await retireWorkingHistory()
  // Ein Vorschlag kann Verknüpfungen enthalten; die Tabellen müssen stehen.
  await initializeOmniActions()
  const sql = monitoringSql()
  try {
    await sql`SELECT public.omnidesk_execute_actions_v3(${userId},${id}::uuid)`
  } catch (error) {
    const message = (error as Error).message
    if (message.includes('OMNI_NOT_FOUND'))
      throw new OmniActionError('Vorschlag nicht gefunden.', 404)
    if (message.includes('OMNI_EXPIRED'))
      throw new OmniActionError(
        'Dieser Vorschlag wurde abgebrochen oder ist abgelaufen. Bitte neu planen.',
        409,
      )
    if (
      message.includes('OMNI_CONFLICT') ||
      (error as { code?: string }).code === '40P01'
    )
      throw new OmniActionError(
        'Ein betroffener Eintrag wurde inzwischen geändert oder entfernt. Nichts aus diesem Vorschlag wurde ausgeführt. Bitte neu planen.',
        409,
      )
    throw error
  }
  const [row] =
    await sql`SELECT id,status,prompt,time_zone,created_at,expires_at,previews,result_links FROM v2_omni_action_plans WHERE id=${id} AND user_id=${userId}`
  if (!row) throw new OmniActionError('Vorschlag nicht gefunden.', 404)
  return serialize(row)
}
export async function cancelOmniPlan(userId: string, id: string) {
  const sql = monitoringSql()
  const [row] =
    await sql`UPDATE v2_omni_action_plans SET status='cancelled' WHERE id=${id} AND user_id=${userId} AND status='pending' RETURNING id`
  if (!row)
    throw new OmniActionError(
      'Vorschlag nicht mehr offen oder nicht gefunden.',
      409,
    )
  return { ok: true }
}
