'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G, STUN_TIME, DUNK_DUR, addFx } from '@/lib/game'

interface Props {
  id: number
}

// ---------- Tiny 3x5 pixel digit font for jersey numbers ----------
const DIGITS: Record<string, number[]> = {
  '0': [1,1,1, 1,0,1, 1,0,1, 1,0,1, 1,1,1],
  '1': [0,1,0, 1,1,0, 0,1,0, 0,1,0, 1,1,1],
  '2': [1,1,1, 0,0,1, 1,1,1, 1,0,0, 1,1,1],
  '3': [1,1,1, 0,0,1, 0,1,1, 0,0,1, 1,1,1],
  '4': [1,0,1, 1,0,1, 1,1,1, 0,0,1, 0,0,1],
  '5': [1,1,1, 1,0,0, 1,1,1, 0,0,1, 1,1,1],
  '6': [1,1,1, 1,0,0, 1,1,1, 1,0,1, 1,1,1],
  '7': [1,1,1, 0,0,1, 0,1,0, 0,1,0, 0,1,0],
  '8': [1,1,1, 1,0,1, 1,1,1, 1,0,1, 1,1,1],
  '9': [1,1,1, 1,0,1, 1,1,1, 0,0,1, 1,1,1],
}

function JerseyNumber({
  n,
  z,
  color = '#f8fafc',
}: {
  n: number
  z: number
  color?: string
}) {
  const px = 0.034
  const str = String(n)
  const pixels = useMemo(() => {
    const out: [number, number][] = []
    const totalW = str.length * 4 * px - px
    str.split('').forEach((ch, di) => {
      const bits = DIGITS[ch]
      if (!bits) return
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if (bits[row * 3 + col]) {
            out.push([
              di * 4 * px + col * px - totalW / 2 + px / 2,
              (4 - row) * px - px * 2,
            ])
          }
        }
      }
    })
    return out
  }, [str])
  return (
    <group position={[0, 1.1, z]}>
      {pixels.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <boxGeometry args={[px, px, 0.012]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

// ---------- Hairstyles: each player gets a unique cut ----------
function Hair({ style, color }: { style: string; color: string }) {
  switch (style) {
    case 'afro':
      return (
        <group>
          <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[0.46, 0.3, 0.44]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[-0.2, 0.1, 0]}>
            <boxGeometry args={[0.1, 0.22, 0.4]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[0.2, 0.1, 0]}>
            <boxGeometry args={[0.1, 0.22, 0.4]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.12, -0.19]}>
            <boxGeometry args={[0.4, 0.2, 0.1]} />
            <meshLambertMaterial color={color} />
          </mesh>
        </group>
      )
    case 'flattop':
      return (
        <group>
          <mesh position={[0, 0.24, 0]}>
            <boxGeometry args={[0.36, 0.2, 0.34]} />
            <meshLambertMaterial color={color} />
          </mesh>
          {/* Shaved sides line */}
          <mesh position={[0, 0.13, 0]}>
            <boxGeometry args={[0.345, 0.04, 0.33]} />
            <meshLambertMaterial color="#292524" />
          </mesh>
        </group>
      )
    case 'hightop':
      return (
        <group>
          <mesh position={[0, 0.28, 0]}>
            <boxGeometry args={[0.28, 0.26, 0.3]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <boxGeometry args={[0.34, 0.08, 0.33]} />
            <meshLambertMaterial color={color} />
          </mesh>
        </group>
      )
    case 'bun':
      return (
        <group>
          <mesh position={[0, 0.15, 0.01]}>
            <boxGeometry args={[0.34, 0.1, 0.32]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.24, -0.14]}>
            <boxGeometry args={[0.16, 0.14, 0.14]} />
            <meshLambertMaterial color={color} />
          </mesh>
        </group>
      )
    case 'curls':
      return (
        <group>
          <mesh position={[0, 0.18, 0]}>
            <boxGeometry args={[0.38, 0.14, 0.36]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[-0.12, 0.27, 0.05]}>
            <boxGeometry args={[0.13, 0.1, 0.13]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[0.1, 0.28, -0.06]}>
            <boxGeometry args={[0.14, 0.1, 0.14]} />
            <meshLambertMaterial color={color} />
          </mesh>
          <mesh position={[0.02, 0.26, 0.1]}>
            <boxGeometry args={[0.11, 0.09, 0.11]} />
            <meshLambertMaterial color={color} />
          </mesh>
        </group>
      )
    default:
      // buzz cut - thin cap hugging the skull
      return (
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[0.335, 0.07, 0.33]} />
          <meshLambertMaterial color={color} />
        </mesh>
      )
  }
}

