import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Loader2, NotebookPen, Paperclip, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { AttachmentsPanel } from '@/components/shared/AttachmentsPanel'
import { useUploadAttachment } from '@/modules/attachments/api'
import { ConnectionsPanel } from '@/components/shared/ConnectionsPanel'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { openNoteAttachment, useNoteAttachments } from '../attachments'
import type { NoteInput } from '../api'

export type SaveStatus = 'saved' | 'saving' | 'dirty' | 'error'

interface NoteEditorProps {
  noteId: string | null
  draft: NoteInput | null
  onChange: (draft: NoteInput) => void
  status: SaveStatus
  onDelete: () => void
}

function StatusIndicator({ status }: { status: SaveStatus }) {
  if (status === 'error')
    return <span className="text-xs text-destructive">Nicht gespeichert</span>
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Speichert…
      </span>
    )
  }
  if (status === 'dirty') {
    return <span className="text-xs text-muted-foreground">Ungespeichert…</span>
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Check className="size-3" /> Gespeichert
    </span>
  )
}

export function NoteEditor({
  noteId,
  draft,
  onChange,
  status,
  onDelete,
}: NoteEditorProps) {
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  // Der Altbestand bleibt lesbar; neue Dateien gehen an OMNIDESK.
  const { attachments, remove, isDropping, setIsDropping, formatSize } =
    useNoteAttachments(noteId)
  const upload = useUploadAttachment({ kind: 'note', id: noteId ?? '' })

  const handleDragOver = (e: React.DragEvent) => {
    if (!noteId) return
    e.preventDefault()
    setIsDropping(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Nicht "verlassen", wenn der Cursor nur in ein Kind-Element wechselt
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDropping(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    if (!noteId) return
    e.preventDefault()
    setIsDropping(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    for (const file of files) {
      try {
        await upload.mutateAsync(file)
        toast.success(`„${file.name}“ angehängt`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Hochladen fehlgeschlagen.')
      }
    }
  }

  if (!draft) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <NotebookPen className="size-8" />
        <p className="text-sm">Wähle eine Notiz aus oder lege eine neue an.</p>
      </div>
    )
  }

  return (
    <div
      className={`relative flex h-full flex-col ${
        isDropping ? 'ring-2 ring-primary ring-inset' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(event) => void handleDrop(event)}
    >
      {isDropping && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80">
          <Paperclip className="size-6 text-primary" />
          <p className="text-sm font-medium">Loslassen zum Anhängen</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as 'edit' | 'preview')}
        >
          <TabsList className="h-8">
            <TabsTrigger value="edit" className="text-xs">
              Bearbeiten
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs">
              Vorschau
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <StatusIndicator status={status} />
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label="Notiz löschen"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <input
        value={draft.title}
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
        placeholder="Titel der Notiz"
        maxLength={300}
        className="border-0 bg-transparent px-6 pt-5 pb-2 text-xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
      />

      {view === 'edit' ? (
        <textarea
          value={draft.content}
          onChange={(e) => onChange({ ...draft, content: e.target.value })}
          placeholder="Schreib los… (Markdown wird unterstützt)"
          spellCheck={false}
          className="flex-1 resize-none border-0 bg-transparent px-6 py-2 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
        />
      ) : (
        <div className="prose prose-invert prose-sm max-w-none flex-1 overflow-y-auto px-6 py-2">
          {draft.content.trim() === '' ? (
            <p className="text-muted-foreground">
              Nichts zu sehen – die Notiz ist leer.
            </p>
          ) : (
            <Markdown remarkPlugins={[remarkGfm]}>{draft.content}</Markdown>
          )}
        </div>
      )}

      {/* Anhänge in OMNIDESK – auf jedem Gerät sichtbar */}
      <AttachmentsPanel
        owner={noteId ? { kind: 'note', id: noteId } : null}
        compact
        className="border-t px-6 py-2"
      />

      {/* Verknüpfungen zu Aufgaben, Terminen, Kontakten und Projekten */}
      <ConnectionsPanel
        end={noteId ? { kind: 'note', id: noteId } : null}
        compact
        className="border-t px-6 py-2"
      />

      {/* Altbestand: frühere Anhänge liegen nur in diesem Browser (IndexedDB).
          Sie bleiben les- und löschbar, neue entstehen hier nicht mehr. */}
      <div className="flex flex-wrap items-center gap-2 border-t px-6 py-2">
        <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
        {attachments.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">
            Ältere Anhänge dieser Notiz lagen nur in diesem Browser. Neue
            Dateien gehören nach oben zu „Anhänge“ – die sind überall sichtbar.
          </span>
        ) : (
          attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-1.5 rounded-md border bg-secondary/40 px-2 py-1 text-xs"
            >
              <button
                onClick={() => openNoteAttachment(a)}
                title="Anhang öffnen"
                className="max-w-[180px] truncate hover:text-foreground hover:underline"
              >
                {a.name}
              </button>
              <span className="shrink-0 text-muted-foreground">
                {formatSize(a.size)}
              </span>
              <button
                onClick={() => void remove(a.id)}
                title="Anhang entfernen"
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
