import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useBrowserItems } from './api'
export function ProjectBrowserNotes({ projectId }: { projectId: string }) {
  const query = useBrowserItems(projectId)
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="text-base">
          Browser-Quellen im Projekt
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isPending ? (
          <p className="text-sm text-muted-foreground">
            Browser-Notizen werden geladen…
          </p>
        ) : query.error ? (
          <p role="alert" className="text-sm text-destructive">
            {query.error.message}
          </p>
        ) : query.data?.items.length ? (
          <ul className="space-y-2">
            {query.data.items.slice(0, 5).map((i) => (
              <li key={i.id} className="text-sm">
                <Link
                  to={`/browser-desk?project=${encodeURIComponent(projectId)}`}
                  className="text-primary hover:underline"
                >
                  {i.title} →
                </Link>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {i.annotation || i.selection}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch keine Browser-Quellen zugeordnet. Über die Chrome-Erweiterung
            oder die Browser-Kommandoebene eigene Anmerkungen mit diesem Projekt
            verbinden.
          </p>
        )}
        <Link
          to={`/browser-desk?project=${encodeURIComponent(projectId)}`}
          className="inline-block text-sm text-primary hover:underline"
        >
          Alle Browser-Anmerkungen im Projekt öffnen →
        </Link>
      </CardContent>
    </Card>
  )
}
