import { useAuth } from '@clerk/clerk-react'
import { useLocation, useSearchParams } from 'react-router'
import { useProjects } from '@/modules/projects/api'
import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  Brain,
  ChevronDown,
  CornerDownLeft,
  Gauge,
  Loader2,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import {
  useChatMessages,
  useChatSessions,
  useCreateSession,
  useSendMessage,
} from './api'
import type { ChatUsage } from './api'
import { ChatMessageItem } from './components/ChatMessageItem'
import { OmniMemory, type MemoryDraft } from './components/OmniMemory'
import { looksLikeOmniOrder } from '@/lib/omni-intent'
import { ChatOmniPlan } from './components/ChatOmniPlan'
import { OmniActions } from './components/OmniActions'
import { ChatSidebar } from './components/ChatSidebar'

const STARTER_PROMPTS = [
  'Hey Omni, wie geht es dir so?',
  'Was ist DNS? Kurz erklärt.',
  'Was ist der Unterschied zwischen Docker Image und Container?',
  'Wie prüfe ich freien Speicher unter Linux?',
]

export default function AssistantPage() {
  const { userId } = useAuth()
  return userId ? <AssistantWorkspace key={userId} userId={userId} /> : null
}

function AssistantWorkspace({ userId }: { userId: string }) {
  const [params, setParams] = useSearchParams(),
    location = useLocation()
  const requestedSession = params.get('session'),
    lastSource = useRef('')
  const [memoryOpen, setMemoryOpen] = useState(false),
    [memoryDraft, setMemoryDraft] = useState<MemoryDraft | null>(null),
    [selectedMemory, setSelectedMemory] = useState<string | null>(null)
  const [memoryEnabled, setMemoryEnabled] = useState(
    () => localStorage.getItem(`omnidesk:chat-memory:${userId}`) !== 'off',
  )
  const [autoCapture, setAutoCapture] = useState(
    () => localStorage.getItem(`omnidesk:auto-memory:${userId}`) !== 'off',
  )
  const [projectScopes, setProjectScopes] = useState<Record<string, string>>({})
  const projects = useProjects()
  const { data: sessions = [], isLoading: sessionsLoading } = useChatSessions()
  const createSessionMutation = useCreateSession()

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('omnidesk_assistant_sidebar') === 'collapsed',
  )

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      localStorage.setItem(
        'omnidesk_assistant_sidebar',
        prev ? 'open' : 'collapsed',
      )
      return !prev
    })
  }

  const [input, setInput] = useState('')
  /**
   * Die zuletzt gesendete Nachricht, die nach einem Auftrag aussah. Omni
   * plant sie und zeigt den Vorschlag unter dem Gespräch; ausgeführt wird
   * erst nach einem Klick.
   */
  const [order, setOrder] = useState<{ text: string; key: string } | null>(null)

  // Wenn Sessions geladen sind und keine aktiv ist, wähle die erste
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id)
    }
  }, [sessions, activeSessionId])

  const { data: messages = [], isLoading: messagesLoading } =
    useChatMessages(activeSessionId)
  const sendMutation = useSendMessage()
  // Zeitzone des Geräts für Datumsangaben in Aufträgen.
  const chatTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'
  const projectScope = projectScopes[activeSessionId ?? 'new'] ?? ''
  useEffect(() => {
    if (sessionsLoading || !requestedSession) return
    const signature = location.key + requestedSession
    if (lastSource.current === signature) return
    lastSource.current = signature
    if (sessions.some((session) => session.id === requestedSession)) {
      setActiveSessionId(requestedSession)
      isPinnedRef.current = false
    } else toast.error('Die Chatquelle ist nicht mehr verfügbar.')
  }, [requestedSession, sessions, sessionsLoading, location.key])
  useEffect(() => {
    if (
      messagesLoading ||
      requestedSession !== activeSessionId ||
      !/^#chat-message-[0-9a-f-]{36}$/i.test(location.hash)
    )
      return
    const frame = requestAnimationFrame(() =>
      document
        .getElementById(location.hash.slice(1))
        ?.scrollIntoView({ block: 'center' }),
    )
    return () => cancelAnimationFrame(frame)
  }, [
    messagesLoading,
    messages,
    requestedSession,
    activeSessionId,
    location.hash,
  ])

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const isPinnedRef = useRef(true)
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true)
  const [usage, setUsage] = useState<ChatUsage | null>(null)
  const [isContextOpen, setIsContextOpen] = useState(true)

  // Auto-Scroll nur, wenn der Nutzer selbst ganz unten ist – so kann man
  // jederzeit nach oben scrollen, ohne dass der Chat "zurückzieht".
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]',
    )
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior })
  }

  useEffect(() => {
    if (isPinnedRef.current) scrollToBottom()
  }, [messages, sendMutation.isPending])

  const handleChatScroll = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]',
    )
    if (!viewport) return
    const pinned =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80
    isPinnedRef.current = pinned
    setIsPinnedToBottom(pinned)
  }

  const markPinned = () => {
    isPinnedRef.current = true
    setIsPinnedToBottom(true)
  }

  const handleNewChat = async () => {
    try {
      const newSession = await createSessionMutation.mutateAsync()
      markPinned()
      setParams({})
      setActiveSessionId(newSession.id)
      setMobileSidebarOpen(false)
    } catch {
      toast.error('Neuer Chat konnte nicht gestartet werden')
    }
  }

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input

    // /context – Token-Verbrauch & verfügbares Kontingent anzeigen
    if (textToSend.trim() === '/context') {
      if (!customText) setInput('')
      if (usage) {
        setIsContextOpen(true)
        markPinned()
        scrollToBottom()
      } else {
        toast.info('Noch keine Token-Nutzung – sende zuerst eine Nachricht.')
      }
      return
    }

    if (!textToSend.trim() || sendMutation.isPending) return

    // Klingt die Nachricht nach einem Auftrag, plant Omni ihn parallel zur
    // Chat-Antwort. Die Prüfung läuft im Browser und kostet nichts.
    setOrder(
      looksLikeOmniOrder(textToSend)
        ? { text: textToSend.trim(), key: crypto.randomUUID() }
        : null,
    )

    let currentId = activeSessionId

    // Falls noch keine Session aktiv ist, lege sofort eine an
    if (!currentId) {
      try {
        const newSession = await createSessionMutation.mutateAsync()
        currentId = newSession.id
        setActiveSessionId(currentId)
        if (projectScope)
          setProjectScopes((current) => ({
            ...current,
            [currentId!]: projectScope,
          }))
      } catch {
        toast.error('Fehler beim Starten des Chats')
        return
      }
    }

    if (!customText) {
      setInput('')
    }

    try {
      const result = await sendMutation.mutateAsync({
        sessionId: currentId,
        content: textToSend.trim(),
        memory: {
          enabled: memoryEnabled,
          projectId: projectScope || null,
          autoCapture: memoryEnabled && autoCapture,
        },
      })
      if (result.memoryReceiptSaved === false)
        toast.warning(
          'Antwort gespeichert, aber der Gedächtnisnachweis konnte nicht dauerhaft gesichert werden.',
        )
      setUsage(result.usage ?? null)
      setIsContextOpen(true)
      markPinned()
    } catch {
      toast.error('Nachricht konnte nicht gesendet werden')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  return (
    <div className="flex h-[calc(100vh-5.5rem)] overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/60 shadow-xl card-hover-glow">
      {/* Desktop Sidebar */}
      <div
        className={`hidden shrink-0 transition-[width] duration-200 md:block ${
          sidebarCollapsed ? 'w-12' : 'w-72'
        }`}
      >
        {sidebarCollapsed ? (
          <div className="flex h-full w-12 flex-col items-center gap-2 border-r border-zinc-800 bg-zinc-950/60 py-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
              onClick={toggleSidebar}
              title="Sidebar einblenden"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-gradient-accent text-white shadow-sm glow-subtle hover:brightness-110"
              onClick={handleNewChat}
              title="Neuer Chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <ChatSidebar
            sessions={sessions}
            currentSessionId={activeSessionId}
            onSelectSession={(id) => {
              markPinned()
              setParams({})
              setActiveSessionId(id)
            }}
            onNewChat={handleNewChat}
          />
        )}
      </div>

      {/* Mobile Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex bg-black/60 md:hidden">
          <div className="w-4/5 max-w-xs h-full">
            <ChatSidebar
              sessions={sessions}
              currentSessionId={activeSessionId}
              onSelectSession={(id) => {
                markPinned()
                setParams({})
                setActiveSessionId(id)
                setMobileSidebarOpen(false)
              }}
              onNewChat={handleNewChat}
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />
          </div>
          <div className="flex-1" onClick={() => setMobileSidebarOpen(false)} />
        </div>
      )}

      {/* Chat Hauptbereich */}
      <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950/40">
        {/* Chat Topbar */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3 bg-zinc-900/40">
          <div className="flex items-center gap-2.5 truncate">
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex text-zinc-400 hover:text-zinc-100"
              onClick={toggleSidebar}
              title={
                sidebarCollapsed ? 'Sidebar einblenden' : 'Sidebar ausblenden'
              }
            >
              <PanelLeftClose className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-zinc-400"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-accent text-white shadow-sm glow-subtle shrink-0">
              <Bot className="h-4 w-4" />
            </div>

            <div className="truncate">
              <h2 className="text-sm font-semibold text-zinc-100 truncate">
                {activeSession?.title || 'Omni'}
              </h2>
              <p className="text-[11px] text-zinc-500">
                IT- &amp; FiSi-Fachwissen, Skripte, Notizen &amp; Fehleranalyse
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMemoryDraft(null)
                setSelectedMemory(null)
                setMemoryOpen(true)
              }}
            >
              <Brain className="mr-1.5 size-4" />
              <span className="hidden sm:inline">Gedächtnis</span>
              <span className="sm:hidden">Wissen</span>
            </Button>
            <OmniActions />
          </div>
        </div>

        {/* Nachrichtenliste */}
        <div className="relative flex-1 overflow-hidden">
          <ScrollArea
            ref={scrollAreaRef}
            onScroll={handleChatScroll}
            className="h-full px-4 py-4"
          >
            {sessionsLoading || messagesLoading ? (
              <div className="flex h-64 items-center justify-center text-xs text-zinc-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                Chat wird geladen...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-accent text-white shadow-md glow-subtle mb-3">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-zinc-200">
                  Hi, ich bin Omni 👋 Wie kann ich dich heute unterstützen?
                </h3>
                <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                  Frag einfach los. Ich antworte kurz – wenn du mehr Details
                  möchtest, sag Bescheid.
                </p>

                {/* Starter-Prompts */}
                <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 max-w-lg w-full text-left">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleSend(prompt)}
                      className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-850 hover:text-zinc-100 hover:border-zinc-700 text-left"
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                      <span>{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((m) => (
                  <ChatMessageItem
                    key={m.id}
                    message={m}
                    isSource={
                      requestedSession === activeSessionId &&
                      location.hash === `#chat-message-${m.id}`
                    }
                    onRemember={(message) => {
                      setMemoryDraft({ message, key: crypto.randomUUID() })
                      setSelectedMemory(null)
                      setMemoryOpen(true)
                    }}
                    onShowMemory={(id) => {
                      setMemoryDraft(null)
                      setSelectedMemory(id)
                      setMemoryOpen(true)
                    }}
                  />
                ))}
                {order && (
                  <ChatOmniPlan
                    key={order.key}
                    prompt={order.text}
                    timeZone={chatTimeZone}
                  />
                )}
                {sendMutation.isPending && (
                  <div className="flex items-center gap-2 py-3 text-xs text-zinc-500">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-accent text-white shadow-sm glow-subtle animate-pulse">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      KI generiert Antwort…
                    </span>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* „Nach unten"-Button, sobald man nach oben gescrollt ist */}
          {!isPinnedToBottom && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                markPinned()
                scrollToBottom()
              }}
              className="absolute bottom-3 left-1/2 z-10 h-7 -translate-x-1/2 rounded-full border border-zinc-800 bg-zinc-900/90 text-[11px] text-zinc-300 shadow-md hover:bg-zinc-800"
            >
              <ChevronDown className="mr-1 h-3.5 w-3.5" />
              Nach unten
            </Button>
          )}
        </div>

        {/* /context – Token-Nutzung & Kontingent */}
        {usage && isContextOpen && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-800/80 bg-zinc-900/40 px-4 py-2 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Gauge className="h-3 w-3 text-primary" />
              Token-Nutzung
            </span>
            <span>
              Prompt:{' '}
              <span className="text-zinc-300">
                {usage.promptTokens?.toLocaleString('de-DE') ?? '–'}
              </span>
            </span>
            <span>
              Antwort:{' '}
              <span className="text-zinc-300">
                {usage.completionTokens?.toLocaleString('de-DE') ?? '–'}
              </span>
            </span>
            <span>
              Gesamt:{' '}
              <span className="text-zinc-300">
                {usage.totalTokens?.toLocaleString('de-DE') ?? '–'}
              </span>{' '}
              Tokens
            </span>
            {usage.ratelimit?.remainingTokens != null && (
              <span>
                Verfügbar:{' '}
                <span className="text-emerald-400">
                  {usage.ratelimit.remainingTokens.toLocaleString('de-DE')}
                </span>{' '}
                Tokens
              </span>
            )}
            {usage.ratelimit?.remainingRequests != null && (
              <span>
                Anfragen übrig:{' '}
                <span className="text-emerald-400">
                  {usage.ratelimit.remainingRequests}
                </span>
              </span>
            )}
            {usage.ratelimit?.resetTokens && (
              <span>Reset: {usage.ratelimit.resetTokens}</span>
            )}
            <button
              onClick={() => setIsContextOpen(false)}
              className="ml-auto text-zinc-600 transition-colors hover:text-zinc-300"
              title="Ausblenden"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800/80 px-3 py-2 text-xs text-zinc-400">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={memoryEnabled}
              onChange={(e) => {
                setMemoryEnabled(e.target.checked)
                localStorage.setItem(
                  `omnidesk:chat-memory:${userId}`,
                  e.target.checked ? 'on' : 'off',
                )
              }}
            />
            Gedächtnis für neue Antworten nutzen
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoCapture}
              disabled={!memoryEnabled || sendMutation.isPending}
              onChange={(e) => {
                setAutoCapture(e.target.checked)
                localStorage.setItem(
                  `omnidesk:auto-memory:${userId}`,
                  e.target.checked ? 'on' : 'off',
                )
              }}
            />
            Wichtige Angaben automatisch merken
          </label>
          <span className="text-[11px] text-zinc-500">
            Neue eigene Angaben prüfen lassen · ggf. zusätzlicher KI-Aufruf
          </span>
          <label className="flex min-w-0 items-center gap-2">
            <span>Projektkontext</span>
            <select
              aria-label="Projektkontext für Gedächtnis"
              className="max-w-48 rounded-md border border-zinc-800 bg-zinc-900 p-1.5"
              value={projectScope}
              disabled={!memoryEnabled || sendMutation.isPending}
              onChange={(e) =>
                setProjectScopes((current) => ({
                  ...current,
                  [activeSessionId ?? 'new']: e.target.value,
                }))
              }
            >
              <option value="">Nur persönliche Erinnerungen</option>
              {projects.data?.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          {projects.error && (
            <span className="text-amber-400">
              Projektliste nicht verfügbar.
            </span>
          )}
        </div>
        {/* Input Bar */}
        <div className="border-t border-zinc-800/80 p-3 bg-zinc-900/40">
          <div className="relative flex items-end rounded-xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-sm focus-within:border-zinc-700">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Frage stellen oder Prompt eingeben... (Enter senden, Shift+Enter Zeilenumbruch, /context für Token-Nutzung)"
              className="min-h-[44px] max-h-36 resize-none border-0 bg-transparent text-sm focus-visible:ring-0 placeholder:text-zinc-500"
              rows={1}
            />

            <Button
              size="icon"
              onClick={() => handleSend()}
              disabled={!input.trim() || sendMutation.isPending}
              className="h-8 w-8 shrink-0 bg-gradient-accent text-white hover:brightness-110 disabled:opacity-50"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CornerDownLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
      <OmniMemory
        open={memoryOpen}
        onOpenChange={setMemoryOpen}
        draft={memoryDraft}
        selectedId={selectedMemory}
        onSelect={setSelectedMemory}
      />
    </div>
  )
}
