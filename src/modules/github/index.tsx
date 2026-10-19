import { useSearchParams } from 'react-router'
import { GitHubPanel } from '@/components/integrations/GitHubPanel'
export default function GitHubPage() {
  const [params] = useSearchParams()
  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8"><div><h1 className="text-2xl font-bold tracking-tight">GitHub</h1><p className="mt-1 text-sm text-muted-foreground">Repositories, Codeänderungen und Builds mit deinen Projekten verbinden.</p></div><GitHubPanel key={params.toString()} initialRepository={params.get('repository') ?? undefined} commitSha={params.get('sha') ?? undefined} /></div>
}
