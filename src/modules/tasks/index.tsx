import { useLocation, useSearchParams } from 'react-router'
import { useEffect, useRef, useState } from 'react'
import { Columns3, List, ListTodo, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { consumeQuickAction } from '@/lib/quick-action'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TaskBoardView } from './components/TaskBoardView'
import { TaskFormDialog } from './components/TaskFormDialog'
import { TaskListView } from './components/TaskListView'
import { useDeleteTask, useTasks, useUpdateTask, type TaskDto } from './api'
import { STATUS_META, STATUS_ORDER } from './constants'

type ViewMode = 'list' | 'board'
const VIEW_STORAGE_KEY = 'omnidesk:tasks-view'

export default function TasksPage() {
  const { data: tasks, isLoading, error } = useTasks()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const [view, setView] = useState<ViewMode>(() =>
    localStorage.getItem(VIEW_STORAGE_KEY) === 'board' ? 'board' : 'list',
  )
  const [params] = useSearchParams(), location = useLocation(), handledLink = useRef('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTask, setEditTask] = useState<TaskDto | null>(null)

  useEffect(() => {
    const id = params.get('task'), request = `${location.key}:${id}`
    if (!id || !tasks || handledLink.current === request) return
    handledLink.current = request
    const task = tasks.find((entry) => entry.id === id)
    if (task) { setEditTask(task); setDialogOpen(true) }
    else toast.info('Diese Aufgabe ist nicht mehr verfügbar.')
  }, [params, location.key, tasks])

  const changeView = (v: string) => {
    setView(v as ViewMode)
    localStorage.setItem(VIEW_STORAGE_KEY, v)
  }

  const openCreate = () => {
    setEditTask(null)
    setDialogOpen(true)
  }

  // Schnellaktion aus der Command-Palette: Dialog direkt öffnen
  useEffect(() => {
    if (consumeQuickAction('create-task')) {
      setEditTask(null)
      setDialogOpen(true)
    }
  }, [])

  const openEdit = (task: TaskDto) => {
    setEditTask(task)
    setDialogOpen(true)
  }

  const setStatus = (task: TaskDto, status: TaskDto['status']) => {
    updateTask.mutate(
      { id: task.id, status },
      {
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : 'Aktualisieren fehlgeschlagen',
          ),
      },
    )
  }

  const handleMove = (task: TaskDto, direction: -1 | 1) => {
    const next = STATUS_ORDER[STATUS_ORDER.indexOf(task.status) + direction]
    if (next) setStatus(task, next)
  }

  const handleToggleDone = (task: TaskDto) => {
    setStatus(task, task.status === 'done' ? 'todo' : 'done')
  }

  const handleDelete = async (task: TaskDto) => {
    try {
      await deleteTask.mutateAsync(task.id)
      toast.success(`„${task.title}“ gelöscht`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
    }
  }

  const counts = STATUS_ORDER.map((s) => ({
    status: s,
    count: (tasks ?? []).filter((t) => t.status === s).length,
  }))

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Aufgaben</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts
              .map((c) => `${c.count} ${STATUS_META[c.status].label.toLowerCase()}`)
              .join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={changeView}>
            <TabsList>
              <TabsTrigger value="list" aria-label="Listenansicht">
                <List className="size-4" /> Liste
              </TabsTrigger>
              <TabsTrigger value="board" aria-label="Kanban-Ansicht">
                <Columns3 className="size-4" /> Kanban
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={openCreate} className="bg-gradient-accent glow text-white">
            <Plus className="size-4" /> Neue Aufgabe
          </Button>
        </div>
      </div>

      <div className="mt-8">
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">
            Aufgaben konnten nicht geladen werden: {error.message}
          </p>
        )}

        {!isLoading && !error && (tasks ?? []).length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
            <ListTodo className="size-8" />
            <p className="text-sm">Noch keine Aufgaben – lege die erste an.</p>
          </div>
        )}

        {!isLoading && !error && (tasks ?? []).length > 0 && (
          view === 'list' ? (
            <TaskListView
              tasks={tasks ?? []}
              onToggleDone={handleToggleDone}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ) : (
            <TaskBoardView
              tasks={tasks ?? []}
              onEdit={openEdit}
              onDelete={handleDelete}
              onMove={handleMove}
            />
          )
        )}
      </div>

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editTask={editTask}
      />
    </div>
  )
}
