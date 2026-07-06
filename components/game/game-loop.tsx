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
  STUN_TIME,
  distToRim,
  isThree,
  useHud,
  type PlayerData,
} from '@/lib/game'

const V = new THREE.Vector3()
const V2 = new THREE.Vector3()
const V3 = new THREE.Vector3()

const OFFENSE_SPOTS = [
  new THREE.Vector3(-6.9, 0, -8.6), // left corner
  new THREE.Vector3(6.9, 0, -8.6), // right corner
  new THREE.Vector3(-6.2, 0, -4.2), // left wing
  new THREE.Vector3(6.2, 0, -4.2), // right wing
  new THREE.Vector3(-3.2, 0, 0.5), // left top
  new THREE.Vector3(3.2, 0, 0.5), // right top
  new THREE.Vector3(0, 0, 1.8), // top of key
]

function clampCourt(p: THREE.Vector3, pad = 0) {
  p.x = Math.max(COURT.minX + pad, Math.min(COURT.maxX - pad, p.x))
  p.z = Math.max(COURT.minZ + pad, Math.min(COURT.maxZ - pad, p.z))
}

function nearestOpponentDist(pl: PlayerData) {
  let best = 99
  for (const o of G.players) {
    if (o.team === pl.team || o.stunT > 0) continue
    const d = o.pos.distanceTo(pl.pos)
    if (d < best) best = d
  }
  return best
}

function setMessage(msg: string, t = 1.8) {
  G.message = msg
  G.messageT = t
}

// ---------- Momentum movement ----------
// Every player moves through velocity + acceleration so direction changes
// take real time. This is what makes defenders "shakeable".
function applyMove(
  p: PlayerData,
  dirX: number,
  dirZ: number,
  maxSpeed: number,
  accel: number,
  dt: number,
) {
  const targetVx = dirX * maxSpeed
  const targetVz = dirZ * maxSpeed
  const k = Math.min(1, accel * dt)
  p.vel.x += (targetVx - p.vel.x) * k
  p.vel.z += (targetVz - p.vel.z) * k
  p.pos.x += p.vel.x * dt
  p.pos.z += p.vel.z * dt
  p.speed = Math.hypot(p.vel.x, p.vel.z)
  clampCourt(p.pos, 0.3)
  if (p.speed > 0.6) {
    p.facing = Math.atan2(p.vel.x, p.vel.z)
  }
}

function steerToward(
  p: PlayerData,
  target: THREE.Vector3,
  maxSpeed: number,
  accel: number,
  dt: number,
  stopDist = 0.18,
) {
  V.copy(target).sub(p.pos)
  V.y = 0
  const d = V.length()
  if (d > stopDist) {
    V.normalize()
    // Slow into the target so players don't orbit around spots
    const sp = Math.min(maxSpeed, d * 4 + 0.5)
    applyMove(p, V.x, V.z, sp, accel, dt)
    if (p.grounded && p.stunT <= 0 && p.speed > 1.2 && p.anim !== 'shuffle')
      p.anim = 'run'
  } else {
    applyMove(p, 0, 0, 0, accel * 1.4, dt)
    if (p.grounded && p.anim === 'run') p.anim = 'idle'
  }
  return d
}

// ---------- Body collisions (screens work because bodies are solid) ----------
const PLAYER_RADIUS = 0.38
function resolvePlayerCollisions() {
  const R2 = PLAYER_RADIUS * 2
  for (let i = 0; i < G.players.length; i++) {
    const a = G.players[i]
    if (a.stunT > 0 || a.dunking || !a.grounded) continue
    for (let j = i + 1; j < G.players.length; j++) {
      const b = G.players[j]
      if (b.stunT > 0 || b.dunking || !b.grounded) continue
      let dx = b.pos.x - a.pos.x
      let dz = b.pos.z - a.pos.z
      const d = Math.hypot(dx, dz)
      if (d >= R2 || d < 0.0001) continue
      dx /= d
      dz /= d
      const push = (R2 - d) / 2
      a.pos.x -= dx * push
      a.pos.z -= dz * push
      b.pos.x += dx * push
      b.pos.z += dz * push
      clampCourt(a.pos, 0.3)
      clampCourt(b.pos, 0.3)

      // Kill velocity into each other (bodies are solid)
      const avn = a.vel.x * dx + a.vel.z * dz
      if (avn > 0) {
        a.vel.x -= dx * avn * 0.85
        a.vel.z -= dz * avn * 0.85
      }
      const bvn = b.vel.x * dx + b.vel.z * dz
      if (bvn < 0) {
        b.vel.x -= dx * bvn * 0.85
        b.vel.z -= dz * bvn * 0.85
      }

      // SCREEN: a defender slamming into a near-stationary offensive body
      // (not the handler) gets stuck on it for a moment.
      hitScreenCheck(a, b, avn)
      hitScreenCheck(b, a, -bvn)
    }
  }
}

