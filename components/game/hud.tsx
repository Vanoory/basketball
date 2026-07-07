'use client'

import { useState } from 'react'
import {
  setGameMode,
  useHud,
  SETTINGS,
  MAPS,
  JERSEY_KITS,
  type GameMode,
  type MapId,
} from '@/lib/game'
import CourtPainter from './court-painter'
import TouchControls, { useIsTouchDevice } from './touch-controls'
import { pushAction } from '@/lib/input'

type Step = 'mode' | 'map' | 'kits' | 'paint'

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
    mode,
    setHud,
  } = useHud()

  const isTouch = useIsTouchDevice()
  const [step, setStep] = useState<Step>('mode')
  const [pickedMode, setPickedMode] = useState<GameMode>('3v3')
  const [pickedMap, setPickedMap] = useState<MapId>('city')
  const [kit0, setKit0] = useState(0)
  const [kit1, setKit1] = useState(1)

  const myKit = JERSEY_KITS[SETTINGS.kit0]
  const cpuKit = JERSEY_KITS[SETTINGS.kit1]

  function launchGame() {
    SETTINGS.map = pickedMap
    SETTINGS.kit0 = kit0
    SETTINGS.kit1 = kit1
    setGameMode(pickedMode)
    setHud({
      started: true,
      mode: pickedMode,
      map: pickedMap,
      scores: [0, 0],
      over: false,
    })
  }

  function backToMenu() {
    setStep('mode')
    setHud({ started: false, over: false })
  }

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Scoreboard */}
      <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-stretch text-sm md:text-base">
        <div
          className={`flex items-center gap-2 border-4 bg-muted/90 px-4 py-2 ${
            possession === 0 ? 'border-accent' : 'border-muted'
          }`}
          style={{ color: myKit.jersey }}
        >
          <span
            className="inline-block h-2.5 w-2.5"
            style={{ backgroundColor: myKit.jersey }}
          />
          <span>YOU</span>
          <span className="min-w-6 text-right text-foreground">{scores[0]}</span>
        </div>
        <div className="flex items-center border-y-4 border-muted bg-background/80 px-3 text-[10px] text-muted-foreground">
          {mode === '5v5' ? '5V5 - TO 21' : '3V3 - TO 21'}
        </div>
        <div
          className={`flex items-center gap-2 border-4 bg-muted/90 px-4 py-2 ${
            possession === 1 ? 'border-danger' : 'border-muted'
          }`}
          style={{ color: cpuKit.jersey }}
        >
          <span className="min-w-6 text-left text-foreground">{scores[1]}</span>
          <span>CPU</span>
          <span
            className="inline-block h-2.5 w-2.5"
            style={{ backgroundColor: cpuKit.jersey }}
          />
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

      {/* Touch controls: joystick + action buttons on phones/tablets */}
      {isTouch && started && !over && <TouchControls />}

      {/* Controls hint (hidden on touch devices - buttons are on screen) */}
      {!isTouch && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 whitespace-nowrap text-[8px] text-muted-foreground md:text-[10px]">
          {[
            ['WASD / STICK', 'MOVE'],
            ['SHIFT / RT', 'SPRINT'],
            ['SPACE / A', 'SHOOT / DUNK / BLOCK'],
            ['E / X', 'PASS / SWITCH'],
            ['Q / B', 'STEAL'],
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
      )}

      {/* ---------- Pre-game setup flow ---------- */}
      {!started && step === 'mode' && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background/90 p-6 text-center">
          <h1 className="text-3xl text-primary md:text-5xl [text-shadow:4px_4px_0_#1e293b]">
            PIXEL HOOPS
          </h1>
          <p className="text-sm text-accent md:text-lg">PICK YOUR GAME</p>
          <div className="flex max-w-md flex-col gap-2 text-[10px] leading-relaxed text-muted-foreground md:text-xs">
            <p>FIRST TO 21 WINS. 2 PTS INSIDE, 3 PTS BEYOND THE ARC.</p>
            {isTouch ? (
              <>
                <p>HOLD SHOOT FOR A JUMPER - RELEASE IN THE GREEN ZONE.</p>
                <p>RUN TO THE RIM + SHOOT = DUNK.</p>
                <p>DEFENSE: PASS SWITCHES PLAYERS, STEAL POKES, SHOOT BLOCKS.</p>
                <p>GAMEPADS WORK TOO: A SHOOT, X PASS, B STEAL, RT SPRINT.</p>
              </>
            ) : (
              <>
                <p>HOLD SPACE TO JUMP SHOT - RELEASE IN THE GREEN ZONE.</p>
                <p>SPRINT TO THE RIM + SPACE = DUNK.</p>
                <p>ON DEFENSE: E SWITCHES PLAYERS, Q POKES THE BALL, SPACE BLOCKS.</p>
                <p>GAMEPAD: A SHOOT, X PASS, B STEAL, RT SPRINT, STICK MOVES.</p>
              </>
            )}
          </div>
          <div className="flex flex-col items-center gap-4 md:flex-row">
            <button
              type="button"
              onClick={() => {
                setPickedMode('3v3')
                setStep('map')
              }}
              className="flex w-56 flex-col items-center gap-1 border-4 border-primary bg-primary px-6 py-4 text-primary-foreground shadow-[6px_6px_0_#7c2d12] transition-transform hover:scale-105"
            >
              <span className="text-sm md:text-base">3 ON 3</span>
              <span className="text-[9px] opacity-80 md:text-[10px]">
                STREETBALL - HALF COURT
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPickedMode('5v5')
                setStep('map')
              }}
              className="flex w-56 flex-col items-center gap-1 border-4 border-accent bg-accent px-6 py-4 text-accent-foreground shadow-[6px_6px_0_#1e3a8a] transition-transform hover:scale-105"
            >
              <span className="text-sm md:text-base">5 ON 5</span>
              <span className="text-[9px] opacity-80 md:text-[10px]">
                FULL COURT - TWO BASKETS
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Step 2: map selection */}
      {!started && step === 'map' && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background/90 p-6 text-center">
          <h2 className="text-xl text-primary md:text-3xl [text-shadow:3px_3px_0_#1e293b]">
            CHOOSE YOUR COURT
          </h2>
          <div className="flex flex-col items-stretch gap-4 md:flex-row">
            {MAPS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPickedMap(m.id)}
                className={`flex w-64 flex-col items-center gap-2 border-4 p-3 transition-transform hover:scale-105 ${
                  pickedMap === m.id
                    ? 'border-primary bg-muted shadow-[6px_6px_0_#7c2d12]'
                    : 'border-muted bg-muted/60'
                }`}
              >
                {/* Pixel map preview */}
                <div
                  className="relative h-28 w-full overflow-hidden border-2 border-background"
                  style={{
                    backgroundColor: m.id === 'park' ? '#7ec3e8' : '#0f1d33',
                  }}
                >
                  {m.id === 'park' ? (
                    <>
                      <div className="absolute left-2 top-2 h-5 w-5 bg-[#fde047]" />
                      <div className="absolute bottom-0 h-12 w-full bg-[#4d8b3f]" />
                      <div className="absolute bottom-3 left-1/2 h-8 w-24 -translate-x-1/2 bg-[#2e7d54]" />
                      <div className="absolute bottom-8 left-4 h-8 w-4 bg-[#2f7d3c]" />
                      <div className="absolute bottom-8 right-4 h-10 w-4 bg-[#2f7d3c]" />
                      <div className="absolute bottom-10 left-3 h-4 w-6 bg-[#3c9349]" />
                      <div className="absolute bottom-12 right-3 h-4 w-6 bg-[#3c9349]" />
                    </>
                  ) : (
                    <>
                      <div className="absolute left-3 top-3 h-3 w-3 bg-[#fde047]" />
                      <div className="absolute right-6 top-5 h-2 w-2 bg-[#fde047]" />
                      <div className="absolute bottom-8 left-2 h-10 w-6 bg-[#1e293b]" />
                      <div className="absolute bottom-8 right-2 h-14 w-6 bg-[#16213a]" />
                      <div className="absolute bottom-8 left-10 h-8 w-5 bg-[#1e293b]" />
                      <div className="absolute bottom-0 h-8 w-full bg-[#2b3648]" />
                      <div className="absolute bottom-1 left-1/2 h-6 w-24 -translate-x-1/2 bg-[#c98442]" />
                    </>
                  )}
                </div>
                <span className="text-[11px] text-foreground md:text-xs">
                  {m.name}
                </span>
                <span className="text-[8px] text-muted-foreground md:text-[9px]">
                  {m.desc}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('mode')}
              className="border-4 border-muted bg-muted px-5 py-2 text-xs text-foreground shadow-[4px_4px_0_#0f172a] transition-transform hover:scale-105"
            >
              BACK
            </button>
            <button
              type="button"
              onClick={() => setStep('kits')}
              className="border-4 border-primary bg-primary px-5 py-2 text-xs text-primary-foreground shadow-[4px_4px_0_#7c2d12] transition-transform hover:scale-105"
            >
              NEXT
            </button>
          </div>
        </div>
      )}

      {/* Step 3: jersey kits */}
      {!started && step === 'kits' && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-5 bg-background/90 p-6 text-center">
          <h2 className="text-xl text-primary md:text-3xl [text-shadow:3px_3px_0_#1e293b]">
            PICK YOUR JERSEYS
          </h2>
          <div className="flex flex-col gap-5 md:flex-row md:gap-10">
            <KitPicker
              label="YOUR TEAM"
              selected={kit0}
              disabled={kit1}
              onPick={setKit0}
            />
            <KitPicker
              label="CPU TEAM"
              selected={kit1}
              disabled={kit0}
              onPick={setKit1}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('map')}
              className="border-4 border-muted bg-muted px-5 py-2 text-xs text-foreground shadow-[4px_4px_0_#0f172a] transition-transform hover:scale-105"
            >
              BACK
            </button>
            <button
              type="button"
              onClick={() => setStep('paint')}
              className="border-4 border-primary bg-primary px-5 py-2 text-xs text-primary-foreground shadow-[4px_4px_0_#7c2d12] transition-transform hover:scale-105"
            >
              NEXT
            </button>
          </div>
        </div>
      )}

      {/* Step 4: court painter (optional) */}
      {!started && step === 'paint' && (
        <CourtPainter mode={pickedMode} map={pickedMap} onDone={launchGame} />
      )}

      {/* Game over */}
      {over && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background/85 text-center">
          <h2
            className={`text-3xl md:text-5xl [text-shadow:4px_4px_0_#1e293b] ${
              winner === 0 ? 'text-accent' : 'text-danger'
            }`}
          >
            {winner === 0 ? 'YOU WIN!' : 'CPU TEAM WINS!'}
          </h2>
          <p className="text-lg text-foreground md:text-2xl">
            {scores[0]} - {scores[1]}
          </p>
          <p className="text-xs text-muted-foreground md:text-sm">
            {isTouch ? 'TAP PLAY AGAIN' : 'PRESS ENTER / START TO PLAY AGAIN'}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => pushAction('restart')}
              className="border-4 border-primary bg-primary px-6 py-3 text-xs text-primary-foreground shadow-[4px_4px_0_#7c2d12] transition-transform hover:scale-105 md:text-sm"
            >
              PLAY AGAIN
            </button>
            <button
              type="button"
              onClick={backToMenu}
              className="border-4 border-muted bg-muted px-6 py-3 text-xs text-foreground shadow-[4px_4px_0_#0f172a] transition-transform hover:scale-105 md:text-sm"
            >
              MAIN MENU
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Mini pixel-jersey card grid for choosing a team kit
function KitPicker({
  label,
  selected,
  disabled,
  onPick,
}: {
  label: string
  selected: number
  disabled: number
  onPick: (i: number) => void
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] text-accent md:text-xs">{label}</span>
      <div className="grid grid-cols-4 gap-2">
        {JERSEY_KITS.map((kit, i) => (
          <button
            key={kit.name}
            type="button"
            disabled={i === disabled}
            onClick={() => onPick(i)}
            title={kit.name}
            className={`flex flex-col items-center gap-1 border-4 p-1.5 transition-transform ${
              i === selected
                ? 'scale-105 border-primary bg-muted'
                : i === disabled
                  ? 'cursor-not-allowed border-muted bg-muted/30 opacity-30'
                  : 'border-muted bg-muted/60 hover:scale-105'
            }`}
          >
            {/* Tiny pixel jersey */}
            <div className="relative h-10 w-9">
              <div
                className="absolute left-1 top-0 h-6 w-7"
                style={{ backgroundColor: kit.jersey }}
              />
              <div
                className="absolute left-0 top-0 h-2.5 w-1"
                style={{ backgroundColor: kit.jersey }}
              />
              <div
                className="absolute right-0 top-0 h-2.5 w-1"
                style={{ backgroundColor: kit.jersey }}
              />
              <div
                className="absolute left-3.5 top-0 h-1 w-2"
                style={{ backgroundColor: kit.trim }}
              />
              <div
                className="absolute bottom-0 left-1 h-3.5 w-7"
                style={{ backgroundColor: kit.shorts }}
              />
              <div
                className="absolute bottom-3.5 left-1 h-0.5 w-7"
                style={{ backgroundColor: kit.trim }}
              />
            </div>
            <span className="text-[6px] leading-tight text-muted-foreground">
              {kit.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
