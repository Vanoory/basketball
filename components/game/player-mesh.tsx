'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G } from '@/lib/game'

interface Props {
  id: number
}

export default function PlayerMesh({ id }: Props) {
  const root = useRef<THREE.Group>(null)
  const lArm = useRef<THREE.Group>(null)
  const rArm = useRef<THREE.Group>(null)
  const lLeg = useRef<THREE.Group>(null)
  const rLeg = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)

  const p = G.players[id]
  const c = p.colors

  useFrame((state) => {
    if (!root.current) return
    const pl = G.players[id]
    root.current.position.copy(pl.pos)
    root.current.rotation.y = pl.facing

    const t = state.clock.elapsedTime
    const runPhase = t * 11
    const runAmt = Math.min(pl.speed / 4.5, 1.4)

    let lArmX = 0
    let rArmX = 0
    let lLegX = 0
    let rLegX = 0
    let bodyLean = 0

    if (pl.anim === 'run') {
      lArmX = Math.sin(runPhase) * 0.8 * runAmt
      rArmX = -Math.sin(runPhase) * 0.8 * runAmt
      lLegX = -Math.sin(runPhase) * 0.9 * runAmt
      rLegX = Math.sin(runPhase) * 0.9 * runAmt
      bodyLean = 0.12 * runAmt
    } else if (pl.anim === 'shoot') {
      // Both arms raised overhead, extend on release
      const k = Math.min(pl.animT / 0.25, 1)
      lArmX = -2.6 * k
      rArmX = -2.6 * k
      lLegX = -0.3
      rLegX = 0.35
    } else if (pl.anim === 'dunk') {
      lArmX = -2.9
      rArmX = -2.9
      lLegX = -0.7
      rLegX = 0.5
      bodyLean = 0.25
    } else if (pl.anim === 'jump') {
      lArmX = -2.8
      rArmX = -2.8
      lLegX = -0.4
      rLegX = 0.4
    } else {
      // idle: subtle sway + defensive stance arms
      lArmX = Math.sin(t * 2 + id) * 0.06 + 0.25
      rArmX = Math.sin(t * 2 + id + 1) * 0.06 + 0.25
    }

    if (lArm.current) lArm.current.rotation.x = lArmX
    if (rArm.current) rArm.current.rotation.x = rArmX
    if (lLeg.current) lLeg.current.rotation.x = lLegX
    if (rLeg.current) rLeg.current.rotation.x = rLegX
    if (body.current) body.current.rotation.x = bodyLean

    // Controlled-player indicator ring
    if (ring.current) {
      const isControlled = G.controlled === id
      ring.current.visible = isControlled
      ring.current.rotation.z = t * 2
    }
  })

  return (
    <group ref={root}>
      {/* Indicator ring under controlled player */}
      <mesh ref={ring} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.62, 4]} />
        <meshBasicMaterial color="#fde047" />
      </mesh>

      <group ref={body}>
        {/* Torso / jersey */}
        <mesh position={[0, 1.08, 0]} castShadow>
          <boxGeometry args={[0.52, 0.6, 0.3]} />
          <meshLambertMaterial color={c.jersey} />
        </mesh>
        {/* Shorts */}
        <mesh position={[0, 0.68, 0]}>
          <boxGeometry args={[0.5, 0.24, 0.3]} />
          <meshLambertMaterial color={c.shorts} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.56, 0]}>
          <boxGeometry args={[0.32, 0.32, 0.32]} />
          <meshLambertMaterial color={c.skin} />
        </mesh>
        {/* Hair */}
        <mesh position={[0, 1.72, 0.02]}>
          <boxGeometry args={[0.34, 0.12, 0.3]} />
          <meshLambertMaterial color={c.hair} />
        </mesh>

        {/* Arms (pivot at shoulders) */}
        <group ref={lArm} position={[-0.34, 1.32, 0]}>
          <mesh position={[0, -0.26, 0]}>
            <boxGeometry args={[0.14, 0.52, 0.14]} />
            <meshLambertMaterial color={c.skin} />
          </mesh>
        </group>
        <group ref={rArm} position={[0.34, 1.32, 0]}>
          <mesh position={[0, -0.26, 0]}>
            <boxGeometry args={[0.14, 0.52, 0.14]} />
            <meshLambertMaterial color={c.skin} />
          </mesh>
        </group>
      </group>

      {/* Legs (pivot at hips) */}
      <group ref={lLeg} position={[-0.14, 0.6, 0]}>
        <mesh position={[0, -0.26, 0]}>
          <boxGeometry args={[0.17, 0.52, 0.17]} />
          <meshLambertMaterial color={c.skin} />
        </mesh>
        {/* Shoe */}
        <mesh position={[0, -0.55, 0.04]}>
          <boxGeometry args={[0.18, 0.1, 0.26]} />
          <meshLambertMaterial color="#f8fafc" />
        </mesh>
      </group>
      <group ref={rLeg} position={[0.14, 0.6, 0]}>
        <mesh position={[0, -0.26, 0]}>
          <boxGeometry args={[0.17, 0.52, 0.17]} />
          <meshLambertMaterial color={c.skin} />
        </mesh>
        <mesh position={[0, -0.55, 0.04]}>
          <boxGeometry args={[0.18, 0.1, 0.26]} />
          <meshLambertMaterial color="#f8fafc" />
        </mesh>
      </group>
    </group>
  )
}
