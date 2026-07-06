'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G, STUN_TIME } from '@/lib/game'

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

    switch (pl.anim) {
      case 'run': {
        lArmX = Math.sin(runPhase) * 0.85 * runAmt
        rArmX = -Math.sin(runPhase) * 0.85 * runAmt
        lLegX = -Math.sin(runPhase) * 0.95 * runAmt
        rLegX = Math.sin(runPhase) * 0.95 * runAmt
        bodyLean = 0.14 * runAmt
        bodyBob = Math.abs(Math.sin(runPhase)) * 0.05 * runAmt
        break
      }
      case 'shoot': {
        // Two-hand gather, then one-arm follow-through at release
        const k = Math.min(pl.animT / 0.25, 1)
        const follow = Math.max(0, Math.min((pl.animT - 0.32) / 0.15, 1))
        lArmX = -2.6 * k + follow * 1.2
        rArmX = -2.6 * k - follow * 0.4
        rArmZ = follow * 0.15
        lLegX = -0.3
        rLegX = 0.35
        break
      }
      case 'dunk': {
        lArmX = -1.2
        rArmX = -2.95
        lLegX = -0.75
        rLegX = 0.55
        bodyLean = 0.3
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
        // Wide defensive stance: knees bent, arms out to the sides
        const sway = Math.sin(t * 6 + id) * 0.08
        lArmX = -0.5
        rArmX = -0.5
        lArmZ = 0.9 + sway
        rArmZ = -0.9 + sway
        lLegX = 0.15
        rLegX = -0.15
        lLegZ = 0.28
        rLegZ = -0.28
        bodyLean = 0.22
        bodyBob = -0.09 + Math.abs(Math.sin(t * 5.5)) * 0.03
        break
      }
      case 'pass': {
        const k = Math.min(pl.animT / 0.12, 1)
        lArmX = -1.5 * k
        rArmX = -1.5 * k
        bodyLean = 0.18 * k
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
        break
      }
      case 'fall': {
        // Handled below via tilt; arms flail out
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
        lArmX = Math.sin(t * 2 + id) * 0.06 + 0.25
        rArmX = Math.sin(t * 2 + id + 1) * 0.06 + 0.25
        bodyBob = Math.sin(t * 2.4 + id) * 0.015
      }
    }

    // Knockdown tilt: fall fast, lie there, then get back up
    let fallAmt = 0
    if (pl.stunT > 0) {
      fallAmt = Math.min((STUN_TIME - pl.stunT) * 5, pl.stunT * 3.2, 1)
    }
    tilt.current.rotation.x = -fallAmt * 1.5
    tilt.current.position.y = -fallAmt * 0.12

    // Crossover side lean (from dribble moves)
    tilt.current.rotation.z = pl.crossLean

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
          {/* Head */}
          <mesh position={[0, 1.56, 0]} castShadow>
            <boxGeometry args={[0.32, 0.32, 0.32]} />
            <meshLambertMaterial color={c.skin} />
          </mesh>
          {/* Hair */}
          <mesh position={[0, 1.72, 0.02]}>
            <boxGeometry args={[0.34, 0.12, 0.3]} />
            <meshLambertMaterial color={c.hair} />
          </mesh>
          {/* Headband */}
          <mesh position={[0, 1.64, 0]}>
            <boxGeometry args={[0.34, 0.05, 0.34]} />
            <meshLambertMaterial color={c.jersey} />
          </mesh>

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
          </group>
        </group>

        {/* Legs (pivot at hips) */}
        <group ref={lLeg} position={[-0.14, 0.6, 0]}>
          <mesh position={[0, -0.26, 0]} castShadow>
            <boxGeometry args={[0.17, 0.52, 0.17]} />
            <meshLambertMaterial color={c.skin} />
          </mesh>
          <mesh position={[0, -0.55, 0.04]}>
            <boxGeometry args={[0.18, 0.1, 0.26]} />
            <meshLambertMaterial color="#f8fafc" />
          </mesh>
        </group>
        <group ref={rLeg} position={[0.14, 0.6, 0]}>
          <mesh position={[0, -0.26, 0]} castShadow>
            <boxGeometry args={[0.17, 0.52, 0.17]} />
            <meshLambertMaterial color={c.skin} />
          </mesh>
          <mesh position={[0, -0.55, 0.04]}>
            <boxGeometry args={[0.18, 0.1, 0.26]} />
            <meshLambertMaterial color="#f8fafc" />
          </mesh>
        </group>
      </group>
    </group>
  )
}
