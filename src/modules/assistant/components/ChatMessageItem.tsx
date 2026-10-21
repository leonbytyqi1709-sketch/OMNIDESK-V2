import { AutoMemoryNotice } from './AutoMemoryNotice'
import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bot, Brain, Check, Copy, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { ChatMessageDto } from '../api'

interface ChatMessageItemProps {
  message: ChatMessageDto
  isSource?: boolean
  onRemember?: (message: ChatMessageDto) => void
  onShowMemory?: (id: string) => void
}

export function ChatMessageItem({
  message,
  isSource = false,
  onRemember,
  onShowMemory,
}: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    toast.success('Nachricht kopiert')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      id={`chat-message-${message.id}`}
      className={`${isSource ? 'rounded-xl ring-2 ring-primary' : ''} flex w-full gap-3 py-3 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Bot-Avatar */}
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-gradient-accent text-white shadow-sm glow-subtle">
          <Bot className="h-4 w-4" />
        </div>
      )}

      {/* Message Box */}
      <div
        className={`group relative max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${
          isUser
            ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm'
            : 'bg-zinc-900/90 text-zinc-200 border border-zinc-800/80 shadow-sm'
        }`}
      >
        {/* Copy Button */}
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCopy}
          className="absolute right-2 top-2 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100 text-zinc-400 hover:text-zinc-200"
          title="Kopieren"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>

        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none break-words leading-relaxed">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({
                  inline,
                  className,
                  children,
                  ...props
                }: {
                  inline?: boolean
                  className?: string
                  children?: React.ReactNode
                }) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline ? (
                    <div className="relative my-2 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 font-mono text-xs">
                      {match && (
                        <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-3 py-1 text-[11px] text-zinc-400">
                          <span>{match[1]}</span>
                        </div>
                      )}
                      <pre className="p-3 overflow-x-auto">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    </div>
                  ) : (
                    <code
                      className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-primary"
                      {...props}
                    >
                      {children}
                    </code>
                  )
                },
                p({ children }) {
                  return <p className="mb-2 last:mb-0">{children}</p>
                },
              }}
            >
              {message.content}
            </Markdown>
          </div>
        )}

        {!isUser && message.autoMemory && (
          <AutoMemoryNotice state={message.autoMemory} onEdit={onShowMemory} />
        )}
        {!isUser &&
          message.memory &&
          (message.memory.status === 'used' ||
            message.memory.status === 'unavailable') && (
            <details className="mt-3 border-t border-zinc-800 pt-2 text-xs text-zinc-400">
              <summary className="cursor-pointer">
                {message.memory.status === 'used'
                  ? `Erinnerungen · ${message.memory.references.length}`
                  : 'Kontext nicht verfügbar'}
              </summary>
              <p className="mt-2">
                Dies zeigt den mitgesendeten Kontext, nicht den Nachweis, dass
                die KI jeden Eintrag genutzt hat.
              </p>
              <ul className="mt-2 space-y-2">
                {message.memory.references.map((reference) => (
                  <li key={reference.id}>
                    {reference.available ? (
                      <button
                        onClick={() => onShowMemory?.(reference.id)}
                        className="break-words text-left underline underline-offset-4"
                      >
                        {reference.title} · gesendete Version{' '}
                        {reference.version}
                      </button>
                    ) : (
                      <span>
                        Erinnerung entfernt oder Projekt nicht mehr verfügbar ·
                        Version {reference.version}
                      </span>
                    )}
                    {reference.changed && (
                      <span className="block text-amber-400">
                        Inzwischen geändert · aktuell v
                        {reference.currentVersion}
                      </span>
                    )}
                    {reference.archived && (
                      <span className="block">Inzwischen archiviert.</span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1 text-[11px] text-zinc-400"
            onClick={() => onRemember?.(message)}
            title="Erinnerung als Entwurf vorbereiten"
          >
            <Brain className="mr-1 size-3" />
            Merken
          </Button>
        </div>
        <div className="mt-1 flex items-center justify-end text-[10px] text-zinc-500">
          {new Date(message.createdAt).toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>

      {/* User-Avatar */}
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  )
}
