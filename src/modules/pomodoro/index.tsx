import { useState } from 'react'
import { Coffee, Crosshair, Pause, Play, RotateCcw, SkipForward, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  BREAK_SECONDS,
  WORK_SECONDS,
  usePomodoroStore,
} from '@/stores/pomodoro'
import { FOCUS_LABEL } from '@/lib/focus'
import { cn, formatTime } from '@/lib/utils'
import { FocusReview } from './components/FocusReview'
import { FocusTargetDialog } from './components/FocusTargetDialog'

const RADIUS = 110
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function PomodoroPage() {
  const { mode, remaining, running, completedCycles, target, setTarget, start, pause, reset, skip } =
    usePomodoroStore()
  const [targetOpen, setTargetOpen] = useState(false)

  const total = mode === 'work' ? WORK_SECONDS : BREAK_SECONDS
  const progress = 1 - remaining / total

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="flex items-center gap-2 text-sm font-medium tracking-wider text-muted-foreground uppercase">
        {mode === 'work' ? (
          <>
            <Target className="size-4" /> Fokus
          </>
        ) : (
          <>
            <Coffee className="size-4" /> Pause
          </>
        )}
      </div>

      {/* Ziel des aktuellen Blocks */}
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-xs"
        onClick={() => setTargetOpen(true)}
      >
        <Crosshair className="size-3.5 text-primary" />
        {target ? (
          <>
            <span className="max-w-[16rem] truncate">{target.title}</span>
            <span className="text-muted-foreground">({FOCUS_LABEL[target.kind]})</span>
          </>
        ) : (
          'Ziel wählen'
        )}
      </Button>

      {/* Fortschrittsring im Akzent-Verlauf */}
      <div className={cn('relative', running && 'glow')}>
        <svg width="280" height="280" viewBox="0 0 280 280" role="img" aria-label="Timer-Fortschritt">
          <defs>
            <linearGradient id="pomodoro-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--gradient-from)" />
              <stop offset="100%" stopColor="var(--gradient-to)" />
            </linearGradient>
          </defs>
          <circle
            cx="140"
            cy="140"
            r={RADIUS}
            fill="none"
            stroke="var(--secondary)"
            strokeWidth="10"
          />
          <circle
            cx="140"
            cy="140"
            r={RADIUS}
            fill="none"
            stroke="url(#pomodoro-gradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            transform="rotate(-90 140 140)"
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-6xl font-semibold tabular-nums">
            {formatTime(remaining)}
          </span>
          <span className="mt-2 text-xs text-muted-foreground">
            {completedCycles}{' '}
            {completedCycles === 1 ? 'Pomodoro' : 'Pomodoros'} geschafft
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={reset}
          aria-label="Zurücksetzen"
        >
          <RotateCcw className="size-4" />
        </Button>
        <Button
          size="lg"
          onClick={running ? pause : start}
          className="bg-gradient-accent glow w-36 text-white"
        >
          {running ? (
            <>
              <Pause className="size-4" /> Pause
            </>
          ) : (
            <>
              <Play className="size-4" /> Start
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={skip}
          aria-label="Phase überspringen"
        >
          <SkipForward className="size-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        25 Minuten Fokus, 5 Minuten Pause – der Timer läuft beim Modulwechsel weiter.
        {target
          ? ' Die Zeit wird dem gewählten Ziel gutgeschrieben.'
          : ' Ohne Ziel wird die Zeit als „Ohne Ziel“ gezählt.'}
      </p>

      <FocusReview />

      <FocusTargetDialog
        open={targetOpen}
        onOpenChange={setTargetOpen}
        current={target}
        onSelect={setTarget}
      />
    </div>
  )
}
