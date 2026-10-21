-- Nur Modultrigger deaktivieren; keine Originale oder Altdaten löschen.
BEGIN;
SELECT pg_advisory_xact_lock(184730024);
DO $retire$ BEGIN IF to_regclass('public.notes') IS NOT NULL THEN DROP TRIGGER IF EXISTS v2_history_notes ON public.notes; END IF; END $retire$;
DO $retire$ BEGIN IF to_regclass('public.tasks') IS NOT NULL THEN DROP TRIGGER IF EXISTS v2_history_tasks ON public.tasks; END IF; END $retire$;
DO $retire$ BEGIN IF to_regclass('public.project_tasks') IS NOT NULL THEN DROP TRIGGER IF EXISTS v2_history_project_tasks ON public.project_tasks; END IF; END $retire$;
COMMIT;
