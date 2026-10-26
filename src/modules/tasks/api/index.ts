import { useAuth } from '@clerk/clerk-react'
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import { sendBrowserNotification } from '@/lib/notifications'
import type { Subtask, TaskPriority, TaskStatus } from '@/db/schema'

export type { Subtask, TaskPriority, TaskStatus }

/** Aufgabe, wie sie die API liefert (Timestamps als ISO-Strings). */
export interface TaskDto {
  fingerprint: string
  id: string
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  dueDate: string | null
  tags?: string[] | null
  subtasks?: Subtask[] | null
  createdAt: string
  updatedAt: string
}

export interface TaskInput {
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  dueDate: string | null
  tags?: string[]
  subtasks?: Subtask[]
}

const QUERY_KEY = ['tasks'] as const

/**
 * Persönliche Aufgaben.
 *
 * `enabled` erlaubt Aufrufern, die die Liste nur unter einer Bedingung
 * brauchen, den Abruf zurückzuhalten.
 */
export function useTasks(enabled = true) {
  const apiFetch = useApiFetch()
  const { userId } = useAuth()
  return useQuery({
    queryKey: [...QUERY_KEY, userId],
    enabled: Boolean(userId) && enabled,
    queryFn: () => apiFetch<TaskDto[]>('/api/tasks'),
  })
}

function useInvalidateTasks() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })
}

export function useCreateTask() {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: TaskInput) =>
      apiFetch<TaskDto>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

/** Teil-Update – reicht z.B. für reine Statuswechsel im Kanban. */
export function useUpdateTask() {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<TaskInput> & { id: string; expectedFingerprint: string }) =>
      apiFetch<TaskDto>(`/api/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteTask() {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

const OVERDUE_NOTIFY_KEY = 'omnidesk:overdue-notified'

/** Tagesschlüssel des localStorage-Markers für die Überfälligkeits-Erinnerung. */
function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

/** true, wenn für den heutigen Tag bereits erinnert wurde. */
function alreadyNotifiedToday() {
  try {
    const notified = JSON.parse(
      localStorage.getItem(OVERDUE_NOTIFY_KEY) ?? '{}',
    ) as Record<string, boolean>
    return Boolean(notified[todayKey()])
  } catch {
    return false
  }
}

/**
 * Browser-Notification bei überfälligen Aufgaben – max. 1x pro Tag.
 * Benachrichtigt nur, wenn die Browser-Berechtigung bereits erteilt wurde
 * (Anfrage passiert z. B. beim Start des Pomodoro-Timers – keine Nerv-Prompts hier).
 *
 * Architektur-Hinweis: Der Hook wird in der Layout-Shell (AppLayout) gemountet,
 * damit die Erinnerung in jedem Modul funktioniert – analog zur Ausnahme für
 * Dashboard-Widgets, die ebenfalls Modul-APIs nutzen dürfen.
 */
export function useOverdueTaskNotifications() {
  // Die Erinnerung gibt es höchstens einmal pro Tag. Steht der Marker bereits,
  // wird die Aufgabenliste für diesen Zweck gar nicht erst geladen – sonst lief
  // der Abruf in jedem Modul mit, ohne etwas bewirken zu können.
  const pending = !alreadyNotifiedToday()
  const { data: tasks } = useTasks(pending)

  useEffect(() => {
    if (!tasks || !pending) return

    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    const overdue = tasks.filter(
      (t) =>
        t.status !== 'done' &&
        t.dueDate !== null &&
        new Date(t.dueDate) < endOfToday,
    )
    if (overdue.length === 0) return

    // Max. eine Erinnerung pro Tag (localStorage-Marker)
    if (alreadyNotifiedToday()) return
    localStorage.setItem(
      OVERDUE_NOTIFY_KEY,
      JSON.stringify({ [todayKey()]: true }),
    )

    void sendBrowserNotification('OMNIDESK – Überfällige Aufgaben', {
      body:
        overdue.length === 1
          ? `„${overdue[0].title}“ ist überfällig – Zeit, sie abzuschließen!`
          : `${overdue.length} Aufgaben sind überfällig – Zeit, sie abzuschließen!`,
      tag: 'overdue-tasks',
    })
  }, [tasks, pending])
}
