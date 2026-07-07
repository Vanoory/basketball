'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RIM, type GameMode } from '@/lib/game'

const LINE_COLOR = '#f8fafc'
const LINE_Y = 0.02

// Fixed plank tones (seeded variation, no flicker between renders)
const PLANK_TONES = [
  '#cd8a45',
  '#bd7a3c',
  '#c98442',
  '#b97638',
  '#d18e49',
  '#bd7a3c',
  '#c68040',
  '#bb783a',
  '#cf8c47',
  '#b8743a',
  '#ca8643',
  '#bf7c3e',
]

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

// One basket's worth of markings: key, FT circle, arc, corners, hoop.
// Built around the -z rim; mirror with a 180-degree Y rotation for the
// opposite basket on the full court.
function EndMarkings() {
  return (
    <group>
      {/* Painted key */}
      <mesh position={[0, 0.01, -8.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 5.6]} />
        <meshLambertMaterial color="#b91c1c" />
      </mesh>

      {/* Key outline */}
      <Line x={-1.8} z={-8.1} w={0.1} d={5.6} />
      <Line x={1.8} z={-8.1} w={0.1} d={5.6} />
      <Line x={0} z={-5.3} w={3.7} d={0.1} />

      {/* Free-throw circle */}
      <mesh position={[0, LINE_Y, -5.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.7, 1.8, 32]} />
        <meshBasicMaterial color={LINE_COLOR} />
      </mesh>

      {/* 3-point arc (opens toward the court) */}
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

export default function Court({ mode = '3v3' }: { mode?: GameMode }) {
  const full = mode === '5v5'
  // Floor footprint: half court is offset toward -z, full court is centered
  // The 5v5 court is LARGER: baskets at +-11.9, baselines at +-13.9
  const floorLen = full ? 29.4 : 16.4
  const floorZ = full ? 0 : -3.4
  const seams = full
    ? [-12.5, -9, -5.5, -2, 1.5, 5, 8.5, 12]
    : [-9, -5.5, -2, 1.5]
  const plankCount = full ? 14 : 12
  const plankStart = full ? -10.5 : -8.25
  const seamW = full ? 19.5 : 16.5

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
      <mesh position={[0, -0.01, floorZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[full ? 23.5 : 20.5, floorLen + 3.2]} />
        <meshLambertMaterial color="#14532d" />
      </mesh>

      {/* Wooden court - plank strips with subtle tone variation */}
      {Array.from({ length: plankCount }).map((_, i) => (
        <mesh
          key={i}
          position={[plankStart + i * 1.5 + 0.75, 0, floorZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[1.5, floorLen]} />
          <meshLambertMaterial color={PLANK_TONES[i % PLANK_TONES.length]} />
        </mesh>
      ))}
      {/* Plank seams (horizontal breaks for a real parquet feel) */}
      {seams.map((z, i) => (
        <mesh
          key={`seam${i}`}
          position={[0, 0.005, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[seamW, 0.04]} />
          <meshBasicMaterial color="#a4692f" />
        </mesh>
      ))}

      {full ? (
        <>
          {/* Midcourt line + full center circle */}
          <Line x={0} z={0} w={19.1} d={0.12} />
          <mesh position={[0, LINE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.7, 1.82, 32]} />
            <meshBasicMaterial color={LINE_COLOR} />
          </mesh>
          <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.7, 32]} />
            <meshLambertMaterial color="#b91c1c" />
          </mesh>
          {/* Pixel basketball logo at center court */}
          <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.75, 10]} />
            <meshBasicMaterial color="#f97316" />
          </mesh>
          <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.45, 0.07]} />
            <meshBasicMaterial color="#7c2d12" />
          </mesh>
          <mesh
            position={[0, 0.014, 0]}
            rotation={[-Math.PI / 2, 0, Math.PI / 2]}
          >
            <planeGeometry args={[1.45, 0.07]} />
            <meshBasicMaterial color="#7c2d12" />
          </mesh>

          {/* Full-court boundary lines */}
          <Line x={0} z={13.9} w={19.1} d={0.12} />
          <Line x={0} z={-13.9} w={19.1} d={0.12} />
          <Line x={-9.5} z={0} w={0.12} d={27.92} />
          <Line x={9.5} z={0} w={0.12} d={27.92} />

          {/* Both ends: markings + hoops (shifted deeper on the big court) */}
          <group position={[0, 0, -2.5]}>
            <EndMarkings />
          </group>
          <group rotation={[0, Math.PI, 0]}>
            <group position={[0, 0, -2.5]}>
              <EndMarkings />
            </group>
          </group>
        </>
      ) : (
        <>
          {/* Center circle (half court decoration at +z end) */}
          <mesh position={[0, LINE_Y, 4.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.7, 1.82, 32, 1, 0, Math.PI]} />
            <meshBasicMaterial color={LINE_COLOR} />
          </mesh>
          <mesh position={[0, 0.011, 4.5]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.7, 32, 0, Math.PI]} />
            <meshLambertMaterial color="#b91c1c" />
          </mesh>
          {/* Pixel basketball logo inside the center circle */}
          <mesh position={[0, 0.013, 3.7]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.75, 10]} />
            <meshBasicMaterial color="#f97316" />
          </mesh>
          <mesh position={[0, 0.014, 3.7]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.45, 0.07]} />
            <meshBasicMaterial color="#7c2d12" />
          </mesh>
          <mesh
            position={[0, 0.014, 3.7]}
            rotation={[-Math.PI / 2, 0, Math.PI / 2]}
          >
            <planeGeometry args={[1.45, 0.07]} />
            <meshBasicMaterial color="#7c2d12" />
          </mesh>

          {/* Court boundary lines */}
          <Line x={0} z={4.5} w={17} d={0.12} />
          <Line x={0} z={-11.5} w={17} d={0.12} />
          <Line x={-8.45} z={-3.5} w={0.12} d={16.12} />
          <Line x={8.45} z={-3.5} w={0.12} d={16.12} />

          <EndMarkings />
        </>
      )}

      <Environment full={full} />
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

      {/* Backboard - transparent glass so it never blocks the view */}
      <mesh position={[0, 3.6, -10.05]}>
        <boxGeometry args={[2.4, 1.5, 0.08]} />
        <meshLambertMaterial
          color="#bfdbfe"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
      {/* Backboard frame (thin opaque edges) */}
      {[
        [0, 4.33, 2.44, 0.07],
        [0, 2.87, 2.44, 0.07],
      ].map(([x, y, w, h], i) => (
        <mesh key={`bbh${i}`} position={[x, y, -10.05]}>
          <boxGeometry args={[w, h, 0.1]} />
          <meshLambertMaterial color="#e2e8f0" />
        </mesh>
      ))}
      {[-1.185, 1.185].map((x, i) => (
        <mesh key={`bbv${i}`} position={[x, 3.6, -10.05]}>
          <boxGeometry args={[0.07, 1.5, 0.1]} />
          <meshLambertMaterial color="#e2e8f0" />
        </mesh>
      ))}
      {/* Shooter's square outline */}
      {[
        [0, 3.63, 0.82, 0.05],
        [0, 3.07, 0.82, 0.05],
      ].map(([x, y, w, h], i) => (
        <mesh key={`sqh${i}`} position={[x, y, -9.99]}>
          <boxGeometry args={[w, h, 0.02]} />
          <meshLambertMaterial color="#ef4444" />
        </mesh>
      ))}
      {[-0.385, 0.385].map((x, i) => (
        <mesh key={`sqv${i}`} position={[x, 3.35, -9.99]}>
          <boxGeometry args={[0.05, 0.6, 0.02]} />
          <meshLambertMaterial color="#ef4444" />
        </mesh>
      ))}

      {/* Rim */}
      <mesh position={[RIM.x, RIM.y, RIM.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.45, 0.05, 8, 16]} />
        <meshLambertMaterial color="#f97316" emissive="#7c2d12" emissiveIntensity={0.4} />
      </mesh>
      {/* Rim mounting bracket */}
      <mesh position={[RIM.x, RIM.y - 0.05, RIM.z - 0.52]}>
        <boxGeometry args={[0.3, 0.12, 0.2]} />
        <meshLambertMaterial color="#ea580c" />
      </mesh>

      {/* Net - double layer for density */}
      <mesh position={[RIM.x, RIM.y - 0.25, RIM.z]}>
        <cylinderGeometry args={[0.44, 0.28, 0.5, 8, 3, true]} />
        <meshBasicMaterial color="#f8fafc" wireframe transparent opacity={0.8} />
      </mesh>
      <mesh position={[RIM.x, RIM.y - 0.25, RIM.z]} rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[0.43, 0.27, 0.48, 8, 2, true]} />
        <meshBasicMaterial color="#e2e8f0" wireframe transparent opacity={0.5} />
      </mesh>

      {/* Shot-clock box on top of the backboard */}
      <mesh position={[0, 4.5, -10.05]}>
        <boxGeometry args={[0.6, 0.35, 0.12]} />
        <meshLambertMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0, 4.5, -9.98]}>
        <planeGeometry args={[0.4, 0.2]} />
        <meshBasicMaterial color="#f97316" />
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

