import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '@clerk/clerk-react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  consumeQuickAction,
  consumeQuickActionPayload,
} from '@/lib/quick-action'
import { deleteAllNoteAttachments } from './attachments'
import { NoteEditor, type SaveStatus } from './components/NoteEditor'
import { NoteList } from './components/NoteList'
import {
  useCreateNote,
  useDeleteNote,
  useNotes,
  useUpdateNote,
  type NoteInput,
} from './api'

function Notes() {
  const [params] = useSearchParams()
  const query = useNotes(),
    { data: notes, isLoading, error } = query
  const createNote = useCreateNote(),
    updateNote = useUpdateNote(),
    deleteNote = useDeleteNote()
  const { mutateAsync: updateNoteAsync } = updateNote
  const { mutateAsync: createNoteAsync } = createNote
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [draft, setDraft] = useState<NoteInput | null>(null),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(''),
    [switching, setSwitching] = useState(false)
  const pendingCount = useRef(0)
  const bases = useRef(new Map<string, string>()),
    queue = useRef(Promise.resolve()),
    blocked = useRef(false),
    pendingOpen = useRef<string | null>(null),
    latest = useRef({ selectedId, draft, dirty })
  latest.current = { selectedId, draft, dirty }
  const save = useCallback(
    async (id: string, input: NoteInput) => {
      pendingCount.current++
      setSaving(true)
      const work = queue.current.then(async () => {
        try {
          if (blocked.current)
            throw new Error(
              'Zuerst den Speicherkonflikt lösen. Dein Entwurf bleibt im Editor.',
            )
          const expectedFingerprint = bases.current.get(id)
          if (!expectedFingerprint)
            throw new Error('Notizstand fehlt. Bitte neu laden.')
          const note = await updateNoteAsync({
            id,
            title: input.title.trim() || 'Unbenannte Notiz',
            content: input.content,
            expectedFingerprint,
          })
          bases.current.set(id, note.fingerprint)
          setSaveError('')
        } catch (e) {
          blocked.current = true
          setSaveError((e as Error).message)
          throw e
        } finally {
          pendingCount.current--
          setSaving(pendingCount.current > 0)
        }
      })
      queue.current = work.catch(() => {})
      return work
    },
    [updateNoteAsync],
  )
  const select = useCallback(
    (id: string) => {
      const note = notes?.find((n) => n.id === id)
      if (!note) return
      bases.current.set(id, note.fingerprint)
      setSelectedId(id)
      setDraft({ title: note.title, content: note.content })
      setDirty(false)
      setSaveError('')
      blocked.current = false
    },
    [notes],
  )
  useEffect(() => {
    if (!selectedId && notes?.length) select(notes[0].id)
  }, [notes, selectedId, select])
  useEffect(() => {
    if (!dirty || !draft || !selectedId || switching || blocked.current) return
    const timer = setTimeout(() => {
      setDirty(false)
      void save(selectedId, draft).catch(() => {})
    }, 800)
    return () => clearTimeout(timer)
  }, [draft, dirty, selectedId, switching, save])
  // The next save uses the preceding successful fingerprint. Refetches never
  // silently replace a local draft or advance its editing base.
  const flush = useCallback(async () => {
    const value = latest.current
    if (value.dirty && value.draft && value.selectedId) {
      setDirty(false)
      await save(value.selectedId, value.draft)
    } else await queue.current
    if (blocked.current)
      throw new Error(
        'Dein Entwurf ist noch nicht gespeichert. Bitte zuerst den Konflikt lösen.',
      )
  }, [save])
  async function changeSelection(id: string) {
    if (id === selectedId || switching) return
    setSwitching(true)
    try {
      await flush()
      select(id)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSwitching(false)
    }
  }
  const create = useCallback(async () => {
    if (switching) return
    setSwitching(true)
    try {
      await flush()
      const note = await createNoteAsync()
      bases.current.set(note.id, note.fingerprint)
      setSelectedId(note.id)
      setDraft({ title: note.title, content: note.content })
      setDirty(false)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSwitching(false)
    }
  }, [switching, flush, createNoteAsync])
  async function remove() {
    if (
      !selectedId ||
      switching ||
      !window.confirm(
        'Notiz endgültig löschen?',
      )
    )
      return
    setSwitching(true)
    try {
      await queue.current
      await deleteNote.mutateAsync(selectedId)
      void deleteAllNoteAttachments(selectedId)
      setSelectedId(null)
      setDraft(null)
      setDirty(false)
      setSaveError('')
      blocked.current = false
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSwitching(false)
    }
  }
  async function reload() {
    if (
      !selectedId ||
      !window.confirm(
        'Aktuellen Serverstand laden? Kopiere deinen Entwurf vorher, wenn du ihn behalten möchtest. Er wird durch den Serverstand ersetzt.',
      )
    )
      return
    setSwitching(true)
    try {
      await queue.current
      const result = await query.refetch()
      if (result.error) throw result.error
      const note = result.data?.find((n) => n.id === selectedId)
      if (!note)
        throw new Error(
          'Notiz nicht mehr verfügbar. Dein Entwurf bleibt hier sichtbar.',
        )
      bases.current.set(note.id, note.fingerprint)
      setDraft({ title: note.title, content: note.content })
      setDirty(false)
      setSaveError('')
      blocked.current = false
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSwitching(false)
    }
  }
  const quickHandled = useRef(false)
  useEffect(() => {
    if (quickHandled.current) return
    quickHandled.current = true
    pendingOpen.current =
      params.get('note') || consumeQuickActionPayload('open-note')
    if (consumeQuickAction('create-note')) void create()
  }, [create, params])
  useEffect(() => {
    const id = pendingOpen.current
    if (id && notes?.some((n) => n.id === id)) {
      select(id)
      pendingOpen.current = null
    }
  }, [notes, select])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (latest.current.dirty || pendingCount.current > 0 || blocked.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saving])
  const status: SaveStatus = saveError
    ? 'error'
    : dirty
      ? 'dirty'
      : saving
        ? 'saving'
        : 'saved'
  if (error && !draft)
    return (
      <div className="p-6 text-destructive">
        Notizen konnten nicht geladen werden: {error.message}
      </div>
    )
  return (
    <div className="flex min-h-[75vh] min-w-0 flex-col md:h-screen md:flex-row">
      <aside className="max-h-48 shrink-0 overflow-y-auto border-b md:max-h-none md:w-72 md:border-r md:border-b-0">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        ) : (
          <NoteList
            notes={notes ?? []}
            selectedId={selectedId}
            onSelect={(id) => void changeSelection(id)}
            onCreate={() => void create()}
            isCreating={switching || createNote.isPending}
          />
        )}
      </aside>
      <section className="min-h-[60vh] min-w-0 flex-1">
        {saveError && (
          /* Der Hinweis muss als Warnung erkennbar sein: Ohne Farbe und Symbol
             wirkte er wie normaler Fließtext und wurde übersehen, während im
             Hintergrund nichts mehr gespeichert wurde. */
          <div
            role="alert"
            className="space-y-2 border-b-2 border-destructive bg-destructive/10 p-3 text-sm"
          >
            <p className="flex items-start gap-2 font-medium text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>Nicht gespeichert: {saveError}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Dein Entwurf bleibt im Editor und wird nicht automatisch
              überschrieben. Weitere Änderungen werden erst wieder gespeichert,
              wenn du den Konflikt auflöst.
            </p>
            <Button
              variant="outline"
              disabled={switching}
              onClick={() => void reload()}
            >
              Aktuellen Stand laden
            </Button>
          </div>
        )}
        <NoteEditor
          noteId={selectedId}
          draft={draft}
          onChange={(next) => {
            if (switching) return
            setDraft(next)
            setDirty(true)
          }}
          status={status}
          onDelete={() => void remove()}
        />
      </section>
    </div>
  )
}
export default function NotesPage() {
  const { userId } = useAuth()
  return userId ? <Notes key={userId} /> : null
}
