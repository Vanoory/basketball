'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G } from '@/lib/game'

export default function BallMesh() {
  const ref = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!ref.current) return
    ref.current.position.copy(G.ball.pos)
    ref.current.rotation.x += G.ball.spin
  })

  return (
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
  )
}
