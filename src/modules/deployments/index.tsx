import { DeploymentPanel } from '@/components/integrations/DeploymentPanel'

export default function DeploymentsPage() {
  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
    <div><h1 className="text-2xl font-bold tracking-tight">Deployments</h1><p className="mt-1 text-sm text-muted-foreground">Vercel-Projekte, Produktionszuordnung und Build-Verlauf an einem Ort.</p></div>
    <DeploymentPanel />
  </div>
}
