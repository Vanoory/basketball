'use client'

import { useEffect, useRef, useState } from 'react'
import { INPUT, pushAction, resetTouchMove } from '@/lib/input'

// On-screen controls for phones / tablets: a virtual joystick on the left
// and pixel-styled action buttons on the right. They write into the shared
// INPUT bus that the game loop consumes alongside keyboard and gamepad.

const STICK_RADIUS = 56 // px travel of the thumb knob

// Pointer capture can throw on some browsers / synthetic events - never
// let that break the control handlers.
function capture(e: React.PointerEvent) {
  try {
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  } catch {
    // ignore
  }
}

export function useIsTouchDevice() {
  const [touch, setTouch] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => {
      const params = new URLSearchParams(window.location.search)
      const forced = params.get('touch')
      setTouch(
        forced === '1' ||
          (forced !== '0' &&
            (mq.matches ||
              'ontouchstart' in window ||
              navigator.maxTouchPoints > 0)),
      )
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return touch
}

export default function TouchControls() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      <VirtualStick />

      {/* Action cluster: bottom-right */}
      <div className="pointer-events-auto absolute bottom-5 right-4 flex items-end gap-2.5">
        <div className="flex flex-col items-center gap-2.5">
          <ActionButton
            label="PASS"
            sub="SWITCH"
            className="h-16 w-16 border-accent bg-accent/25 text-accent"
            onPress={() => pushAction('pass')}
          />
          <ActionButton
            label="STEAL"
            className="h-16 w-16 border-danger bg-danger/25 text-danger"
            onPress={() => pushAction('steal')}
          />
        </div>
        <ActionButton
          label="SHOOT"
          sub="HOLD"
          className="h-24 w-24 border-primary bg-primary/25 text-primary"
          onPress={() => pushAction('shootDown')}
          onRelease={() => pushAction('shootUp')}
        />
      </div>

      {/* Sprint: above the joystick */}
      <div className="pointer-events-auto absolute bottom-56 left-6">
        <SprintButton />
      </div>
    </div>
  )
}

function VirtualStick() {
  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const pointerId = useRef<number | null>(null)

  useEffect(() => {
    return () => resetTouchMove()
  }, [])

  function moveKnob(dx: number, dz: number) {
    if (knobRef.current)
      knobRef.current.style.transform = `translate(${dx * STICK_RADIUS}px, ${dz * STICK_RADIUS}px)`
  }

  function handleMove(e: React.PointerEvent) {
    if (pointerId.current !== e.pointerId || !baseRef.current) return
    const rect = baseRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = (e.clientX - cx) / STICK_RADIUS
    let dz = (e.clientY - cy) / STICK_RADIUS
    const len = Math.hypot(dx, dz)
    if (len > 1) {
      dx /= len
      dz /= len
    }
    INPUT.moveX = dx
    INPUT.moveZ = dz
    moveKnob(dx, dz)
  }

  function release(e: React.PointerEvent) {
    if (pointerId.current !== e.pointerId) return
    pointerId.current = null
    resetTouchMove()
    moveKnob(0, 0)
  }

  return (
    <div
      ref={baseRef}
      role="application"
      aria-label="Movement joystick"
      className="pointer-events-auto absolute bottom-8 left-6 flex h-36 w-36 items-center justify-center border-4 border-muted bg-background/40"
      style={{ touchAction: 'none', borderRadius: '9999px' }}
      onPointerDown={(e) => {
        pointerId.current = e.pointerId
        capture(e)
        handleMove(e)
      }}
      onPointerMove={handleMove}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div
        ref={knobRef}
        className="h-14 w-14 border-4 border-foreground bg-muted shadow-[3px_3px_0_#0f172a]"
        style={{ borderRadius: '9999px' }}
      />
    </div>
  )
}

function ActionButton({
  label,
  sub,
  className,
  onPress,
  onRelease,
}: {
  label: string
  sub?: string
  className?: string
  onPress: () => void
  onRelease?: () => void
}) {
  const active = useRef(false)
  return (
    <button
      type="button"
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-0.5 border-4 text-[10px] leading-none backdrop-blur-sm active:scale-95 ${className ?? ''}`}
      style={{ touchAction: 'none', borderRadius: '9999px' }}
      onPointerDown={(e) => {
        e.preventDefault()
        active.current = true
        capture(e)
        onPress()
      }}
      onPointerUp={() => {
        if (active.current && onRelease) onRelease()
        active.current = false
      }}
      onPointerCancel={() => {
        if (active.current && onRelease) onRelease()
        active.current = false
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span>{label}</span>
      {sub ? <span className="text-[7px] opacity-70">{sub}</span> : null}
    </button>
  )
}

function SprintButton() {
  const [held, setHeld] = useState(false)
  return (
    <button
      type="button"
      aria-label="Sprint"
      aria-pressed={held}
      className={`flex h-14 w-14 items-center justify-center border-4 text-[9px] leading-none backdrop-blur-sm active:scale-95 ${
        held
          ? 'border-primary bg-primary/40 text-primary-foreground'
          : 'border-muted bg-background/40 text-muted-foreground'
      }`}
      style={{ touchAction: 'none', borderRadius: '9999px' }}
      onPointerDown={(e) => {
        e.preventDefault()
        capture(e)
        INPUT.sprint = true
        setHeld(true)
      }}
      onPointerUp={() => {
        INPUT.sprint = false
        setHeld(false)
      }}
      onPointerCancel={() => {
        INPUT.sprint = false
        setHeld(false)
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      RUN
    </button>
  )
}
