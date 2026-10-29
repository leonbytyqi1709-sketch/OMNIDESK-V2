import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { useApiFetch } from '@/hooks/use-api'
import type { AttachmentDto, AttachmentKind, AttachmentQuota } from '@/lib/attachments'

interface Owner {
  kind: AttachmentKind
  id: string
}

const key = (owner: Owner) => ['attachments', owner.kind, owner.id] as const

export function useAttachments(owner: Owner | null) {
  const apiFetch = useApiFetch()
  return useQuery({
    queryKey: owner ? key(owner) : ['attachments', 'none'],
    queryFn: () => apiFetch<AttachmentDto[]>(`/api/attachments/${owner!.kind}/${owner!.id}`),
    enabled: Boolean(owner),
  })
}

export function useAttachmentQuota(enabled = true) {
  const apiFetch = useApiFetch()
  return useQuery({
    queryKey: ['attachments', 'quota'],
    queryFn: () => apiFetch<AttachmentQuota>('/api/attachments/quota'),
    enabled,
  })
}

/**
 * Hochladen läuft als Formular-Anfrage, nicht als JSON: Der Browser setzt die
 * Grenzen des mehrteiligen Formats selbst, und die Datei wird nicht erst in
 * Text umgerechnet.
 */
export function useUploadAttachment(owner: Owner) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const response = await fetch(`/api/attachments/${owner.kind}/${owner.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getToken()}` },
        body: form,
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Hochladen fehlgeschlagen (${response.status})`)
      }
      return (await response.json()) as AttachmentDto
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key(owner) })
      void queryClient.invalidateQueries({ queryKey: ['attachments', 'quota'] })
    },
  })
}

export function useDeleteAttachment(owner: Owner) {
  const apiFetch = useApiFetch()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/attachments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key(owner) })
      void queryClient.invalidateQueries({ queryKey: ['attachments', 'quota'] })
    },
  })
}

/**
 * Holt den Inhalt eines Anhangs. Ein einfacher Link ginge nicht: Die Anfrage
 * braucht den Authorization-Kopf.
 */
export function useAttachmentContent() {
  const { getToken } = useAuth()
  // Stabil, damit ein Effekt sie in seine Abhängigkeiten nehmen kann, ohne
  // bei jedem Zeichnen erneut zu laden.
  return useCallback(
    async (attachment: AttachmentDto) => {
      const response = await fetch(`/api/attachments/file/${attachment.id}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      })
      if (!response.ok) throw new Error('Der Anhang konnte nicht geladen werden.')
      return response.blob()
    },
    [getToken],
  )
}

/** Lädt einen Anhang und übergibt ihn dem Browser zum Speichern. */
export function useDownloadAttachment() {
  const load = useAttachmentContent()
  return useCallback(
    async (attachment: AttachmentDto) => {
      const blob = await load(attachment)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.name
      document.body.append(link)
      link.click()
      link.remove()
      // Erst nach dem Klick freigeben, sonst bricht der Download ab.
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    },
    [load],
  )
}
