import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type AttachmentDto, formatBytes } from '@/lib/attachments'
import { MAX_TEXT_PREVIEW_BYTES, previewKind } from '@/lib/attachment-preview'
import { useAttachmentContent, useDownloadAttachment } from '@/modules/attachments/api'

interface AttachmentPreviewDialogProps {
  attachment: AttachmentDto | null
  onClose: () => void
}

type Content =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'url'; url: string }
  | { state: 'text'; text: string }

/**
 * Zeigt einen Anhang im Fenster, statt ihn nur herunterzuladen.
 *
 * Angezeigt werden Bilder, PDFs und Klartext. Alles andere — insbesondere,
 * was ein Browser selbst ausführen würde — bleibt beim Download; HTML, SVG
 * und XML liegen ohnehin als `application/octet-stream` in der Datenbank.
 */
export function AttachmentPreviewDialog({
  attachment,
  onClose,
}: AttachmentPreviewDialogProps) {
  const load = useAttachmentContent()
  const download = useDownloadAttachment()
  const [content, setContent] = useState<Content>({ state: 'loading' })

  useEffect(() => {
    if (!attachment) return
    let objectUrl: string | null = null
    let cancelled = false
    setContent({ state: 'loading' })

    void (async () => {
      try {
        const blob = await load(attachment)
        if (cancelled) return
        if (previewKind(attachment.mime) === 'text') {
          if (blob.size > MAX_TEXT_PREVIEW_BYTES) {
            setContent({
              state: 'error',
              message: `Die Datei ist größer als ${formatBytes(MAX_TEXT_PREVIEW_BYTES)} und wird nicht als Text angezeigt.`,
            })
            return
          }
          setContent({ state: 'text', text: await blob.text() })
          return
        }
        objectUrl = URL.createObjectURL(blob)
        setContent({ state: 'url', url: objectUrl })
      } catch (error) {
        if (!cancelled)
          setContent({
            state: 'error',
            message:
              error instanceof Error ? error.message : 'Der Anhang konnte nicht geladen werden.',
          })
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment, load])

  const kind = attachment ? previewKind(attachment.mime) : null

  return (
    <Dialog open={Boolean(attachment)} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="break-words pr-8">{attachment?.name}</DialogTitle>
          <DialogDescription>
            {attachment ? `${formatBytes(attachment.size)} · ${attachment.mime}` : ''}
          </DialogDescription>
        </DialogHeader>

        {content.state === 'loading' && (
          <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Wird geladen…
          </p>
        )}

        {content.state === 'error' && (
          <p role="alert" className="py-6 text-sm text-destructive">
            {content.message}
          </p>
        )}

        {content.state === 'url' && kind === 'image' && (
          <img
            src={content.url}
            alt={attachment?.name ?? ''}
            className="max-h-[60dvh] w-full rounded-lg object-contain"
          />
        )}

        {content.state === 'url' && kind === 'pdf' && (
          <iframe
            src={content.url}
            title={attachment?.name ?? 'PDF'}
            className="h-[60dvh] w-full rounded-lg border border-border"
          />
        )}

        {content.state === 'text' && (
          <pre className="max-h-[60dvh] overflow-auto rounded-lg border border-border bg-secondary/20 p-3 text-xs whitespace-pre-wrap break-words">
            {content.text}
          </pre>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (!attachment) return
              void download(attachment).catch((error: unknown) =>
                toast.error(
                  error instanceof Error ? error.message : 'Herunterladen fehlgeschlagen.',
                ),
              )
            }}
          >
            <Download className="mr-2 size-4" />
            Herunterladen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