function hitScreenCheck(runner: PlayerData, wall: PlayerData, vInto: number) {
  if (runner.team === wall.team) return
  if (runner.team === G.possession) return // runner must be a defender
  if (wall.id === G.ball.holder) return // the handler is not a screener
  if (Math.hypot(wall.vel.x, wall.vel.z) > 2.4) return // screener must be set
  if (vInto < 1.1) return // needs closing speed to get "caught"
  if (runner.screenedT > 0) return
  runner.screenedT = 0.45 + Math.min(vInto * 0.09, 0.45)
  runner.reactT = Math.max(runner.reactT, 0.35) // loses track of his man
  if (runner.id !== G.controlled && Math.random() < 0.4)
    setMessage('SCREEN!', 0.9)
}

// ---------- Knockdown (ankle breaker) ----------
function knockDown(def: PlayerData, msg = 'ANKLES GONE!') {
  if (def.stunT > 0 || !def.grounded || def.dunking) return
  def.stunT = STUN_TIME
  def.ankleCd = 3.2
  def.anim = 'fall'
  def.animT = 0
  def.vel.multiplyScalar(0.15)
  G.camShake = 0.25
  setMessage(msg, 1.6)
}

// A sharp direction change by the ball handler near a defender can drop him.
// Sharper cut + faster defender momentum = higher chance.
function tryAnkleBreak(handler: PlayerData, newDirX: number, newDirZ: number) {
  if (handler.speed < 2.8) return
  const vlen = Math.hypot(handler.vel.x, handler.vel.z)
  if (vlen < 0.1) return
  const dot =
    (handler.vel.x / vlen) * newDirX + (handler.vel.z / vlen) * newDirZ
  if (dot > -0.2) return // not a sharp cut

  for (const def of G.players) {
    if (
      def.team === handler.team ||
      def.stunT > 0 ||
      def.stumbleT > 0 ||
      def.ankleCd > 0
    )
      continue
    const d = def.pos.distanceTo(handler.pos)
    if (d > 2.1) continue
    const defSpeed = Math.hypot(def.vel.x, def.vel.z)
    const sharpness = -dot // 0.2..1
    // The human player is much harder to shake: he only goes down when
    // sprinting into a truly vicious cut, and gets longer immunity after.
    const isUser = def.id === G.controlled
    // Full knockdown needs a committed (moving) defender + sharp cut.
    // A staggering stumble can happen even against a set defender.
    let fallChance =
      defSpeed < 2.0
        ? 0
        : 0.08 + sharpness * 0.18 + Math.min(defSpeed / 16, 0.14)
    let stumbleChance = 0.2 + sharpness * 0.22
    if (isUser) {
      fallChance = defSpeed < 4.2 ? 0 : fallChance * 0.2
      stumbleChance *= 0.25
    }
    def.ankleCd = isUser ? 3.0 : 2.2 // even on a miss, brief immunity
    const roll = Math.random()
    if (roll < fallChance) {
      knockDown(def)
      handler.crossLean = newDirX * 0.5
    } else if (roll < stumbleChance) {
      def.stumbleT = 0.55 + sharpness * 0.3
      def.anim = 'stumble'
      def.animT = 0
      def.vel.multiplyScalar(0.25)
      handler.crossLean = newDirX * 0.4
    }
  }
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

function scoreBasket(team: 0 | 1, points: number, scorer?: PlayerData) {
  G.scores[team] += points
  if (points === 3) setMessage('SPLASH! +3', 2)
  else setMessage(Math.random() > 0.5 ? 'BUCKETS! +2' : 'GOOD! +2', 2)
  if (scorer) {
    scorer.celebrateT = 1.3
  }
  if (G.scores[team] >= WIN_SCORE) {
    G.phase = 'over'
    setMessage(team === 0 ? 'YOU WIN!' : 'RED TEAM WINS!', 99)
  } else {
    // No stoppage: the other team takes the ball under the rim and
    // must clear it beyond the arc before attacking.
    const other = (team === 0 ? 1 : 0) as 0 | 1
    G.possession = other
    G.mustClear = true
    G.inboundTeam = other
    if (other === 0) {
      G.controlled = nearestOf(0, RIM_GROUND)
    }
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
    p.stunT = 0
    p.ankleCd = 0
    p.helpDef = false
    p.cutting = false
    p.celebrateT = 0
    p.screenedT = 0
    p.trailing = false
    p.vel.set(0, 0, 0)
    p.facing = Math.PI
    p.aiTimer = 1.5 + Math.random() * 2
    p.reactT = 0
  }
  // Defenders line up between their man and the rim
  for (let i = 0; i < 3; i++) {
    const man = off[i]
    V.copy(RIM_GROUND).sub(man.pos).normalize().multiplyScalar(1.4)
    def[i].pos.copy(man.pos).add(V)
    def[i].pos.y = 0
    def[i].reactTarget.copy(def[i].pos)
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
      b.state = 'loose'
      b.holder = -1
      b.pos.set(RIM.x, RIM.y - 0.3, RIM.z)
      b.vel.set(0, -4, 0.6)
      G.camShake = 0.35
      scoreBasket(pl.team, 2, pl)
    }
  }
  if (t >= 1) {
    pl.dunking = false
    pl.pos.y = 0
    pl.anim = 'idle'
  }
}

