import { useAuth } from '@clerk/clerk-react'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type {
  ProjectStatus,
  ProjectTaskStatus,
  TaskPriority,
} from '@/db/schema'

export type { ProjectStatus, ProjectTaskStatus }

export interface ProjectDto {
  id: string
  name: string
  description: string
  priority: TaskPriority
  status: ProjectStatus
  tags?: string[] | null
  createdAt: string
  updatedAt: string
}

export interface ProjectTaskDto {
  fingerprint: string
  id: string
  projectId: string
  title: string
  status: ProjectTaskStatus
  priority: TaskPriority
  createdAt: string
  updatedAt: string
}

export interface MilestoneDto {
  id: string
  projectId: string
  title: string
  dueDate: string | null
  done: boolean
  createdAt: string
}

export interface ProjectDetail {
  project: ProjectDto
  tasks: ProjectTaskDto[]
  milestones: MilestoneDto[]
}

export interface ProjectInput {
  name: string
  description: string
  priority: TaskPriority
  status: ProjectStatus
  tags?: string[]
}

const LIST_KEY = ['projects'] as const
const detailKey = (id: string) => ['projects', id] as const

export function useProjects() {
  const apiFetch = useApiFetch()
  const { userId } = useAuth()
  return useQuery({
    queryKey: [...LIST_KEY, userId],
    enabled: Boolean(userId),
    queryFn: () => apiFetch<ProjectDto[]>('/api/projects'),
  })
}

export function useProjectDetail(id: string) {
  const apiFetch = useApiFetch()
  const { userId } = useAuth()
  return useQuery({
    queryKey: [...detailKey(id), userId],
    enabled: Boolean(userId),
    queryFn: () => apiFetch<ProjectDetail>(`/api/projects/${id}`),
  })
}

function useInvalidateProjects(projectId?: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: LIST_KEY })
    if (projectId) {
      void queryClient.invalidateQueries({ queryKey: detailKey(projectId) })
    }
  }
}

export function useCreateProject() {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateProjects()
  return useMutation({
    mutationFn: (input: ProjectInput) =>
      apiFetch<ProjectDto>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateProject(projectId: string) {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateProjects(projectId)
  return useMutation({
    mutationFn: (input: Partial<ProjectInput>) =>
      apiFetch<ProjectDto>(`/api/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteProject() {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateProjects()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

// --- Board-Aufgaben ---

export interface ProjectTaskInput {
  title: string
  status: ProjectTaskStatus
  priority: TaskPriority
}

export function useCreateProjectTask(projectId: string) {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateProjects(projectId)
  return useMutation({
    mutationFn: (input: ProjectTaskInput) =>
      apiFetch<ProjectTaskDto>(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateProjectTask(projectId: string) {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateProjects(projectId)
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: Partial<ProjectTaskInput> & {
      id: string
      expectedFingerprint: string
    }) =>
      apiFetch<ProjectTaskDto>(`/api/projects/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : 'Projektaufgabe konnte nicht geändert werden.',
      ),
  })
}

export function useDeleteProjectTask(projectId: string) {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateProjects(projectId)
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/projects/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : 'Projektaufgabe konnte nicht geändert werden.',
      ),
  })
}

// --- Meilensteine ---

export interface MilestoneInput {
  title: string
  dueDate: string | null
  done: boolean
}

export function useCreateMilestone(projectId: string) {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateProjects(projectId)
  return useMutation({
    mutationFn: (input: MilestoneInput) =>
      apiFetch<MilestoneDto>(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateMilestone(projectId: string) {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateProjects(projectId)
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<MilestoneInput> & { id: string }) =>
      apiFetch<MilestoneDto>(`/api/projects/milestones/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteMilestone(projectId: string) {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateProjects(projectId)
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/projects/milestones/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: invalidate,
  })
}