function Stars() {
  const stars = useMemo(() => {
    const arr: { x: number; y: number; z: number; s: number }[] = []
    let seed = 7
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < 46; i++) {
      arr.push({
        x: (rnd() - 0.5) * 100,
        y: 12 + rnd() * 24,
        z: -36 - rnd() * 8,
        s: 0.12 + rnd() * 0.2,
      })
    }
    return arr
  }, [])
  return (
    <group>
      {stars.map((st, i) => (
        <mesh key={i} position={[st.x, st.y, st.z]}>
          <boxGeometry args={[st.s, st.s, 0.05]} />
          <meshBasicMaterial color={i % 5 === 0 ? '#bfdbfe' : '#e2e8f0'} />
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
      {/* Soft volumetric light cone */}
      <mesh position={[0, 4.2, 1.5]} rotation={[0.42, 0, 0]}>
        <coneGeometry args={[2.4, 6.6, 4, 1, true]} />
        <meshBasicMaterial
          color="#fef9c3"
          transparent
          opacity={0.045}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

// Sagging strand of warm pixel bulbs strung across the court
const BULB_COLORS = ['#fbbf24', '#f97316', '#fde68a', '#fca5a5']
function StringLights({ z, width }: { z: number; width: number }) {
  const bulbs = useMemo(() => {
    const arr: { x: number; y: number; c: string }[] = []
    const n = 15
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      arr.push({
        x: (t - 0.5) * width,
        y: 7.0 - Math.sin(t * Math.PI) * 0.9,
        c: BULB_COLORS[i % BULB_COLORS.length],
      })
    }
    return arr
  }, [width])
  return (
    <group position={[0, 0, z]}>
      {/* Cable segments between bulbs */}
      {bulbs.slice(0, -1).map((b, i) => {
        const nb = bulbs[i + 1]
        const mx = (b.x + nb.x) / 2
        const my = (b.y + nb.y) / 2
        const len = Math.hypot(nb.x - b.x, nb.y - b.y)
        const ang = Math.atan2(nb.y - b.y, nb.x - b.x)
        return (
          <mesh key={`c${i}`} position={[mx, my, 0]} rotation={[0, 0, ang]}>
            <boxGeometry args={[len, 0.04, 0.04]} />
            <meshBasicMaterial color="#1e293b" />
          </mesh>
        )
      })}
      {bulbs.map((b, i) => (
        <mesh key={`b${i}`} position={[b.x, b.y - 0.12, 0]}>
          <boxGeometry args={[0.16, 0.2, 0.16]} />
          <meshBasicMaterial color={b.c} />
        </mesh>
      ))}
      {/* End poles holding the strand */}
      {[-1, 1].map((s) => (
        <mesh key={`p${s}`} position={[s * (width / 2), 3.5, 0]}>
          <boxGeometry args={[0.14, 7, 0.14]} />
          <meshLambertMaterial color="#3f4c63" />
        </mesh>
      ))}
    </group>
  )
}

// Pixel graffiti tag - blocky spray-paint panels for the fence
function Graffiti({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {[
        { dx: -0.9, dy: 1.3, w: 0.8, h: 0.9, c: '#22d3ee' },
        { dx: -0.1, dy: 1.5, w: 0.7, h: 1.1, c: '#f472b6' },
        { dx: 0.7, dy: 1.25, w: 0.8, h: 0.8, c: '#a3e635' },
        { dx: -0.4, dy: 0.8, w: 1.6, h: 0.25, c: '#facc15' },
      ].map((p, i) => (
        <mesh key={i} position={[p.dx, p.dy, 0]}>
          <planeGeometry args={[p.w, p.h]} />
          <meshBasicMaterial color={p.c} side={THREE.DoubleSide} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  )
}

// Blinking rooftop neon sign
function NeonSign({ x, y, z }: { x: number; y: number; z: number }) {
  const ref = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.opacity = Math.sin(t * 2.2) > -0.6 ? 1 : 0.15
  })
  return (
    <group position={[x, y, z]}>
      <mesh>
        <boxGeometry args={[4.6, 1.4, 0.2]} />
        <meshLambertMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <planeGeometry args={[4, 0.9]} />
        <meshBasicMaterial ref={ref} color="#f97316" transparent />
      </mesh>
    </group>
  )
}

function Tree({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.35, 2, 0.35]} />
        <meshLambertMaterial color="#5b4633" />
      </mesh>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[1.9, 1.6, 1.9]} />
        <meshLambertMaterial color="#1f4a2e" />
      </mesh>
      <mesh position={[0.3, 3.5, 0.2]}>
        <boxGeometry args={[1.2, 1, 1.2]} />
        <meshLambertMaterial color="#276038" />
      </mesh>
    </group>
  )
}

function Bench({ x, z, rot = 0 }: { x: number; z: number; rot?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[2.2, 0.1, 0.55]} />
        <meshLambertMaterial color="#7c5c3e" />
      </mesh>
      <mesh position={[0, 0.85, -0.25]}>
        <boxGeometry args={[2.2, 0.5, 0.08]} />
        <meshLambertMaterial color="#7c5c3e" />
      </mesh>
      {[-0.9, 0.9].map((lx, i) => (
        <mesh key={i} position={[lx, 0.22, 0]}>
          <boxGeometry args={[0.12, 0.45, 0.5]} />
          <meshLambertMaterial color="#334155" />
        </mesh>
      ))}
    </group>
  )
}

