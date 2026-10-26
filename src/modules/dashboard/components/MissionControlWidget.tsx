import { NavLink } from 'react-router'
import { AlertTriangle, CheckCircle2, Crosshair, HelpCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { analyzeMission, missionLabels } from '@/lib/mission-control'
import { useMission } from '@/modules/mission-control/api'
import { useProjects } from '@/modules/projects/api'
import type { MissionStatus } from '@/types/mission-control'
import { WidgetCard } from './WidgetCard'

const STATUS_META: Record<
  MissionStatus,
  { icon: typeof CheckCircle2; className: string }
> = {
  ok: { icon: CheckCircle2, className: 'text-emerald-400' },
  attention: { icon: AlertTriangle, className: 'text-amber-400' },
  unknown: { icon: HelpCircle, className: 'text-muted-foreground' },
}

/**
 * Lagebild eines einzelnen Projekts aus Mission Control.
 *
 * Bewusst nur ein Projekt: Jeder Abruf fragt GitHub, Vercel, Neon und die
 * Uptime-Monitore an. Für alle Projekte gleichzeitig wäre das Dashboard
 * dadurch spürbar langsamer. Gewählt wird das zuletzt geänderte aktive
 * Projekt; das vollständige Lagebild bleibt im Modul.
 *
 * Der Abruf zählt nicht als Besuch: Der Vergleich „seit deinem letzten Besuch“
 * in Mission Control bleibt dadurch unberührt.
 */
export function MissionControlWidget() {
  const { data: projects, isLoading: projectsLoading } = useProjects()

  const project = (projects ?? [])
    .filter((entry) => entry.status !== 'done')
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0]

  const { data: snapshot, isLoading, error } = useMission(project?.id ?? '')

  const analysis = snapshot ? analyzeMission(snapshot) : null
  const attention = analysis?.facts.filter((fact) => fact.status !== 'ok') ?? []
  const Icon = analysis ? STATUS_META[analysis.status].icon : HelpCircle

  return (
    <WidgetCard title="Mission Control" icon={Crosshair} to="/mission-control">
      {projectsLoading || (project && isLoading) ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-8 rounded-md" />
          ))}
        </div>
      ) : !project ? (
        <p className="text-sm text-muted-foreground">
          Kein aktives Projekt vorhanden.{' '}
          <NavLink
            to="/projects"
            className="text-foreground underline underline-offset-4"
          >
            Projekt anlegen
          </NavLink>
        </p>
      ) : error || !analysis ? (
        <p className="text-sm text-muted-foreground">
          Lagebild für „{project.name}“ nicht verfügbar. Das bedeutet nicht,
          dass alles in Ordnung ist.
        </p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Icon
              className={cn(
                'size-4 shrink-0',
                STATUS_META[analysis.status].className,
              )}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {project.name}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {missionLabels[analysis.status]}
          </p>

          {attention.length > 0 && (
            <ul className="-mx-2">
              {attention.slice(0, 3).map((fact) => (
                <li key={fact.id}>
                  <NavLink
                    to={fact.href}
                    className="flex items-start gap-2 rounded-md px-2 py-1 transition-colors hover:bg-accent"
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-1.5 shrink-0 rounded-full',
                        fact.status === 'attention'
                          ? 'bg-amber-400'
                          : 'bg-muted-foreground',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {fact.title}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          )}

          {analysis.gaps.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {analysis.gaps.length} unvollständige{' '}
              {analysis.gaps.length === 1 ? 'Quelle' : 'Quellen'} · Details im
              Modul
            </p>
          )}
        </div>
      )}
    </WidgetCard>
  )
}
