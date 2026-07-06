'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  G,
  RIM,
  RIM_GROUND,
  COURT,
  GRAVITY,
  WIN_SCORE,
  METER_FILL_TIME,
  METER_PERFECT_CENTER,
  distToRim,
  isThree,
  useHud,
  type PlayerData,
} from '@/lib/game'

const V = new THREE.Vector3()
const V2 = new THREE.Vector3()

const OFFENSE_SPOTS = [
  new THREE.Vector3(-6.8, 0, -8.5), // left corner
  new THREE.Vector3(6.8, 0, -8.5), // right corner
  new THREE.Vector3(-5.8, 0, -3), // left wing
  new THREE.Vector3(5.8, 0, -3), // right wing
  new THREE.Vector3(-2.5, 0, 1.5), // left top
  new THREE.Vector3(2.5, 0, 1.5), // right top
]

function clampCourt(p: THREE.Vector3, pad = 0) {
  p.x = Math.max(COURT.minX + pad, Math.min(COURT.maxX - pad, p.x))
  p.z = Math.max(COURT.minZ + pad, Math.min(COURT.maxZ - pad, p.z))
}

function nearestOpponentDist(pl: PlayerData) {
  let best = 99
  for (const o of G.players) {
    if (o.team === pl.team) continue
    const d = o.pos.distanceTo(pl.pos)
    if (d < best) best = d
  }
  return best
}

function setMessage(msg: string, t = 1.8) {
  G.message = msg
  G.messageT = t
}

// ---------- Shooting ----------
function launchShot(shooter: PlayerData, willScore: boolean, points: number) {
  const b = G.ball
  const start = V.set(
    shooter.pos.x,
    shooter.pos.y + 2.15,
    shooter.pos.z,
  ).clone()

  let target: THREE.Vector3
  if (willScore) {
    target = RIM.clone()
    target.y = RIM.y + 0.02
  } else {
    // Aim at the rim edge / slightly off so it clanks
    const ang = Math.random() * Math.PI * 2
    const r = 0.35 + Math.random() * 0.3
    target = RIM.clone().add(
      new THREE.Vector3(Math.cos(ang) * r, 0.05, Math.sin(ang) * r * 0.6),
    )
  }

  const dist = start.distanceTo(target)
  const T = 0.75 + dist * 0.055
  b.vel.set(
    (target.x - start.x) / T,
    (target.y - start.y) / T - 0.5 * GRAVITY * T,
    (target.z - start.z) / T,
  )
  b.pos.copy(start)
  b.state = 'shot'
  b.holder = -1
  b.shotT = 0
  b.shotWillScore = willScore
  b.shotPoints = points
  b.shooterId = shooter.id
  b.scored = false
  b.spin = -0.25
}

function scoreBasket(team: 0 | 1, points: number) {
  G.scores[team] += points
  if (points === 3) setMessage('SPLASH! +3', 2)
  else setMessage(Math.random() > 0.5 ? 'BUCKETS! +2' : 'GOOD! +2', 2)
  if (G.scores[team] >= WIN_SCORE) {
    G.phase = 'over'
    setMessage(team === 0 ? 'YOU WIN!' : 'RED TEAM WINS!', 99)
  } else {
    startReset(team === 0 ? 1 : 0, 1.4)
  }
}

// ---------- Possession reset ("check ball") ----------
let pendingResetTeam: 0 | 1 = 0
function startReset(team: 0 | 1, delay = 1.1) {
  if (G.phase === 'over') return
  pendingResetTeam = team
  G.phase = 'reset'
  G.phaseT = delay
  G.meterActive = false
}

function applyReset() {
  const team = pendingResetTeam
  G.possession = team
  const off = G.players.filter((p) => p.team === team)
  const def = G.players.filter((p) => p.team !== team)

  const handler = off[0]
  handler.pos.set(0, 0, 3.4)
  off[1].pos.set(-5.6, 0, -1.8)
  off[2].pos.set(5.6, 0, -1.8)

  for (const p of G.players) {
    p.vy = 0
    p.grounded = true
    p.anim = 'idle'
    p.dunking = false
    p.facing = Math.PI
    p.aiTimer = 1.5 + Math.random() * 2
  }
  // Defenders line up between their man and the rim
  for (let i = 0; i < 3; i++) {
    const man = off[i]
    V.copy(RIM_GROUND).sub(man.pos).normalize().multiplyScalar(1.4)
    def[i].pos.copy(man.pos).add(V)
    def[i].pos.y = 0
  }

  const b = G.ball
  b.state = 'held'
  b.holder = handler.id
  b.vel.set(0, 0, 0)
  b.scored = false

  G.controlled = team === 0 ? handler.id : nearestOf(0, handler.pos)
  setMessage(team === 0 ? 'YOUR BALL' : 'DEFENSE!', 1.4)
}