// ---------- Passing ----------
function tryPass(passer: PlayerData, preferId = -1) {
  const mates = G.players.filter(
    (p) => p.team === passer.team && p.id !== passer.id && p.stunT <= 0,
  )
  if (mates.length === 0) return
  let best = mates[0]
  if (preferId >= 0) {
    best = G.players[preferId]
  } else {
    const fwd = V.set(Math.sin(passer.facing), 0, Math.cos(passer.facing))
    let bs = Number.NEGATIVE_INFINITY
    for (const m of mates) {
      const dir = V2.copy(m.pos).sub(passer.pos).normalize()
      const openness = nearestOpponentDist(m)
      const s =
        dir.dot(fwd) * 0.8 +
        openness * 0.25 -
        m.pos.distanceTo(passer.pos) * 0.02
      if (s > bs) {
        bs = s
        best = m
      }
    }
  }
  const b = G.ball
  b.state = 'pass'
  b.holder = -1
  b.passTo = best.id
  b.pos.set(passer.pos.x, passer.pos.y + 1.3, passer.pos.z)
  b.spin = 0.3
  passer.anim = 'pass'
  passer.animT = 0
}

// Openness score for a teammate = distance to nearest defender
function opennessOf(p: PlayerData) {
  return nearestOpponentDist(p)
}

// ---------- Block resolution (works for user AND AI jumpers) ----------
function rejectBall(p: PlayerData, msgUser: string, msgRed: string) {
  const b = G.ball
  b.state = 'loose'
  b.holder = -1
  b.shotWillScore = false
  V2.copy(b.pos).sub(RIM).setY(0)
  if (V2.lengthSq() < 0.01) V2.set(0, 0, 1)
  V2.normalize()
  b.vel.set(V2.x * 5.5, 2.4, V2.z * 5.5)
  p.anim = 'block'
  p.animT = 0
  G.camShake = 0.32
  setMessage(p.team === 0 ? msgUser : msgRed, 1.6)
}

