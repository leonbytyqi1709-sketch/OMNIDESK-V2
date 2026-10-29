import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ListChecks, Plus, Tag, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { AttachmentsPanel } from '@/components/shared/AttachmentsPanel'
import { ConnectionsPanel } from '@/components/shared/ConnectionsPanel'
import { FocusTotalBadge } from '@/modules/pomodoro/components/FocusTotalBadge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  useCreateTask,
  useUpdateTask,
  type Subtask,
  type TaskDto,
  type TaskPriority,
  type TaskStatus,
} from '../api'
import { PRIORITY_META, STATUS_META, STATUS_ORDER } from '../constants'

interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editTask: TaskDto | null
}

/** ISO-String → Wert für <input type="date"> (lokales Datum). */
function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function TaskFormDialog({
  open,
  onOpenChange,
  editTask,
}: TaskFormDialogProps) {
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const isPending = createTask.isPending || updateTask.isPending

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [dueDate, setDueDate] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [subtaskInput, setSubtaskInput] = useState('')

  useEffect(() => {
    if (open) {
      setTitle(editTask?.title ?? '')
      setDescription(editTask?.description ?? '')
      setPriority(editTask?.priority ?? 'medium')
      setStatus(editTask?.status ?? 'todo')
      setDueDate(toDateInputValue(editTask?.dueDate ?? null))
      setTags(editTask?.tags ? [...editTask.tags] : [])
      setTagInput('')
      setSubtasks(editTask?.subtasks ? [...editTask.subtasks] : [])
      setSubtaskInput('')
    }
  }, [open, editTask])

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '')
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
      setTagInput('')
    }
  }

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((item) => item !== t))
  }

  const handleAddSubtask = () => {
    const trimmed = subtaskInput.trim()
    if (!trimmed) return
    const newSubtask: Subtask = {
      id: crypto.randomUUID(),
      title: trimmed,
      done: false,
    }
    setSubtasks([...subtasks, newSubtask])
    setSubtaskInput('')
  }

  const handleToggleSubtask = (id: string) => {
    setSubtasks(
      subtasks.map((st) => (st.id === id ? { ...st, done: !st.done } : st)),
    )
  }

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter((st) => st.id !== id))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const input = {
      title,
      description,
      priority,
      status,
      // Fällig am Ende des gewählten Tages (lokale Zeit)
      dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
      tags,
      subtasks,
    }
    try {
      if (editTask) {
        await updateTask.mutateAsync({ id: editTask.id, expectedFingerprint: editTask.fingerprint, ...input })
        toast.success('Aufgabe aktualisiert')
      } else {
        await createTask.mutateAsync(input)
        toast.success('Aufgabe angelegt')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editTask ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
          </DialogTitle>
          <DialogDescription>
            Mit Priorität, Status, Fälligkeit, Tags und Unteraufgaben.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-title">Titel</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Firewall-Regeln prüfen"
              required
              maxLength={300}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-description">Beschreibung (optional)</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details, Links, Checkpunkte…"
              rows={3}
              maxLength={10_000}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Priorität</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      <span
                        className={`size-2 rounded-full ${PRIORITY_META[p].dotClass}`}
                      />
                      {PRIORITY_META[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-due">Fällig am (optional)</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Tags / Schlagwörter */}
          <div className="flex flex-col gap-2 border-t border-border/40 pt-3">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Tag className="size-3.5" /> Tags & Schlagwörter
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Tag eingeben (z. B. Netzwerk, Dringend)..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="h-9 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                className="h-9 text-xs"
              >
                Hinzufügen
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <Badge
                    key={t}
                    variant="secondary"
                    className="gap-1 text-xs py-0.5 px-2"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Unteraufgaben / Checkliste */}
          <div className="flex flex-col gap-2 border-t border-border/40 pt-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ListChecks className="size-3.5" /> Unteraufgaben ({subtasks.filter((s) => s.done).length}/{subtasks.length})
              </Label>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Neue Unteraufgabe eingeben..."
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddSubtask()
                  }
                }}
                className="h-9 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSubtask}
                className="h-9 text-xs gap-1"
              >
                <Plus className="size-3.5" /> Hinzufügen
              </Button>
            </div>
            {subtasks.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-border/40 bg-secondary/10 p-2 pt-2.5">
                {subtasks.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-card/60 p-2 text-xs transition-colors hover:bg-card"
                  >
                    <label className="flex flex-1 items-center gap-2 cursor-pointer select-none">
                      <Checkbox
                        checked={st.done}
                        onCheckedChange={() => handleToggleSubtask(st.id)}
                      />
                      <span
                        className={
                          st.done
                            ? 'text-muted-foreground line-through'
                            : 'text-foreground font-medium'
                        }
                      >
                        {st.title}
                      </span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveSubtask(st.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {editTask && (
            <div className="border-t pt-3">
              <FocusTotalBadge kind="task" id={editTask.id} />
            </div>
          )}
          <AttachmentsPanel
            owner={editTask ? { kind: 'task', id: editTask.id } : null}
            compact
            className="border-t pt-3"
          />
          <ConnectionsPanel
            end={editTask ? { kind: 'task', id: editTask.id } : null}
            compact
            className="border-t pt-3"
          />
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-gradient-accent glow text-white"
            >
              {isPending ? 'Speichert…' : 'Speichern'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
