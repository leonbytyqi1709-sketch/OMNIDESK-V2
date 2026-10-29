import { Link, useSearchParams } from 'react-router'
import { useEffect, useState } from 'react'
import { GitHubPanel } from '@/components/integrations/GitHubPanel'
import { DeploymentPanel } from '@/components/integrations/DeploymentPanel'
import { NeonPanel } from '@/components/integrations/NeonPanel'
import {
  ArrowLeft,
  MoreVertical,
  Pencil,
  Plus,
  SquareKanban,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { AttachmentsPanel } from '@/components/shared/AttachmentsPanel'
import { ConnectionsPanel } from '@/components/shared/ConnectionsPanel'
import { FocusTotalBadge } from '@/modules/pomodoro/components/FocusTotalBadge'
import { MilestonePanel } from './components/MilestonePanel'
import { ProjectBoard } from './components/ProjectBoard'
import { ProjectFormDialog } from './components/ProjectFormDialog'
import {
  useDeleteProject,
  useProjectDetail,
  useProjects,
  type ProjectDto,
} from './api'
import { PRIORITY_META, PROJECT_STATUS_META } from './constants'
import { consumeQuickAction } from '@/lib/quick-action'

function ProjectDetailView({
  projectId,
  onBack,
}: {
  projectId: string
  onBack: () => void
}) {
  const { data, isLoading, error } = useProjectDetail(projectId)
  useEffect(() => {
    if (!data || !/^#(?:(?:project-task|milestone)-[0-9a-f-]{36}|mission-(?:neon|github|deployment))$/i.test(window.location.hash)) return
    const frame = requestAnimationFrame(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'center' }))
    return () => cancelAnimationFrame(frame)
  }, [data])

  if (isLoading) {
    return <Skeleton className="h-96 rounded-lg" />
  }
  if (error || !data) {
    return (
      <p className="text-sm text-destructive">
        Projekt konnte nicht geladen werden: {error?.message}
      </p>
    )
  }

  const doneMilestones = data.milestones.filter((m) => m.done).length

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Zurück">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold tracking-tight">
            {data.project.name}
          </h2>
          {data.project.description && (
            <p className="truncate text-sm text-muted-foreground">
              {data.project.description}
            </p>
          )}
        </div>
        <Badge
          variant="outline"
          className={PRIORITY_META[data.project.priority].badgeClass}
        >
          {PRIORITY_META[data.project.priority].label}
        </Badge>
        <Badge
          variant="outline"
          className={PROJECT_STATUS_META[data.project.status].badgeClass}
        >
          {PROJECT_STATUS_META[data.project.status].label}
        </Badge>
        {data.project.tags && data.project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.project.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-secondary/80 px-2 py-0.5 text-xs text-muted-foreground font-mono"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
        <Link className="text-sm text-primary hover:underline" to={`/mission-control?project=${encodeURIComponent(projectId)}`}>Mission Control öffnen →</Link>
        <span className="text-xs text-muted-foreground">
          Meilensteine: {doneMilestones}/{data.milestones.length}
        </span>
        <FocusTotalBadge kind="project" id={projectId} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_18rem]">
        <ProjectBoard projectId={projectId} tasks={data.tasks} />
        <div className="space-y-4">
          <MilestonePanel projectId={projectId} milestones={data.milestones} />
          <ConnectionsPanel
            end={{ kind: 'project', id: projectId }}
            className="rounded-xl border border-border bg-card p-4"
          />
          <AttachmentsPanel
            owner={{ kind: 'project', id: projectId }}
            className="rounded-xl border border-border bg-card p-4"
          />
        </div>
      </div>
      <div className="mt-6 space-y-6"><div id="mission-neon" className="scroll-mt-6"><NeonPanel projectId={projectId} /></div><div id="mission-deployment" className="scroll-mt-6"><DeploymentPanel projectId={projectId} /></div><div id="mission-github" className="scroll-mt-6"><GitHubPanel key={projectId} projectId={projectId} /></div></div>
    </div>
  )
}

export default function ProjectsPage() {
  const { data: projects, isLoading, error } = useProjects()
  const deleteProject = useDeleteProject()

  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('project'))
  useEffect(() => { const id = params.get('project'); if (id) setSelectedId(id) }, [params])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editProject, setEditProject] = useState<ProjectDto | null>(null)

  const openCreate = () => {
    setEditProject(null)
    setDialogOpen(true)
  }

  // Schnellaktion aus der Command-Palette: Dialog direkt öffnen
  useEffect(() => {
    if (consumeQuickAction('create-project')) {
      setEditProject(null)
      setDialogOpen(true)
    }
  }, [])

  const openEdit = (project: ProjectDto) => {
    setEditProject(project)
    setDialogOpen(true)
  }

  const handleDelete = async (project: ProjectDto) => {
    try {
      await deleteProject.mutateAsync(project.id)
      if (selectedId === project.id) setSelectedId(null)
      toast.success(`„${project.name}“ gelöscht`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
    }
  }

  return (
    <div className="p-8">
      {selectedId === null ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Projektmanagement
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Agile Kanban-Boards für deine IT-Infrastrukturprojekte.
              </p>
            </div>
            <Button
              onClick={openCreate}
              className="bg-gradient-accent glow text-white"
            >
              <Plus className="size-4" /> Neues Projekt
            </Button>
          </div>

          <div className="mt-8">
            {isLoading && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">
                Projekte konnten nicht geladen werden: {error.message}
              </p>
            )}

            {!isLoading && !error && (projects ?? []).length === 0 && (
              <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
                <SquareKanban className="size-8" />
                <p className="text-sm">
                  Noch keine Projekte – lege das erste an.
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(projects ?? []).map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer gap-3 transition-colors hover:border-muted-foreground/40"
                  onClick={() => setSelectedId(project.id)}
                >
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{project.name}</CardTitle>
                      {project.description && (
                        <CardDescription className="mt-1 line-clamp-2">
                          {project.description}
                        </CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="-mt-1 size-7 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Projekt-Aktionen"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuItem onClick={() => openEdit(project)}>
                          <Pencil className="size-4" /> Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDelete(project)}
                        >
                          <Trash2 className="size-4" /> Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={PRIORITY_META[project.priority].badgeClass}
                      >
                        {PRIORITY_META[project.priority].label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={PROJECT_STATUS_META[project.status].badgeClass}
                      >
                        {PROJECT_STATUS_META[project.status].label}
                      </Badge>
                    </div>
                    {project.tags && project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {project.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      ) : (
        <ProjectDetailView
          projectId={selectedId}
          onBack={() => { setSelectedId(null); setParams({}) }}
        />
      )}

      <ProjectFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editProject={editProject}
      />
    </div>
  )
}
