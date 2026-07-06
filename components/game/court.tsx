'use client'

import { RIM } from '@/lib/game'

const LINE_COLOR = '#f8fafc'
const LINE_Y = 0.02

function Line({
  x = 0,
  z = 0,
  w = 0.1,
  d = 0.1,
}: {
  x?: number
  z?: number
  w?: number
  d?: number
}) {
  return (
    <mesh position={[x, LINE_Y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial color={LINE_COLOR} />
    </mesh>
  )
}

export default function Court() {
  return (
    <group>
      {/* Asphalt around */}
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshLambertMaterial color="#334155" />
      </mesh>

      {/* Wooden court - alternating plank strips for a pixel feel */}
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh
          key={i}
          position={[-8.25 + i * 1.5 + 0.75, 0, -3.4]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[1.5, 16.4]} />
          <meshLambertMaterial color={i % 2 === 0 ? '#c47f3d' : '#b5723a'} />
        </mesh>
      ))}

      {/* Painted key */}
      <mesh position={[0, 0.01, -8.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 5.6]} />
        <meshLambertMaterial color="#b91c1c" />
      </mesh>

      {/* Court boundary lines */}
      <Line x={0} z={4.5} w={17} d={0.12} />
      <Line x={0} z={-11.5} w={17} d={0.12} />
      <Line x={-8.45} z={-3.5} w={0.12} d={16.12} />
      <Line x={8.45} z={-3.5} w={0.12} d={16.12} />

      {/* Key outline */}
      <Line x={-1.8} z={-8.1} w={0.1} d={5.6} />
      <Line x={1.8} z={-8.1} w={0.1} d={5.6} />
      <Line x={0} z={-5.3} w={3.7} d={0.1} />

      {/* Free-throw circle */}
      <mesh position={[0, LINE_Y, -5.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.7, 1.8, 32]} />
        <meshBasicMaterial color={LINE_COLOR} />
      </mesh>

      {/* 3-point arc (opens toward +z / the court) */}
      <mesh position={[0, LINE_Y, -9.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.5, 6.62, 48, 1, Math.PI, Math.PI]} />
        <meshBasicMaterial color={LINE_COLOR} />
      </mesh>
      {/* Corner three lines */}
      <Line x={-6.56} z={-10.15} w={0.12} d={2.7} />
      <Line x={6.56} z={-10.15} w={0.12} d={2.7} />

      <Hoop />
    </group>
  )
}

function Hoop() {
  return (
    <group>
      {/* Pole */}
      <mesh position={[0, 2, -11.3]}>
        <boxGeometry args={[0.25, 4, 0.25]} />
        <meshLambertMaterial color="#475569" />
      </mesh>
      <mesh position={[0, 3.7, -10.65]}>
        <boxGeometry args={[0.18, 0.18, 1.3]} />
        <meshLambertMaterial color="#475569" />
      </mesh>

      {/* Backboard */}
      <mesh position={[0, 3.6, -10.05]}>
        <boxGeometry args={[2.4, 1.5, 0.08]} />
        <meshLambertMaterial color="#e2e8f0" />
      </mesh>
      {/* Backboard inner square */}
      <mesh position={[0, 3.35, -10.0]}>
        <boxGeometry args={[0.8, 0.6, 0.02]} />
        <meshLambertMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0, 3.35, -9.99]}>
        <boxGeometry args={[0.64, 0.44, 0.02]} />
        <meshLambertMaterial color="#e2e8f0" />
      </mesh>

      {/* Rim */}
      <mesh position={[RIM.x, RIM.y, RIM.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.45, 0.05, 8, 16]} />
        <meshLambertMaterial color="#f97316" />
      </mesh>

      {/* Net */}
      <mesh position={[RIM.x, RIM.y - 0.25, RIM.z]}>
        <cylinderGeometry args={[0.44, 0.28, 0.5, 8, 3, true]} />
        <meshBasicMaterial color="#f8fafc" wireframe transparent opacity={0.8} />
      </mesh>
    </group>
  )
}
