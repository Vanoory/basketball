'use client'

import { useHud } from '@/lib/game'

export default function Hud() {
  const {
    scores,
    possession,
    meterActive,
    meterValue,
    meterWindow,
    message,
    over,
    winner,
    started,
    setHud,
  } = useHud()

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Scoreboard */}
      <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-stretch text-sm md:text-base">
        <div
          className={`flex items-center gap-2 border-4 bg-muted/90 px-4 py-2 text-accent ${
            possession === 0 ? 'border-accent' : 'border-muted'
          }`}
        >
          <span className="inline-block h-2.5 w-2.5 bg-accent" />
          <span>BLU</span>
          <span className="min-w-6 text-right text-foreground">{scores[0]}</span>
        </div>
        <div className="flex items-center border-y-4 border-muted bg-background/80 px-3 text-[10px] text-muted-foreground">
          FIRST TO 21
        </div>
        <div
          className={`flex items-center gap-2 border-4 bg-muted/90 px-4 py-2 text-danger ${
            possession === 1 ? 'border-danger' : 'border-muted'
          }`}
        >
          <span className="min-w-6 text-left text-foreground">{scores[1]}</span>
          <span>RED</span>
          <span className="inline-block h-2.5 w-2.5 bg-danger" />
        </div>
      </div>

      {/* Possession label under the scoreboard */}
      {!over && started && (
        <div
          className={`absolute left-1/2 top-16 -translate-x-1/2 border-2 px-2 py-0.5 text-[9px] md:text-[10px] ${
            possession === 0
              ? 'border-accent/60 bg-accent/15 text-accent'
              : 'border-danger/60 bg-danger/15 text-danger'
          }`}
        >
          {possession === 0 ? 'OFFENSE' : 'DEFENSE'}
        </div>
      )}

      {/* Message banner */}
      {message && !over && (
        <div
          key={message}
          className="animate-msg-pop absolute left-1/2 top-24 -translate-x-1/2 text-center text-lg text-primary md:text-2xl [text-shadow:3px_3px_0_#0f172a]"
        >
          {message}
        </div>
      )}

      {/* Shot meter */}
      {meterActive && (
        <div className="absolute bottom-24 left-1/2 h-44 w-7 -translate-x-1/2 border-4 border-foreground bg-muted shadow-[4px_4px_0_#0f172a]">
          {/* Perfect window */}
          <div
            className="absolute w-full bg-emerald-500"
            style={{
              bottom: `${meterWindow[0] * 100}%`,
              height: `${(meterWindow[1] - meterWindow[0]) * 100}%`,
            }}
          />
          {/* Window center tick */}
          <div
            className="absolute h-0.5 w-full bg-emerald-200"
            style={{ bottom: `${((meterWindow[0] + meterWindow[1]) / 2) * 100}%` }}
          />
          {/* Fill cursor */}
          <div
            className="absolute -left-1.5 h-1.5 w-[calc(100%+12px)] bg-primary shadow-[0_0_6px_#f97316]"
            style={{ bottom: `${Math.min(meterValue, 1) * 100}%` }}
          />
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 whitespace-nowrap text-[8px] text-muted-foreground md:text-[10px]">
        {[
          ['WASD', 'MOVE'],
          ['SHIFT', 'SPRINT'],
          ['SPACE', 'SHOOT / DUNK / BLOCK'],
          ['E', 'PASS / SWITCH'],
          ['Q', 'STEAL'],
        ].map(([keyName, action]) => (
          <span
            key={keyName}
            className="flex items-center gap-1 border border-muted bg-background/70 px-1.5 py-0.5"
          >
            <span className="text-foreground">{keyName}</span>
            <span>{action}</span>
          </span>
        ))}
      </div>

      {/* Start screen */}
      {!started && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background/90 p-6 text-center">
          <h1 className="text-3xl text-primary md:text-5xl [text-shadow:4px_4px_0_#1e293b]">
            PIXEL HOOPS
          </h1>
          <p className="text-sm text-accent md:text-lg">3 ON 3 STREETBALL</p>
          <div className="flex max-w-md flex-col gap-2 text-[10px] leading-relaxed text-muted-foreground md:text-xs">
            <p>FIRST TO 21 WINS. 2 PTS INSIDE, 3 PTS BEYOND THE ARC.</p>
            <p>HOLD SPACE TO JUMP SHOT - RELEASE IN THE GREEN ZONE.</p>
            <p>SPRINT TO THE RIM + SPACE = DUNK.</p>
            <p>ON DEFENSE: E SWITCHES PLAYERS, Q POKES THE BALL, SPACE BLOCKS.</p>
          </div>
          <button
            type="button"
            onClick={() => setHud({ started: true })}
            className="border-4 border-primary bg-primary px-8 py-4 text-sm text-primary-foreground shadow-[6px_6px_0_#7c2d12] transition-transform hover:scale-105 md:text-base"
          >
            PLAY
          </button>
        </div>
      )}

      {/* Game over */}
      {over && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background/85 text-center">
          <h2
            className={`text-3xl md:text-5xl [text-shadow:4px_4px_0_#1e293b] ${
              winner === 0 ? 'text-accent' : 'text-danger'
            }`}
          >
            {winner === 0 ? 'YOU WIN!' : 'RED TEAM WINS!'}
          </h2>
          <p className="text-lg text-foreground md:text-2xl">
            {scores[0]} - {scores[1]}
          </p>
          <p className="text-xs text-muted-foreground md:text-sm">
            PRESS ENTER TO PLAY AGAIN
          </p>
        </div>
      )}
    </div>
  )
}
