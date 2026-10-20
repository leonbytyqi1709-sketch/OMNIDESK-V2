import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RELATION_LABELS, relationReviewDue } from '@/lib/account-map'
import type { SecurityAccount } from '@/types/account-security'
import type { AccountDependency, AccountRelation } from '@/types/account-map'
export function AccountGraph({ accounts, relations, selected, dependencies, upstreamIds, select }: {
  accounts: SecurityAccount[]; relations: AccountRelation[]; selected: string; dependencies: AccountDependency[]; upstreamIds: string[]; select: (id: string) => void
}) {
  const id = useId().replace(/:/g, ''), [zoom, setZoom] = useState(1), [focused, setFocused] = useState(true)
  const viewport = useRef<HTMLDivElement>(null)
  const graph = useMemo(() => {
    const related = new Set([selected, ...dependencies.map((item) => item.accountId), ...upstreamIds])
    const sorted = [...accounts].filter((account) => !focused || related.has(account.id)).sort((a, b) => Number(b.id === selected) - Number(a.id === selected) || a.name.localeCompare(b.name))
    const visible = sorted.slice(0, 60), columns = new Map<number, number>()
    const level = (account: SecurityAccount) => {
      const dependency = dependencies.find((item) => item.accountId === account.id)
      return account.id === selected ? 1 : dependency ? Math.min(dependency.distance, 3) + 1 : upstreamIds.includes(account.id) ? 0 : 5
    }
    const levels = [...new Set(visible.map(level))].sort((a, b) => a - b)
    const nodes = visible.map((account) => {
      const column = levels.indexOf(level(account))
      const row = columns.get(column) ?? 0; columns.set(column, row + 1)
      return { account, column, x: 30 + column * 270, y: 50 + row * 105 }
    })
    return { nodes, total: sorted.length, width: Math.max(2, ...nodes.map((node) => node.column + 1)) * 270 + 40, height: Math.max(1, ...columns.values()) * 105 + 85 }
  }, [accounts, selected, dependencies, upstreamIds, focused])
  useEffect(() => {
    const node = graph.nodes.find((item) => item.account.id === selected), element = viewport.current
    if (node && element) element.scrollTo({ left: Math.max(0, (node.x + 108) * zoom - element.clientWidth / 2), top: Math.max(0, node.y * zoom - 25) })
  }, [graph.nodes, selected, zoom])
  return <section aria-label="Interaktive Kontenkarte" className="space-y-3 rounded-xl border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={focused} onChange={(e) => setFocused(e.target.checked)} />Nur strukturell verbundene Konten</label><div className="flex items-center gap-2"><Button size="sm" variant="outline" aria-label="Karte verkleinern" disabled={zoom <= .5} onClick={() => setZoom((value) => value - .25)}>−</Button><span className="text-xs">{Math.round(zoom * 100)} %</span><Button size="sm" variant="outline" aria-label="Karte vergrößern" disabled={zoom >= 1.5} onClick={() => setZoom((value) => value + .25)}>+</Button></div></div>
    <p className="text-xs text-muted-foreground">Blau: Anmeldung · Orange: Wiederherstellung · Gestrichelt: Verbindung ungeprüft oder Prüfung fällig. Pfeile führen vom unterstützenden zum nutzenden Konto. Konten sind per Klick oder Tastatur auswählbar.</p>
    {graph.total > 60 && <p role="status" className="text-xs text-amber-400">Die Grafik zeigt 60 von {graph.total} Konten. Die Kontoauswahl und Verbindungsliste enthalten weiterhin alle gespeicherten Einträge.</p>}
    <div ref={viewport} className="max-h-[560px] overflow-auto rounded-lg border border-border/60 bg-background/50" tabIndex={0} aria-label="Kartenbereich horizontal und vertikal scrollbar">
      <svg viewBox={`0 0 ${graph.width} ${graph.height}`} width={graph.width * zoom} height={graph.height * zoom} style={{ maxWidth: 'none' }} role="group" aria-label="Gerichtete Kontoverbindungen">
        <defs><marker id={`${id}-login`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#38bdf8" /></marker><marker id={`${id}-recovery`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#fbbf24" /></marker></defs>
        {relations.map((edge) => {
          const from = graph.nodes.find((node) => node.account.id === edge.fromAccountId), to = graph.nodes.find((node) => node.account.id === edge.toAccountId)
          if (!from || !to) return null
          const x1 = from.x + 215, y1 = from.y + 38, x2 = to.x, y2 = to.y + 38
          return <path key={edge.id} d={`M${x1} ${y1} C${x1 + 50} ${y1 + (x2 < x1 ? 55 : 0)},${x2 - 25} ${y2 + (x2 < x1 ? 55 : 0)},${x2} ${y2}`} fill="none" stroke={edge.type === 'login' ? '#38bdf8' : '#fbbf24'} strokeWidth="1.8" opacity=".75" strokeDasharray={relationReviewDue(edge, to.account.reviewIntervalDays) ? '6 5' : undefined} markerEnd={`url(#${id}-${edge.type === 'login' ? 'login' : 'recovery'})`}><title>{from.account.name} → {to.account.name} · {RELATION_LABELS[edge.type]}</title></path>
        })}
        {graph.nodes.map(({ account, x, y }) => <g key={account.id} transform={`translate(${x},${y})`} role="button" tabIndex={0} aria-label={`Konto ${account.name} auswählen`} aria-pressed={selected === account.id} onClick={() => select(account.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(account.id) } }} className="cursor-pointer outline-none focus:drop-shadow-[0_0_5px_#38bdf8]">
          <rect width="215" height="76" rx="12" fill="#17171b" stroke={selected === account.id ? '#c026d3' : dependencies.some((dependency) => dependency.accountId === account.id) ? '#38bdf8' : '#52525b'} strokeWidth={selected === account.id ? 2.5 : 1.2} />
          <text x="14" y="28" fill="#f4f4f5" fontSize="13" fontWeight="600">{account.name.length > 25 ? `${account.name.slice(0, 24)}…` : account.name}</text><text x="14" y="51" fill="#a1a1aa" fontSize="11">{account.provider.slice(0, 28) || 'Eigenes Konto'}</text><title>{account.name} · {selected === account.id ? 'Ausgewählt' : upstreamIds.includes(account.id) ? 'Unterstützendes Konto' : 'Dokumentierte Verbindung'}</title>
        </g>)}
      </svg>
    </div>
  </section>
}
