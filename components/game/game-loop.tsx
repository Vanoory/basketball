'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  G,
  COURT,
  GRAVITY,
  WIN_SCORE,
  METER_FILL_TIME,
  METER_PERFECT_CENTER,
  STUN_TIME,
  DUNK_DUR,
  DUNK_NAMES,
  distToRim,
  isThree,
  rimOf,
  rimGroundOf,
  addFx,
  useHud,
  THREE_PT_RADIUS,
  type PlayerData,
  type ShotStyle,
  type AIPlan,
} from '@/lib/game'
import { INPUT } from '@/lib/input'

const V = new THREE.Vector3()
const V2 = new THREE.Vector3()
const V3 = new THREE.Vector3()

// Half-court spots (3v3) - built around the -z rim
const OFFENSE_SPOTS = [
  new THREE.Vector3(-6.9, 0, -8.6), // left corner
  new THREE.Vector3(6.9, 0, -8.6), // right corner
  new THREE.Vector3(-6.2, 0, -4.2), // left wing
  new THREE.Vector3(6.2, 0, -4.2), // right wing
  new THREE.Vector3(-3.2, 0, 0.5), // left top
  new THREE.Vector3(3.2, 0, 0.5), // right top
  new THREE.Vector3(0, 0, 1.8), // top of key
]

// 5v5 spots: built around the deeper -z rim (-11.9) on the larger court
const OFFENSE_SPOTS_5A = [
  new THREE.Vector3(-7.6, 0, -11.0),
  new THREE.Vector3(7.6, 0, -11.0),
  new THREE.Vector3(-6.9, 0, -7.0),
  new THREE.Vector3(6.9, 0, -7.0),
  new THREE.Vector3(-3.5, 0, -3.8),
  new THREE.Vector3(3.5, 0, -3.8),
  new THREE.Vector3(0, 0, -4.8),
]
// Mirrored spots for the team attacking the +z rim
const OFFENSE_SPOTS_5B = OFFENSE_SPOTS_5A.map(
  (s) => new THREE.Vector3(s.x, 0, -s.z),
)

function offenseSpots(team: 0 | 1) {
  if (G.mode === '3v3') return OFFENSE_SPOTS
  return team === 0 ? OFFENSE_SPOTS_5A : OFFENSE_SPOTS_5B
}

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

