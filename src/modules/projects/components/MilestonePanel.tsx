import { useState, type FormEvent } from 'react'
import { Flag, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  useCreateMilestone,
  useDeleteMilestone,
  useUpdateMilestone,
  type MilestoneDto,
} from '../api'

interface MilestonePanelProps {
  projectId: string
  milestones: MilestoneDto[]
}

export function MilestonePanel({ projectId, milestones }: MilestonePanelProps) {
  const createMilestone = useCreateMilestone(projectId)
  const updateMilestone = useUpdateMilestone(projectId)
  const deleteMilestone = useDeleteMilestone(projectId)

  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await createMilestone.mutateAsync({
        title,
        dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
        done: false,
      })
      setTitle('')
      setDueDate('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen')
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Flag className="size-4 text-muted-foreground" /> Meilensteine
      </h3>
      <ul className="mt-3 space-y-2">
        {milestones.length === 0 && (
          <li className="text-xs text-muted-foreground">
            Noch keine Meilensteine.
          </li>
        )}
        {milestones.map((m) => {
          const overdue =
            !m.done && m.dueDate !== null && new Date(m.dueDate) < new Date()
          return (
            <li key={m.id} id={`milestone-${m.id}`} className="target:ring-2 target:ring-primary group flex items-center gap-2">
              <Checkbox
                checked={m.done}
                onCheckedChange={(checked) =>
                  updateMilestone.mutate({ id: m.id, done: checked === true })
                }
                aria-label="Meilenstein abhaken"
              />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-sm',
                  m.done && 'text-muted-foreground line-through',
                )}
              >
                {m.title}
              </span>
              {m.dueDate && (
                <span
                  className={cn(
                    'shrink-0 text-xs',
                    overdue
                      ? 'font-medium text-destructive'
                      : 'text-muted-foreground',
                  )}
                >
                  {new Date(m.dueDate).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                  })}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => deleteMilestone.mutate(m.id)}
                aria-label="Meilenstein löschen"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          )
        })}
      </ul>
      <form onSubmit={handleAdd} className="mt-4 space-y-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Neuer Meilenstein…"
          required
          maxLength={300}
          className="h-8 text-sm"
        />
        <div className="flex gap-2">
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-8 flex-1 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={createMilestone.isPending}
            className="h-8"
          >
            <Plus className="size-3.5" /> Hinzufügen
          </Button>
        </div>
      </form>
    </div>
  )
}