function nearestOf(team: 0 | 1, pos: THREE.Vector3) {
  let best = -1
  let bd = 999
  for (const p of G.players) {
    if (p.team !== team) continue
    const d = p.pos.distanceTo(pos)
    if (d < bd) {
      bd = d
      best = p.id
    }
  }
  return best
}

// ---------- Dunk ----------
function startDunk(pl: PlayerData) {
  pl.dunking = true
  pl.dunkT = 0
  pl.dunkFrom.copy(pl.pos)
  pl.anim = 'dunk'
  G.ball.state = 'dunk'
  G.ball.holder = pl.id
  setMessage('DUNK!', 1.2)
}

function updateDunk(pl: PlayerData, dt: number) {
  const DUR = 0.72
  pl.dunkT += dt
  const t = Math.min(pl.dunkT / DUR, 1)
  const landing = V2.set(RIM_GROUND.x, 0, RIM_GROUND.z + 1.1)
  pl.pos.x = THREE.MathUtils.lerp(pl.dunkFrom.x, landing.x, t)
  pl.pos.z = THREE.MathUtils.lerp(pl.dunkFrom.z, landing.z, t)
  pl.pos.y = Math.sin(Math.min(t, 0.9) * Math.PI) * 2.35
  pl.facing = Math.atan2(RIM_GROUND.x - pl.pos.x, RIM_GROUND.z - pl.pos.z)

  const b = G.ball
  if (b.state === 'dunk' && b.holder === pl.id) {
    if (t < 0.62) {
      b.pos.set(pl.pos.x, pl.pos.y + 2.3, pl.pos.z)
      const toRim = V.copy(RIM).sub(b.pos).normalize().multiplyScalar(0.4)
      b.pos.add(toRim)
    } else {
      // Slam it through
      b.state = 'loose'
      b.holder = -1
      b.pos.set(RIM.x, RIM.y - 0.3, RIM.z)
      b.vel.set(0, -4, 0.6)
      scoreBasket(pl.team, 2)
    }
  }
  if (t >= 1) {
    pl.dunking = false
    pl.pos.y = 0
    pl.anim = 'idle'
  }
}

// ---------- Passing ----------
function tryPass(passer: PlayerData) {
  const mates = G.players.filter(
    (p) => p.team === passer.team && p.id !== passer.id,
  )
  if (mates.length === 0) return
  // Prefer the teammate closest to where the passer is facing
  const fwd = V.set(Math.sin(passer.facing), 0, Math.cos(passer.facing))
  let best = mates[0]
  let bs = Number.NEGATIVE_INFINITY
  for (const m of mates) {
    const dir = V2.copy(m.pos).sub(passer.pos).normalize()
    const s = dir.dot(fwd) - m.pos.distanceTo(passer.pos) * 0.02
    if (s > bs) {
      bs = s
      best = m
    }
  }
  const b = G.ball
  b.state = 'pass'
  b.holder = -1
  b.passTo = best.id
  b.pos.set(passer.pos.x, passer.pos.y + 1.3, passer.pos.z)
  b.spin = 0.3
}

