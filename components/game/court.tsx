'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
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
      <mesh
        position={[0, -0.06, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[80, 80]} />
        <meshLambertMaterial color="#2b3648" />
      </mesh>

      {/* Court apron (colored border band) */}
      <mesh position={[0, -0.01, -3.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20.5, 19.6]} />
        <meshLambertMaterial color="#14532d" />
      </mesh>

      {/* Wooden court - alternating plank strips for a pixel feel */}
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh
          key={i}
          position={[-8.25 + i * 1.5 + 0.75, 0, -3.4]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[1.5, 16.4]} />
          <meshLambertMaterial color={i % 2 === 0 ? '#cd8a45' : '#bd7a3c'} />
        </mesh>
      ))}

      {/* Painted key */}
      <mesh position={[0, 0.01, -8.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 5.6]} />
        <meshLambertMaterial color="#b91c1c" />
      </mesh>

      {/* Center circle (half court decoration at +z end) */}
      <mesh position={[0, LINE_Y, 4.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.7, 1.82, 32, 1, 0, Math.PI]} />
        <meshBasicMaterial color={LINE_COLOR} />
      </mesh>
      <mesh position={[0, 0.011, 4.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.7, 32, 0, Math.PI]} />
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
      <Environment />
    </group>
  )
}

function Hoop() {
  return (
    <group>
      {/* Pole */}
      <mesh position={[0, 2, -11.3]} castShadow>
        <boxGeometry args={[0.25, 4, 0.25]} />
        <meshLambertMaterial color="#475569" />
      </mesh>
      {/* Pole pad */}
      <mesh position={[0, 0.7, -11.3]}>
        <boxGeometry args={[0.45, 1.4, 0.45]} />
        <meshLambertMaterial color="#1d4ed8" />
      </mesh>
      <mesh position={[0, 3.7, -10.65]}>
        <boxGeometry args={[0.18, 0.18, 1.3]} />
        <meshLambertMaterial color="#475569" />
      </mesh>

      {/* Backboard */}
      <mesh position={[0, 3.6, -10.05]} castShadow>
        <boxGeometry args={[2.4, 1.5, 0.08]} />
        <meshLambertMaterial color="#e2e8f0" />
      </mesh>
      {/* Backboard border */}
      <mesh position={[0, 3.6, -10.0]}>
        <boxGeometry args={[2.42, 1.52, 0.02]} />
        <meshLambertMaterial color="#94a3b8" />
      </mesh>
      {/* Backboard inner square */}
      <mesh position={[0, 3.35, -9.99]}>
        <boxGeometry args={[0.8, 0.6, 0.02]} />
        <meshLambertMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0, 3.35, -9.98]}>
        <boxGeometry args={[0.64, 0.44, 0.02]} />
        <meshLambertMaterial color="#e2e8f0" />
      </mesh>

      {/* Rim */}
      <mesh position={[RIM.x, RIM.y, RIM.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.45, 0.05, 8, 16]} />
        <meshLambertMaterial color="#f97316" emissive="#7c2d12" emissiveIntensity={0.4} />
      </mesh>

      {/* Net */}
      <mesh position={[RIM.x, RIM.y - 0.25, RIM.z]}>
        <cylinderGeometry args={[0.44, 0.28, 0.5, 8, 3, true]} />
        <meshBasicMaterial color="#f8fafc" wireframe transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

// ---------- Environment: stands, crowd, buildings, fence, clouds ----------
const CROWD_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#eab308',
  '#22c55e',
  '#f97316',
  '#e2e8f0',
  '#a855f7',
  '#0ea5e9',
]

function Crowd({
  position,
  rotation = 0,
  rows = 3,
  cols = 16,
}: {
  position: [number, number, number]
  rotation?: number
  rows?: number
  cols?: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const count = rows * cols
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        color: new THREE.Color(
          CROWD_COLORS[Math.floor(Math.random() * CROWD_COLORS.length)],
        ),
        phase: Math.random() * Math.PI * 2,
        speed: 4 + Math.random() * 4,
      })),
    [count],
  )
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const colored = useRef(false)

  useFrame((state) => {
    if (!ref.current) return
    if (!colored.current) {
      for (let i = 0; i < count; i++) ref.current.setColorAt(i, seeds[i].color)
      if (ref.current.instanceColor)
        ref.current.instanceColor.needsUpdate = true
      colored.current = true
    }
    const t = state.clock.elapsedTime
    let i = 0
    for (let r = 0; r < rows; r++) {
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        const s = seeds[i]
        const hop = Math.max(0, Math.sin(t * s.speed + s.phase)) * 0.14
        dummy.position.set(
          (cIdx - (cols - 1) / 2) * 1.05,
          0.55 + r * 0.75 + hop,
          -r * 0.8,
        )
        dummy.scale.set(0.55, 0.85, 0.4)
        dummy.updateMatrix()
        ref.current.setMatrixAt(i, dummy.matrix)
        i++
      }
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Bleacher steps */}
      {Array.from({ length: rows }).map((_, r) => (
        <mesh key={r} position={[0, 0.15 + r * 0.75 - 0.35, -r * 0.8]}>
          <boxGeometry args={[cols * 1.05 + 1, 0.5, 0.85]} />
          <meshLambertMaterial color={r % 2 === 0 ? '#475569' : '#3f4c63'} />
        </mesh>
      ))}
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
    </group>
  )
}

