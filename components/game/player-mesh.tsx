'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G, STUN_TIME, DUNK_DUR } from '@/lib/game'

interface Props {
  id: number
}

export default function PlayerMesh({ id }: Props) {
  const root = useRef<THREE.Group>(null)
  const tilt = useRef<THREE.Group>(null)
  const lArm = useRef<THREE.Group>(null)
  const rArm = useRef<THREE.Group>(null)
  const lLeg = useRef<THREE.Group>(null)
  const rLeg = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const shadow = useRef<THREE.Mesh>(null)

  const p = G.players[id]
  const c = p.colors

  useFrame((state) => {
    if (!root.current || !tilt.current) return
    const pl = G.players[id]
    root.current.position.copy(pl.pos)
    root.current.rotation.y = pl.facing

    const t = state.clock.elapsedTime
    const runPhase = t * 11
    const runAmt = Math.min(pl.speed / 4.5, 1.4)

    let lArmX = 0
    let rArmX = 0
    let lArmZ = 0
    let rArmZ = 0
    let lLegX = 0
    let rLegX = 0
    let lLegZ = 0
    let rLegZ = 0
    let bodyLean = 0
    let bodyBob = 0
    let headX = 0

    const hasBall = G.ball.state === 'held' && G.ball.holder === id

    switch (pl.anim) {
      case 'run': {
        lArmX = Math.sin(runPhase) * 0.85 * runAmt
        lLegX = -Math.sin(runPhase) * 0.95 * runAmt
        rLegX = Math.sin(runPhase) * 0.95 * runAmt
        // Feet splay slightly at full sprint for a lively gait
        lLegZ = 0.06 * runAmt
        rLegZ = -0.06 * runAmt
        bodyLean = 0.14 * runAmt
        bodyBob = Math.abs(Math.sin(runPhase)) * 0.05 * runAmt
        headX = 0.06 * runAmt
        if (hasBall) {
          // Dribbling hand pumps in sync with the actual ball bounce
          const rate = 9 + pl.speed * 0.9
          const pump = Math.abs(Math.sin(t * rate))
          rArmX = -0.35 - pump * 0.55
          rArmZ = -0.35
          lArmX *= 0.6 // off-arm shields
          lArmZ = 0.35
        } else {
          rArmX = -Math.sin(runPhase) * 0.85 * runAmt
          // Arms pump across the body a touch
          lArmZ = Math.sin(runPhase) * 0.1 * runAmt
          rArmZ = -Math.sin(runPhase) * 0.1 * runAmt
        }
        break
      }
      case 'shoot': {
        // Style 0: set jumper. Style 1: fadeaway (arch back, legs kick
        // forward). Style 2: floater (one-hand high touch shot).
        const crouch = Math.max(0, 1 - pl.animT / 0.1)
        const k = Math.min(pl.animT / 0.25, 1)
        const follow = Math.max(0, Math.min((pl.animT - 0.32) / 0.15, 1))
        if (pl.shotStyle === 1) {
          // FADEAWAY: body arches away, legs scissor forward, high release
          lArmX = -2.4 * k + follow * 1.2
          rArmX = -2.9 * k - follow * 0.2
          rArmZ = follow * 0.3
          lLegX = -0.7 * k - crouch * 0.3
          rLegX = 0.9 * k + crouch * 0.3
          bodyLean = crouch * 0.2 - k * 0.42 // lean BACK
          headX = -k * 0.25
          bodyBob = -crouch * 0.14
        } else if (pl.shotStyle === 2) {
          // FLOATER: one arm fully extended, soft high release, knee up
          lArmX = -0.6 * k
          lArmZ = 0.5 * k
          rArmX = -3.0 * k + follow * 0.4
          rArmZ = follow * 0.2
          lLegX = -1.1 * k
          rLegX = 0.3 * k
          bodyLean = crouch * 0.2 + k * 0.1
          bodyBob = -crouch * 0.16
        } else {
          lArmX = -2.6 * k + follow * 1.6
          rArmX = -2.7 * k - follow * 0.35
          rArmZ = follow * 0.28
          lArmZ = follow * 0.1
          lLegX = -0.35 - crouch * 0.3
          rLegX = 0.4 + crouch * 0.3
          bodyBob = -crouch * 0.16
          bodyLean = crouch * 0.2 - follow * 0.05
        }
        break
      }
      case 'dunk': {
        const dp = Math.min(pl.dunkT / DUNK_DUR[pl.dunkStyle], 1)
        if (pl.dunkStyle === 1) {
          // TOMAHAWK: one arm cocks way behind the head, whips through
          if (dp < 0.55) {
            const k = dp / 0.55
            rArmX = -2.2 * k - k * k * 1.4 // way behind the head
            rArmZ = -0.35 * k
            lArmX = -0.9 * k
            lArmZ = 0.5 * k
            lLegX = -1.0 * k
            rLegX = -0.5 * k
            bodyLean = -0.3 * k // arch back
            headX = -0.2 * k
          } else {
            const k = Math.min((dp - 0.55) / 0.2, 1)
            rArmX = -3.6 + k * 2.9
            rArmZ = -0.35 + k * 0.35
            lArmX = -0.9 + k * 0.7
            lLegX = -1.0 + k * 1.3
            rLegX = -0.5 + k * 0.9
            bodyLean = -0.3 + k * 0.75
            headX = -0.2 + k * 0.3
          }
        } else if (pl.dunkStyle === 2) {
          // WINDMILL: right arm sweeps a full circle
          const sweep = Math.min(dp / 0.62, 1)
          rArmX = -Math.PI * 2 * sweep - 0.4
          rArmZ = Math.sin(sweep * Math.PI * 2) * 0.4
          lArmX = -0.7
          lArmZ = 0.6
          lLegX = -0.8 * Math.min(dp / 0.4, 1)
          rLegX = -0.5 * Math.min(dp / 0.4, 1)
          bodyLean = -0.15 + Math.sin(sweep * Math.PI) * 0.2
          if (dp > 0.62) {
            const k = Math.min((dp - 0.62) / 0.2, 1)
            lLegX = -0.8 + k * 1.1
            rLegX = -0.5 + k * 0.8
            bodyLean = 0.05 + k * 0.4
          }
        } else if (pl.dunkStyle === 3) {
          // 360: both arms tucked with the ball, legs crossed mid-spin
          if (dp < 0.55) {
            const k = dp / 0.55
            lArmX = -1.6 * k
            rArmX = -1.8 * k
            lArmZ = 0.3 * k
            rArmZ = -0.3 * k
            lLegX = -0.9 * k
            rLegX = -0.9 * k
            lLegZ = 0.2 * k
            rLegZ = -0.2 * k
            bodyLean = 0.1 * k
          } else {
            const k = Math.min((dp - 0.55) / 0.25, 1)
            lArmX = -1.6 - k * 0.8
            rArmX = -1.8 - k * 1.2 + k * k * 2.6
            lLegX = -0.9 + k * 1.1
            rLegX = -0.9 + k * 1.1
            bodyLean = 0.1 + k * 0.3
          }
        } else if (pl.dunkStyle === 4) {
          // REVERSE: back to the rim, both arms slam behind the head
          if (dp < 0.55) {
            const k = dp / 0.55
            lArmX = -2.4 * k
            rArmX = -2.4 * k
            lArmZ = 0.25 * k
            rArmZ = -0.25 * k
            lLegX = -0.7 * k
            rLegX = -0.7 * k
            bodyLean = -0.35 * k // arch backward hard
            headX = -0.3 * k
          } else {
            const k = Math.min((dp - 0.55) / 0.2, 1)
            lArmX = -2.4 - k * 0.9
            rArmX = -2.4 - k * 0.9
            lLegX = -0.7 + k * 0.9
            rLegX = -0.7 + k * 0.9
            bodyLean = -0.35 - k * 0.15
            headX = -0.3
          }
        } else {
          // TWO-HAND JAM (original)
          if (dp < 0.35) {
            const k = dp / 0.35
            lArmX = -1.4 * k
            rArmX = -1.9 * k
            lLegX = -0.9 * k
            rLegX = -0.7 * k
            bodyLean = 0.15 * k
          } else if (dp < 0.6) {
            const k = (dp - 0.35) / 0.25
            lArmX = -1.4 - k * 0.6
            rArmX = -1.9 - k * 1.3
            rArmZ = -0.25 * k
            lLegX = -0.9
            rLegX = -0.7 + k * 0.3
            bodyLean = 0.15 - k * 0.35
          } else {
            const k = Math.min((dp - 0.6) / 0.2, 1)
            lArmX = -2.0 + k * 1.2
            rArmX = -3.2 + k * 2.4
            lLegX = -0.9 + k * 1.2
            rLegX = -0.4 + k * 0.8
            bodyLean = -0.2 + k * 0.55
          }
        }
        break
      }
      case 'jump': {
        lArmX = -2.8
        rArmX = -2.8
        lLegX = -0.4
        rLegX = 0.4
        break
      }
      case 'block': {
        // One arm fully extended, other tucked - classic contest
        rArmX = -3.05
        lArmX = 0.4
        lLegX = -0.35
        rLegX = 0.35
        bodyLean = -0.08
        break
      }
      case 'shuffle': {
        // Wide defensive stance: knees bent, ACTIVE hands poking at the ball
        const sway = Math.sin(t * 6 + id) * 0.08
        const poke = Math.max(0, Math.sin(t * 4.2 + id * 1.7)) * 0.5
        lArmX = -0.5 - poke * 0.6
        rArmX = -0.5 - Math.max(0, Math.sin(t * 3.6 + id * 2.4)) * 0.7
        lArmZ = 0.9 + sway
        rArmZ = -0.9 + sway
        lLegX = 0.15
        rLegX = -0.15
        lLegZ = 0.28
        rLegZ = -0.28
        bodyLean = 0.22
        bodyBob = -0.09 + Math.abs(Math.sin(t * 5.5)) * 0.03
        headX = 0.1
        break
      }
      case 'pass': {
        // Two-hand chest pass: arms snap forward and extend fully
        const k = Math.min(pl.animT / 0.1, 1)
        const ext = Math.min(pl.animT / 0.2, 1)
        lArmX = -1.35 * k - ext * 0.2
        rArmX = -1.35 * k - ext * 0.2
        lArmZ = 0.15 * (1 - ext)
        rArmZ = -0.15 * (1 - ext)
        lLegX = -0.2 * ext
        rLegX = 0.35 * ext // step into the pass
        bodyLean = 0.28 * ext
        break
      }
      case 'catch': {
        // Hands out to meet the ball, absorb into the body
        const k = Math.min(pl.animT / 0.08, 1)
        const absorb = Math.max(0, Math.min((pl.animT - 0.12) / 0.14, 1))
        lArmX = -1.3 * k + absorb * 0.9
        rArmX = -1.3 * k + absorb * 0.9
        lArmZ = 0.2 * k
        rArmZ = -0.2 * k
        bodyLean = 0.1 * k - absorb * 0.05
        lLegX = 0.12
        rLegX = -0.12
        break
      }
      case 'steal': {
        const k = Math.min(pl.animT / 0.12, 1)
        rArmX = -1.1 * k
        rArmZ = -0.5 * k
        bodyLean = 0.35 * k
        break
      }
      case 'celebrate': {
        const wave = Math.sin(t * 10)
        lArmX = -2.9
        rArmX = -2.9
        lArmZ = wave * 0.35
        rArmZ = -wave * 0.35
        bodyBob = Math.abs(Math.sin(t * 8)) * 0.12
        headX = -0.15
        break
      }
      case 'stumble': {
        // Legs crossed up, arms windmilling for balance
        const w = Math.sin(t * 16) * 0.5
        lArmX = -0.9 + w
        rArmX = -0.9 - w
        lArmZ = 0.8
        rArmZ = -0.8
        lLegX = 0.45
        rLegX = -0.35
        bodyLean = 0.42
        bodyBob = -0.12 + Math.sin(t * 14) * 0.03
        break
      }
      case 'fall': {
        lArmX = -1.4
        rArmX = -1.2
        lArmZ = 0.7
        rArmZ = -0.7
        lLegX = 0.3
        rLegX = -0.2
        break
      }
      default: {
        // idle: subtle sway + ready arms
        if (hasBall) {
          const pump = Math.abs(Math.sin(t * 9))
          rArmX = -0.3 - pump * 0.5
          rArmZ = -0.3
          lArmX = 0.35
          lArmZ = 0.45
          lLegX = 0.1
          rLegX = -0.1
          bodyLean = 0.12
          headX = Math.sin(t * 1.4 + id) * 0.08 // scanning the floor
        } else {
          lArmX = Math.sin(t * 2 + id) * 0.06 + 0.25
          rArmX = Math.sin(t * 2 + id + 1) * 0.06 + 0.25
          headX = Math.sin(t * 1.1 + id * 2) * 0.07
        }
        // Bounce on the toes - everyone stays light on their feet
        bodyBob = Math.sin(t * 2.4 + id) * 0.015 + Math.max(0, Math.sin(t * 5 + id * 4)) * 0.01
      }
    }

    // Knockdown tilt: fall fast, lie there, then get back up
    let fallAmt = 0
    if (pl.stunT > 0) {
      fallAmt = Math.min((STUN_TIME - pl.stunT) * 5, pl.stunT * 3.2, 1)
    }
    tilt.current.rotation.x = -fallAmt * 1.5
    tilt.current.position.y = -fallAmt * 0.12

    // Crossover side lean (from dribble moves) + stagger wobble
    tilt.current.rotation.z =
      pl.crossLean + (pl.stumbleT > 0 ? Math.sin(t * 13) * 0.16 : 0)

    // Squash & stretch: stretch going up, slight squash coming down
    const stretch = pl.grounded
      ? 1
      : 1 + THREE.MathUtils.clamp(pl.vy * 0.018, -0.06, 0.1)
    tilt.current.scale.set(2 - stretch, stretch, 2 - stretch)

    if (lArm.current) {
      lArm.current.rotation.x = lArmX
      lArm.current.rotation.z = lArmZ
    }
    if (rArm.current) {
      rArm.current.rotation.x = rArmX
      rArm.current.rotation.z = rArmZ
    }
    if (lLeg.current) {
      lLeg.current.rotation.x = lLegX
      lLeg.current.rotation.z = lLegZ
    }
    if (rLeg.current) {
      rLeg.current.rotation.x = rLegX
      rLeg.current.rotation.z = rLegZ
    }
    if (body.current) {
      body.current.rotation.x = bodyLean
      body.current.position.y = bodyBob
    }
    if (head.current) {
      head.current.rotation.x = headX
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
          {/* Torso / jersey */}
          <mesh position={[0, 1.08, 0]} castShadow>
            <boxGeometry args={[0.52, 0.6, 0.3]} />
            <meshLambertMaterial color={c.jersey} />
          </mesh>
          {/* Jersey side stripes */}
          <mesh position={[-0.265, 1.08, 0]}>
            <boxGeometry args={[0.015, 0.6, 0.31]} />
            <meshLambertMaterial color="#f8fafc" />
          </mesh>
          <mesh position={[0.265, 1.08, 0]}>
            <boxGeometry args={[0.015, 0.6, 0.31]} />
            <meshLambertMaterial color="#f8fafc" />
          </mesh>
          {/* Pixel jersey number (front chest bars) */}
          <mesh position={[-0.07, 1.14, 0.155]}>
            <boxGeometry args={[0.06, 0.2, 0.012]} />
            <meshBasicMaterial color="#f8fafc" />
          </mesh>
          <mesh position={[0.07, 1.14, 0.155]}>
            <boxGeometry args={[0.06, 0.2, 0.012]} />
            <meshBasicMaterial color="#f8fafc" />
          </mesh>
          {/* Jersey trim */}
          <mesh position={[0, 0.82, 0]}>
            <boxGeometry args={[0.53, 0.06, 0.31]} />
            <meshLambertMaterial color="#f8fafc" />
          </mesh>
          {/* Shorts */}
          <mesh position={[0, 0.68, 0]}>
            <boxGeometry args={[0.5, 0.24, 0.3]} />
            <meshLambertMaterial color={c.shorts} />
          </mesh>
          {/* Shorts side stripe */}
          <mesh position={[0, 0.58, 0]}>
            <boxGeometry args={[0.51, 0.04, 0.31]} />
            <meshLambertMaterial color="#f8fafc" />
          </mesh>

          {/* Head (own pivot so it can scan / react) */}
          <group ref={head} position={[0, 1.56, 0]}>
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
            {/* Hair */}
            <mesh position={[0, 0.16, 0.02]}>
              <boxGeometry args={[0.34, 0.12, 0.3]} />
              <meshLambertMaterial color={c.hair} />
            </mesh>
            {/* Headband */}
            <mesh position={[0, 0.08, 0]}>
              <boxGeometry args={[0.34, 0.05, 0.34]} />
              <meshLambertMaterial color={c.jersey} />
            </mesh>
          </group>

          {/* Arms (pivot at shoulders) */}
          <group ref={lArm} position={[-0.34, 1.32, 0]}>
            <mesh position={[0, -0.16, 0]}>
              <boxGeometry args={[0.14, 0.3, 0.14]} />
              <meshLambertMaterial color={c.jersey} />
            </mesh>
            <mesh position={[0, -0.4, 0]} castShadow>
              <boxGeometry args={[0.13, 0.26, 0.13]} />
              <meshLambertMaterial color={c.skin} />
            </mesh>
          </group>
          <group ref={rArm} position={[0.34, 1.32, 0]}>
            <mesh position={[0, -0.16, 0]}>
              <boxGeometry args={[0.14, 0.3, 0.14]} />
              <meshLambertMaterial color={c.jersey} />
            </mesh>
            <mesh position={[0, -0.4, 0]} castShadow>
              <boxGeometry args={[0.13, 0.26, 0.13]} />
              <meshLambertMaterial color={c.skin} />
            </mesh>
            {/* Wristband on the shooting arm */}
            <mesh position={[0, -0.5, 0]}>
              <boxGeometry args={[0.145, 0.06, 0.145]} />
              <meshLambertMaterial color={accent} />
            </mesh>
          </group>
        </group>

        {/* Legs (pivot at hips) */}
        <group ref={lLeg} position={[-0.14, 0.6, 0]}>
          <mesh position={[0, -0.26, 0]} castShadow>
            <boxGeometry args={[0.17, 0.52, 0.17]} />
            <meshLambertMaterial color={c.skin} />
          </mesh>
          {/* Sock */}
          <mesh position={[0, -0.46, 0]}>
            <boxGeometry args={[0.175, 0.08, 0.175]} />
            <meshLambertMaterial color="#f8fafc" />
          </mesh>
          {/* Team-color sneaker with white sole */}
          <mesh position={[0, -0.54, 0.04]}>
            <boxGeometry args={[0.18, 0.08, 0.26]} />
            <meshLambertMaterial color={accent} />
          </mesh>
          <mesh position={[0, -0.59, 0.04]}>
            <boxGeometry args={[0.19, 0.03, 0.27]} />
            <meshLambertMaterial color="#f8fafc" />
          </mesh>
        </group>
        <group ref={rLeg} position={[0.14, 0.6, 0]}>
          <mesh position={[0, -0.26, 0]} castShadow>
            <boxGeometry args={[0.17, 0.52, 0.17]} />
            <meshLambertMaterial color={c.skin} />
          </mesh>
          <mesh position={[0, -0.46, 0]}>
            <boxGeometry args={[0.175, 0.08, 0.175]} />
            <meshLambertMaterial color="#f8fafc" />
          </mesh>
          <mesh position={[0, -0.54, 0.04]}>
            <boxGeometry args={[0.18, 0.08, 0.26]} />
            <meshLambertMaterial color={accent} />
          </mesh>
          <mesh position={[0, -0.59, 0.04]}>
            <boxGeometry args={[0.19, 0.03, 0.27]} />
            <meshLambertMaterial color="#f8fafc" />
          </mesh>
        </group>
      </group>
    </group>
  )
}
