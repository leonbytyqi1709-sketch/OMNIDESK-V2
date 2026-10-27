import { useState, type DragEvent, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  useCreateProjectTask,
  useDeleteProjectTask,
  useUpdateProjectTask,
  type ProjectTaskDto,
  type ProjectTaskStatus,
} from '../api'
import { BOARD_COLUMNS, PRIORITY_META } from '../constants'

function BoardCard({
  task,
  projectId,
}: {
  task: ProjectTaskDto
  projectId: string
}) {
  const updateTask = useUpdateProjectTask(projectId)
  const deleteTask = useDeleteProjectTask(projectId)
  const columnIndex = BOARD_COLUMNS.findIndex((c) => c.status === task.status)

  const move = (direction: -1 | 1) => {
    const next = BOARD_COLUMNS[columnIndex + direction]
    if (next) updateTask.mutate({ id: task.id, status: next.status, expectedFingerprint: task.fingerprint })
  }

  return (
    <Card
      id={`project-task-${task.id}`}
      className="target:ring-2 target:ring-primary group cursor-grab gap-2 p-2.5 active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-1.5 size-2 shrink-0 rounded-full',
            PRIORITY_META[task.priority].dotClass,
          )}
        />
        <p
          className={cn(
            'min-w-0 flex-1 text-sm',
            task.status === 'done' && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </p>
      </div>
      {task.description && (
        <p className="line-clamp-4 pl-4 text-xs whitespace-pre-wrap break-words text-muted-foreground">
          {task.description}
        </p>
      )}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => { if(window.confirm(`„${task.title}“ endgültig löschen?`)) deleteTask.mutate(task.id) }}
          aria-label="Aufgabe löschen"
        >
          <Trash2 className="size-3.5" />
        </Button>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={columnIndex === 0}
            onClick={() => move(-1)}
            aria-label="Spalte zurück"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={columnIndex === BOARD_COLUMNS.length - 1}
            onClick={() => move(1)}
            aria-label="Spalte vor"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

function AddTaskForm({ projectId }: { projectId: string }) {
  const createTask = useCreateProjectTask(projectId)
  const [title, setTitle] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await createTask.mutateAsync({ title, status: 'backlog', priority: 'medium' })
      setTitle('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Neue Board-Aufgabe (landet im Backlog)…"
        required
        maxLength={300}
        className="h-8 text-sm"
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={createTask.isPending}
        className="h-8 shrink-0"
      >
        <Plus className="size-3.5" />
      </Button>
    </form>
  )
}

interface ProjectBoardProps {
  projectId: string
  tasks: ProjectTaskDto[]
}

/**
 * Agiles Kanban-Board: Backlog → To-Do → In Arbeit → Erledigt.
 * Karten per Drag & Drop (HTML5) ODER Pfeil-Buttons verschieben.
 */
export function ProjectBoard({ projectId, tasks }: ProjectBoardProps) {
  const updateTask = useUpdateProjectTask(projectId)
  const [dragOverColumn, setDragOverColumn] = useState<ProjectTaskStatus | null>(
    null,
  )

  const handleDrop = (e: DragEvent, status: ProjectTaskStatus) => {
    e.preventDefault()
    setDragOverColumn(null)
    const id = e.dataTransfer.getData('text/plain')
    const task = tasks.find((t) => t.id === id)
    if (task && task.status !== status) {
      updateTask.mutate({ id, status, expectedFingerprint: task.fingerprint })
    }
  }

  return (
    <div className="space-y-4">
      <AddTaskForm projectId={projectId} />
      <div className="grid gap-3 lg:grid-cols-4">
        {BOARD_COLUMNS.map((column) => {
          const items = tasks.filter((t) => t.status === column.status)
          return (
            <div
              key={column.status}
              className={cn(
                'rounded-lg bg-secondary/40 p-2.5 transition-shadow',
                dragOverColumn === column.status && 'glow ring-1 ring-ring',
              )}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDragEnter={() => setDragOverColumn(column.status)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverColumn(null)
                }
              }}
              onDrop={(e) => handleDrop(e, column.status)}
            >
              <h3 className="mb-2 px-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                {column.label}{' '}
                <span className="text-muted-foreground/60">({items.length})</span>
              </h3>
              <div className="space-y-2">
                {items.map((task) => (
                  <BoardCard key={task.id} task={task} projectId={projectId} />
                ))}
                {items.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                    Leer
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
