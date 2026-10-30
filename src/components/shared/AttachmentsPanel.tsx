import { useRef, useState } from 'react'
import { Download, FileText, Image, Loader2, Paperclip, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  type AttachmentDto,
  type AttachmentKind,
  MAX_ATTACHMENT_BYTES,
  formatBytes,
} from '@/lib/attachments'
import { previewKind } from '@/lib/attachment-preview'
import { cn } from '@/lib/utils'
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog'
import {
  useAttachments,
  useDeleteAttachment,
  useDownloadAttachment,
  useUploadAttachment,
} from '@/modules/attachments/api'

interface AttachmentsPanelProps {
  owner: { kind: AttachmentKind; id: string } | null
  compact?: boolean
  className?: string
}

/**
 * Dateien an einem Eintrag: hochladen, herunterladen, löschen. Auch per
 * Ziehen und Fallenlassen.
 */
export function AttachmentsPanel({ owner, compact = false, className }: AttachmentsPanelProps) {
  const { data: files, isLoading, error } = useAttachments(owner)
  const upload = useUploadAttachment(owner ?? { kind: 'note', id: '' })
  const remove = useDeleteAttachment(owner ?? { kind: 'note', id: '' })
  const download = useDownloadAttachment()
  const input = useRef<HTMLInputElement>(null)
  const [dropping, setDropping] = useState(false)
  const [preview, setPreview] = useState<AttachmentDto | null>(null)

  if (!owner)
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        Anhänge sind möglich, sobald der Eintrag gespeichert ist.
      </p>
    )

  const send = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    for (const file of Array.from(list)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`„${file.name}“ ist größer als ${formatBytes(MAX_ATTACHMENT_BYTES)}.`)
        continue
      }
      try {
        await upload.mutateAsync(file)
        toast.success(`„${file.name}“ angehängt`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Hochladen fehlgeschlagen.')
      }
    }
    if (input.current) input.current.value = ''
  }

  /** Anzeigbare Dateien öffnen sich im Fenster, alle anderen werden geladen. */
  const open = async (attachment: AttachmentDto) => {
    if (previewKind(attachment.mime)) {
      setPreview(attachment)
      return
    }
    try {
      await download(attachment)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Herunterladen fehlgeschlagen.')
    }
  }

  return (
    <div
      className={cn('space-y-2', dropping && 'rounded-md ring-2 ring-primary ring-inset', className)}
      onDragOver={(event) => {
        event.preventDefault()
        setDropping(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setDropping(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDropping(false)
        void send(event.dataTransfer.files)
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Paperclip className="size-3.5" />
          Anhänge{files && files.length > 0 ? ` (${files.length})` : ''}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => input.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          Datei wählen
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void send(event.target.files)}
        />
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Wird geladen…</p>
      ) : error ? (
        <p className="text-xs text-destructive">
          {error instanceof Error ? error.message : 'Anhänge konnten nicht geladen werden.'}
        </p>
      ) : !files || files.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch nichts angehängt. Dateien hierher ziehen oder auswählen – bis{' '}
          {formatBytes(MAX_ATTACHMENT_BYTES)} je Datei.
        </p>
      ) : (
        <ul className={cn('space-y-1.5', compact && 'max-h-40 overflow-y-auto pr-1')}>
          {files.map((file) => {
            const Icon = file.mime.startsWith('image/') ? Image : FileText
            return (
              <li
                key={file.id}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/20 p-2 text-xs"
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left font-medium text-foreground hover:underline"
                  onClick={() => void open(file)}
                  title={previewKind(file.mime) ? 'Ansehen' : 'Herunterladen'}
                >
                  {file.name}
                </button>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {formatBytes(file.size)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    void download(file).catch((err: unknown) =>
                      toast.error(
                        err instanceof Error ? err.message : 'Herunterladen fehlgeschlagen.',
                      ),
                    )
                  }
                  aria-label="Herunterladen"
                >
                  <Download className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    remove.mutate(file.id, {
                      onError: (err) =>
                        toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.'),
                    })
                  }}
                  disabled={remove.isPending}
                  aria-label="Anhang löschen"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <AttachmentPreviewDialog attachment={preview} onClose={() => setPreview(null)} />
    </div>
  )
}
