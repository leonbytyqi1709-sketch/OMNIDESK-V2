import type { OmniActionPlan } from '@/types/omni-actions'

/** Beschriftung der Operationen in Vorschlägen – an einer Stelle für alle Ansichten. */
export const OMNI_OPERATION_LABEL: Record<string, string> = {
  create_task: 'Persönliche Aufgabe anlegen',
  update_task: 'Persönliche Aufgabe ändern',
  create_project_task: 'Projektaufgabe anlegen',
  update_project_task: 'Projektaufgabe ändern',
  create_appointment: 'Termin anlegen',
  append_project_note: 'Projektnotiz ergänzen',
  update_appointment: 'Termin ändern',
  create_note: 'Notiz anlegen',
  append_note: 'Notiz ergänzen',
  create_contact: 'Kontakt anlegen',
  link_objects: 'Verknüpfung anlegen',
}

export const OMNI_PLAN_STATUS: Record<OmniActionPlan['status'], string> = {
  pending: 'Bestätigung ausstehend',
  executed: 'Ausgeführt',
  cancelled: 'Abgebrochen',
  expired: 'Abgelaufen',
}