// Pose channels smoothed every frame for springy, elastic motion
interface Pose {
  lArmX: number; rArmX: number; lArmZ: number; rArmZ: number
  lElb: number; rElb: number
  lLegX: number; rLegX: number; lLegZ: number; rLegZ: number
  lKnee: number; rKnee: number
  bodyLean: number; bodyBob: number; headX: number; headY: number
}

const zeroPose = (): Pose => ({
  lArmX: 0, rArmX: 0, lArmZ: 0, rArmZ: 0, lElb: 0, rElb: 0,
  lLegX: 0, rLegX: 0, lLegZ: 0, rLegZ: 0, lKnee: 0, rKnee: 0,
  bodyLean: 0, bodyBob: 0, headX: 0, headY: 0,
})

export default function PlayerMesh({ id }: Props) {
  const root = useRef<THREE.Group>(null)
  const tilt = useRef<THREE.Group>(null)
  const lArm = useRef<THREE.Group>(null)
  const rArm = useRef<THREE.Group>(null)
  const lFore = useRef<THREE.Group>(null)
  const rFore = useRef<THREE.Group>(null)
  const lLeg = useRef<THREE.Group>(null)
  const rLeg = useRef<THREE.Group>(null)
  const lShin = useRef<THREE.Group>(null)
  const rShin = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const shadow = useRef<THREE.Mesh>(null)

  const pose = useRef<Pose>(zeroPose())
  const wasGrounded = useRef(true)
  const landT = useRef(0)
  const landPower = useRef(0)
  const dustT = useRef(0)

  const p = G.players[id]
  const c = p.colors
  const look = p.look

  useFrame((state, dt) => {
    if (!root.current || !tilt.current) return
    const pl = G.players[id]
    root.current.position.copy(pl.pos)
    // Smoothly rotate toward the facing direction (shortest arc)
    {
      const cur = root.current.rotation.y
      let diff = pl.facing - cur
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      root.current.rotation.y = cur + diff * Math.min(1, 18 * dt)
    }

    const t = state.clock.elapsedTime
    const runPhase = t * 11
    const runAmt = Math.min(pl.speed / 4.5, 1.4)

    // Landing detection -> squash impulse + knee absorb + dust puff
    if (!wasGrounded.current && pl.grounded) {
      landT.current = 0.22
      landPower.current = 1
      addFx('land', pl.pos)
    }
    wasGrounded.current = pl.grounded
    if (landT.current > 0) landT.current -= dt
    const land = Math.max(0, landT.current / 0.22) * landPower.current

    // Sprint dust: fast grounded movement kicks up little puffs at the heels
    dustT.current -= dt
    if (pl.grounded && pl.speed > 4.6 && dustT.current <= 0) {
      dustT.current = 0.14
      addFx('dust', pl.pos)
    }

    const P = zeroPose()
    const hasBall = G.ball.state === 'held' && G.ball.holder === id

    // How fast the pose chases its target: snappy for explosive moves,
    // loose for idle - this is what gives the body its elasticity.
    let ease = 12

    switch (pl.anim) {
      case 'run': {
        ease = 16
        const swing = Math.sin(runPhase)
        P.lArmX = swing * 0.8 * runAmt
        P.lLegX = -swing * 0.85 * runAmt
        P.rLegX = swing * 0.85 * runAmt
        // Knees drive high and heels kick back - real running gait
        P.lKnee = Math.max(0, Math.sin(runPhase - 1.4)) * 1.25 * runAmt
        P.rKnee = Math.max(0, Math.sin(runPhase + Math.PI - 1.4)) * 1.25 * runAmt
        P.lLegZ = 0.05 * runAmt
        P.rLegZ = -0.05 * runAmt
        P.bodyLean = 0.16 * runAmt
        P.bodyBob = Math.abs(swing) * 0.05 * runAmt
        P.headX = 0.06 * runAmt
        if (hasBall) {
          // Dribbling hand pumps in sync with the ball bounce
          const rate = 9 + pl.speed * 0.9
          const pump = Math.abs(Math.sin(t * rate))
          P.rArmX = -0.25 - pump * 0.35
          P.rArmZ = -0.4
          P.rElb = -0.5 - pump * 0.85
          P.lArmX = swing * 0.45 * runAmt
          P.lArmZ = 0.4 // off-arm shields
          P.lElb = -0.7
        } else {
          P.rArmX = -swing * 0.8 * runAmt
          // Elbows pump bent at ~90deg like a sprinter
          P.lElb = -0.85 - Math.max(0, swing) * 0.35 * runAmt
          P.rElb = -0.85 - Math.max(0, -swing) * 0.35 * runAmt
          P.lArmZ = swing * 0.08 * runAmt
          P.rArmZ = -swing * 0.08 * runAmt
        }
        break
      }
      case 'shoot': {
        ease = 24
        const crouch = Math.max(0, 1 - pl.animT / 0.1)
        const k = Math.min(pl.animT / 0.25, 1)
        const follow = Math.max(0, Math.min((pl.animT - 0.32) / 0.15, 1))
        // Elbow: cocked while gathering, snaps straight at release,
        // wrist-flick follow through
        const elbow = -1.7 * (1 - k) - 0.25 + follow * 0.25
        if (pl.shotStyle === 1) {
          // FADEAWAY
          P.lArmX = -2.4 * k + follow * 1.2
          P.rArmX = -2.9 * k - follow * 0.2
          P.rArmZ = follow * 0.3
          P.rElb = elbow
          P.lElb = -0.5 * k
          P.lLegX = -0.7 * k - crouch * 0.3
          P.rLegX = 0.9 * k + crouch * 0.3
          P.lKnee = crouch * 0.8 + k * 0.5
          P.rKnee = crouch * 0.8
          P.bodyLean = crouch * 0.2 - k * 0.42
          P.headX = -k * 0.25
          P.bodyBob = -crouch * 0.14
        } else if (pl.shotStyle === 2) {
          // FLOATER
          P.lArmX = -0.6 * k
          P.lArmZ = 0.5 * k
          P.rArmX = -3.0 * k + follow * 0.4
          P.rArmZ = follow * 0.2
          P.rElb = elbow * 0.6
          P.lLegX = -1.1 * k
          P.lKnee = 1.3 * k
          P.rLegX = 0.3 * k
          P.bodyLean = crouch * 0.2 + k * 0.1
          P.bodyBob = -crouch * 0.16
        } else {
          // SET JUMPER
          P.lArmX = -2.6 * k + follow * 1.6
          P.rArmX = -2.7 * k - follow * 0.35
          P.rArmZ = follow * 0.28
          P.lArmZ = follow * 0.1
          P.rElb = elbow
          P.lElb = -0.9 * (1 - k) - 0.2
          P.lLegX = -0.35 - crouch * 0.3
          P.rLegX = 0.4 + crouch * 0.3
          P.lKnee = crouch * 1.0 + 0.25
          P.rKnee = crouch * 1.0 + 0.25
          P.bodyBob = -crouch * 0.16
          P.bodyLean = crouch * 0.2 - follow * 0.05
        }
        break
      }
      case 'dunk': {
        ease = 26
        const dp = Math.min(pl.dunkT / DUNK_DUR[pl.dunkStyle], 1)
        if (pl.dunkStyle === 1) {
          // TOMAHAWK
          if (dp < 0.55) {
            const k = dp / 0.55
            P.rArmX = -2.2 * k - k * k * 1.4
            P.rArmZ = -0.35 * k
            P.rElb = -1.5 * k // cocked way behind the head
            P.lArmX = -0.9 * k
            P.lArmZ = 0.5 * k
            P.lLegX = -1.0 * k
            P.lKnee = 1.4 * k
            P.rLegX = -0.5 * k
            P.rKnee = 0.9 * k
            P.bodyLean = -0.3 * k
            P.headX = -0.2 * k
          } else {
            const k = Math.min((dp - 0.55) / 0.2, 1)
            P.rArmX = -3.6 + k * 2.9
            P.rArmZ = -0.35 + k * 0.35
            P.rElb = -1.5 + k * 1.5 // whips straight through the rim
            P.lArmX = -0.9 + k * 0.7
            P.lLegX = -1.0 + k * 1.3
            P.lKnee = 1.4 - k * 1.0
            P.rLegX = -0.5 + k * 0.9
            P.rKnee = 0.9 - k * 0.6
            P.bodyLean = -0.3 + k * 0.75
            P.headX = -0.2 + k * 0.3
          }
        } else if (pl.dunkStyle === 2) {
          // WINDMILL
          const sweep = Math.min(dp / 0.62, 1)
          P.rArmX = -Math.PI * 2 * sweep - 0.4
          P.rArmZ = Math.sin(sweep * Math.PI * 2) * 0.4
          P.rElb = -0.4 - Math.sin(sweep * Math.PI) * 0.5
          P.lArmX = -0.7
          P.lArmZ = 0.6
          P.lLegX = -0.8 * Math.min(dp / 0.4, 1)
          P.lKnee = 1.2 * Math.min(dp / 0.4, 1)
          P.rLegX = -0.5 * Math.min(dp / 0.4, 1)
          P.rKnee = 0.8 * Math.min(dp / 0.4, 1)
          P.bodyLean = -0.15 + Math.sin(sweep * Math.PI) * 0.2
          if (dp > 0.62) {
            const k = Math.min((dp - 0.62) / 0.2, 1)
            P.lLegX = -0.8 + k * 1.1
            P.lKnee = 1.2 - k * 0.9
            P.rLegX = -0.5 + k * 0.8
            P.rKnee = 0.8 - k * 0.5
            P.bodyLean = 0.05 + k * 0.4
          }
        } else if (pl.dunkStyle === 3) {
          // 360
          if (dp < 0.55) {
            const k = dp / 0.55
            P.lArmX = -1.6 * k
            P.rArmX = -1.8 * k
            P.lArmZ = 0.3 * k
            P.rArmZ = -0.3 * k
            P.lElb = -1.0 * k
            P.rElb = -1.0 * k // ball tucked tight mid-spin
            P.lLegX = -0.9 * k
            P.rLegX = -0.9 * k
            P.lKnee = 1.3 * k
            P.rKnee = 1.3 * k
            P.lLegZ = 0.2 * k
            P.rLegZ = -0.2 * k
            P.bodyLean = 0.1 * k
          } else {
            const k = Math.min((dp - 0.55) / 0.25, 1)
            P.lArmX = -1.6 - k * 0.8
            P.rArmX = -1.8 - k * 1.2 + k * k * 2.6
            P.rElb = -1.0 + k * 1.0
            P.lElb = -1.0 + k * 0.6
            P.lLegX = -0.9 + k * 1.1
            P.rLegX = -0.9 + k * 1.1
            P.lKnee = 1.3 - k * 1.0
            P.rKnee = 1.3 - k * 1.0
            P.bodyLean = 0.1 + k * 0.3
          }
        } else if (pl.dunkStyle === 4) {
          // REVERSE
          if (dp < 0.55) {
            const k = dp / 0.55
            P.lArmX = -2.4 * k
            P.rArmX = -2.4 * k
            P.lArmZ = 0.25 * k
            P.rArmZ = -0.25 * k
            P.lElb = -0.8 * k
            P.rElb = -0.8 * k
            P.lLegX = -0.7 * k
            P.rLegX = -0.7 * k
            P.lKnee = 1.1 * k
            P.rKnee = 1.1 * k
            P.bodyLean = -0.35 * k
            P.headX = -0.3 * k
          } else {
            const k = Math.min((dp - 0.55) / 0.2, 1)
            P.lArmX = -2.4 - k * 0.9
            P.rArmX = -2.4 - k * 0.9
            P.lElb = -0.8 + k * 0.8
            P.rElb = -0.8 + k * 0.8
            P.lLegX = -0.7 + k * 0.9
            P.rLegX = -0.7 + k * 0.9
            P.lKnee = 1.1 - k * 0.6
            P.rKnee = 1.1 - k * 0.6
            P.bodyLean = -0.35 - k * 0.15
            P.headX = -0.3
          }
        } else {
          // TWO-HAND JAM
          if (dp < 0.35) {
            const k = dp / 0.35
            P.lArmX = -1.4 * k
            P.rArmX = -1.9 * k
            P.lElb = -0.9 * k
            P.rElb = -0.9 * k
            P.lLegX = -0.9 * k
            P.lKnee = 1.3 * k
            P.rLegX = -0.7 * k
            P.rKnee = 1.0 * k
            P.bodyLean = 0.15 * k
          } else if (dp < 0.6) {
            const k = (dp - 0.35) / 0.25
            P.lArmX = -1.4 - k * 0.6
            P.rArmX = -1.9 - k * 1.3
            P.rArmZ = -0.25 * k
            P.lElb = -0.9 + k * 0.5
            P.rElb = -0.9 + k * 0.5
            P.lLegX = -0.9
            P.lKnee = 1.3
            P.rLegX = -0.7 + k * 0.3
            P.rKnee = 1.0 - k * 0.3
            P.bodyLean = 0.15 - k * 0.35
          } else {
            const k = Math.min((dp - 0.6) / 0.2, 1)
            P.lArmX = -2.0 + k * 1.2
            P.rArmX = -3.2 + k * 2.4
            P.lElb = -0.4
            P.rElb = -0.4
            P.lLegX = -0.9 + k * 1.2
            P.lKnee = 1.3 - k * 1.0
            P.rLegX = -0.4 + k * 0.8
            P.rKnee = 0.7 - k * 0.5
            P.bodyLean = -0.2 + k * 0.55
          }
        }
        break
      }
      case 'jump': {
        ease = 20
        P.lArmX = -2.8
        P.rArmX = -2.8
        P.lLegX = -0.4
        P.rLegX = 0.4
        P.lKnee = 0.7
        P.rKnee = 0.4
        break
      }
      case 'block': {
        ease = 26
        P.rArmX = -3.05
        P.rElb = 0 // fully extended contest
        P.lArmX = 0.4
        P.lElb = -0.6
        P.lLegX = -0.35
        P.rLegX = 0.35
        P.lKnee = 0.5
        P.rKnee = 0.5
        P.bodyLean = -0.08
        break
      }
      case 'shuffle': {
        ease = 11
        const sway = Math.sin(t * 6 + id) * 0.08
        const poke = Math.max(0, Math.sin(t * 4.2 + id * 1.7)) * 0.5
        P.lArmX = -0.5 - poke * 0.6
        P.rArmX = -0.5 - Math.max(0, Math.sin(t * 3.6 + id * 2.4)) * 0.7
        P.lArmZ = 0.9 + sway
        P.rArmZ = -0.9 + sway
        P.lElb = -0.5 - poke * 0.4
        P.rElb = -0.5
        P.lLegX = 0.15
        P.rLegX = -0.15
        P.lLegZ = 0.28
        P.rLegZ = -0.28
        // Deep knee bend - proper defensive stance
        P.lKnee = 0.55
        P.rKnee = 0.55
        P.bodyLean = 0.22
        P.bodyBob = -0.11 + Math.abs(Math.sin(t * 5.5)) * 0.03
        P.headX = 0.1
        break
      }
      case 'pass': {
        ease = 26
        const k = Math.min(pl.animT / 0.1, 1)
        const ext = Math.min(pl.animT / 0.2, 1)
        P.lArmX = -1.35 * k - ext * 0.2
        P.rArmX = -1.35 * k - ext * 0.2
        P.lArmZ = 0.15 * (1 - ext)
        P.rArmZ = -0.15 * (1 - ext)
        // Elbows bent at the chest, snap straight with the pass
        P.lElb = -1.2 * (1 - ext)
        P.rElb = -1.2 * (1 - ext)
        P.lLegX = -0.2 * ext
        P.rLegX = 0.35 * ext
        P.rKnee = 0.4 * ext
        P.bodyLean = 0.28 * ext
        break
      }
      case 'catch': {
        ease = 22
        const k = Math.min(pl.animT / 0.08, 1)
        const absorb = Math.max(0, Math.min((pl.animT - 0.12) / 0.14, 1))
        P.lArmX = -1.3 * k + absorb * 0.9
        P.rArmX = -1.3 * k + absorb * 0.9
        P.lArmZ = 0.2 * k
        P.rArmZ = -0.2 * k
        // Arms reach straight, then elbows flex to absorb the ball
        P.lElb = -absorb * 1.0
        P.rElb = -absorb * 1.0
        P.bodyLean = 0.1 * k - absorb * 0.05
        P.lLegX = 0.12
        P.rLegX = -0.12
        P.lKnee = 0.3
        P.rKnee = 0.3
        break
      }
      case 'steal': {
        ease = 28
        const k = Math.min(pl.animT / 0.12, 1)
        P.rArmX = -1.1 * k
        P.rArmZ = -0.5 * k
        P.rElb = -0.2
        P.bodyLean = 0.35 * k
        P.lKnee = 0.4 * k
        P.rKnee = 0.5 * k
        break
      }
      case 'celebrate': {
        ease = 14
        const wave = Math.sin(t * 10)
        P.lArmX = -2.9
        P.rArmX = -2.9
        P.lArmZ = wave * 0.35
        P.rArmZ = -wave * 0.35
        P.lElb = -0.3 + wave * 0.25
        P.rElb = -0.3 - wave * 0.25
        P.bodyBob = Math.abs(Math.sin(t * 8)) * 0.12
        P.headX = -0.15
        break
      }
      case 'stumble': {
        ease = 15
        const w = Math.sin(t * 16) * 0.5
        P.lArmX = -0.9 + w
        P.rArmX = -0.9 - w
        P.lArmZ = 0.8
        P.rArmZ = -0.8
        P.lElb = -0.4
        P.rElb = -0.4
        P.lLegX = 0.45
        P.rLegX = -0.35
        P.lKnee = 0.6
        P.rKnee = 0.8
        P.bodyLean = 0.42
        P.bodyBob = -0.12 + Math.sin(t * 14) * 0.03
        break
      }
      case 'fall': {
        ease = 14
        P.lArmX = -1.4
        P.rArmX = -1.2
        P.lArmZ = 0.7
        P.rArmZ = -0.7
        P.lElb = -0.5
        P.rElb = -0.5
        P.lLegX = 0.3
        P.rLegX = -0.2
        P.lKnee = 0.5
        P.rKnee = 0.3
        break
      }
      default: {
        ease = 9
        // idle: subtle sway + ready arms
        if (hasBall) {
          const pump = Math.abs(Math.sin(t * 9))
          P.rArmX = -0.2 - pump * 0.3
          P.rArmZ = -0.35
          P.rElb = -0.5 - pump * 0.7
          P.lArmX = 0.3
          P.lArmZ = 0.5
          P.lElb = -0.7
          P.lLegX = 0.1
          P.rLegX = -0.1
          P.lKnee = 0.25
          P.rKnee = 0.25
          P.bodyLean = 0.12
          P.headX = Math.sin(t * 1.4 + id) * 0.08
        } else {
          const br = Math.sin(t * 2 + id)
          P.lArmX = br * 0.06 + 0.2
          P.rArmX = Math.sin(t * 2 + id + 1) * 0.06 + 0.2
          P.lElb = -0.25
          P.rElb = -0.25
          P.headX = Math.sin(t * 1.1 + id * 2) * 0.07
          P.headY = Math.sin(t * 0.7 + id * 3) * 0.12 // glancing around
          P.lKnee = 0.12
          P.rKnee = 0.12
        }
        P.bodyBob =
          Math.sin(t * 2.4 + id) * 0.015 +
          Math.max(0, Math.sin(t * 5 + id * 4)) * 0.01
      }
    }

    // Landing absorption: knees flex and the body dips, then springs back
    if (land > 0) {
      P.lKnee += land * 0.9
      P.rKnee += land * 0.9
      P.bodyBob -= land * 0.1
      P.bodyLean += land * 0.12
    }

    // Spring-damp every channel toward its target = elastic, weighty motion
    const cur = pose.current
    const k = 1 - Math.exp(-ease * dt)
    cur.lArmX += (P.lArmX - cur.lArmX) * k
    cur.rArmX += (P.rArmX - cur.rArmX) * k
    cur.lArmZ += (P.lArmZ - cur.lArmZ) * k
    cur.rArmZ += (P.rArmZ - cur.rArmZ) * k
    cur.lElb += (P.lElb - cur.lElb) * k
    cur.rElb += (P.rElb - cur.rElb) * k
    cur.lLegX += (P.lLegX - cur.lLegX) * k
    cur.rLegX += (P.rLegX - cur.rLegX) * k
    cur.lLegZ += (P.lLegZ - cur.lLegZ) * k
    cur.rLegZ += (P.rLegZ - cur.rLegZ) * k
    cur.lKnee += (P.lKnee - cur.lKnee) * k
    cur.rKnee += (P.rKnee - cur.rKnee) * k
    cur.bodyLean += (P.bodyLean - cur.bodyLean) * k
    cur.bodyBob += (P.bodyBob - cur.bodyBob) * k
    cur.headX += (P.headX - cur.headX) * k
    cur.headY += (P.headY - cur.headY) * k

    // Knockdown tilt: fall fast, lie there, then get back up
    let fallAmt = 0
    if (pl.stunT > 0) {
      fallAmt = Math.min((STUN_TIME - pl.stunT) * 5, pl.stunT * 3.2, 1)
    }
    tilt.current.rotation.x = -fallAmt * 1.5
    tilt.current.position.y = -fallAmt * 0.12

    // Crossover side lean + stagger wobble
    tilt.current.rotation.z =
      pl.crossLean + (pl.stumbleT > 0 ? Math.sin(t * 13) * 0.16 : 0)

    // Squash & stretch (composed with the player's build scale)
    let stretch = pl.grounded
      ? 1
      : 1 + THREE.MathUtils.clamp(pl.vy * 0.018, -0.06, 0.1)
    if (land > 0) stretch -= land * 0.06 // landing squash
    tilt.current.scale.set(
      look.w * (2 - stretch),
      look.h * stretch,
      look.w * (2 - stretch),
    )

    if (lArm.current) {
      lArm.current.rotation.x = cur.lArmX
      lArm.current.rotation.z = cur.lArmZ
    }
    if (rArm.current) {
      rArm.current.rotation.x = cur.rArmX
      rArm.current.rotation.z = cur.rArmZ
    }
    if (lFore.current) lFore.current.rotation.x = cur.lElb
    if (rFore.current) rFore.current.rotation.x = cur.rElb
    if (lLeg.current) {
      lLeg.current.rotation.x = cur.lLegX
      lLeg.current.rotation.z = cur.lLegZ
    }
    if (rLeg.current) {
      rLeg.current.rotation.x = cur.rLegX
      rLeg.current.rotation.z = cur.rLegZ
    }
    if (lShin.current) lShin.current.rotation.x = cur.lKnee
    if (rShin.current) rShin.current.rotation.x = cur.rKnee
    if (body.current) {
      body.current.rotation.x = cur.bodyLean
      body.current.position.y = cur.bodyBob
    }
    if (head.current) {
      head.current.rotation.x = cur.headX
      head.current.rotation.y = cur.headY
    }

    // Blob shadow shrinks as the player jumps
    if (shadow.current) {
      const s = Math.max(0.4, 1 - pl.pos.y * 0.22)
      shadow.current.scale.setScalar(s)
      shadow.current.position.y = 0.015 - pl.pos.y
      const mat = shadow.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.35 * Math.max(0.3, 1 - pl.pos.y * 0.18)
    }

    // Controlled-player indicator ring
    if (ring.current) {
      const isControlled = G.controlled === id
      ring.current.visible = isControlled
      ring.current.rotation.z = t * 2
      ring.current.position.y = 0.03 - pl.pos.y
    }
  })

  const accent = c.shorts
  const lSleeve = look.sleeve === 'left'
  const rSleeve = look.sleeve === 'right'

  return (
    <group ref={root}>
      {/* Indicator ring under controlled player */}
      <mesh ref={ring} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.62, 4]} />
        <meshBasicMaterial color="#fde047" />
      </mesh>

      {/* Blob shadow */}
      <mesh
        ref={shadow}
        position={[0, 0.015, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.42, 8]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} />
      </mesh>

      <group ref={tilt}>
        <group ref={body}>
          {/* Shoulders (wider) -> chest -> tapered waist: athletic V-shape */}
          <mesh position={[0, 1.3, 0]} castShadow>
            <boxGeometry args={[0.56, 0.2, 0.3]} />
            <meshLambertMaterial color={c.jersey} />
          </mesh>
          <mesh position={[0, 1.06, 0]} castShadow>
            <boxGeometry args={[0.5, 0.32, 0.28]} />
            <meshLambertMaterial color={c.jersey} />
          </mesh>
          <mesh position={[0, 0.88, 0]}>
            <boxGeometry args={[0.44, 0.14, 0.26]} />
            <meshLambertMaterial color={c.jersey} />
          </mesh>
          {/* Jersey side stripes */}
          <mesh position={[-0.255, 1.06, 0]}>
            <boxGeometry args={[0.015, 0.32, 0.29]} />
            <meshLambertMaterial color={c.trim} />
          </mesh>
          <mesh position={[0.255, 1.06, 0]}>
            <boxGeometry args={[0.015, 0.32, 0.29]} />
            <meshLambertMaterial color={c.trim} />
          </mesh>
          {/* Jersey neckline trim */}
          <mesh position={[0, 1.38, 0.06]}>
            <boxGeometry args={[0.2, 0.05, 0.2]} />
            <meshLambertMaterial color={c.trim} />
          </mesh>
          {/* Pixel jersey number on the chest */}
          <JerseyNumber n={look.number} z={0.155} color={c.trim} />
          {/* Jersey bottom trim */}
          <mesh position={[0, 0.8, 0]}>
            <boxGeometry args={[0.45, 0.05, 0.27]} />
            <meshLambertMaterial color={c.trim} />
          </mesh>
          {/* Shorts */}
          <mesh position={[0, 0.68, 0]}>
            <boxGeometry args={[0.5, 0.22, 0.3]} />
            <meshLambertMaterial color={c.shorts} />
          </mesh>
          {/* Shorts side stripe */}
          <mesh position={[0, 0.59, 0]}>
            <boxGeometry args={[0.51, 0.04, 0.31]} />
            <meshLambertMaterial color={c.trim} />
          </mesh>

          {/* Neck */}
          <mesh position={[0, 1.44, 0]}>
            <boxGeometry args={[0.14, 0.1, 0.14]} />
            <meshLambertMaterial color={c.skin} />
          </mesh>

          {/* Head (own pivot so it can scan / react) */}
          <group ref={head} position={[0, 1.58, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.32, 0.32, 0.32]} />
              <meshLambertMaterial color={c.skin} />
            </mesh>
            {/* Eyes */}
            <mesh position={[-0.08, 0.03, 0.165]}>
              <boxGeometry args={[0.055, 0.055, 0.01]} />
              <meshBasicMaterial color="#1c1917" />
            </mesh>
            <mesh position={[0.08, 0.03, 0.165]}>
              <boxGeometry args={[0.055, 0.055, 0.01]} />
              <meshBasicMaterial color="#1c1917" />
            </mesh>
            {/* Brow shadow */}
            <mesh position={[0, 0.09, 0.163]}>
              <boxGeometry args={[0.24, 0.03, 0.01]} />
              <meshBasicMaterial color={c.hair} />
            </mesh>
            {/* Mouth */}
            <mesh position={[0, -0.09, 0.163]}>
              <boxGeometry args={[0.09, 0.025, 0.01]} />
              <meshBasicMaterial color="#7f4a2e" />
            </mesh>
            <Hair style={look.hair} color={c.hair} />
            {look.headband && (
              <mesh position={[0, 0.07, 0]}>
                <boxGeometry args={[0.345, 0.06, 0.345]} />
                <meshLambertMaterial color={accent} />
              </mesh>
            )}
          </group>

          {/* Arms: shoulder pivot -> upper arm -> elbow pivot -> forearm */}
          <group ref={lArm} position={[-0.35, 1.32, 0]}>
            <mesh position={[0, -0.13, 0]}>
              <boxGeometry args={[0.14, 0.26, 0.14]} />
              <meshLambertMaterial color={lSleeve ? accent : c.jersey} />
            </mesh>
            <group ref={lFore} position={[0, -0.27, 0]}>
              <mesh position={[0, -0.12, 0]} castShadow>
                <boxGeometry args={[0.125, 0.24, 0.125]} />
                <meshLambertMaterial color={lSleeve ? accent : c.skin} />
              </mesh>
              {/* Hand */}
              <mesh position={[0, -0.27, 0]}>
                <boxGeometry args={[0.13, 0.1, 0.13]} />
                <meshLambertMaterial color={c.skin} />
              </mesh>
            </group>
          </group>
          <group ref={rArm} position={[0.35, 1.32, 0]}>
            <mesh position={[0, -0.13, 0]}>
              <boxGeometry args={[0.14, 0.26, 0.14]} />
              <meshLambertMaterial color={rSleeve ? accent : c.jersey} />
            </mesh>
            <group ref={rFore} position={[0, -0.27, 0]}>
              <mesh position={[0, -0.12, 0]} castShadow>
                <boxGeometry args={[0.125, 0.24, 0.125]} />
                <meshLambertMaterial color={rSleeve ? accent : c.skin} />
              </mesh>
              {/* Wristband on the shooting arm */}
              <mesh position={[0, -0.22, 0]}>
                <boxGeometry args={[0.14, 0.06, 0.14]} />
                <meshLambertMaterial color={rSleeve ? '#f8fafc' : accent} />
              </mesh>
              <mesh position={[0, -0.27, 0]}>
                <boxGeometry args={[0.13, 0.1, 0.13]} />
                <meshLambertMaterial color={c.skin} />
              </mesh>
            </group>
          </group>
        </group>

        {/* Legs: hip pivot -> thigh -> knee pivot -> shin + shoe */}
        <group ref={lLeg} position={[-0.14, 0.62, 0]}>
          <mesh position={[0, -0.15, 0]} castShadow>
            <boxGeometry args={[0.17, 0.3, 0.17]} />
            <meshLambertMaterial color={look.legSleeve ? accent : c.skin} />
          </mesh>
          <group ref={lShin} position={[0, -0.3, 0]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <boxGeometry args={[0.15, 0.26, 0.15]} />
              <meshLambertMaterial color={look.legSleeve ? accent : c.skin} />
            </mesh>
            {/* Sock */}
            <mesh position={[0, -0.26, 0]}>
              <boxGeometry args={[0.16, 0.07, 0.16]} />
              <meshLambertMaterial color="#f8fafc" />
            </mesh>
            {/* Team-color sneaker with white sole */}
            <mesh position={[0, -0.3, 0.04]}>
              <boxGeometry args={[0.17, 0.08, 0.26]} />
              <meshLambertMaterial color={accent} />
            </mesh>
            <mesh position={[0, -0.345, 0.04]}>
              <boxGeometry args={[0.18, 0.03, 0.27]} />
              <meshLambertMaterial color="#f8fafc" />
            </mesh>
          </group>
        </group>
        <group ref={rLeg} position={[0.14, 0.62, 0]}>
          <mesh position={[0, -0.15, 0]} castShadow>
            <boxGeometry args={[0.17, 0.3, 0.17]} />
            <meshLambertMaterial color={c.skin} />
          </mesh>
          <group ref={rShin} position={[0, -0.3, 0]}>
            <mesh position={[0, -0.13, 0]} castShadow>
              <boxGeometry args={[0.15, 0.26, 0.15]} />
              <meshLambertMaterial color={c.skin} />
            </mesh>
            <mesh position={[0, -0.26, 0]}>
              <boxGeometry args={[0.16, 0.07, 0.16]} />
              <meshLambertMaterial color="#f8fafc" />
            </mesh>
            <mesh position={[0, -0.3, 0.04]}>
              <boxGeometry args={[0.17, 0.08, 0.26]} />
              <meshLambertMaterial color={accent} />
            </mesh>
            <mesh position={[0, -0.345, 0.04]}>
              <boxGeometry args={[0.18, 0.03, 0.27]} />
              <meshLambertMaterial color="#f8fafc" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
