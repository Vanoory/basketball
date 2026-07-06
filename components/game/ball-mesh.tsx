'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G } from '@/lib/game'

export default function BallMesh() {
  const ref = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (!ref.current) return
    ref.current.position.copy(G.ball.pos)
    ref.current.rotation.x += G.ball.spin
    if (shadow.current) {
      const h = G.ball.pos.y
      shadow.current.position.set(G.ball.pos.x, 0.018, G.ball.pos.z)
      const s = Math.max(0.35, 1 - h * 0.12)
      shadow.current.scale.setScalar(s)
      const mat = shadow.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.3 * Math.max(0.25, 1 - h * 0.1)
    }
  })

  return (
    <>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.17, 8]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>
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
