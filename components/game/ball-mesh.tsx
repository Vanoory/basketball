'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G } from '@/lib/game'

const TRAIL_LEN = 7

export default function BallMesh() {
  const ref = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const trailRefs = useRef<(THREE.Mesh | null)[]>([])
  const trailPos = useRef<THREE.Vector3[]>(
    Array.from({ length: TRAIL_LEN }, () => new THREE.Vector3(0, -5, 0)),
  )
  const trailTimer = useRef(0)

  useFrame((_, dt) => {
    if (!ref.current) return
    const b = G.ball
    ref.current.position.copy(b.pos)
    ref.current.rotation.x += b.spin
    if (shadow.current) {
      const h = b.pos.y
      shadow.current.position.set(b.pos.x, 0.018, b.pos.z)
      const s = Math.max(0.35, 1 - h * 0.12)
      shadow.current.scale.setScalar(s)
      const mat = shadow.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.3 * Math.max(0.25, 1 - h * 0.1)
    }

    // Flight trail: sample the ball position while it's airborne and fast
    const flying =
      b.state === 'shot' ||
      b.state === 'dunk' ||
      (b.state === 'loose' && b.vel.length() > 4)
    trailTimer.current -= dt
    if (flying && trailTimer.current <= 0) {
      trailTimer.current = 0.03
      const arr = trailPos.current
      for (let i = arr.length - 1; i > 0; i--) arr[i].copy(arr[i - 1])
      arr[0].copy(b.pos)
    }
    for (let i = 0; i < TRAIL_LEN; i++) {
      const m = trailRefs.current[i]
      if (!m) continue
      if (!flying) {
        m.visible = false
        continue
      }
      m.visible = true
      m.position.copy(trailPos.current[i])
      const f = 1 - i / TRAIL_LEN
      m.scale.setScalar(0.55 + f * 0.4)
      ;(m.material as THREE.MeshBasicMaterial).opacity = f * 0.32
    }
    if (!flying) {
      // Reset the buffer so old segments don't flash on the next shot
      for (const v of trailPos.current) v.copy(b.pos)
    }
  })

  return (
    <>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.17, 8]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>

      {/* Trail segments */}
      {Array.from({ length: TRAIL_LEN }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            trailRefs.current[i] = el
          }}
          visible={false}
        >
          <sphereGeometry args={[0.15, 6, 5]} />
          <meshBasicMaterial
            color="#fdba74"
            transparent
            opacity={0.3}
            depthWrite={false}
          />
        </mesh>
      ))}

      <group ref={ref}>
        <mesh castShadow>
          <sphereGeometry args={[0.17, 10, 8]} />
          <meshLambertMaterial color="#f97316" />
        </mesh>
        {/* Seams */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.17, 0.012, 4, 16]} />
          <meshBasicMaterial color="#7c2d12" />
        </mesh>
        <mesh>
          <torusGeometry args={[0.17, 0.012, 4, 16]} />
          <meshBasicMaterial color="#7c2d12" />
        </mesh>
      </group>
    </>
  )
}
