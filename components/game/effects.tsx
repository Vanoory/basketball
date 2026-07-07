'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FX, type FxEvent } from '@/lib/game'

// Pooled pixel-particle system. The game loop pushes events into FX.queue
// and this component turns them into bursts of chunky voxel particles plus
// expanding shockwave rings - all without allocations during play.

const MAX_PARTICLES = 160
const MAX_RINGS = 6

interface Particle {
  pos: THREE.Vector3
  vel: THREE.Vector3
  life: number
  maxLife: number
  size: number
  gravity: number
  spin: number
  color: THREE.Color
}

interface Ring {
  pos: THREE.Vector3
  life: number
  maxLife: number
  startScale: number
  endScale: number
  color: THREE.Color
  horizontal: boolean
}

const DUNK_COLORS = ['#f97316', '#fbbf24', '#fde047', '#fff7ed']
const SCORE_COLORS = ['#4ade80', '#fde047', '#f8fafc', '#fb923c']
const DUST_COLORS = ['#94a3b8', '#a8a29e', '#cbd5e1']
const ANKLE_COLORS = ['#fde047', '#facc15', '#fef9c3']
const BLOCK_COLORS = ['#93c5fd', '#f8fafc', '#60a5fa']

export default function Effects() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const ringRefs = useRef<(THREE.Mesh | null)[]>([])

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: MAX_PARTICLES }, () => ({
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 0.1,
        gravity: 0,
        spin: 0,
        color: new THREE.Color(),
      })),
    [],
  )
  const rings = useMemo<Ring[]>(
    () =>
      Array.from({ length: MAX_RINGS }, () => ({
        pos: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        startScale: 0.2,
        endScale: 2,
        color: new THREE.Color('#ffffff'),
        horizontal: false,
      })),
    [],
  )
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const cursor = useRef(0)
  const ringCursor = useRef(0)

  function spawn(
    pos: THREE.Vector3,
    count: number,
    colors: string[],
    opts: {
      speed: number
      up: number
      gravity: number
      life: number
      size: number
      spread?: number
    },
  ) {
    for (let i = 0; i < count; i++) {
      const p = particles[cursor.current]
      cursor.current = (cursor.current + 1) % MAX_PARTICLES
      const ang = Math.random() * Math.PI * 2
      const sp = opts.speed * (0.4 + Math.random() * 0.8)
      p.pos.copy(pos)
      if (opts.spread) {
        p.pos.x += (Math.random() - 0.5) * opts.spread
        p.pos.z += (Math.random() - 0.5) * opts.spread
      }
      p.vel.set(
        Math.cos(ang) * sp,
        opts.up * (0.5 + Math.random() * 0.9),
        Math.sin(ang) * sp,
      )
      p.maxLife = opts.life * (0.7 + Math.random() * 0.6)
      p.life = p.maxLife
      p.size = opts.size * (0.7 + Math.random() * 0.7)
      p.gravity = opts.gravity
      p.spin = (Math.random() - 0.5) * 12
      p.color.set(colors[Math.floor(Math.random() * colors.length)])
    }
  }

  function spawnRing(
    pos: THREE.Vector3,
    color: string,
    endScale: number,
    life: number,
    horizontal = false,
  ) {
    const r = rings[ringCursor.current]
    ringCursor.current = (ringCursor.current + 1) % MAX_RINGS
    r.pos.copy(pos)
    r.maxLife = life
    r.life = life
    r.startScale = 0.25
    r.endScale = endScale
    r.color.set(color)
    r.horizontal = horizontal
  }

  function handleEvent(e: FxEvent) {
    switch (e.type) {
      case 'dunk':
        spawn(e.pos, 26, DUNK_COLORS, {
          speed: 4.5,
          up: 3.2,
          gravity: -11,
          life: 0.55,
          size: 0.11,
        })
        spawnRing(e.pos, '#fbbf24', 3.4, 0.4)
        spawnRing(e.pos, '#fff7ed', 2.2, 0.28)
        break
      case 'score':
        spawn(e.pos, 16, e.color ? [e.color, '#f8fafc', '#fde047'] : SCORE_COLORS, {
          speed: 1.6,
          up: 1.6,
          gravity: -5,
          life: 0.9,
          size: 0.09,
        })
        break
      case 'score3':
        spawn(e.pos, 30, e.color ? [e.color, '#f8fafc', '#fde047', '#4ade80'] : SCORE_COLORS, {
          speed: 2.6,
          up: 2.4,
          gravity: -5,
          life: 1.1,
          size: 0.1,
        })
        spawnRing(e.pos, e.color ?? '#4ade80', 2.6, 0.45)
        break
      case 'land':
        spawn(e.pos, 7, DUST_COLORS, {
          speed: 1.7,
          up: 0.7,
          gravity: -3,
          life: 0.4,
          size: 0.09,
          spread: 0.3,
        })
        break
      case 'dust':
        spawn(e.pos, 3, DUST_COLORS, {
          speed: 0.8,
          up: 0.5,
          gravity: -2,
          life: 0.33,
          size: 0.07,
          spread: 0.25,
        })
        break
      case 'ankle':
        spawn(e.pos, 10, ANKLE_COLORS, {
          speed: 1.4,
          up: 1.4,
          gravity: -4,
          life: 0.7,
          size: 0.1,
        })
        spawnRing(new THREE.Vector3(e.pos.x, 0.05, e.pos.z), '#fde047', 2.0, 0.4, true)
        break
      case 'block':
        spawn(e.pos, 14, BLOCK_COLORS, {
          speed: 3.4,
          up: 2.0,
          gravity: -9,
          life: 0.45,
          size: 0.1,
        })
        spawnRing(e.pos, '#93c5fd', 2.0, 0.3)
        break
    }
  }

  useFrame((_, dt) => {
    // Drain the event queue
    while (FX.queue.length > 0) {
      const e = FX.queue.pop()
      if (e) handleEvent(e)
    }

    const im = mesh.current
    if (im) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particles[i]
        if (p.life > 0) {
          p.life -= dt
          p.vel.y += p.gravity * dt
          p.pos.addScaledVector(p.vel, dt)
          if (p.pos.y < 0.03) {
            p.pos.y = 0.03
            p.vel.y = 0
            p.vel.x *= 0.85
            p.vel.z *= 0.85
          }
          const f = Math.max(p.life / p.maxLife, 0)
          dummy.position.copy(p.pos)
          dummy.rotation.set(p.spin * p.life, p.spin * p.life * 0.7, 0)
          dummy.scale.setScalar(p.size * (0.35 + f * 0.65))
          dummy.updateMatrix()
          im.setMatrixAt(i, dummy.matrix)
          im.setColorAt(i, p.color)
        } else {
          dummy.position.set(0, -50, 0)
          dummy.scale.setScalar(0.001)
          dummy.updateMatrix()
          im.setMatrixAt(i, dummy.matrix)
        }
      }
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
    }

    for (let i = 0; i < MAX_RINGS; i++) {
      const r = rings[i]
      const m = ringRefs.current[i]
      if (!m) continue
      if (r.life > 0) {
        r.life -= dt
        const t = 1 - Math.max(r.life / r.maxLife, 0)
        const s = r.startScale + (r.endScale - r.startScale) * (1 - (1 - t) * (1 - t))
        m.visible = true
        m.position.copy(r.pos)
        m.rotation.set(r.horizontal ? -Math.PI / 2 : 0, 0, 0)
        m.scale.setScalar(s)
        const mat = m.material as THREE.MeshBasicMaterial
        mat.color.copy(r.color)
        mat.opacity = (1 - t) * 0.85
      } else {
        m.visible = false
      }
    }
  })

  return (
    <group>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, MAX_PARTICLES]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {Array.from({ length: MAX_RINGS }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            ringRefs.current[i] = el
          }}
          visible={false}
        >
          <ringGeometry args={[0.82, 1, 20]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}