// ---------- Main loop component ----------
export default function GameLoop() {
  const keys = useRef<Set<string>>(new Set())
  const spaceHeld = useRef(false)
  const stealCooldown = useRef(0)
  const camInit = useRef(false)
  const { camera } = useThree()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.code
      if (
        [
          'Space',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
        ].includes(k)
      )
        e.preventDefault()

      if (k === 'Space' && !spaceHeld.current) {
        spaceHeld.current = true
        onSpaceDown()
      }
      if (k === 'KeyE') onPassOrSwitch()
      if (k === 'KeyQ') onSteal()
      if (k === 'Enter' && G.phase === 'over') restart()
      keys.current.add(k)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false
        onSpaceUp()
      }
      keys.current.delete(e.code)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function restart() {
    G.scores = [0, 0]
    G.phase = 'reset'
    G.phaseT = 0.5
    pendingResetTeam = 0
    setMessage('FIRST TO 21', 2)
  }

  function onSpaceDown() {
    if (G.phase !== 'play') return
    const me = G.players[G.controlled]
    const b = G.ball

    // Offense with ball: dunk or jump shot
    if (b.state === 'held' && b.holder === me.id) {
      const d = distToRim(me.pos)
      if (d < 2.7) {
        startDunk(me)
      } else {
        // Jump shot with meter
        me.anim = 'shoot'
        me.animT = 0
        me.vy = 6.5
        me.grounded = false
        G.meterActive = true
        G.meterValue = 0
        G.shotDist = d
        const contest = Math.max(0, 1.6 - nearestOpponentDist(me)) / 1.6
        const half = Math.max(
          0.045,
          0.11 - d * 0.005 - contest * 0.045,
        )
        G.meterWindow = [
          METER_PERFECT_CENTER - half,
          METER_PERFECT_CENTER + half,
        ]
      }
      return
    }

    // Defense: jump to contest / block
    if (G.possession !== me.team && me.grounded && !me.dunking) {
      me.vy = 7
      me.grounded = false
      me.anim = 'jump'
      me.animT = 0
      // Block check
      const b2 = G.ball
      if (
        b2.state === 'shot' &&
        b2.shotT < 0.4 &&
        me.pos.distanceTo(b2.pos) < 1.6
      ) {
        b2.state = 'loose'
        b2.shotWillScore = false
        V.copy(b2.pos).sub(RIM).setY(0).normalize()
        b2.vel.set(V.x * 5, 2.5, V.z * 5)
        setMessage('BLOCKED!', 1.5)
      }
    }
  }

  function onSpaceUp() {
    if (!G.meterActive || G.phase !== 'play') return
    releaseUserShot()
  }

  function releaseUserShot() {
    G.meterActive = false
    const me = G.players[G.controlled]
    if (G.ball.holder !== me.id) return
    const v = G.meterValue
    const [lo, hi] = G.meterWindow
    const center = (lo + hi) / 2
    const half = (hi - lo) / 2
    const err = Math.max(0, Math.abs(v - center) - half)
    const contest = Math.max(0, 1.6 - nearestOpponentDist(me)) / 1.6
    let willScore: boolean
    if (err <= 0) {
      willScore = true
      setMessage('PERFECT RELEASE!', 1.2)
    } else {
      const p = Math.max(0.03, 0.7 - err * 5.5 - contest * 0.35)
      willScore = Math.random() < p
    }
    const pts = isThree(me.pos) ? 3 : 2
    launchShot(me, willScore, pts)
  }

  function onPassOrSwitch() {
    if (G.phase !== 'play') return
    const me = G.players[G.controlled]
    const b = G.ball
    if (b.state === 'held' && b.holder === me.id && !G.meterActive) {
      tryPass(me)
    } else if (G.possession !== me.team) {
      // Switch to defender nearest the ball
      const handler = b.holder >= 0 ? G.players[b.holder].pos : b.pos
      G.controlled = nearestOf(me.team, handler)
    }
  }

  function onSteal() {
    if (G.phase !== 'play' || stealCooldown.current > 0) return
    const me = G.players[G.controlled]
    const b = G.ball
    if (G.possession === me.team) return
    stealCooldown.current = 0.9
    if (b.state === 'held' && b.holder >= 0) {
      const h = G.players[b.holder]
      if (h.pos.distanceTo(me.pos) < 1.5 && !h.dunking) {
        if (Math.random() < 0.3) {
          b.state = 'loose'
          b.holder = -1
          b.pos.set(h.pos.x, 1, h.pos.z)
          V.copy(me.pos).sub(h.pos).normalize()
          b.vel.set(V.x * 3 + (Math.random() - 0.5) * 2, 2, V.z * 3)
          setMessage('STEAL!', 1.5)
        }
      }
    }
  }

  // ---------- Per-frame simulation ----------
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    G.time += dt
    if (G.messageT > 0) G.messageT -= dt
    if (stealCooldown.current > 0) stealCooldown.current -= dt

    if (G.phase === 'reset') {
      G.phaseT -= dt
      if (G.phaseT <= 0) {
        applyReset()
        G.phase = 'play'
      }
    }

    if (G.phase === 'play') {
      updateControlledPlayer(dt)
      updateAI(dt)
      for (const p of G.players) {
        if (p.dunking) updateDunk(p, dt)
      }
      updateBall(dt)
    }

    // Gravity / landing for everyone
    for (const p of G.players) {
      if (p.dunking) continue
      if (!p.grounded) {
        p.pos.y += p.vy * dt
        p.vy += GRAVITY * 0.8 * dt
        if (p.pos.y <= 0) {
          p.pos.y = 0
          p.vy = 0
          p.grounded = true
          if (p.anim === 'shoot' || p.anim === 'jump') p.anim = 'idle'
        }
      }
      p.animT += dt
    }

    // Shot meter fill + overfill auto-release
    if (G.meterActive) {
      G.meterValue += dt / METER_FILL_TIME
      if (G.meterValue >= 1) {
        G.meterValue = 1
        releaseUserShot()
      }
    }

    updateCamera(dt)
    syncHud()
  })

  function updateControlledPlayer(dt: number) {
    const me = G.players[G.controlled]
    if (me.dunking) return
    const b = G.ball
    const shooting = me.anim === 'shoot' && !me.grounded

    let mx = 0
    let mz = 0
    const k = keys.current
    if (k.has('KeyW') || k.has('ArrowUp')) mz -= 1
    if (k.has('KeyS') || k.has('ArrowDown')) mz += 1
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1

    if (!shooting && (mx !== 0 || mz !== 0)) {
      const len = Math.hypot(mx, mz)
      mx /= len
      mz /= len
      const sprint = k.has('ShiftLeft') || k.has('ShiftRight')
      const hasBall = b.state === 'held' && b.holder === me.id
      const speed = sprint ? (hasBall ? 6.2 : 6.8) : 4.6
      me.pos.x += mx * speed * dt
      me.pos.z += mz * speed * dt
      clampCourt(me.pos, 0.3)
      me.facing = Math.atan2(mx, mz)
      me.speed = speed
      if (me.grounded) me.anim = 'run'
    } else if (!shooting) {
      me.speed = 0
      if (me.grounded && me.anim === 'run') me.anim = 'idle'
      // Face the rim when holding the ball
      if (b.state === 'held' && b.holder === me.id) {
        me.facing = Math.atan2(
          RIM_GROUND.x - me.pos.x,
          RIM_GROUND.z - me.pos.z,
        )
      }
    }
  }

  function updateAI(dt: number) {
    const b = G.ball
    for (const p of G.players) {
      if (p.id === G.controlled || p.dunking) continue
      if (p.anim === 'shoot') {
        // AI mid-jumpshot: release at apex
        if (b.holder === p.id && p.animT >= 0.32) {
          const d = distToRim(p.pos)
          const contest = Math.max(0, 1.6 - nearestOpponentDist(p)) / 1.6
          const prob = Math.max(0.15, 0.62 - d * 0.03 - contest * 0.35)
          launchShot(p, Math.random() < prob, isThree(p.pos) ? 3 : 2)
        }
        continue
      }

      const onOffense = p.team === G.possession
      if (onOffense && b.state === 'held' && b.holder === p.id) {
        updateAIHandler(p, dt)
      } else if (onOffense) {
        updateAIOffBall(p, dt)
      } else {
        updateAIDefender(p, dt)
      }
    }
  }

  function moveToward(p: PlayerData, target: THREE.Vector3, speed: number, dt: number) {
    V.copy(target).sub(p.pos)
    V.y = 0
    const d = V.length()
    if (d > 0.15) {
      V.normalize()
      p.pos.x += V.x * speed * dt
      p.pos.z += V.z * speed * dt
      p.facing = Math.atan2(V.x, V.z)
      p.speed = speed
      if (p.grounded) p.anim = 'run'
    } else {
      p.speed = 0
      if (p.grounded && p.anim === 'run') p.anim = 'idle'
    }
    clampCourt(p.pos, 0.3)
  }

  function updateAIHandler(p: PlayerData, dt: number) {
    p.aiTimer -= dt
    const d = distToRim(p.pos)
    const defDist = nearestOpponentDist(p)

    // Attack the rim
    if (d < 2.5) {
      startDunk(p)
      return
    }
    if (p.aiTimer <= 0) {
      if (defDist > 1.7 && d < 7.8) {
        // Open jumper
        p.anim = 'shoot'
        p.animT = 0
        p.vy = 6.5
        p.grounded = false
        return
      }
      // Otherwise pass
      tryPass(p)
      p.aiTimer = 2 + Math.random() * 2
      return
    }
    // Drive: head toward rim, drift sideways if defender is tight
    V2.copy(RIM_GROUND).sub(p.pos).normalize()
    if (defDist < 1.2) {
      V2.x += Math.sin(G.time * 2.3 + p.id) * 0.8
      V2.normalize()
    }
    const target = V.copy(p.pos).add(V2.multiplyScalar(2))
    moveToward(p, target, 4.4, dt)
  }

  function updateAIOffBall(p: PlayerData, dt: number) {
    p.aiTimer -= dt
    if (p.aiTimer <= 0) {
      p.spot.copy(
        OFFENSE_SPOTS[Math.floor(Math.random() * OFFENSE_SPOTS.length)],
      )
      p.aiTimer = 2.5 + Math.random() * 2.5
    }
    moveToward(p, p.spot, 3.6, dt)
  }

  function updateAIDefender(p: PlayerData, dt: number) {
    // Guard the matching opponent by index
    const idx = p.id % 3
    const man = G.players.find(
      (o) => o.team !== p.team && o.id % 3 === idx,
    )!
    V2.copy(RIM_GROUND).sub(man.pos)
    V2.y = 0
    const toRim = V2.length()
    V2.normalize().multiplyScalar(Math.min(1.2, toRim * 0.3))
    const target = V.copy(man.pos).add(V2)
    moveToward(p, target, 4.8, dt)
    // Always face the man
    p.facing = Math.atan2(man.pos.x - p.pos.x, man.pos.z - p.pos.z)
    // Contest shots
    if (
      man.anim === 'shoot' &&
      p.grounded &&
      p.pos.distanceTo(man.pos) < 2.1
    ) {
      p.vy = 6.5
      p.grounded = false
      p.anim = 'jump'
      p.animT = 0
    }
  }

  function updateBall(dt: number) {
    const b = G.ball

    if (b.state === 'held' && b.holder >= 0) {
      const h = G.players[b.holder]
      if (h.anim === 'shoot' || h.anim === 'dunk') {
        // Ball overhead while gathering the shot
        b.pos.set(
          h.pos.x + Math.sin(h.facing) * 0.15,
          h.pos.y + 2.05,
          h.pos.z + Math.cos(h.facing) * 0.15,
        )
        b.spin = 0
      } else {
        // Dribble at the right hand
        const side = h.facing + Math.PI / 2.6
        const bounce =
          h.speed > 0.1 || true ? Math.abs(Math.sin(G.time * 9)) * 0.55 : 0.4
        b.pos.set(
          h.pos.x + Math.sin(side) * 0.42 + Math.sin(h.facing) * 0.2,
          h.pos.y + 0.25 + bounce,
          h.pos.z + Math.cos(side) * 0.42 + Math.cos(h.facing) * 0.2,
        )
        b.spin = 0.15
      }
      return
    }

    if (b.state === 'pass') {
      const target = G.players[b.passTo]
      V.set(target.pos.x, target.pos.y + 1.25, target.pos.z).sub(b.pos)
      const d = V.length()
      const step = 15 * dt
      // Interception check
      for (const o of G.players) {
        if (o.team === target.team) continue
        if (o.pos.clone().setY(b.pos.y).distanceTo(b.pos) < 0.55) {
          b.state = 'held'
          b.holder = o.id
          onPossessionGained(o)
          setMessage('INTERCEPTED!', 1.5)
          return
        }
      }
      if (d <= step + 0.35) {
        b.state = 'held'
        b.holder = target.id
        onPossessionGained(target)
      } else {
        V.normalize().multiplyScalar(step)
        b.pos.add(V)
      }
      return
    }

    if (b.state === 'shot') {
      b.shotT += dt
      b.pos.addScaledVector(b.vel, dt)
      b.vel.y += GRAVITY * dt

      const shooter = G.players[b.shooterId]
      if (b.shotWillScore) {
        if (b.vel.y < 0 && b.pos.y <= RIM.y - 0.05) {
          scoreBasket(shooter.team as 0 | 1, b.shotPoints)
          b.state = 'loose'
          b.pos.set(RIM.x, RIM.y - 0.4, RIM.z)
          b.vel.set(0, -2.5, 0.3)
        }
      } else {
        // Backboard
        if (b.pos.z < -9.95 && b.pos.y > 2.9 && b.pos.y < 4.4 && Math.abs(b.pos.x) < 1.25) {
          b.pos.z = -9.95
          b.vel.z = Math.abs(b.vel.z) * 0.5
          b.state = 'loose'
        }
        // Rim clank
        const dr = b.pos.distanceTo(RIM)
        if (dr < 0.6 && b.shotT > 0.25) {
          const ang = Math.random() * Math.PI * 2
          b.state = 'loose'
          b.vel.set(
            Math.cos(ang) * (2 + Math.random() * 2.5),
            2.5 + Math.random() * 2,
            Math.abs(Math.sin(ang)) * (2 + Math.random() * 2.5),
          )
          setMessage('OFF THE RIM!', 1.2)
        }
        if (b.pos.y < 0.2) b.state = 'loose'
      }
      return
    }

    if (b.state === 'loose') {
      b.pos.addScaledVector(b.vel, dt)
      b.vel.y += GRAVITY * dt
      b.spin = b.vel.length() * 0.03
      // Floor bounce
      if (b.pos.y < 0.17) {
        b.pos.y = 0.17
        b.vel.y = Math.abs(b.vel.y) * 0.55
        b.vel.x *= 0.8
        b.vel.z *= 0.8
        if (Math.abs(b.vel.y) < 0.6) b.vel.y = 0
      }
      // Keep in playable area
      if (b.pos.x < COURT.minX || b.pos.x > COURT.maxX) {
        b.pos.x = THREE.MathUtils.clamp(b.pos.x, COURT.minX, COURT.maxX)
        b.vel.x *= -0.6
      }
      if (b.pos.z < COURT.minZ || b.pos.z > COURT.maxZ) {
        b.pos.z = THREE.MathUtils.clamp(b.pos.z, COURT.minZ, COURT.maxZ)
        b.vel.z *= -0.6
      }
      // Pickup (not during score reset)
      if (G.phase === 'play' && b.pos.y < 1.5) {
        for (const p of G.players) {
          if (p.dunking || p.anim === 'shoot') continue
          if (p.pos.clone().setY(0).distanceTo(V.set(b.pos.x, 0, b.pos.z)) < 0.7) {
            b.state = 'held'
            b.holder = p.id
            b.vel.set(0, 0, 0)
            onPossessionGained(p)
            break
          }
        }
      }
      return
    }
  }

  function onPossessionGained(p: PlayerData) {
    const prev = G.possession
    if (p.team !== prev) {
      // Turnover / defensive rebound: check ball
      setMessage(p.team === 0 ? 'REBOUND! YOUR BALL' : 'RED BALL!', 1.3)
      startReset(p.team as 0 | 1, 1.0)
    } else {
      G.possession = p.team as 0 | 1
      if (p.team === 0) {
        G.controlled = p.id
      } else {
        G.controlled = nearestOf(0, p.pos)
      }
      p.aiTimer = 2 + Math.random() * 2
    }
  }

  function updateCamera(dt: number) {
    const b = G.ball
    const fx = THREE.MathUtils.clamp(b.pos.x, -6, 6)
    const fz = THREE.MathUtils.clamp(b.pos.z, -10, 4.5)

    V.set(fx * 0.5, 7.4, fz * 0.42 + 11)
    V2.set(fx * 0.65, 1.1, fz * 0.55 - 3.2)

    if (!camInit.current) {
      G.camPos.copy(V)
      G.camLook.copy(V2)
      camInit.current = true
    } else {
      G.camPos.lerp(V, 1 - Math.exp(-3.5 * dt))
      G.camLook.lerp(V2, 1 - Math.exp(-3.5 * dt))
    }
    camera.position.copy(G.camPos)
    camera.lookAt(G.camLook)
  }

  function syncHud() {
    const hud = useHud.getState()
    const patch: Record<string, unknown> = {}
    if (
      hud.scores[0] !== G.scores[0] ||
      hud.scores[1] !== G.scores[1]
    )
      patch.scores = [...G.scores] as [number, number]
    if (hud.possession !== G.possession) patch.possession = G.possession
    if (hud.meterActive !== G.meterActive) {
      patch.meterActive = G.meterActive
      patch.meterWindow = [...G.meterWindow] as [number, number]
    }
    if (G.meterActive && hud.meterValue !== G.meterValue)
      patch.meterValue = G.meterValue
    const msg = G.messageT > 0 ? G.message : ''
    if (hud.message !== msg) patch.message = msg
    const over = G.phase === 'over'
    if (hud.over !== over) {
      patch.over = over
      patch.winner = G.scores[0] > G.scores[1] ? 0 : 1
    }
    if (Object.keys(patch).length > 0) hud.setHud(patch)
  }

  return null
}
