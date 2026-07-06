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
      <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 text-sm md:text-base">
        <div
          className={`border-4 bg-muted px-4 py-2 text-accent ${
            possession === 0 ? 'border-accent' : 'border-muted'
          }`}
        >
          BLU {scores[0]}
        </div>
        <div className="text-muted-foreground text-xs">VS</div>
        <div
          className={`border-4 bg-muted px-4 py-2 text-danger ${
            possession === 1 ? 'border-danger' : 'border-muted'
          }`}
        >
          RED {scores[1]}
        </div>
      </div>

      {/* Message banner */}
      {message && !over && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 text-center text-lg text-primary md:text-2xl [text-shadow:3px_3px_0_#0f172a]">
          {message}
        </div>
      )}

      {/* Shot meter */}
      {meterActive && (
        <div className="absolute bottom-24 left-1/2 h-44 w-6 -translate-x-1/2 border-4 border-foreground bg-muted">
          {/* Perfect window */}
          <div
            className="absolute w-full bg-emerald-500"
            style={{
              bottom: `${meterWindow[0] * 100}%`,
              height: `${(meterWindow[1] - meterWindow[0]) * 100}%`,
            }}
          />
          {/* Fill cursor */}
          <div
            className="absolute h-1.5 w-full bg-primary"
            style={{ bottom: `${Math.min(meterValue, 1) * 100}%` }}
          />
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-muted-foreground md:text-[11px]">
        WASD MOVE | SHIFT SPRINT | SPACE SHOOT/DUNK/BLOCK | E PASS/SWITCH | Q
        STEAL
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
          </div>
          <button
            type="button"
            onClick={() => setHud({ started: true })}
            className="border-4 border-primary bg-primary px-8 py-4 text-sm text-primary-foreground transition-transform hover:scale-105 md:text-base"
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