function Building({
  x,
  z,
  w,
  h,
  color,
}: {
  x: number
  z: number
  w: number
  h: number
  color: string
}) {
  const windows = useMemo(() => {
    const arr: { x: number; y: number; lit: boolean }[] = []
    const cols = Math.floor(w / 1.4)
    const rowsN = Math.floor(h / 1.6)
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rowsN; j++) {
        arr.push({
          x: (i - (cols - 1) / 2) * 1.4,
          y: 1.2 + j * 1.6,
          lit: Math.random() > 0.45,
        })
      }
    }
    return arr
  }, [w, h])

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, 3]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {windows.map((win, i) => (
        <mesh key={i} position={[win.x, win.y, 1.52]}>
          <planeGeometry args={[0.7, 0.9]} />
          <meshBasicMaterial color={win.lit ? '#fbbf24' : '#1e293b'} />
        </mesh>
      ))}
    </group>
  )
}

function Floodlight({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[0.2, 7, 0.2]} />
        <meshLambertMaterial color="#334155" />
      </mesh>
      <mesh position={[0, 7.1, 0.3]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[1.4, 0.7, 0.3]} />
        <meshLambertMaterial color="#475569" />
      </mesh>
      <mesh position={[0, 7.05, 0.5]} rotation={[0.5, 0, 0]}>
        <planeGeometry args={[1.2, 0.5]} />
        <meshBasicMaterial color="#fef9c3" />
      </mesh>
    </group>
  )
}

function Environment() {
  return (
    <group>
      {/* Bleachers with animated crowd on both sides */}
      <Crowd position={[-12.5, 0, -3.5]} rotation={Math.PI / 2} rows={3} cols={16} />
      <Crowd position={[12.5, 0, -3.5]} rotation={-Math.PI / 2} rows={3} cols={16} />
      <Crowd position={[0, 0, -15.5]} rotation={0} rows={2} cols={18} />

      {/* Chain-link fence behind the court */}
      {Array.from({ length: 13 }).map((_, i) => (
        <mesh key={`fp${i}`} position={[-18 + i * 3, 1.6, 9]}>
          <boxGeometry args={[0.12, 3.2, 0.12]} />
          <meshLambertMaterial color="#64748b" />
        </mesh>
      ))}
      <mesh position={[0, 1.6, 9.05]}>
        <planeGeometry args={[36, 3]} />
        <meshBasicMaterial
          color="#94a3b8"
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Night-city skyline */}
      <Building x={-16} z={-24} w={7} h={14} color="#1e293b" />
      <Building x={-7} z={-26} w={6} h={19} color="#273449" />
      <Building x={2} z={-25} w={8} h={12} color="#1e293b" />
      <Building x={11} z={-26} w={6} h={17} color="#243044" />
      <Building x={19} z={-24} w={7} h={10} color="#1e293b" />
      <Building x={-24} z={-20} w={6} h={9} color="#273449" />
      <Building x={25} z={-20} w={6} h={12} color="#273449" />

      {/* Moon */}
      <mesh position={[14, 22, -40]}>
        <boxGeometry args={[3, 3, 0.2]} />
        <meshBasicMaterial color="#fef9c3" />
      </mesh>

      {/* Pixel clouds */}
      {[
        [-18, 17, -35, 5],
        [6, 20, -38, 7],
        [22, 15, -34, 4],
      ].map(([x, y, z, w], i) => (
        <group key={`cl${i}`} position={[x, y, z]}>
          <mesh>
            <boxGeometry args={[w, 1.2, 0.3]} />
            <meshBasicMaterial color="#475569" />
          </mesh>
          <mesh position={[w * 0.2, 0.9, 0]}>
            <boxGeometry args={[w * 0.5, 1, 0.3]} />
            <meshBasicMaterial color="#526078" />
          </mesh>
        </group>
      ))}

      {/* Floodlights on the corners */}
      <Floodlight x={-11} z={6} />
      <Floodlight x={11} z={6} />
      <Floodlight x={-11} z={-13} />
      <Floodlight x={11} z={-13} />
    </group>
  )
}