function checkBlocks() {
  const b = G.ball

  // Jump shots: swattable early in flight
  if (b.state === 'shot' && b.shotT <= 0.45) {
    const shooter = G.players[b.shooterId]
    for (const p of G.players) {
      if (p.team === shooter.team || p.grounded || p.stunT > 0) continue
      // Hand position at the top of the jump
      V.set(p.pos.x, p.pos.y + 2.35, p.pos.z)
      if (V.distanceTo(b.pos) < 0.95) {
        rejectBall(p, 'REJECTED!', 'BLOCKED BY RED!')
        return
      }
    }
    return
  }

  // Dunks: meet the ball at the rim before the slam finishes
  if (b.state === 'dunk' && b.holder >= 0) {
    const dunker = G.players[b.holder]
    if (dunker.dunkT < 0.18 || dunker.dunkT > 0.55) return
    for (const p of G.players) {
      if (p.team === dunker.team || p.grounded || p.stunT > 0) continue
      V.set(p.pos.x, p.pos.y + 2.35, p.pos.z)
      if (V.distanceTo(b.pos) < 1.0) {
        rejectBall(p, 'DUNK DENIED!', 'DENIED AT THE RIM!')
        return
      }
    }
  }
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
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          k,
        )
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
    if (me.stunT > 0) return
    const b = G.ball

    // Offense with ball: dunk or jump shot
    if (b.state === 'held' && b.holder === me.id) {
      if (G.mustClear && !isThree(me.pos)) {
        setMessage('CLEAR IT PAST THE ARC!', 1.0)
        return
      }
      const d = distToRim(me.pos)
      if (d < 2.7) {
        startDunk(me)
      } else {
        me.anim = 'shoot'
        me.animT = 0
        me.vy = 6.5
        me.grounded = false
        const moveSpeed = me.speed
        me.vel.multiplyScalar(0.25)
        G.meterActive = true
        G.meterValue = 0
        G.shotDist = d
        const contest = Math.max(0, 1.6 - nearestOpponentDist(me)) / 1.6
        // Green window shrinks with: distance, contest, and shooting on
        // the move. A sprinting contested deep three is a sliver; a set
        // open mid-range look is generous.
        const half = Math.max(
          0.022,
          0.115 - d * 0.005 - contest * 0.04 - moveSpeed * 0.0085,
        )
        G.meterWindow = [
          METER_PERFECT_CENTER - half,
          METER_PERFECT_CENTER + half,
        ]
      }
      return
    }

    // Defense: jump to contest / block (resolution happens in checkBlocks)
    if (G.possession !== me.team && me.grounded && !me.dunking) {
      me.vy = 7.2
      me.grounded = false
      me.anim = 'block'
      me.animT = 0
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
      const handler = b.holder >= 0 ? G.players[b.holder].pos : b.pos
      G.controlled = nearestOf(me.team, handler)
    }
  }

  function onSteal() {
    if (G.phase !== 'play' || stealCooldown.current > 0) return
    const me = G.players[G.controlled]
    if (me.stunT > 0) return
    const b = G.ball
    if (G.possession === me.team) return
    stealCooldown.current = 0.9
    me.anim = 'steal'
    me.animT = 0
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
    if (G.camShake > 0) G.camShake = Math.max(0, G.camShake - dt * 1.2)

    // Timers on every player
    for (const p of G.players) {
      if (p.stunT > 0) {
        p.stunT -= dt
        if (p.stunT <= 0) {
          p.stunT = 0
          p.anim = 'idle'
        }
      }
      if (p.stumbleT > 0) {
        p.stumbleT -= dt
        if (p.stumbleT <= 0) {
          p.stumbleT = 0
          if (p.anim === 'stumble') p.anim = 'idle'
        }
      }
      if (p.ankleCd > 0) p.ankleCd -= dt
      if (p.screenedT > 0) p.screenedT -= dt
      if (p.celebrateT > 0) {
        p.celebrateT -= dt
        if (p.grounded && p.stunT <= 0 && !p.dunking) p.anim = 'celebrate'
        if (p.celebrateT <= 0 && p.anim === 'celebrate') p.anim = 'idle'
      }
      if (p.anim === 'pass' && p.animT > 0.32) p.anim = 'idle'
      if (p.anim === 'steal' && p.animT > 0.35) p.anim = 'idle'
      p.crossLean *= Math.exp(-6 * dt)
    }

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
      resolvePlayerCollisions()
      checkBlocks()
      updateBall(dt)

      // "Clear the ball" rule: new possession must take it beyond the arc
      if (G.mustClear && G.ball.state === 'held' && G.ball.holder >= 0) {
        const h = G.players[G.ball.holder]
        if (h.team === G.possession && isThree(h.pos)) {
          G.mustClear = false
          setMessage('BALL IN - GO!', 1.1)
        }
      }
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
          if (p.anim === 'shoot' || p.anim === 'jump' || p.anim === 'block')
            p.anim = 'idle'
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
    if (me.dunking || me.stunT > 0) return
    if (me.stumbleT > 0) {
      applyMove(me, 0, 0, 0, 14, dt)
      return
    }
    const b = G.ball
    const shooting = me.anim === 'shoot' && !me.grounded

    let mx = 0
    let mz = 0
    const k = keys.current
    if (k.has('KeyW') || k.has('ArrowUp')) mz -= 1
    if (k.has('KeyS') || k.has('ArrowDown')) mz += 1
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1

    const hasBall = b.state === 'held' && b.holder === me.id

    if (!shooting && (mx !== 0 || mz !== 0)) {
      const len = Math.hypot(mx, mz)
      mx /= len
      mz /= len
      // Sharp cut with the ball near a defender = ankle-break chance
      if (hasBall) tryAnkleBreak(me, mx, mz)
      const sprint = k.has('ShiftLeft') || k.has('ShiftRight')
      const speed = sprint ? (hasBall ? 6.4 : 7) : 4.6
      applyMove(me, mx, mz, speed, 12, dt)
      if (me.grounded) me.anim = 'run'
    } else if (!shooting) {
      applyMove(me, 0, 0, 0, 16, dt)
      if (me.grounded && me.anim === 'run') me.anim = 'idle'
      if (hasBall) {
        me.facing = Math.atan2(
          RIM_GROUND.x - me.pos.x,
          RIM_GROUND.z - me.pos.z,
        )
      }
    }
  }

  function updateAI(dt: number) {
    const b = G.ball

    // Loose ball: nearest AI player from each team hustles for it
    let chaser0 = -1
    let chaser1 = -1
    if (b.state === 'loose') {
      let d0 = 999
      let d1 = 999
      for (const p of G.players) {
        if (p.dunking || p.stunT > 0 || p.anim === 'shoot') continue
        // After a made basket only the inbounding team hustles for the ball
        if (G.inboundTeam >= 0 && p.team !== G.inboundTeam) continue
        const d = p.pos.distanceTo(b.pos)
        if (p.team === 0 && d < d0) {
          d0 = d
          chaser0 = p.id
        }
        if (p.team === 1 && d < d1) {
          d1 = d
          chaser1 = p.id
        }
      }
    }

    for (const p of G.players) {
      if (p.id === G.controlled || p.dunking || p.stunT > 0) continue
      if (p.stumbleT > 0) {
        // Staggered: can't pursue, just bleed momentum
        applyMove(p, 0, 0, 0, 14, dt)
        continue
      }
      if (b.state === 'loose' && (p.id === chaser0 || p.id === chaser1)) {
        V3.set(b.pos.x, 0, b.pos.z)
        steerToward(p, V3, 6.6, 10, dt, 0.1)
        continue
      }
      if (p.anim === 'shoot') {
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

  // ---------- AI: ball handler ----------
  function updateAIHandler(p: PlayerData, dt: number) {
    p.aiTimer -= dt
    const d = distToRim(p.pos)
    const defDist = nearestOpponentDist(p)

    // Clear the ball first: dribble it out beyond the arc, or hit a
    // teammate already spotted up outside for the quick three look.
    if (G.mustClear && !isThree(p.pos)) {
      let outMate: PlayerData | null = null
      let bestOpen = 0
      for (const m of G.players) {
        if (m.team !== p.team || m.id === p.id || m.stunT > 0) continue
        if (!isThree(m.pos)) continue
        const o = opennessOf(m)
        if (o > bestOpen) {
          bestOpen = o
          outMate = m
        }
      }
      if (outMate && bestOpen > 1.6 && Math.random() < 0.02) {
        tryPass(p, outMate.id)
        return
      }
      // Dribble straight out past the arc
      V2.set(p.pos.x * 0.55, 0, 6.2)
      steerToward(p, V2.setY(0), 6.2, 9, dt, 0.4)
      if (p.grounded) p.anim = 'run'
      return
    }

    // Attack the rim
    if (d < 2.5 && !G.mustClear) {
      startDunk(p)
      return
    }

    // Find the most open teammate for a potential kick-out
    let openMate: PlayerData | null = null
    let bestOpen = 0
    for (const m of G.players) {
      if (m.team !== p.team || m.id === p.id || m.stunT > 0) continue
      const o = opennessOf(m)
      if (o > bestOpen) {
        bestOpen = o
        openMate = m
      }
    }

    if (p.aiTimer <= 0) {
      // Open jumper
      if (defDist > 1.8 && d < 8) {
        p.anim = 'shoot'
        p.animT = 0
        p.vy = 6.5
        p.grounded = false
        p.vel.multiplyScalar(0.25)
        return
      }
      // Kick out to a wide-open teammate when pressured
      if (defDist < 1.3 && openMate && bestOpen > 2.4) {
        tryPass(p, openMate.id)
        p.aiTimer = 1.6 + Math.random() * 1.5
        return
      }
      // Otherwise reset the clock and keep working
      p.aiTimer = 1.2 + Math.random() * 1.4
    }

    // Dribble attack with real crossover moves
    V2.copy(RIM_GROUND).sub(p.pos).normalize()
    if (defDist < 1.4) {
      // Hard lateral cut - can drop the defender via the same ankle system
      const side = Math.sin(G.time * 3.1 + p.id * 2) > 0 ? 1 : -1
      const cutX = V2.z * side
      const cutZ = -V2.x * side
      const mixX = V2.x * 0.35 + cutX * 0.9
      const mixZ = V2.z * 0.35 + cutZ * 0.9
      const len = Math.hypot(mixX, mixZ)
      tryAnkleBreak(p, mixX / len, mixZ / len)
      applyMove(p, mixX / len, mixZ / len, 5.6, 9, dt)
      p.crossLean = side * 0.3
    } else {
      applyMove(p, V2.x, V2.z, 5.2, 8, dt)
    }
    if (p.grounded) p.anim = 'run'
  }

  // ---------- AI: off-ball offense (get open!) ----------
  function updateAIOffBall(p: PlayerData, dt: number) {
    p.aiTimer -= dt
    const b = G.ball
    const handler = b.holder >= 0 ? G.players[b.holder] : null
    const myOpen = opennessOf(p)

    if (p.aiTimer <= 0) {
      const roll = Math.random()
      if (roll < 0.22 && !p.cutting) {
        // Backdoor cut to the rim
        p.cutting = true
        p.spot.set(
          RIM_GROUND.x + (Math.random() - 0.5) * 2.4,
          0,
          RIM_GROUND.z + 1.6 + Math.random(),
        )
        p.aiTimer = 1.2 + Math.random() * 0.6
      } else if (roll < 0.42 && handler && handler.team === p.team) {
        // SET A SCREEN: plant right on the hip of the handler's defender
        const defOnBall = G.players.find(
          (o) =>
            o.team !== p.team &&
            o.stunT <= 0 &&
            o.pos.distanceTo(handler.pos) < 3.2,
        )
        if (defOnBall) {
          V3.copy(handler.pos)
            .sub(defOnBall.pos)
            .setY(0)
            .normalize()
            .multiplyScalar(-0.55)
          p.spot.copy(defOnBall.pos).add(V3)
          p.cutting = false
          p.aiTimer = 1.8 + Math.random()
        } else {
          p.aiTimer = 0.4
        }
      } else {
        // Relocate to the most open perimeter spot
        p.cutting = false
        let best = OFFENSE_SPOTS[0]
        let bs = Number.NEGATIVE_INFINITY
        for (const s of OFFENSE_SPOTS) {
          let score = Math.random() * 1.2
          // Prefer spots far from defenders
          for (const o of G.players) {
            if (o.team === p.team) continue
            score += Math.min(s.distanceTo(o.pos), 6) * 0.35
          }
          // Avoid crowding teammates and the handler
          for (const m of G.players) {
            if (m.team !== p.team || m.id === p.id) continue
            const dd = s.distanceTo(m.pos)
            if (dd < 3) score -= (3 - dd) * 1.4
          }
          if (score > bs) {
            bs = score
            best = s
          }
        }
        p.spot.copy(best)
        p.aiTimer = 2 + Math.random() * 2
      }
    }

    // Cutter finished the cut -> relocate next tick
    if (p.cutting && p.pos.distanceTo(p.spot) < 0.6) {
      p.cutting = false
      p.aiTimer = 0
    }

    // If the handler is trapped and I'm open, flash toward the ball
    let target = p.spot
    if (
      handler &&
      handler.team === p.team &&
      nearestOpponentDist(handler) < 1 &&
      myOpen > 2.2 &&
      !p.cutting
    ) {
      V3.copy(handler.pos).lerp(p.pos, 0.55)
      target = V3
    }

    const speed = p.cutting ? 6.4 : 4.6
    steerToward(p, target, speed, 9, dt, 0.35)

    // Small V-cut jitter to shake the defender while waiting on the spot
    if (p.speed < 1 && p.grounded) {
      const jit = Math.sin(G.time * 2.2 + p.id * 3)
      if (Math.abs(jit) > 0.93) {
        p.vel.x += jit * 1.6 * dt * 10
      }
    }
  }

  // ---------- AI: defense with reaction time + momentum ----------
  function updateAIDefender(p: PlayerData, dt: number) {
    const b = G.ball
    const idx = p.id % 3
    let man = G.players.find((o) => o.team !== p.team && o.id % 3 === idx)!

    const handler = b.holder >= 0 ? G.players[b.holder] : null

    // Help defense: if the handler beat his man and is driving, nearest
    // free defender rotates onto the ball
    p.helpDef = false
    if (handler && handler.team !== p.team && handler.id !== man.id) {
      const hisDefender = G.players.find(
        (o) => o.team === p.team && o.id % 3 === handler.id % 3,
      )!
      const handlerToRim = distToRim(handler.pos)
      const defBeaten =
        hisDefender.stunT > 0 ||
        distToRim(hisDefender.pos) > handlerToRim + 0.6
      if (defBeaten && handlerToRim < 5) {
        // Am I the closest helper?
        let closest = true
        for (const o of G.players) {
          if (o.team !== p.team || o.id === p.id || o.id === hisDefender.id)
            continue
          if (
            o.stunT <= 0 &&
            o.pos.distanceTo(handler.pos) < p.pos.distanceTo(handler.pos)
          )
            closest = false
        }
        if (closest) {
          man = handler
          p.helpDef = true
        }
      }
    }

    const manHasBall = b.state === 'held' && b.holder === man.id

    // Reaction time: the defender only refreshes his mental "target spot"
    // every ~0.15-0.28s. Between refreshes he commits to old info, which is
    // exactly what lets you shake him with dribble moves.
    p.reactT -= dt
    if (p.reactT <= 0) {
      const gap = manHasBall
        ? THREE.MathUtils.clamp(distToRim(man.pos) * 0.18, 0.55, 1.1)
        : THREE.MathUtils.clamp(distToRim(man.pos) * 0.28, 0.9, 1.9)
      V2.copy(RIM_GROUND).sub(man.pos)
      V2.y = 0
      const toRim = V2.length()
      V2.normalize().multiplyScalar(Math.min(gap, toRim * 0.5))
      p.reactTarget.copy(man.pos).add(V2)
      // Lead the target using the man's velocity (good defenders anticipate)
      p.reactTarget.x += man.vel.x * 0.12
      p.reactTarget.z += man.vel.z * 0.12
      p.reactT = manHasBall
        ? 0.13 + Math.random() * 0.1
        : 0.2 + Math.random() * 0.15
    }

    const dMan = p.pos.distanceTo(man.pos)

    // TRAILING: if the man blew by (closer to the rim by a real margin, or
    // we got hung up on a screen), the defender loses contact and has to
    // sprint back on the recovery angle - just like real defense.
    const manToRim = distToRim(man.pos)
    const meToRim = distToRim(p.pos)
    const gotBeat =
      p.screenedT > 0 || (manToRim < meToRim - 0.7 && dMan > 1.6)
    p.trailing = gotBeat

    if (p.screenedT > 0) {
      // Stuck on the screen: grinding, barely moving
      applyMove(p, 0, 0, 0, 10, dt)
      p.anim = 'shuffle'
      if (dMan < 5)
        p.facing = Math.atan2(man.pos.x - p.pos.x, man.pos.z - p.pos.z)
      return
    }

    if (gotBeat && manToRim > 1.5) {
      // Recovery sprint to a point BETWEEN the man and the rim (not to the
      // man himself) - the real way to get back in front.
      V3.copy(RIM_GROUND).sub(man.pos).normalize()
      V3.multiplyScalar(Math.min(1.6, manToRim * 0.45)).add(man.pos)
      // Lead ahead of where he is driving
      V3.x += man.vel.x * 0.22
      V3.z += man.vel.z * 0.22
      steerToward(p, V3, 7.3, 10.5, dt, 0.15)
      if (p.grounded && p.speed > 1.5) p.anim = 'run'
      if (dMan < 5)
        p.facing = Math.atan2(man.pos.x - p.pos.x, man.pos.z - p.pos.z)
      return
    }

    const distToTarget = p.pos.distanceTo(p.reactTarget)
    const closeOut = distToTarget > 2.4
    const maxSp = closeOut ? 6.6 : manHasBall ? 5.6 : 4.8
    // Lower accel than the offense => momentum can be exploited
    steerToward(p, p.reactTarget, maxSp, 7.5, dt, 0.12)

    // Defensive shuffle stance when locked onto the man
    if (p.grounded && dMan < 2.6 && p.speed < 3.4 && p.stunT <= 0) {
      p.anim = 'shuffle'
    }
    // Face the man
    if (dMan < 4) {
      p.facing = Math.atan2(man.pos.x - p.pos.x, man.pos.z - p.pos.z)
    }

    // Contest / block: jump when the man rises up for a shot.
    // A defender arriving at full sprint is off-balance: he jumps later,
    // lower, and sometimes can't get up at all.
    if (man.anim === 'shoot' && p.grounded && dMan < 2.2 && man.animT < 0.25) {
      const offBalance = Math.min(p.speed / 6.5, 1)
      if (Math.random() < 0.55 - offBalance * 0.35) {
        p.vy = 7.4 - offBalance * 2.6
        p.grounded = false
        p.anim = 'block'
        p.animT = 0
      } else if (offBalance > 0.6 && Math.random() < 0.3) {
        // Flew past on the closeout
        p.stumbleT = 0.5
        p.anim = 'stumble'
        p.animT = 0
      }
    }

    // Dunk challenge: meet the dunker at the rim (dunks are blockable)
    if (
      man.dunking &&
      man.dunkT < 0.3 &&
      p.grounded &&
      dMan < 2.4 &&
      p.speed < 4.5 &&
      Math.random() < 0.5
    ) {
      p.vy = 7.6
      p.grounded = false
      p.anim = 'block'
      p.animT = 0
    }

    // Occasional steal lunge at the ball handler
    if (manHasBall && dMan < 1.3 && p.grounded && Math.random() < dt * 0.25) {
      p.anim = 'steal'
      p.animT = 0
      if (Math.random() < 0.22 && !man.dunking) {
        b.state = 'loose'
        b.holder = -1
        b.pos.set(man.pos.x, 1, man.pos.z)
        V.copy(p.pos).sub(man.pos).normalize()
        b.vel.set(V.x * 3.5, 2, V.z * 3.5)
        setMessage(p.team === 0 ? 'STEAL!' : 'STOLEN BY RED!', 1.5)
      }
    }
  }

  function updateBall(dt: number) {
    const b = G.ball

    if (b.state === 'held' && b.holder >= 0) {
      const h = G.players[b.holder]
      if (h.anim === 'shoot' || h.anim === 'dunk') {
        b.pos.set(
          h.pos.x + Math.sin(h.facing) * 0.15,
          h.pos.y + 2.05,
          h.pos.z + Math.cos(h.facing) * 0.15,
        )
        b.spin = 0
      } else {
        // Dribble: faster & lower when sprinting, crossover swings side to side
        const crossing = Math.abs(h.crossLean) > 0.08
        const rate = 9 + h.speed * 0.9
        const side =
          h.facing + (crossing ? Math.sin(G.time * 13) * 1.2 : Math.PI / 2.6)
        const bounce = Math.abs(Math.sin(G.time * rate)) * (0.55 - Math.min(h.speed * 0.03, 0.2))
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
      for (const o of G.players) {
        if (o.team === target.team || o.stunT > 0) continue
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
          scoreBasket(shooter.team as 0 | 1, b.shotPoints, shooter)
          b.state = 'loose'
          b.pos.set(RIM.x, RIM.y - 0.4, RIM.z)
          b.vel.set(0, -2.5, 0.3)
        }
      } else {
        if (
          b.pos.z < -9.95 &&
          b.pos.y > 2.9 &&
          b.pos.y < 4.4 &&
          Math.abs(b.pos.x) < 1.25
        ) {
          b.pos.z = -9.95
          b.vel.z = Math.abs(b.vel.z) * 0.5
          b.state = 'loose'
        }
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
      if (b.pos.y < 0.17) {
        b.pos.y = 0.17
        b.vel.y = Math.abs(b.vel.y) * 0.55
        b.vel.x *= 0.8
        b.vel.z *= 0.8
        if (Math.abs(b.vel.y) < 0.6) b.vel.y = 0
      }
      if (b.pos.x < COURT.minX || b.pos.x > COURT.maxX) {
        b.pos.x = THREE.MathUtils.clamp(b.pos.x, COURT.minX, COURT.maxX)
        b.vel.x *= -0.6
      }
      if (b.pos.z < COURT.minZ || b.pos.z > COURT.maxZ) {
        b.pos.z = THREE.MathUtils.clamp(b.pos.z, COURT.minZ, COURT.maxZ)
        b.vel.z *= -0.6
      }
      if (G.phase === 'play' && b.pos.y < 1.5) {
        for (const p of G.players) {
          if (p.dunking || p.anim === 'shoot' || p.stunT > 0) continue
          // After a made basket only the inbounding team takes the ball
          if (G.inboundTeam >= 0 && p.team !== G.inboundTeam) continue
          if (
            p.pos.clone().setY(0).distanceTo(V.set(b.pos.x, 0, b.pos.z)) < 0.7
          ) {
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
    G.inboundTeam = -1
    if (p.team !== prev) {
      // Change of possession: play on, but the ball must be cleared
      G.possession = p.team as 0 | 1
      G.mustClear = true
      setMessage(p.team === 0 ? 'YOUR BALL - CLEAR IT!' : 'RED BALL!', 1.4)
    }
    if (p.team === 0) {
      G.controlled = p.id
    } else {
      G.controlled = nearestOf(0, p.pos)
    }
    p.aiTimer = 2 + Math.random() * 2
  }

  function updateCamera(dt: number) {
    const b = G.ball

    // Lead the action: anticipate where the ball is going
    const leadX = THREE.MathUtils.clamp(b.vel.x * 0.28, -2.2, 2.2)
    const leadZ = THREE.MathUtils.clamp(b.vel.z * 0.22, -1.8, 1.8)
    const fx = THREE.MathUtils.clamp(b.pos.x + leadX, -6.5, 6.5)
    const fz = THREE.MathUtils.clamp(b.pos.z + leadZ, -10, 4.5)

    // Action intensity: 0 out top, 1 at the rim -> camera pushes in and drops
    const rimT = THREE.MathUtils.clamp(1 - distToRim(b.pos) / 12, 0, 1)
    // Airborne ball (shot/dunk) pulls the camera up slightly for the arc
    const airT = THREE.MathUtils.clamp((b.pos.y - 1.6) / 3.5, 0, 1)

    const camH = 7.6 - rimT * 1.7 + airT * 0.9
    const camDist = 11.4 - rimT * 2.6
    V.set(fx * (0.5 + rimT * 0.18), camH, fz * 0.42 + camDist)
    V2.set(fx * 0.7, 1.0 + airT * 1.1, fz * 0.58 - 3.0)

    if (!camInit.current) {
      G.camPos.copy(V)
      G.camLook.copy(V2)
      camInit.current = true
    } else {
      // Faster panning when the ball moves fast, smooth when settled
      const ballSpeed = Math.hypot(b.vel.x, b.vel.z)
      const k = 3.2 + Math.min(ballSpeed * 0.35, 3.4) + rimT * 1.2
      G.camPos.lerp(V, 1 - Math.exp(-k * dt))
      G.camLook.lerp(V2, 1 - Math.exp(-(k + 0.8) * dt))
    }
    camera.position.copy(G.camPos)
    if (G.camShake > 0) {
      camera.position.x += (Math.random() - 0.5) * G.camShake * 0.3
      camera.position.y += (Math.random() - 0.5) * G.camShake * 0.3
    }
    camera.lookAt(G.camLook)

    // Subtle zoom punch-in near the rim
    const cam = camera as THREE.PerspectiveCamera
    const targetFov = 50 - rimT * 5
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov += (targetFov - cam.fov) * (1 - Math.exp(-4 * dt))
      cam.updateProjectionMatrix()
    }
  }

  function syncHud() {
    const hud = useHud.getState()
    const patch: Record<string, unknown> = {}
    if (hud.scores[0] !== G.scores[0] || hud.scores[1] !== G.scores[1])
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