// Roll a scoring plan from the player's shot tendency the moment he gets
// the rock: shooters hunt pull-up threes, bigs put their head down and
// drive, wings mix in the mid-range game.
function pickPlan(p: PlayerData): AIPlan {
  const t = p.tendency
  const total = t.three + t.mid + t.drive
  const r = Math.random() * total
  if (r < t.three) return 'pull3'
  if (r < t.three + t.mid) return 'midpull'
  // Some drives start as a patient probe before committing
  return Math.random() < 0.75 ? 'drive' : 'probe'
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
  // Don't let drift velocity spin the shooter away from the rim mid-shot
  if (p.speed > 0.6 && p.anim !== 'shoot') {
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
  addFx('ankle', V.set(def.pos.x, 1.6, def.pos.z))
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
// Pick a shot style from movement: drifting away from the rim = fadeaway,
// driving in from short range = floater, otherwise a normal jumper.
function detectShotStyle(p: PlayerData): ShotStyle {
  const d = distToRim(p.pos, p.team)
  V3.copy(rimGroundOf(p.team)).sub(p.pos).setY(0).normalize()
  const vdot = p.vel.x * V3.x + p.vel.z * V3.z
  if (p.speed > 2.0 && vdot < -1.1 && d > 2.7) return 1 // fadeaway
  if (p.speed > 2.0 && vdot > 1.3 && d < 4.8 && d >= 2.7) return 2 // floater
  return 0
}

// Rise up for a shot with the chosen style. Fadeaways keep backward drift,
// floaters keep forward momentum and release quicker.
function beginShotRise(p: PlayerData) {
  const style = detectShotStyle(p)
  p.shotStyle = style
  p.anim = 'shoot'
  p.animT = 0
  p.grounded = false
  // Always square up to the rim - even on step-backs and fadeaways the
  // shooter's chest turns toward the basket as he rises.
  const rg = rimGroundOf(p.team)
  p.facing = Math.atan2(rg.x - p.pos.x, rg.z - p.pos.z)
  if (style === 1) {
    p.vy = 6.2
    p.vel.multiplyScalar(0.55) // keep drifting back - the fadeaway look
  } else if (style === 2) {
    p.vy = 7.0
    p.vel.multiplyScalar(0.45) // floater carries some drive momentum
  } else {
    p.vy = 6.5
    p.vel.multiplyScalar(0.25)
  }
}

function launchShot(shooter: PlayerData, willScore: boolean, points: number) {
  const b = G.ball
  const start = V.set(
    shooter.pos.x,
    shooter.pos.y + 2.15,
    shooter.pos.z,
  ).clone()

  const rim = rimOf(shooter.team)
  let target: THREE.Vector3
  if (willScore) {
    target = rim.clone()
    target.y = rim.y + 0.02
  } else {
    const ang = Math.random() * Math.PI * 2
    const r = 0.35 + Math.random() * 0.3
    target = rim.clone().add(
      new THREE.Vector3(Math.cos(ang) * r, 0.05, Math.sin(ang) * r * 0.6),
    )
  }

  const dist = start.distanceTo(target)
  // Floaters get a higher, softer arc; fadeaways hang slightly longer
  const arcBoost = shooter.shotStyle === 2 ? 0.2 : shooter.shotStyle === 1 ? 0.08 : 0
  const T = 0.75 + dist * 0.055 + arcBoost
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
  const wasShot = G.ball.state === 'shot'
  if (scorer && wasShot && scorer.shotStyle === 1)
    setMessage(`FADEAWAY! +${points}`, 2)
  else if (scorer && wasShot && scorer.shotStyle === 2)
    setMessage(`SOFT TOUCH! +${points}`, 2)
  else if (points === 3) setMessage('SPLASH! +3', 2)
  else setMessage(Math.random() > 0.5 ? 'BUCKETS! +2' : 'GOOD! +2', 2)
  if (scorer) {
    scorer.celebrateT = 1.3
  }
  // Confetti burst at the rim in the scoring team's color
  addFx(
    points === 3 ? 'score3' : 'score',
    rimOf(team),
    scorer?.colors.jersey,
  )
  if (G.scores[team] >= WIN_SCORE) {
    G.phase = 'over'
    setMessage(team === 0 ? 'YOU WIN!' : 'RED TEAM WINS!', 99)
  } else {
    // No stoppage: the other team takes the ball under the rim it was
    // scored on. In 3v3 it must be cleared beyond the arc; in 5v5 the
    // team simply pushes the break toward the opposite basket.
    const other = (team === 0 ? 1 : 0) as 0 | 1
    G.possession = other
    G.mustClear = G.mode === '3v3'
    G.inboundTeam = other
    if (other === 0) {
      G.controlled = nearestOf(0, rimGroundOf(team))
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
  const rg = rimGroundOf(team)
  // Base formations are built for attacking the -z rim; mirror for +z
  const m = rg.z < 0 ? 1 : -1

  const handler = off[0]
  if (G.mode === '3v3') {
    handler.pos.set(0, 0, 3.4)
    off[1].pos.set(-5.6, 0, -1.8)
    off[2].pos.set(5.6, 0, -1.8)
  } else {
    handler.pos.set(0, 0, 3.2 * m)
    off[1].pos.set(-6.2, 0, -1.5 * m)
    off[2].pos.set(6.2, 0, -1.5 * m)
    off[3].pos.set(-3.0, 0, -6.0 * m)
    off[4].pos.set(3.0, 0, -6.0 * m)
  }

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
    p.aiTimer = 1.5 + Math.random() * 2
    p.reactT = 0
  }
  // Defenders line up between their man and the defended rim
  for (let i = 0; i < G.perTeam; i++) {
    const man = off[i]
    V.copy(rg).sub(man.pos).normalize().multiplyScalar(1.4)
    def[i].pos.copy(man.pos).add(V)
    def[i].pos.y = 0
    def[i].reactTarget.copy(def[i].pos)
  }
  // Everyone squares up toward the attacked rim
  for (const p of G.players) {
    p.facing = Math.atan2(rg.x - p.pos.x, rg.z - p.pos.z)
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
  const rg = rimGroundOf(pl.team)
  pl.dunking = true
  pl.dunkT = 0
  pl.dunkFrom.copy(pl.pos)
  pl.anim = 'dunk'
  pl.dunkFacing = Math.atan2(rg.x - pl.pos.x, rg.z - pl.pos.z)
  // Pick a dunk based on the approach: fast straight drives unlock the
  // flashy stuff, slower/short takeoffs get the safe two-hand jam.
  const speed = Math.hypot(pl.vel.x, pl.vel.z)
  const roll = Math.random()
  if (speed > 4.5) {
    pl.dunkStyle = roll < 0.3 ? 2 : roll < 0.55 ? 3 : roll < 0.8 ? 1 : 4
  } else if (speed > 2.5) {
    pl.dunkStyle = roll < 0.35 ? 1 : roll < 0.55 ? 4 : 0
  } else {
    pl.dunkStyle = roll < 0.25 ? 1 : 0
  }
  G.ball.state = 'dunk'
  G.ball.holder = pl.id
  setMessage(DUNK_NAMES[pl.dunkStyle], 1.3)
}

function updateDunk(pl: PlayerData, dt: number) {
  const rg = rimGroundOf(pl.team)
  const rim = rimOf(pl.team)
  // "In front" of the rim = toward the court center
  const inFront = rg.z < 0 ? 1 : -1
  const DUR = DUNK_DUR[pl.dunkStyle]
  pl.dunkT += dt
  const t = Math.min(pl.dunkT / DUR, 1)
  // Reverse jam lands behind the rim; everything else lands in front
  const landZ =
    pl.dunkStyle === 4 ? rg.z - 0.35 * inFront : rg.z + 1.1 * inFront
  const landing = V2.set(rg.x, 0, landZ)
  pl.pos.x = THREE.MathUtils.lerp(pl.dunkFrom.x, landing.x, t)
  pl.pos.z = THREE.MathUtils.lerp(pl.dunkFrom.z, landing.z, t)
  // Windmill / 360 hang higher and longer
  const peak = pl.dunkStyle === 2 || pl.dunkStyle === 3 ? 2.6 : 2.35
  pl.pos.y = Math.sin(Math.min(t, 0.9) * Math.PI) * peak

  if (pl.dunkStyle === 3) {
    // Full 360 spin in the air, landing square to the rim
    pl.facing = pl.dunkFacing + Math.min(t / 0.85, 1) * Math.PI * 2
  } else if (pl.dunkStyle === 4) {
    // Reverse: rotate to face away from the rim at the slam
    pl.facing =
      pl.dunkFacing + Math.min(t / 0.6, 1) * Math.PI
  } else {
    pl.facing = Math.atan2(rg.x - pl.pos.x, rg.z - pl.pos.z)
  }

  const b = G.ball
  if (b.state === 'dunk' && b.holder === pl.id) {
    const slamAt = 0.62
    if (t < slamAt) {
      if (pl.dunkStyle === 2) {
        // Windmill: the ball sweeps a big circle beside the body
        const wt = t / slamAt
        const ang = wt * Math.PI * 2 - Math.PI / 2
        const side = Math.cos(ang) * 0.85
        const up = Math.sin(ang) * 0.9
        b.pos.set(
          pl.pos.x + Math.cos(pl.facing) * side,
          pl.pos.y + 1.5 + up,
          pl.pos.z - Math.sin(pl.facing) * side,
        )
      } else {
        b.pos.set(pl.pos.x, pl.pos.y + 2.3, pl.pos.z)
        const toRim = V.copy(rim).sub(b.pos).normalize().multiplyScalar(0.4)
        b.pos.add(toRim)
      }
    } else {
      b.state = 'loose'
      b.holder = -1
      b.pos.set(rim.x, rim.y - 0.3, rim.z)
      b.vel.set(0, -4, 0.6 * inFront)
      G.camShake = pl.dunkStyle >= 2 ? 0.6 : 0.45
      addFx('dunk', rim)
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
  b.passFromY = b.pos.y
  b.spin = 0.3
  // Arc height scales with distance; if a defender sits in the passing lane
  // the passer throws a lob over the top instead of a flat chest pass
  const dist = passer.pos.distanceTo(best.pos)
  b.passDist = Math.max(dist, 0.01)
  let laneBlocked = false
  for (const o of G.players) {
    if (o.team === passer.team || o.stunT > 0) continue
    // Distance from the defender to the passer->receiver segment
    V.copy(best.pos).sub(passer.pos).setY(0)
    V2.copy(o.pos).sub(passer.pos).setY(0)
    const tt = THREE.MathUtils.clamp(V2.dot(V) / V.lengthSq(), 0, 1)
    V.multiplyScalar(tt).add(passer.pos)
    if (V.distanceTo(o.pos) < 0.9 && tt > 0.12 && tt < 0.88) {
      laneBlocked = true
      break
    }
  }
  b.passArc = laneBlocked
    ? 1.1 + dist * 0.06
    : THREE.MathUtils.clamp(dist * 0.055, 0.12, 0.55)
  passer.anim = 'pass'
  passer.animT = 0
  passer.facing = Math.atan2(
    best.pos.x - passer.pos.x,
    best.pos.z - passer.pos.z,
  )
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
  // Swat away from the rim the OFFENSE was attacking
  V2.copy(b.pos).sub(rimOf(G.possession)).setY(0)
  if (V2.lengthSq() < 0.01) V2.set(0, 0, 1)
  V2.normalize()
  b.vel.set(V2.x * 5.5, 2.4, V2.z * 5.5)
  p.anim = 'block'
  p.animT = 0
  G.camShake = 0.32
  addFx('block', b.pos)
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
  const lastHolder = useRef(-1)
  const camInit = useRef(false)
  const defCamBlend = useRef(0)
  const { camera } = useThree()
  // Gamepad state (polled every frame - the Gamepad API has no events
  // for buttons, so we track previous frame state to detect edges)
  const padPrev = useRef<boolean[]>([])
  const padMove = useRef({ x: 0, z: 0 })
  const padSprint = useRef(false)

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
      if (G.mustClear && !isThree(me.pos, me.team)) {
        setMessage('CLEAR IT PAST THE ARC!', 1.0)
        return
      }
      const d = distToRim(me.pos, me.team)
      if (d < 2.7) {
        startDunk(me)
      } else {
        const moveSpeed = me.speed
        beginShotRise(me)
        G.meterActive = true
        G.meterValue = 0
        G.shotDist = d
        const contest = Math.max(0, 1.6 - nearestOpponentDist(me)) / 1.6
        // Green window shrinks with: distance, contest, and shooting on
        // the move. A sprinting contested deep three is a sliver; a set
        // open mid-range look is generous.
        // Fadeaways create separation (less contest) but are harder;
        // floaters are a touch shot with a slightly friendlier window.
        const styleMod =
          me.shotStyle === 1 ? -0.018 : me.shotStyle === 2 ? 0.012 : 0
        const contestMod = me.shotStyle === 1 ? 0.55 : 1
        const half = Math.max(
          0.022,
          0.115 -
            d * 0.005 -
            contest * 0.04 * contestMod -
            moveSpeed * 0.0085 +
            styleMod,
        )
        G.meterWindow = [
          METER_PERFECT_CENTER - half,
          METER_PERFECT_CENTER + half,
        ]
        if (me.shotStyle === 1) setMessage('FADEAWAY!', 0.8)
        if (me.shotStyle === 2) setMessage('FLOATER!', 0.8)
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
    const pts = isThree(me.pos, me.team) ? 3 : 2
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
    stealCooldown.current = 0.75
    me.anim = 'steal'
    me.animT = 0
    // Poke at a live pass: deflect it if it's flying close by
    if (b.state === 'pass' && b.pos.distanceTo(me.pos) < 1.6 && Math.random() < 0.5) {
      b.state = 'loose'
      b.holder = -1
      b.vel.set((Math.random() - 0.5) * 4, 2.2, (Math.random() - 0.5) * 4)
      setMessage('DEFLECTED!', 1.3)
      return
    }
    if (b.state === 'held' && b.holder >= 0) {
      const h = G.players[b.holder]
      if (h.pos.distanceTo(me.pos) < 1.6 && !h.dunking) {
        // Poking from behind / the side is more effective than head-on
        const toMe = V2.copy(me.pos).sub(h.pos).setY(0).normalize()
        const fwd = V3.set(Math.sin(h.facing), 0, Math.cos(h.facing))
        const behind = toMe.dot(fwd) < 0.2
        if (Math.random() < (behind ? 0.42 : 0.3)) {
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

  // ---------- Gamepad (polled - the API is stateless) ----------
  // Standard mapping: A/Cross shoot-dunk-block (hold to fill the meter),
  // X/Square pass-switch, B/Circle steal, any shoulder/trigger sprint,
  // Start restarts after game over. Left stick or D-pad moves.
  function pollGamepad() {
    padMove.current.x = 0
    padMove.current.z = 0
    padSprint.current = false
    const pads =
      typeof navigator !== 'undefined' && navigator.getGamepads
        ? navigator.getGamepads()
        : null
    if (!pads) return
    for (const pad of pads) {
      if (!pad || !pad.connected) continue
      const dead = 0.22
      const ax = pad.axes[0] ?? 0
      const az = pad.axes[1] ?? 0
      if (Math.abs(ax) > dead) padMove.current.x += ax
      if (Math.abs(az) > dead) padMove.current.z += az
      const btn = (i: number) => pad.buttons[i]?.pressed ?? false
      // D-pad fallback
      if (btn(12)) padMove.current.z -= 1
      if (btn(13)) padMove.current.z += 1
      if (btn(14)) padMove.current.x -= 1
      if (btn(15)) padMove.current.x += 1
      if (btn(4) || btn(5) || btn(6) || btn(7)) padSprint.current = true

      const prev = padPrev.current
      // A (0): shoot / dunk / block - hold-release like Space
      if (btn(0) && !prev[0]) onSpaceDown()
      if (!btn(0) && prev[0]) onSpaceUp()
      // X (2): pass / switch player
      if (btn(2) && !prev[2]) onPassOrSwitch()
      // B (1): steal
      if (btn(1) && !prev[1]) onSteal()
      // Start (9): play again
      if (btn(9) && !prev[9] && G.phase === 'over') restart()
      padPrev.current = pad.buttons.map((b) => b.pressed)
      break // one controller drives the game
    }
  }

  // Touch buttons queue one-shot actions into the shared INPUT bus
  function consumeInputQueue() {
    for (const a of INPUT.queue) {
      if (a === 'shootDown') onSpaceDown()
      else if (a === 'shootUp') onSpaceUp()
      else if (a === 'pass') onPassOrSwitch()
      else if (a === 'steal') onSteal()
      else if (a === 'restart' && G.phase === 'over') restart()
    }
    INPUT.queue.length = 0
  }

  // ---------- Per-frame simulation ----------
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    pollGamepad()
    consumeInputQueue()
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
      if (p.anim === 'catch' && p.animT > 0.28) p.anim = 'idle'
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
        if (h.team === G.possession && isThree(h.pos, h.team)) {
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

    // Touch joystick + gamepad stick share the same screen-space convention
    mx += INPUT.moveX + padMove.current.x
    mz += INPUT.moveZ + padMove.current.z
    const mLen = Math.hypot(mx, mz)
    if (mLen > 1) {
      mx /= mLen
      mz /= mLen
    } else if (mLen < 0.12) {
      mx = 0
      mz = 0
    }

    // CAMERA-RELATIVE input: W always pushes "up the screen" no matter how
    // the camera is oriented. Critical in 5v5 where the broadcast camera
    // films from the sideline - without this WASD feels completely chaotic.
    if (mx !== 0 || mz !== 0) {
      let cfx = G.camLook.x - G.camPos.x
      let cfz = G.camLook.z - G.camPos.z
      const cfl = Math.hypot(cfx, cfz)
      if (cfl > 0.0001) {
        cfx /= cfl
        cfz /= cfl
        // right = forward x up (projected on the floor plane)
        const wx = cfx * -mz + -cfz * mx
        const wz = cfz * -mz + cfx * mx
        mx = wx
        mz = wz
      }
    }

    const hasBall = b.state === 'held' && b.holder === me.id
    const defending = G.possession !== me.team

    if (!shooting && (mx !== 0 || mz !== 0)) {
      const len = Math.hypot(mx, mz)
      mx /= len
      mz /= len
      // Sharp cut with the ball near a defender = ankle-break chance
      if (hasBall) tryAnkleBreak(me, mx, mz)
      const sprint =
        k.has('ShiftLeft') ||
        k.has('ShiftRight') ||
        INPUT.sprint ||
        padSprint.current
      // Defense is snappier: higher accel + a small speed edge so you can
      // actually stay in front of the AI handler.
      // The larger 5v5 court gets a speed bump so running the floor
      // doesn't feel sluggish.
      const modeBoost = G.mode === '5v5' ? 1.12 : 1
      const speed =
        (sprint ? (hasBall ? 6.4 : defending ? 7.4 : 7) : defending ? 5.2 : 4.6) *
        modeBoost
      applyMove(me, mx, mz, speed, defending ? 15 : 12, dt)
      if (me.grounded) me.anim = 'run'
      // While defending, keep facing the ball even when strafing so blocks
      // and steals feel aimed correctly.
      if (defending && b.holder >= 0 && me.grounded) {
        const h = G.players[b.holder]
        if (h.pos.distanceTo(me.pos) < 4.5) {
          me.facing = Math.atan2(h.pos.x - me.pos.x, h.pos.z - me.pos.z)
          if (me.speed < 3.6 && me.anim === 'run') me.anim = 'shuffle'
        }
      }
    } else if (!shooting) {
      applyMove(me, 0, 0, 0, 16, dt)
      if (me.grounded && me.anim === 'run') me.anim = 'idle'
      if (hasBall) {
        const rg = rimGroundOf(me.team)
        me.facing = Math.atan2(rg.x - me.pos.x, rg.z - me.pos.z)
      } else if (defending && b.holder >= 0) {
        // Standing on defense: square up to the ball handler automatically
        const h = G.players[b.holder]
        if (h.pos.distanceTo(me.pos) < 6) {
          me.facing = Math.atan2(h.pos.x - me.pos.x, h.pos.z - me.pos.z)
          if (me.grounded && h.pos.distanceTo(me.pos) < 2.8) me.anim = 'shuffle'
        }
      }
    }
  }

  function updateAI(dt: number) {
    const b = G.ball

    // New handler picks a fresh scoring plan the moment he gets the ball
    if (b.state === 'held' && b.holder >= 0 && b.holder !== lastHolder.current) {
      lastHolder.current = b.holder
      G.players[b.holder].aiPlanFresh = true
    }
    if (b.state !== 'held') lastHolder.current = -1

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
          const d = distToRim(p.pos, p.team)
          const contest = Math.max(0, 1.6 - nearestOpponentDist(p)) / 1.6
          const three = isThree(p.pos, p.team)
          // Specialists hit their favorite shot more often: gunners from
          // deep, mid-range artists from the elbows.
          const spec = three
            ? p.tendency.three * 0.3
            : d > 3
              ? p.tendency.mid * 0.25
              : 0
          const prob = Math.max(
            0.15,
            0.6 - d * 0.028 - contest * 0.35 + spec,
          )
          launchShot(p, Math.random() < prob, three ? 3 : 2)
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
    const RG = rimGroundOf(p.team)
    const d = distToRim(p.pos, p.team)
    const defDist = nearestOpponentDist(p)

    // Fresh possession: roll a scoring plan from this player's tendency
    if (p.aiPlanFresh) {
      p.aiPlanFresh = false
      p.aiPlan = pickPlan(p)
      p.aiTimer = 0.5 + Math.random() * 0.7
    }

    // Clear the ball first: dribble it out beyond the arc, or hit a
    // teammate already spotted up outside for the quick three look.
    if (G.mustClear && !isThree(p.pos, p.team)) {
      let outMate: PlayerData | null = null
      let bestOpen = 0
      for (const m of G.players) {
        if (m.team !== p.team || m.id === p.id || m.stunT > 0) continue
        if (!isThree(m.pos, m.team)) continue
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

    // Right at the rim everyone finishes strong, but only committed
    // drivers hunt this spot on purpose.
    if (d < 2.5 && !G.mustClear && (p.aiPlan === 'drive' || d < 1.9)) {
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

    // ----- Plan: hunt a pull-up three -----
    if (p.aiPlan === 'pull3') {
      const beyondArc = d > THREE_PT_RADIUS + 0.25
      // Open look from deep: let it fly
      if (beyondArc && defDist > 1.5 && p.aiTimer <= 0) {
        p.vel.multiplyScalar(0.3)
        beginShotRise(p)
        setMessage('FOR THREE!', 0.9)
        return
      }
      // Crowded at the arc: create space with a step-back three
      if (beyondArc && defDist < 1.1 && p.aiTimer <= 0 && Math.random() < 0.5) {
        V2.copy(p.pos).sub(RG).setY(0).normalize()
        p.vel.x = V2.x * 3.0
        p.vel.z = V2.z * 3.0
        p.speed = 3.0
        beginShotRise(p)
        setMessage('STEP-BACK THREE!', 1.0)
        return
      }
      // Not behind the line yet: dribble out to a spot on the arc
      if (!beyondArc) {
        V2.copy(p.pos).sub(RG).setY(0).normalize()
        V3.copy(RG).addScaledVector(V2, THREE_PT_RADIUS + 0.7)
        clampCourt(V3, 0.6)
        steerToward(p, V3, 5.8, 9, dt, 0.3)
        if (p.grounded) p.anim = 'run'
        return
      }
      // Behind the arc but smothered too long: bail out of the plan
      if (p.aiTimer <= -1.2) {
        if (openMate && bestOpen > 2.0) {
          tryPass(p, openMate.id)
          return
        }
        p.aiPlan = Math.random() < 0.5 ? 'drive' : 'midpull'
        p.aiTimer = 0.4 + Math.random() * 0.5
      }
      // Shuffle along the arc waiting for a window
      const side = Math.sin(G.time * 1.7 + p.id) > 0 ? 1 : -1
      V2.copy(p.pos).sub(RG).setY(0).normalize()
      applyMove(p, V2.z * side * 0.8, -V2.x * side * 0.8, 3.4, 8, dt)
      if (p.grounded) p.anim = 'run'
      return
    }

    // ----- Plan: mid-range pull-up -----
    if (p.aiPlan === 'midpull') {
      const inMidRange = d > 3.0 && d < 5.8
      if (inMidRange && defDist > 1.4 && p.aiTimer <= 0) {
        p.vel.multiplyScalar(0.3)
        beginShotRise(p)
        setMessage('PULL-UP JUMPER!', 0.9)
        return
      }
      // Contested in the mid post: rise for the tough fadeaway
      if (inMidRange && defDist < 1.2 && p.aiTimer <= 0 && Math.random() < 0.4) {
        V2.copy(p.pos).sub(RG).setY(0).normalize()
        p.vel.x = V2.x * 2.6
        p.vel.z = V2.z * 2.6
        p.speed = 2.6
        beginShotRise(p)
        return
      }
      // Work toward the elbow / short wing
      if (!inMidRange) {
        V2.copy(p.pos).sub(RG).setY(0).normalize()
        V3.copy(RG).addScaledVector(V2, 4.4)
        clampCourt(V3, 0.6)
        steerToward(p, V3, 5.4, 9, dt, 0.3)
        if (p.grounded) p.anim = 'run'
        return
      }
      // Stuck too long: kick out or switch plans
      if (p.aiTimer <= -1.4) {
        if (openMate && bestOpen > 2.0) {
          tryPass(p, openMate.id)
          return
        }
        p.aiPlan = 'drive'
        p.aiTimer = 0.3
      }
      // Jab-step dance in the mid post
      const side = Math.sin(G.time * 2.4 + p.id * 1.7) > 0 ? 1 : -1
      V2.copy(p.pos).sub(RG).setY(0).normalize()
      applyMove(p, V2.z * side * 0.7, -V2.x * side * 0.7, 3.0, 8, dt)
      if (p.grounded) p.anim = 'run'
      return
    }

    // ----- Plan: probe (patient) or drive (downhill) -----
    if (p.aiTimer <= 0) {
      // Open jumper opportunistically even while driving
      if (defDist > 1.8 && d < 8 && Math.random() < 0.5) {
        beginShotRise(p)
        return
      }
      // Short floater over collapsing help defense
      if (p.aiPlan === 'drive' && d < 4.6 && d > 2.7 && defDist < 1.3 && Math.random() < 0.35) {
        V2.copy(RG).sub(p.pos).setY(0).normalize()
        p.vel.x = V2.x * 2.6
        p.vel.z = V2.z * 2.6
        p.speed = 2.6
        beginShotRise(p)
        return
      }
      // Kick out to a wide-open teammate when pressured
      if (defDist < 1.3 && openMate && bestOpen > 2.4) {
        tryPass(p, openMate.id)
        p.aiTimer = 1.6 + Math.random() * 1.5
        return
      }
      // Probing possessions eventually commit to something
      if (p.aiPlan === 'probe') {
        p.aiPlan = pickPlan(p)
        if (p.aiPlan === 'probe') p.aiPlan = 'drive'
      }
      // Otherwise reset the clock and keep working
      p.aiTimer = 1.2 + Math.random() * 1.4
    }

    // Dribble attack with real crossover moves
    V2.copy(RG).sub(p.pos).normalize()
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
    const RG = rimGroundOf(p.team)
    const inFront = RG.z < 0 ? 1 : -1
    const handler = b.holder >= 0 ? G.players[b.holder] : null
    const myOpen = opennessOf(p)

    if (p.aiTimer <= 0) {
      const roll = Math.random()
      if (roll < 0.22 && !p.cutting) {
        // Backdoor cut to the rim
        p.cutting = true
        p.spot.set(
          RG.x + (Math.random() - 0.5) * 2.4,
          0,
          RG.z + (1.6 + Math.random()) * inFront,
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
        const spots = offenseSpots(p.team)
        let best = spots[0]
        let bs = Number.NEGATIVE_INFINITY
        for (const s of spots) {
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
        p.aiTimer = 1.1 + Math.random() * 1.3
      }
    }

    // If the handler is driving to the rim, drift along the perimeter to
    // stay open for the kick-out (real spacing movement)
    if (handler && handler.team === p.team && !p.cutting) {
      const handlerDriving =
        distToRim(handler.pos, handler.team) < 5.5 &&
        Math.hypot(handler.vel.x, handler.vel.z) > 3
      if (handlerDriving && Math.abs(p.spot.x) > 2) {
        // Slide 1-2m along my side's arc away from the drive lane
        const drift = handler.pos.x > 0 ? -1 : 1
        p.spot.x = THREE.MathUtils.clamp(
          p.spot.x + drift * dt * 2.2 * Math.sign(p.spot.x) * -1,
          -7,
          7,
        )
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

    const speed = p.cutting ? 6.4 : 5.2
    steerToward(p, target, speed, 9, dt, 0.35)

    // V-cut jitter to shake the defender while waiting on the spot:
    // sharp little in-out bursts instead of standing still
    if (p.speed < 1.2 && p.grounded) {
      const jit = Math.sin(G.time * 2.6 + p.id * 3)
      if (Math.abs(jit) > 0.88) {
        p.vel.x += jit * 2.4 * dt * 10
        p.vel.z += Math.cos(G.time * 1.9 + p.id * 2) * 1.4 * dt * 10
      }
    }
  }

  // ---------- AI: defense with reaction time + momentum ----------
  // Team slot (0..perTeam-1) - defenders match up with the same slot
  function slotOf(p: PlayerData) {
    return p.team === 0 ? p.id : p.id - G.perTeam
  }

  function updateAIDefender(p: PlayerData, dt: number) {
    const b = G.ball
    const idx = slotOf(p)
    let man = G.players.find((o) => o.team !== p.team && slotOf(o) === idx)!
    // Rim the OFFENSE is attacking = the rim I am protecting
    const offTeam = (p.team === 0 ? 1 : 0) as 0 | 1
    const RG = rimGroundOf(offTeam)

    const handler = b.holder >= 0 ? G.players[b.holder] : null

    // Help defense: if the handler beat his man and is driving, nearest
    // free defender rotates onto the ball
    p.helpDef = false
    if (handler && handler.team !== p.team && handler.id !== man.id) {
      const hisDefender = G.players.find(
        (o) => o.team === p.team && slotOf(o) === slotOf(handler),
      )!
      const handlerToRim = distToRim(handler.pos, handler.team)
      const defBeaten =
        hisDefender.stunT > 0 ||
        distToRim(hisDefender.pos, handler.team) > handlerToRim + 0.6
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
        ? THREE.MathUtils.clamp(distToRim(man.pos, offTeam) * 0.18, 0.55, 1.1)
        : THREE.MathUtils.clamp(distToRim(man.pos, offTeam) * 0.28, 0.9, 1.9)
      V2.copy(RG).sub(man.pos)
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
    const manToRim = distToRim(man.pos, offTeam)
    const meToRim = distToRim(p.pos, offTeam)
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
      V3.copy(RG).sub(man.pos).normalize()
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
      // Horizontal homing toward the receiver's chest
      V.set(target.pos.x, 0, target.pos.z)
      V2.set(b.pos.x, 0, b.pos.z)
      V.sub(V2)
      const dFlat = V.length()
      const step = 15 * dt
      for (const o of G.players) {
        if (o.team === target.team || o.stunT > 0) continue
        // Lobs sail over a grounded defender's reach
        const reach = o.grounded ? 2.1 : 2.9
        if (b.pos.y - o.pos.y > reach) continue
        if (o.pos.clone().setY(b.pos.y).distanceTo(b.pos) < 0.55) {
          b.state = 'held'
          b.holder = o.id
          onPossessionGained(o)
          setMessage('INTERCEPTED!', 1.5)
          return
        }
      }
      if (dFlat <= step + 0.3) {
        b.state = 'held'
        b.holder = target.id
        target.anim = 'catch'
        target.animT = 0
        onPossessionGained(target)
      } else {
        V.normalize().multiplyScalar(step)
        b.pos.x += V.x
        b.pos.z += V.z
        // Arc: sine bump between launch height and the receiver's chest
        const prog = THREE.MathUtils.clamp(1 - dFlat / b.passDist, 0, 1)
        const targetY = target.pos.y + 1.25
        b.pos.y =
          THREE.MathUtils.lerp(b.passFromY, targetY, prog) +
          Math.sin(prog * Math.PI) * b.passArc
        b.spin = 0.32
      }
      return
    }

    if (b.state === 'shot') {
      b.shotT += dt
      b.pos.addScaledVector(b.vel, dt)
      b.vel.y += GRAVITY * dt

      const shooter = G.players[b.shooterId]
      const rim = rimOf(shooter.team)
      const inFront = rim.z < 0 ? 1 : -1
      if (b.shotWillScore) {
        if (b.vel.y < 0 && b.pos.y <= rim.y - 0.05) {
          scoreBasket(shooter.team as 0 | 1, b.shotPoints, shooter)
          b.state = 'loose'
          b.pos.set(rim.x, rim.y - 0.4, rim.z)
          b.vel.set(0, -2.5, 0.3 * inFront)
        }
      } else {
        // Backboard: 0.55 behind the rim on the attacked basket
        const boardZ = rim.z - 0.55 * inFront
        const behindBoard =
          inFront > 0 ? b.pos.z < boardZ : b.pos.z > boardZ
        if (
          behindBoard &&
          b.pos.y > 2.9 &&
          b.pos.y < 4.4 &&
          Math.abs(b.pos.x - rim.x) < 1.25
        ) {
          b.pos.z = boardZ
          b.vel.z = Math.abs(b.vel.z) * 0.5 * inFront
          b.state = 'loose'
        }
        const dr = b.pos.distanceTo(rim)
        if (dr < 0.6 && b.shotT > 0.25) {
          const ang = Math.random() * Math.PI * 2
          b.state = 'loose'
          b.vel.set(
            Math.cos(ang) * (2 + Math.random() * 2.5),
            2.5 + Math.random() * 2,
            Math.abs(Math.sin(ang)) * (2 + Math.random() * 2.5) * inFront,
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
      // Change of possession: in 3v3 the ball must be cleared past the
      // arc; in 5v5 the new team just attacks the opposite basket.
      G.possession = p.team as 0 | 1
      G.mustClear = G.mode === '3v3'
      if (G.mode === '3v3') {
        setMessage(p.team === 0 ? 'YOUR BALL - CLEAR IT!' : 'RED BALL!', 1.4)
      } else {
        setMessage(p.team === 0 ? 'YOUR BALL - PUSH IT!' : 'RED BALL!', 1.4)
      }
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
    const me = G.players[G.controlled]
    const defending = G.phase === 'play' && G.possession !== me.team
    const full = G.mode === '5v5'
    const maxFz = full ? 12.6 : 4.5
    const minFz = full ? -12.6 : -10
    const maxFx = full ? 7.8 : 6.5

    // Lead the action: anticipate where the ball is going
    const leadX = THREE.MathUtils.clamp(b.vel.x * 0.28, -2.2, 2.2)
    const leadZ = THREE.MathUtils.clamp(b.vel.z * (full ? 0.3 : 0.22), -2.6, 2.6)
    let fx = THREE.MathUtils.clamp(b.pos.x + leadX, -maxFx, maxFx)
    let fz = THREE.MathUtils.clamp(b.pos.z + leadZ, minFz, maxFz)

    // DEFENSE: frame the midpoint between MY defender and the ball so both
    // are always on screen - much easier to position yourself.
    if (defending) {
      fx = THREE.MathUtils.clamp(
        me.pos.x * 0.45 + b.pos.x * 0.55 + leadX * 0.4,
        -maxFx,
        maxFx,
      )
      fz = THREE.MathUtils.clamp(
        me.pos.z * 0.45 + b.pos.z * 0.55 + leadZ * 0.4,
        minFz,
        maxFz,
      )
    }

    // Action intensity: 0 out top, 1 at the rim -> camera pushes in and
    // drops. In 5v5 the "action rim" is whichever basket is being attacked.
    const rimT = THREE.MathUtils.clamp(
      1 - distToRim(b.pos, G.possession) / 12,
      0,
      1,
    )
    // Airborne ball (shot/dunk) pulls the camera up slightly for the arc
    const airT = THREE.MathUtils.clamp((b.pos.y - 1.6) / 3.5, 0, 1)
    // Fast ball = wider, more cinematic framing
    const ballSpeed = Math.hypot(b.vel.x, b.vel.z)
    const speedT = THREE.MathUtils.clamp(ballSpeed / 9, 0, 1)

    // On defense stay higher & further back for full court vision - the
    // camera never dives behind the backboard.
    const camH = defending
      ? 9.2 - rimT * 0.7 + airT * 0.7
      : 7.6 - rimT * 1.7 + airT * 0.9 + speedT * 0.5
    const camDist = defending ? 12.8 - rimT * 1.1 : 11.4 - rimT * 2.6
    // Subtle lateral orbit follows the ball side for a dynamic angle
    const orbit = defending ? 0 : THREE.MathUtils.clamp(fx * 0.1, -0.8, 0.8)

    if (full) {
      // 5v5 BROADCAST CAM: classic sideline view from the +x side so both
      // baskets stay readable as play flows end to end. Pulled higher and
      // further back for the larger court.
      const sideH = 10.2 - rimT * 1.4 + airT * 0.9 + speedT * 0.6
      const sideDist = 16.6 - rimT * 2.2 + speedT * 0.9
      V.set(sideDist, sideH, fz * 0.78)
      V2.set(fx * 0.35 - 1.4, 0.9 + airT * 1.1, fz * 0.88)
    } else {
      V.set(fx * (0.5 + rimT * 0.18) + orbit, camH, fz * 0.42 + camDist)
      V2.set(fx * 0.7, 1.0 + airT * 1.1, fz * 0.58 - 3.0)
    }

    // DEFENSE CAM (3v3 only): when your team is defending, glide behind
    // the hoop so you see the attack coming at you.
    const wantDef =
      !full &&
      G.phase === 'play' &&
      G.possession === 1 &&
      b.state !== 'shot' &&
      b.state !== 'dunk'
        ? 1
        : 0
    defCamBlend.current +=
      (wantDef - defCamBlend.current) * (1 - Math.exp(-2.2 * dt))
    const db = defCamBlend.current
    if (db > 0.01) {
      // High behind the hoop, looking over the top of the backboard so
      // the board never blocks the view of the action near the rim
      V3.set(
        THREE.MathUtils.clamp(fx * 0.45, -3.2, 3.2),
        8.8 - rimT * 0.5,
        rimGroundOf(0).z - 7.2,
      )
      V.lerp(V3, db)
      V3.set(
        fx * 0.8,
        0.5 + airT * 0.8,
        THREE.MathUtils.clamp(fz, -6, 4) * 0.9,
      )
      V2.lerp(V3, db)
    }

    if (!camInit.current) {
      G.camPos.copy(V)
      G.camLook.copy(V2)
      camInit.current = true
    } else {
      // Faster panning when the ball moves fast, smooth when settled
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

    // Zoom punch-in near the rim, slight wide-angle on fast breaks;
    // defense keeps a steady wider lens.
    const cam = camera as THREE.PerspectiveCamera
    const targetFov = defending
      ? full
        ? 55
        : 53
      : (full ? 53 : 50) - rimT * 6 + speedT * 2
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
    if (hud.mode !== G.mode) patch.mode = G.mode
    if (Object.keys(patch).length > 0) hud.setHud(patch)
  }

  return null
}