function Environment({ full = false }: { full?: boolean }) {
  // On the full court everything on the +z side moves out past the second
  // basket so nothing sits on the playing surface.
  const zOff = full ? 7.5 : 0
  const sideX = full ? 13.8 : 12.5
  return (
    <group>
      {/* Bleachers with animated crowd on both sides */}
      <Crowd
        position={[-sideX, 0, full ? 0 : -3.5]}
        rotation={Math.PI / 2}
        rows={3}
        cols={full ? 26 : 16}
      />
      <Crowd
        position={[sideX, 0, full ? 0 : -3.5]}
        rotation={-Math.PI / 2}
        rows={3}
        cols={full ? 26 : 16}
      />
      <Crowd position={[0, 0, full ? -18 : -15.5]} rotation={0} rows={2} cols={18} />
      {full && (
        <Crowd position={[0, 0, 18]} rotation={Math.PI} rows={2} cols={18} />
      )}

      {/* String lights over the ends of the court - streetball night vibe.
          Kept off midcourt so the cables never cut across the broadcast cam. */}
      <StringLights z={full ? -15.5 : -6.5} width={full ? 27 : 24} />
      <StringLights z={full ? 15.5 : 2.5} width={full ? 27 : 24} />

      {/* Chain-link fence behind the court */}
      {Array.from({ length: 13 }).map((_, i) => (
        <mesh key={`fp${i}`} position={[-18 + i * 3, 1.6, 9 + zOff]}>
          <boxGeometry args={[0.12, 3.2, 0.12]} />
          <meshLambertMaterial color="#64748b" />
        </mesh>
      ))}
      <mesh position={[0, 1.6, 9.05 + zOff]}>
        <planeGeometry args={[36, 3]} />
        <meshBasicMaterial
          color="#94a3b8"
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Fence top rail */}
      <mesh position={[0, 3.25, 9 + zOff]}>
        <boxGeometry args={[36, 0.12, 0.12]} />
        <meshLambertMaterial color="#64748b" />
      </mesh>

      {/* Pixel graffiti tags sprayed along the fence */}
      <Graffiti x={-13} z={8.98 + zOff} />
      <Graffiti x={-6} z={8.98 + zOff} />
      <Graffiti x={6.2} z={8.98 + zOff} />
      <Graffiti x={13.5} z={8.98 + zOff} />

      {/* Night-city skyline (two depth layers) */}
      <Building x={-16} z={-24} w={7} h={14} color="#1e293b" />
      <Building x={-7} z={-26} w={6} h={19} color="#273449" />
      <Building x={2} z={-25} w={8} h={12} color="#1e293b" />
      <Building x={11} z={-26} w={6} h={17} color="#243044" />
      <Building x={19} z={-24} w={7} h={10} color="#1e293b" />
      <Building x={-24} z={-20} w={6} h={9} color="#273449" />
      <Building x={25} z={-20} w={6} h={12} color="#273449" />
      {/* Far silhouette layer */}
      <Building x={-30} z={-32} w={9} h={22} color="#16233a" />
      <Building x={-2} z={-34} w={10} h={25} color="#141f33" />
      <Building x={16} z={-33} w={8} h={20} color="#16233a" />
      <Building x={32} z={-31} w={9} h={16} color="#141f33" />
      {/* Side-street buildings */}
      <Building x={-30} z={-4} w={8} h={11} color="#1c2940" />
      <Building x={30} z={-4} w={8} h={13} color="#1c2940" />
      <Building x={-32} z={10} w={7} h={9} color="#1a2740" />
      <Building x={31} z={12} w={7} h={10} color="#1a2740" />
      {/* Skyline behind the +z end so the city wraps all the way around */}
      <Building x={-14} z={26 + zOff} w={7} h={12} color="#1e293b" />
      <Building x={-4} z={28 + zOff} w={8} h={17} color="#243044" />
      <Building x={6} z={27 + zOff} w={6} h={11} color="#1e293b" />
      <Building x={16} z={28 + zOff} w={8} h={15} color="#273449" />
      <Building x={-24} z={30 + zOff} w={9} h={20} color="#16233a" />
      <Building x={26} z={31 + zOff} w={9} h={18} color="#141f33" />

      {/* Blinking rooftop neon signs */}
      <NeonSign x={-7} y={20} z={-25.8} />
      <NeonSign x={16} y={21} z={-32.8} />
      {full && <NeonSign x={-4} y={18} z={27.8 + zOff} />}

      {/* Rooftop antenna blinkers */}
      {[
        [-7, 19.4, -26],
        [11, 17.4, -26],
        [-2, 25.4, -34],
      ].map(([x, y, z], i) => (
        <group key={`ant${i}`} position={[x, y, z]}>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[0.08, 1.2, 0.08]} />
            <meshLambertMaterial color="#475569" />
          </mesh>
          <mesh position={[0, 1.25, 0]}>
            <boxGeometry args={[0.2, 0.2, 0.2]} />
            <meshBasicMaterial color="#f87171" />
          </mesh>
        </group>
      ))}

      {/* Glowing moon */}
      <group position={[14, 22, -40]}>
        <mesh>
          <boxGeometry args={[3, 3, 0.2]} />
          <meshBasicMaterial color="#fef9c3" />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[4.4, 4.4, 0.1]} />
          <meshBasicMaterial color="#fef9c3" transparent opacity={0.14} />
        </mesh>
        <mesh position={[-0.6, 0.5, 0.12]}>
          <boxGeometry args={[0.7, 0.7, 0.05]} />
          <meshBasicMaterial color="#fde68a" />
        </mesh>
      </group>

      {/* Pixel stars */}
      <Stars />

      {/* Sideline benches with pixel water coolers */}
      {[-1, 1].map((s) => (
        <group key={`bench${s}`} position={[s * 6, 0, 7.2 + zOff]}>
          <mesh position={[0, 0.35, 0]}>
            <boxGeometry args={[3.2, 0.12, 0.6]} />
            <meshLambertMaterial color="#7c5a3a" />
          </mesh>
          {[-1.3, 0, 1.3].map((lx, i) => (
            <mesh key={i} position={[lx, 0.16, 0]}>
              <boxGeometry args={[0.12, 0.32, 0.5]} />
              <meshLambertMaterial color="#57534e" />
            </mesh>
          ))}
          <mesh position={[s * 1.9, 0.4, 0]}>
            <boxGeometry args={[0.35, 0.5, 0.35]} />
            <meshLambertMaterial color="#f97316" />
          </mesh>
        </group>
      ))}

      {/* Fence ad banners */}
      {[
        { x: -9, c: '#b91c1c', t: '#fca5a5' },
        { x: -3, c: '#1d4ed8', t: '#93c5fd' },
        { x: 3, c: '#15803d', t: '#86efac' },
        { x: 9, c: '#a16207', t: '#fde047' },
      ].map((ad, i) => (
        <group key={`ad${i}`} position={[ad.x, 1.1, 8.95 + zOff]}>
          <mesh>
            <planeGeometry args={[4.5, 1.1]} />
            <meshLambertMaterial color={ad.c} side={THREE.DoubleSide} />
          </mesh>
          {/* Pixel "text" bars */}
          {[-1.4, -0.4, 0.6].map((bx, j) => (
            <mesh key={j} position={[bx, 0.05, -0.01]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[0.7, 0.28]} />
              <meshBasicMaterial color={ad.t} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Standalone pixel scoreboard tower behind the far crowd */}
      <group position={[8.5, 0, full ? -17.5 : -15]}>
        <mesh position={[0, 3, 0]}>
          <boxGeometry args={[0.3, 6, 0.3]} />
          <meshLambertMaterial color="#334155" />
        </mesh>
        <mesh position={[0, 6.6, 0]}>
          <boxGeometry args={[3.4, 2, 0.4]} />
          <meshLambertMaterial color="#0f172a" />
        </mesh>
        <mesh position={[-0.8, 6.9, 0.21]}>
          <planeGeometry args={[1, 0.7]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
        <mesh position={[0.8, 6.9, 0.21]}>
          <planeGeometry args={[1, 0.7]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        <mesh position={[0, 6.1, 0.21]}>
          <planeGeometry args={[2.6, 0.3]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      </group>

      {/* Pixel clouds */}
      {[
        [-18, 17, -35, 5],
        [6, 20, -38, 7],
        [22, 15, -34, 4],
        [-30, 21, -36, 6],
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

      {/* Park trees around the court */}
      <Tree x={-16} z={5} s={1.3} />
      <Tree x={-18} z={-9} s={1.1} />
      <Tree x={17} z={4} s={1.2} />
      <Tree x={18} z={-10} s={1.4} />
      <Tree x={-21} z={0} s={0.9} />
      <Tree x={22} z={-2} s={1} />
      <Tree x={-17} z={12 + zOff} s={1.2} />
      <Tree x={18} z={11 + zOff} s={1} />

      {/* Benches along the sideline */}
      <Bench x={full ? -11.8 : -10.6} z={2} rot={Math.PI / 2} />
      <Bench x={full ? 11.8 : 10.6} z={-8.5} rot={-Math.PI / 2} />

      {/* Floodlights on the corners */}
      <Floodlight x={full ? -12.5 : -11} z={6 + zOff * 1.35} />
      <Floodlight x={full ? 12.5 : 11} z={6 + zOff * 1.35} />
      <Floodlight x={full ? -12.5 : -11} z={full ? -16 : -13} />
      <Floodlight x={full ? 12.5 : 11} z={full ? -16 : -13} />
    </group>
  )
}
