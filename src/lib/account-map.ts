import type { AccountDependency, AccountMapAnalysis, AccountRelation, DependencyKind } from '../types/account-map'
export const RELATION_LABELS = { login: 'Anmeldung', recovery_email: 'Wiederherstellungs-E-Mail', recovery_other: 'Weiterer Wiederherstellungsweg' }
export const LOGIN_DEPENDENCY_LABELS = { only_known: 'Einziger mir bekannter Anmeldeweg', alternative_known: 'Weiterer Anmeldeweg dokumentiert', unknown: 'Weitere Anmeldewege ungeklärt' }
export const DEPENDENCY_LABELS: Record<DependencyKind, string> = {
  login_chain: 'Mögliche Anmeldeabhängigkeit', login_unknown: 'Anmeldeabhängigkeit ungeklärt',
  alternative: 'Anmeldeweg verbunden · Alternative dokumentiert', recovery: 'Wiederherstellungsweg verbunden',
  connection_only: 'Indirekte Verbindung · kein Zugangsverlust ableitbar',
}
export function relationReviewDue(relation: AccountRelation, intervalDays: number, now = Date.now()) {
  return !relation.manualReviewedAt || Date.parse(relation.manualReviewedAt) + intervalDays * 86_400_000 <= now
}
/** Describe declared paths only. No claim about actual provider access, current alternatives or outage causation. */
export function analyzeAccountMap(root: string, relations: AccountRelation[]): AccountMapAnalysis {
  const outgoing = new Map<string, AccountRelation[]>(), incoming = new Map<string, AccountRelation[]>()
  for (const edge of relations) {
    outgoing.set(edge.fromAccountId, [...(outgoing.get(edge.fromAccountId) ?? []), edge])
    incoming.set(edge.toAccountId, [...(incoming.get(edge.toAccountId) ?? []), edge])
  }
  const reachable = (reverse: boolean) => {
    const seen = new Set<string>([root]), queue = [root]
    for (let i = 0; i < queue.length; i++) for (const edge of (reverse ? incoming : outgoing).get(queue[i]) ?? []) {
      const next = reverse ? edge.fromAccountId : edge.toAccountId
      if (!seen.has(next)) { seen.add(next); queue.push(next) }
    }
    seen.delete(root); return seen
  }
  const forward = reachable(false), backward = reachable(true)
  // Track state as well as node to retain multiple path meanings, without looping through cycles.
  const queue: Array<{ id: string; path: string[]; kind: DependencyKind | 'root' }> = [{ id: root, path: [], kind: 'root' }]
  const visited = new Set<string>([`${root}:root`]); const result = new Map<string, AccountDependency>()
  const rank: Record<DependencyKind, number> = { login_chain: 0, login_unknown: 1, alternative: 2, recovery: 3, connection_only: 4 }
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i]
    for (const edge of outgoing.get(node.id) ?? []) {
      if (edge.toAccountId === root) continue
      let kind: DependencyKind
      if (['recovery', 'alternative', 'connection_only'].includes(node.kind)) kind = 'connection_only'
      else if (edge.type !== 'login') kind = 'recovery'
      else if (edge.loginDependency === 'alternative_known') kind = 'alternative'
      else if (node.kind === 'login_unknown' || edge.loginDependency !== 'only_known') kind = 'login_unknown'
      else kind = 'login_chain'
      const path = [...node.path, edge.id], key = `${edge.toAccountId}:${kind}`
      if (visited.has(key)) continue
      visited.add(key)
      const previous = result.get(edge.toAccountId)
      if (!previous || rank[kind] < rank[previous.kind] || (kind === previous.kind && path.length < previous.distance)) {
        result.set(edge.toAccountId, { accountId: edge.toAccountId, kind, distance: path.length, path })
      }
      queue.push({ id: edge.toAccountId, kind, path })
    }
  }
  const cycleIds = [...forward].filter((id) => backward.has(id))
  return { dependencies: [...result.values()].sort((a, b) => rank[a.kind] - rank[b.kind] || a.distance - b.distance), upstreamIds: [...backward], cycleIds: cycleIds.length ? [root, ...cycleIds] : [] }
}
