import { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { Link, useLocation } from 'react-router'
import { Bot, RefreshCw, Settings2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useBriefingContext, useBriefingFacts, useBriefingMessage, useBriefingPreferences } from '@/hooks/use-briefing'
import { BRIEFING_COUNT_LABELS, BRIEFING_REASON_LABELS, BRIEFING_SOURCE_LABELS, defaultBriefingRecommendations } from '@/lib/briefing'
import type { BriefingPreferences, BriefingSection, BriefingSnapshot, BriefingSource } from '@/types/briefing'
const hrefs: Record<BriefingSource, string> = { tasks:'/tasks',projects:'/projects',calendar:'/calendar',uptime:'/uptime',neon:'/uptime',security:'/account-security' }
const states: Record<string,string> = { active:'Aktiv',paused:'Pausiert',todo:'Offen',in_progress:'In Arbeit',ongoing:'Läuft gerade',upcoming:'Bevorstehend',stale:'Messung veraltet / unbekannt',down:'Störung',ssl_warning:'Zertifikatswarnung',warning:'Warnung',review:'Dokumentierte Prüfung offen' }
function PreferenceForm({ snapshot }: { snapshot: BriefingSnapshot }) {
  const [value,setValue]=useState<BriefingPreferences>(snapshot.preferences), mutation=useBriefingPreferences()
  return <form className="space-y-4 rounded-xl border border-border p-4" onSubmit={(event)=>{event.preventDefault();mutation.mutate({preferences:value,version:snapshot.preferenceVersion})}}>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.showOnOpen} onChange={(e)=>setValue({...value,showOnOpen:e.target.checked})}/>Beim Öffnen der App automatisch anzeigen</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.aiEnabled} onChange={(e)=>setValue({...value,aiEnabled:e.target.checked})}/>Omni darf KI-Empfehlungen aus den ausgewählten Quellen erstellen</label>
    <p className="text-xs text-muted-foreground">Dabei werden ausgewählte Titel und Statusangaben an deinen bereits eingerichteten KI-Anbieter übermittelt. Keine Notiztexte, Passwörter, Vault-Inhalte oder Wiederherstellungscodes. Die Faktenübersicht funktioniert auch ohne KI.</p>
    <label className="block space-y-1 text-sm">Zeitzone<select value={value.timeZone} onChange={(e)=>setValue({...value,timeZone:e.target.value})} className="block w-full rounded-md border border-border bg-background p-2">{[...new Set([value.timeZone,'Europe/Berlin','Europe/London','America/New_York','UTC'])].map((zone)=><option key={zone} value={zone}>{zone}</option>)}</select></label>
    <fieldset className="grid gap-2 sm:grid-cols-2"><legend className="mb-2 text-sm font-semibold">Einbezogene Bereiche</legend>{(Object.keys(value.sources) as BriefingSource[]).map((source)=><label key={source} className="flex items-start gap-2 text-xs"><input type="checkbox" checked={value.sources[source]} onChange={(e)=>setValue({...value,sources:{...value.sources,[source]:e.target.checked}})} className="mt-0.5"/>{BRIEFING_SOURCE_LABELS[source]}</label>)}</fieldset>
    <p className="text-xs text-muted-foreground">Im Modul-Manager ausgeschaltete Bereiche bleiben zusätzlich ausgeschlossen. Kontosicherheit ist zunächst aus; dortige Angaben bleiben als Selbstauskunft gekennzeichnet.</p>
    {mutation.error&&<p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}<Button size="sm" type="submit" disabled={mutation.isPending||!snapshot.storageReady}>Einstellungen speichern</Button>
  </form>
}
function FactSection({ section, timeZone, close }: { section: BriefingSection; timeZone:string; close:()=>void }) {
  return <section className="min-w-0 space-y-3 rounded-xl border border-border p-4"><h3 className="text-sm font-semibold"><Link to={hrefs[section.source]} onClick={close} className="underline-offset-4 hover:underline">{BRIEFING_SOURCE_LABELS[section.source]}</Link></h3>
    {section.status!=='ready'?<p className="text-xs text-amber-400">{section.status==='excluded'?'Von dir oder im Modul-Manager ausgeschlossen.':section.status==='not_configured'?'Noch nicht eingerichtet oder keine nutzbare Zuordnung.':'Datenquelle derzeit nicht verfügbar. Das bedeutet nicht, dass keine offenen Punkte existieren.'}</p>:<>
      <dl className="grid grid-cols-2 gap-3 text-xs">{Object.entries(section.counts).map(([key,count])=><div key={key}><dt className="text-muted-foreground">{BRIEFING_COUNT_LABELS[key]??key}</dt><dd className="mt-1 font-semibold">{count}</dd></div>)}</dl>
      {!!section.items.length&&<details><summary className="cursor-pointer text-xs text-muted-foreground">Quellen öffnen · {section.items.length} ausgewählte Einträge</summary><ul className="mt-3 max-h-72 space-y-3 overflow-auto">{section.items.map((entry)=><li key={entry.id} className="space-y-1 border-b border-border/60 pb-2 last:border-0"><Link to={entry.href} onClick={close} className="block break-words text-sm hover:underline">{entry.title}</Link><p className="text-xs text-muted-foreground">{entry.kind} · {states[entry.state]??entry.state}{entry.at&&` · ${new Date(entry.at).toLocaleString('de-DE',{timeZone})}`}</p></li>)}</ul></details>}
      {section.changes!=null&&<p className="text-xs text-muted-foreground">Seit dem vorherigen App-Start geändert: {section.changes}{section.source==='projects'?' Projekte (ohne separate Task-Historie)':section.source==='calendar'?' Termine im angezeigten Zeitraum':' persönliche Aufgaben, einschließlich erledigter'}. Gelöschte Einträge sind nicht nachträglich erfasst.</p>}
    </>}
  </section>
}
export function OmniBriefing() {
  const facts=useBriefingFacts(),context=useBriefingContext(),{user}=useUser()
  const [dismissed,setDismissed]=useState(false),[manualOpen,setManualOpen]=useState(false),[now,setNow]=useState(Date.now())
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60_000);return()=>clearInterval(timer)},[])
  const snapshot=facts.data,open=manualOpen||(!dismissed&&Boolean(snapshot?.preferences.showOnOpen)),message=useBriefingMessage(snapshot,open)
  const close=()=>{setDismissed(true);setManualOpen(false)}
  // Der Auslöser erscheint ausschließlich auf dem Dashboard. In allen anderen
  // Modulen entfiel sonst eine zusätzliche Leiste über dem Modulinhalt und
  // verschob dessen Layout. Automatisches Öffnen beim App-Start bleibt hiervon
  // unberührt, weil der Dialog weiterhin überall eingehängt ist.
  const onDashboard=useLocation().pathname==='/'
  const openBriefing=()=>{setManualOpen(true);if(!snapshot||Date.now()-Date.parse(snapshot.checkedAt)>60_000)void facts.refetch()}
  const stale=Boolean(snapshot&&now-Date.parse(snapshot.checkedAt)>120_000)
  const usableMessage=context.aiModuleEnabled&&snapshot?.preferences.aiEnabled&&message.data?.digest===snapshot.digest?message.data:undefined
  const aiReady=usableMessage&&(usableMessage.status==='ready'||usableMessage.status==='cached')
  const recommendations=snapshot?(usableMessage?.recommendations??defaultBriefingRecommendations(snapshot)):[]
  const allItems=snapshot?.sections.flatMap((section)=>section.items)??[]
  const hour=Number(new Intl.DateTimeFormat('en-GB',{hour:'numeric',hourCycle:'h23',timeZone:snapshot?.timeZone??'Europe/Berlin'}).format(new Date(now)))
  const greeting=hour<5?'Gute Nacht':hour<11?'Guten Morgen':hour<18?'Guten Tag':'Guten Abend'
  const name=user?.firstName??user?.username??''
  const tasks=snapshot?.sections.find((s)=>s.source==='tasks'),projects=snapshot?.sections.find((s)=>s.source==='projects'),calendar=snapshot?.sections.find((s)=>s.source==='calendar')
  return <>{onDashboard&&<div className="flex justify-end px-4 pt-3 md:px-6"><Button size="sm" variant="outline" onClick={openBriefing}><Bot className="mr-2 size-4"/>Omni-Briefing</Button></div>}
    <Dialog open={open} onOpenChange={(value)=>{if(!value)close()}}><DialogContent className="w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary"/>Dein Omni-Briefing</DialogTitle><DialogDescription>Dein Arbeitsstand mit nachvollziehbaren Quellen und getrennten Empfehlungen.</DialogDescription></DialogHeader>
      {facts.isLoading&&<p className="text-sm text-muted-foreground">Omni sammelt deinen aktuellen Arbeitsstand…</p>}
      {facts.error&&<p role="alert" className="text-sm text-destructive">{facts.error.message}{snapshot?' Die sichtbaren Angaben stammen vom letzten erfolgreichen Abruf.':''}</p>}
      {snapshot&&<div className="space-y-5">
        <div className="space-y-3 rounded-xl border border-primary/25 bg-secondary/15 p-4"><p className="text-lg font-semibold">{greeting}{name?`, ${name}`:''}.</p><p className="text-sm leading-relaxed">{tasks?.status==='ready'&&<>Du hast <Link to="/tasks" onClick={close} className="font-semibold underline underline-offset-4">{tasks.counts.open} offene persönliche Aufgaben</Link>, davon {tasks.counts.today} heute fällig und {tasks.counts.overdue} überfällig. </>}{projects?.status==='ready'&&<>Bei deinen <Link to="/projects" onClick={close} className="font-semibold underline underline-offset-4">{projects.counts.active} aktiven Projekten</Link> stehen außerdem {projects.counts.paused} Projekte auf Pause. Projektaufgaben werden unten separat aufgeführt. </>}{calendar?.status==='ready'&&<>Im <Link to="/calendar" onClick={close} className="font-semibold underline underline-offset-4">Kalender stehen {calendar.counts.upcoming} anstehende oder laufende Termine</Link> für die nächsten sieben Kalendertage.</>}</p>
          {!snapshot.sections.some((s)=>s.status==='ready')&&<p className="text-sm text-amber-400">Aktuell ist keine einbezogene Datenquelle verfügbar. Daraus lässt sich kein leerer Arbeitsstand ableiten.</p>}
          <p className="text-xs text-muted-foreground">Stand: {new Date(snapshot.checkedAt).toLocaleString('de-DE',{timeZone:snapshot.timeZone})} · {snapshot.timeZone}</p>
          {(stale||facts.error)&&<p role="status" className="text-xs text-amber-400">Die Fakten sind möglicherweise veraltet. Bitte vor einer Entscheidung aktualisieren.</p>}
          {(!snapshot.storageReady||!snapshot.visitRecorded)&&<p role="status" className="text-xs text-amber-400">Besuchsvergleich oder Speicherung nicht verfügbar. Fakten bleiben sichtbar; KI wird ohne sicheren benutzerbezogenen Speicher nicht neu erzeugt.</p>}
          <Button size="sm" variant="outline" disabled={facts.isFetching} onClick={()=>void facts.refetch()}><RefreshCw className={`mr-2 size-3.5 ${facts.isFetching?'animate-spin':''}`}/>Fakten aktualisieren</Button>
        </div>
        <section className="space-y-3"><h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">Vorschlag für deinen nächsten Schritt<Badge variant="outline">{aiReady?'Omni · KI-Empfehlung':'Regelbasierte Orientierung'}</Badge></h2>
          {message.isFetching&&<p className="text-xs text-muted-foreground">Omni wählt passende nächste Schritte aus deinen Quellen…</p>}
          {!aiReady&&!message.isFetching&&<p className="text-xs text-muted-foreground">{!snapshot.preferences.aiEnabled||!context.aiModuleEnabled?'KI-Empfehlungen sind ausgeschaltet.':usableMessage?.status==='not_needed'?'Keine priorisierten Quellen vorhanden; dafür ist keine KI-Anfrage nötig.':usableMessage?.status==='cooldown'?'Neue KI-Anfragen sind kurz begrenzt; die Faktenübersicht bleibt aktuell.':'Die KI ist gerade nicht verfügbar. Du siehst eine Orientierung aus den strukturierten Fakten.'}</p>}
          {!recommendations.length?<p className="text-sm text-muted-foreground">In den geladenen Quellen ist kein priorisierter nächster Schritt enthalten. Prüfe bei Bedarf die vollständigen Module und nicht verfügbaren Bereiche.</p>:<ol className="space-y-3">{recommendations.map((rec)=>{const source=allItems.find((entry)=>entry.id===rec.sourceId);return source?<li key={rec.sourceId} className="space-y-1 rounded-lg border border-border p-3"><Link to={source.href} onClick={close} className="block break-words text-sm font-semibold hover:underline">{source.title}</Link><p className="text-xs text-muted-foreground">{BRIEFING_REASON_LABELS[rec.reason]} {aiReady?'Omni empfiehlt, diesen Punkt als Nächstes einzuplanen.':'Als möglicher nächster Schritt vorgeschlagen.'}</p></li>:null})}</ol>}
          {usableMessage?.generatedAt&&<p className="text-xs text-muted-foreground">Empfehlung erstellt: {new Date(usableMessage.generatedAt).toLocaleString('de-DE',{timeZone:snapshot.timeZone})}{usableMessage.status==='cached'?' · Wiederverwendet, keine neue KI-Anfrage.':''}</p>}
        </section>
        <p className="text-xs text-muted-foreground">{snapshot.previousVisitAt?`Vergleich seit deinem vorherigen App-Start am ${new Date(snapshot.previousVisitAt).toLocaleString('de-DE',{timeZone:snapshot.timeZone})}.`:'Noch kein vorheriger App-Start für einen Besuchsvergleich gespeichert.'} Fakten sind keine vollständige Änderungshistorie. Empfehlungen führen keine Aktionen aus.</p>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">{snapshot.sections.map((section)=><FactSection key={section.source} section={section} timeZone={snapshot.timeZone} close={close}/>)}</div>
        <p className="text-xs text-muted-foreground">Zähler beziehen sich auf alle passenden eigenen Einträge, die Quellenlisten auf einen begrenzten Ausschnitt. Persönliche Aufgaben, Projektaufgaben und Meilensteine werden nicht zu einer gemeinsamen Gesamtzahl vermischt. Die Monitorübersicht liest gespeicherte Prüfungen und startet keine neuen Checks.</p>
        <details><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><Settings2 className="size-4"/>Briefing-Einstellungen</summary><div className="mt-3"><PreferenceForm key={snapshot.preferenceVersion} snapshot={snapshot}/></div></details>
      </div>}
    </DialogContent></Dialog>
  </>
}
