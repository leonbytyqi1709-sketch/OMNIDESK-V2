import { useRef, useState } from 'react'
import { useClerk, useUser } from '@clerk/clerk-react'
import { Download, ExternalLink, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useApiFetch } from '@/hooks/use-api'
import { formatBytes } from '@/lib/attachments'
import { useAttachmentQuota } from '@/modules/attachments/api'

/** Struktur der JSON-Sicherung (Backup-Strategie, Spec Abschnitt 4). */
interface BackupFile {
  app: 'omnidesk'
  version: 1
  exportedAt: string
  links: unknown[]
  notes: unknown[]
  tasks: unknown[]
  contacts: unknown[]
  appointments: unknown[]
}

export function GeneralTab() {
  const { data: quota } = useAttachmentQuota()
  const { user } = useUser()
  const { openUserProfile } = useClerk()
  const apiFetch = useApiFetch()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const handleExport = async () => {
    setBusy(true)
    try {
      const [links, notes, tasks, contacts, appointments] = await Promise.all([
        apiFetch<unknown[]>('/api/links'),
        apiFetch<unknown[]>('/api/notes'),
        apiFetch<unknown[]>('/api/tasks'),
        apiFetch<unknown[]>('/api/contacts'),
        apiFetch<unknown[]>('/api/appointments'),
      ])
      const backup: BackupFile = {
        app: 'omnidesk',
        version: 1,
        exportedAt: new Date().toISOString(),
        links,
        notes,
        tasks,
        contacts,
        appointments,
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `omnidesk-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup heruntergeladen')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (file: File) => {
    setBusy(true)
    try {
      const parsed = JSON.parse(await file.text()) as Partial<BackupFile>
      if (parsed.app !== 'omnidesk') {
        throw new Error('Keine gültige OMNIDESK-Sicherungsdatei.')
      }

      let imported = 0
      const post = async (path: string, body: Record<string, unknown>) => {
        await apiFetch(path, { method: 'POST', body: JSON.stringify(body) })
        imported++
      }

      for (const l of (parsed.links ?? []) as Record<string, unknown>[]) {
        await post('/api/links', {
          title: l.title,
          url: l.url,
          category: l.category ?? null,
          icon: l.icon ?? null,
        })
      }
      for (const n of (parsed.notes ?? []) as Record<string, unknown>[]) {
        // Notizen: erst anlegen, dann Inhalt setzen (POST vergibt Defaults)
        const created = await apiFetch<{ id: string; fingerprint: string }>('/api/notes', {
          method: 'POST',
        })
        await apiFetch(`/api/notes/${created.id}`, {
          method: 'PUT',
          body: JSON.stringify({ title: n.title, content: n.content, expectedFingerprint: created.fingerprint }),
        })
        imported++
      }
      for (const t of (parsed.tasks ?? []) as Record<string, unknown>[]) {
        await post('/api/tasks', {
          title: t.title,
          description: t.description ?? '',
          priority: t.priority ?? 'medium',
          status: t.status ?? 'todo',
          dueDate: t.dueDate ?? null,
        })
      }
      for (const c of (parsed.contacts ?? []) as Record<string, unknown>[]) {
        await post('/api/contacts', {
          firstName: c.firstName,
          lastName: c.lastName ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          company: c.company ?? '',
          notes: c.notes ?? '',
        })
      }
      for (const a of (parsed.appointments ?? []) as Record<string, unknown>[]) {
        await post('/api/appointments', {
          title: a.title,
          description: a.description ?? '',
          location: a.location ?? '',
          priority: a.priority ?? 'medium',
          startsAt: a.startsAt,
          endsAt: a.endsAt,
        })
      }

      toast.success(`Import abgeschlossen: ${imported} Einträge übernommen`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import fehlgeschlagen')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Speicher für Anhänge</CardTitle>
          <CardDescription>
            Angehängte Dateien liegen in deiner eigenen Datenbank. Löschst du einen Eintrag,
            verschwinden auch seine Anhänge und der Platz wird wieder frei.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {quota ? (
            <>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Belegt</span>
                <span className="font-medium">
                  {formatBytes(quota.used)}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    von {formatBytes(quota.limit)}
                  </span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-gradient-accent transition-all"
                  style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Wird geladen…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>
            Deine Anmeldedaten werden von Clerk verwaltet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarImage src={user?.imageUrl} alt="" />
              <AvatarFallback>{user?.firstName?.[0] ?? '?'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => openUserProfile()}>
            <ExternalLink className="size-4" /> Profil verwalten
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lokale Datensicherung</CardTitle>
          <CardDescription>
            Alle Modul-Daten als JSON exportieren oder aus einer Sicherung
            wiederherstellen. Der Import legt Einträge zusätzlich an (kein
            Überschreiben).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={handleExport}
            disabled={busy}
            className="bg-gradient-accent glow text-white"
          >
            <Download className="size-4" /> Backup exportieren
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" /> Backup importieren
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImport(file)
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
