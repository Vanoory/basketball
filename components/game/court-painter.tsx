'use client'

import { useEffect, useRef, useState } from 'react'
import { PAINT, useHud, type GameMode, type MapId } from '@/lib/game'

// 2D top-down court painter. The user sprays custom art onto a transparent
// canvas which is then laid over the 3D court floor as a texture.
// Canvas top = the far rim (-z), matching the in-game camera.

const PALETTE = [
  '#f8fafc',
  '#ef4444',
  '#f97316',
  '#fde047',
  '#4ade80',
  '#22d3ee',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
  '#0f172a',
]

const BRUSHES = [6, 14, 28]

interface Props {
  mode: GameMode
  map: MapId
  onDone: () => void
}

export default function CourtPainter({ mode, map, onDone }: Props) {
  const paintRef = useRef<HTMLCanvasElement>(null)
  const guideRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [color, setColor] = useState('#f8fafc')
  const [brush, setBrush] = useState(1)
  const [eraser, setEraser] = useState(false)
  const setHud = useHud((s) => s.setHud)
  const paintVersion = useHud((s) => s.paintVersion)

  const full = mode === '5v5'
  // World-space footprint of the paint plane (must match PaintOverlay)
  const worldW = full ? 19 : 16.9
  const worldL = full ? 29.4 : 16.4
  const floorZ = full ? 0 : -3.4
  const W = 512
  const H = Math.round((W * worldL) / worldW)

  // Map world coords -> canvas pixels
  const px = (x: number) => ((x + worldW / 2) / worldW) * W
  const py = (z: number) => ((z - (floorZ - worldL / 2)) / worldL) * H

  // Draw the reference court markings on the guide layer
  useEffect(() => {
    const g = guideRef.current?.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, W, H)
    // Floor tone
    g.fillStyle = map === 'park' ? '#2e7d54' : '#c98442'
    g.fillRect(0, 0, W, H)
    g.strokeStyle = 'rgba(248,250,252,0.75)'
    g.lineWidth = 3

    const key = (rimZ: number, dir: 1 | -1) => {
      // Painted key
      g.fillStyle = map === 'park' ? 'rgba(29,78,216,0.55)' : 'rgba(185,28,28,0.55)'
      const keyTop = py(rimZ + 1.3 * -dir)
      const keyBot = py(rimZ + 4.1 * dir)
      g.fillRect(px(-1.8), Math.min(keyTop, keyBot), px(1.8) - px(-1.8), Math.abs(keyBot - keyTop))
      // Key outline
      g.strokeRect(px(-1.8), Math.min(keyTop, keyBot), px(1.8) - px(-1.8), Math.abs(keyBot - keyTop))
      // FT circle
      g.beginPath()
      g.arc(px(0), py(rimZ + 4.1 * dir), px(1.75) - px(0), 0, Math.PI * 2)
      g.stroke()
      // 3pt arc
      g.beginPath()
      g.arc(px(0), py(rimZ), px(6.56) - px(0), 0, Math.PI * 2)
      g.stroke()
      // Rim dot
      g.fillStyle = '#f97316'
      g.beginPath()
      g.arc(px(0), py(rimZ), 6, 0, Math.PI * 2)
      g.fill()
    }

    if (full) {
      key(-11.9, 1)
      key(11.9, -1)
      // Midcourt line + circle
      g.beginPath()
      g.moveTo(0, py(0))
      g.lineTo(W, py(0))
      g.stroke()
      g.beginPath()
      g.arc(px(0), py(0), px(1.75) - px(0), 0, Math.PI * 2)
      g.stroke()
    } else {
      key(-9.4, 1)
    }
    // Border
    g.strokeRect(2, 2, W - 4, H - 4)
  }, [W, H, full, map])

  // Restore previous paint if the user re-enters the painter
  useEffect(() => {
    const c = paintRef.current?.getContext('2d')
    if (!c) return
    if (PAINT.canvas && paintVersion > 0 && PAINT.canvas.width === W && PAINT.canvas.height === H) {
      c.clearRect(0, 0, W, H)
      c.drawImage(PAINT.canvas, 0, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    }
  }

  function strokeTo(p: { x: number; y: number }) {
    const ctx = paintRef.current?.getContext('2d')
    if (!ctx) return
    ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over'
    ctx.strokeStyle = color
    ctx.lineWidth = BRUSHES[brush]
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    const from = last.current ?? p
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }

  function commit(painted: boolean) {
    if (painted && paintRef.current) {
      // Copy into a detached canvas so the texture survives unmount
      const out = document.createElement('canvas')
      out.width = W
      out.height = H
      out.getContext('2d')?.drawImage(paintRef.current, 0, 0)
      PAINT.canvas = out
    } else {
      PAINT.canvas = null
    }
    setHud({ paintVersion: paintVersion + 1 })
    onDone()
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/95 p-4">
      <h2 className="text-lg text-primary md:text-2xl [text-shadow:3px_3px_0_#1e293b]">
        PAINT YOUR COURT
      </h2>
      <p className="text-[9px] text-muted-foreground md:text-[11px]">
        DRAW ON THE COURT - YOUR ART SHOWS UP ON THE FLOOR IN-GAME
      </p>

      {/* Tools */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => {
                setColor(c)
                setEraser(false)
              }}
              className={`h-7 w-7 border-2 transition-transform hover:scale-110 ${
                color === c && !eraser
                  ? 'scale-110 border-primary'
                  : 'border-muted'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex gap-1">
          {BRUSHES.map((b, i) => (
            <button
              key={b}
              type="button"
              aria-label={`Brush size ${b}`}
              onClick={() => setBrush(i)}
              className={`flex h-7 w-7 items-center justify-center border-2 bg-muted ${
                brush === i ? 'border-primary' : 'border-muted'
              }`}
            >
              <span
                className="rounded-full bg-foreground"
                style={{ width: 4 + i * 5, height: 4 + i * 5 }}
              />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEraser(!eraser)}
            className={`h-7 border-2 bg-muted px-2 text-[9px] text-foreground ${
              eraser ? 'border-primary' : 'border-muted'
            }`}
          >
            ERASE
          </button>
          <button
            type="button"
            onClick={() => {
              paintRef.current
                ?.getContext('2d')
                ?.clearRect(0, 0, W, H)
            }}
            className="h-7 border-2 border-muted bg-muted px-2 text-[9px] text-foreground"
          >
            CLEAR
          </button>
        </div>
      </div>

      {/* Drawing surface */}
      <div
        className="relative border-4 border-muted shadow-[6px_6px_0_#0f172a]"
        style={{
          width: 'min(64vw, ' + (full ? '300px' : '420px') + ')',
          aspectRatio: `${W} / ${H}`,
          maxHeight: '52vh',
        }}
      >
        <canvas
          ref={guideRef}
          width={W}
          height={H}
          className="absolute inset-0 h-full w-full"
        />
        <canvas
          ref={paintRef}
          width={W}
          height={H}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drawing.current = true
            last.current = null
            strokeTo(pointerPos(e))
          }}
          onPointerMove={(e) => {
            if (drawing.current) strokeTo(pointerPos(e))
          }}
          onPointerUp={() => {
            drawing.current = false
            last.current = null
          }}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => commit(true)}
          className="border-4 border-primary bg-primary px-6 py-2 text-xs text-primary-foreground shadow-[4px_4px_0_#7c2d12] transition-transform hover:scale-105 md:text-sm"
        >
          DONE - PLAY
        </button>
        <button
          type="button"
          onClick={() => commit(false)}
          className="border-4 border-muted bg-muted px-6 py-2 text-xs text-foreground shadow-[4px_4px_0_#0f172a] transition-transform hover:scale-105 md:text-sm"
        >
          SKIP
        </button>
      </div>
    </div>
  )
}
