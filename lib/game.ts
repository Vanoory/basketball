import * as THREE from 'three'
import { create } from 'zustand'

// ---------- Constants ----------
export const RIM = new THREE.Vector3(0, 3.05, -9.4)
export const RIM_GROUND = new THREE.Vector3(0, 0, -9.4)
// 5v5 full court is LARGER: baskets sit deeper at +-11.9
export const RIM_5 = new THREE.Vector3(0, 3.05, -11.9)
export const RIM_5_GROUND = new THREE.Vector3(0, 0, -11.9)
export const RIM_5B = new THREE.Vector3(0, 3.05, 11.9)
export const RIM_5B_GROUND = new THREE.Vector3(0, 0, 11.9)
// Offset of the 5v5 end markings vs the 3v3 half court (rim -9.4 -> -11.9)
export const END_OFFSET_5V5 = -2.5
export const THREE_PT_RADIUS = 6.6
// Mutable court bounds - swapped when the game mode changes
export const COURT = { minX: -8.4, maxX: 8.4, minZ: -10.9, maxZ: 4.6 }
const COURT_3V3 = { minX: -8.4, maxX: 8.4, minZ: -10.9, maxZ: 4.6 }
const COURT_5V5 = { minX: -9.4, maxX: 9.4, minZ: -13.4, maxZ: 13.4 }
export const GRAVITY = -20
export const WIN_SCORE = 21

// ---------- Game modes ----------
export type GameMode = '3v3' | '5v5'

// In 3v3 both teams attack the single half-court rim.
// In 5v5 team 0 attacks the -z rim (RIM), team 1 attacks the +z rim (RIM_B).
export function attackRim(mode: GameMode, team: 0 | 1) {
  if (mode === '5v5') return team === 1 ? RIM_5B : RIM_5
  return RIM
}
export function attackRimGround(mode: GameMode, team: 0 | 1) {
  if (mode === '5v5') return team === 1 ? RIM_5B_GROUND : RIM_5_GROUND
  return RIM_GROUND
}

export const METER_FILL_TIME = 1.05 // seconds to fill meter fully
export const METER_PERFECT_CENTER = 0.72
export const STUN_TIME = 1.25 // how long a player stays down after ankle-break

// ---------- Types ----------
export type PlayerAnim =
  | 'idle'
  | 'run'
  | 'shoot'
  | 'dunk'
  | 'jump'
  | 'block'
  | 'shuffle'
  | 'fall'
  | 'pass'
  | 'celebrate'
  | 'steal'
  | 'stumble'
  | 'catch'

// Dunk styles: 0 two-hand jam, 1 tomahawk, 2 windmill, 3 360 slam, 4 reverse
export const DUNK_DUR = [0.72, 0.78, 0.92, 0.98, 0.85]
export const DUNK_NAMES = [
  'TWO-HAND JAM!',
  'TOMAHAWK!',
  'WINDMILL!',
  '360 SLAM!',
  'REVERSE JAM!',
]

// Shot styles: 0 jumper, 1 fadeaway, 2 floater
export type ShotStyle = 0 | 1 | 2

// ---------- Player identity / look ----------
export type HairStyle = 'afro' | 'flattop' | 'buzz' | 'hightop' | 'bun' | 'curls'

export interface PlayerLook {
  h: number // height scale (silhouette variety)
  w: number // width / build scale
  hair: HairStyle
  headband: boolean
  sleeve: 'none' | 'left' | 'right' // shooting-arm compression sleeve
  legSleeve: boolean
  number: number // jersey number 0-99
}

// How an AI player likes to score. Probability weights, not hard rules.
export interface ShotTendency {
  three: number // loves pulling up from deep
  mid: number // mid-range pull-up game
  drive: number // attacks the rim for dunks / floaters
}

// What the AI ball handler decided to do this possession
export type AIPlan = 'drive' | 'pull3' | 'midpull' | 'probe'

export interface PlayerData {
  id: number
  team: 0 | 1
  pos: THREE.Vector3
  vel: THREE.Vector3 // momentum-based movement
  facing: number
  anim: PlayerAnim
  animT: number
  vy: number
  grounded: boolean
  speed: number
  aiTimer: number
  spot: THREE.Vector3
  cutting: boolean // backdoor cut in progress
  dunkFrom: THREE.Vector3
  dunkT: number
  dunking: boolean
  dunkStyle: number // which dunk animation is playing
  dunkFacing: number // facing captured at takeoff (for 360 spins)
  shotStyle: ShotStyle // 0 jumper, 1 fadeaway, 2 floater
  stunT: number // > 0 => knocked down (ankle break)
  stumbleT: number // > 0 => staggered but on his feet (light cross)
  ankleCd: number // cooldown so the same defender is not dropped every frame
  reactT: number // defender reaction delay accumulator
  reactTarget: THREE.Vector3 // where the defender THINKS he should be
  crossLean: number // sideways lean for crossover animation
  celebrateT: number
  helpDef: boolean // temporarily rotating onto ball handler
  screenedT: number // > 0 => caught on a screen / body, slowed down
  trailing: boolean // defender got beaten and is sprinting to recover
  colors: { jersey: string; shorts: string; skin: string; hair: string }
  look: PlayerLook
  tendency: ShotTendency
  aiPlan: AIPlan
  aiPlanFresh: boolean // set when a new plan is picked (handler resets timers)
}

export type BallState = 'held' | 'shot' | 'pass' | 'loose' | 'dunk'

export interface BallData {
  pos: THREE.Vector3
  vel: THREE.Vector3
  state: BallState
  holder: number // player id or -1
  passTo: number
  shotT: number
  shotWillScore: boolean
  shotPoints: number
  shooterId: number
  scored: boolean
  spin: number
  passDist: number // total distance of the current pass (for the arc)
  passArc: number // peak height of the pass arc
  passFromY: number // launch height of the pass
}

export interface GameData {
  mode: GameMode
  perTeam: number // 3 or 5 - team 0 ids are 0..perTeam-1, team 1 follows
  players: PlayerData[]
  ball: BallData
  possession: 0 | 1
  scores: [number, number]
  phase: 'play' | 'reset' | 'over'
  phaseT: number
  controlled: number
  meterActive: boolean
  meterValue: number
  meterWindow: [number, number]
  shotDist: number
  message: string
  messageT: number
  camPos: THREE.Vector3
  camLook: THREE.Vector3
  camShake: number
  time: number
  mustClear: boolean // new possession must take the ball beyond the arc
  inboundTeam: -1 | 0 | 1 // after a made basket only this team may pick it up
}

// ---------- Factory ----------
// 5 color kits per team - 3v3 uses the first 3, 5v5 uses all 5
const TEAM0 = [
  { jersey: '#3b82f6', shorts: '#1d4ed8', skin: '#c68642', hair: '#1c1917' },
  { jersey: '#3b82f6', shorts: '#1d4ed8', skin: '#f1c27d', hair: '#78350f' },
  { jersey: '#3b82f6', shorts: '#1d4ed8', skin: '#8d5524', hair: '#0c0a09' },
  { jersey: '#3b82f6', shorts: '#1d4ed8', skin: '#e0ac69', hair: '#292524' },
  { jersey: '#3b82f6', shorts: '#1d4ed8', skin: '#8d5524', hair: '#3f2c1a' },
]
const TEAM1 = [
  { jersey: '#ef4444', shorts: '#b91c1c', skin: '#f1c27d', hair: '#facc15' },
  { jersey: '#ef4444', shorts: '#b91c1c', skin: '#8d5524', hair: '#1c1917' },
  { jersey: '#ef4444', shorts: '#b91c1c', skin: '#c68642', hair: '#44403c' },
  { jersey: '#ef4444', shorts: '#b91c1c', skin: '#e0ac69', hair: '#0c0a09' },
  { jersey: '#ef4444', shorts: '#b91c1c', skin: '#f1c27d', hair: '#57534e' },
]

// Each player gets his own silhouette, hair, and gear so nobody looks
// like a clone. Index = slot within the team (0-4).
const LOOKS0: PlayerLook[] = [
  { h: 0.96, w: 0.94, hair: 'buzz', headband: true, sleeve: 'right', legSleeve: false, number: 1 },
  { h: 1.1, w: 1.12, hair: 'afro', headband: false, sleeve: 'none', legSleeve: true, number: 34 },
  { h: 1.02, w: 0.98, hair: 'hightop', headband: false, sleeve: 'left', legSleeve: false, number: 7 },
  { h: 0.98, w: 0.96, hair: 'curls', headband: false, sleeve: 'none', legSleeve: true, number: 11 },
  { h: 1.14, w: 1.16, hair: 'flattop', headband: true, sleeve: 'left', legSleeve: false, number: 42 },
]
const LOOKS1: PlayerLook[] = [
  { h: 0.99, w: 0.96, hair: 'bun', headband: true, sleeve: 'none', legSleeve: false, number: 0 },
  { h: 1.12, w: 1.14, hair: 'flattop', headband: false, sleeve: 'none', legSleeve: true, number: 55 },
  { h: 0.94, w: 0.92, hair: 'curls', headband: false, sleeve: 'right', legSleeve: false, number: 23 },
  { h: 1.04, w: 1.0, hair: 'buzz', headband: false, sleeve: 'left', legSleeve: false, number: 8 },
  { h: 1.15, w: 1.18, hair: 'afro', headband: true, sleeve: 'none', legSleeve: true, number: 50 },
]

// Matches LOOKS by team slot: the small guards are shooters, the bigs are
// rim runners, the wings are balanced. Weights are relative, not percentages.
const TENDENCIES0: ShotTendency[] = [
  { three: 0.45, mid: 0.3, drive: 0.25 }, // #1  sharpshooting guard
  { three: 0.1, mid: 0.2, drive: 0.7 }, // #34 big man - lives at the rim
  { three: 0.3, mid: 0.4, drive: 0.3 }, // #7  mid-range wing
  { three: 0.4, mid: 0.35, drive: 0.25 }, // #11 combo guard
  { three: 0.05, mid: 0.15, drive: 0.8 }, // #42 center - rim runner
]
const TENDENCIES1: ShotTendency[] = [
  { three: 0.5, mid: 0.25, drive: 0.25 }, // #0  deep-range gunner
  { three: 0.08, mid: 0.22, drive: 0.7 }, // #55 bruiser - dunks only
  { three: 0.35, mid: 0.35, drive: 0.3 }, // #23 smooth all-around scorer
  { three: 0.42, mid: 0.3, drive: 0.28 }, // #8  streaky shooter
  { three: 0.05, mid: 0.18, drive: 0.77 }, // #50 paint monster
]

function makePlayer(id: number, team: 0 | 1, slot: number, x: number, z: number): PlayerData {
  return {
    id,
    team,
    pos: new THREE.Vector3(x, 0, z),
    vel: new THREE.Vector3(),
    facing: Math.PI, // face the hoop (-z)
    anim: 'idle',
    animT: 0,
    vy: 0,
    grounded: true,
    speed: 0,
    aiTimer: 1 + Math.random() * 2,
    spot: new THREE.Vector3(x, 0, z),
    cutting: false,
    dunkFrom: new THREE.Vector3(),
    dunkT: 0,
    dunking: false,
    dunkStyle: 0,
    dunkFacing: 0,
    shotStyle: 0,
    stunT: 0,
    stumbleT: 0,
    ankleCd: 0,
    reactT: 0,
    reactTarget: new THREE.Vector3(x, 0, z),
    crossLean: 0,
    celebrateT: 0,
    helpDef: false,
    screenedT: 0,
    trailing: false,
    colors: team === 0 ? TEAM0[slot % 5] : TEAM1[slot % 5],
    look: team === 0 ? LOOKS0[slot % 5] : LOOKS1[slot % 5],
    tendency: team === 0 ? TENDENCIES0[slot % 5] : TENDENCIES1[slot % 5],
    aiPlan: 'probe',
    aiPlanFresh: false,
  }
}

export function createGame(mode: GameMode = '3v3'): GameData {
  const players =
    mode === '3v3'
      ? [
          makePlayer(0, 0, 0, 0, 2.5),
          makePlayer(1, 0, 1, -5.5, -2),
          makePlayer(2, 0, 2, 5.5, -2),
          makePlayer(3, 1, 0, 0, 0.8),
          makePlayer(4, 1, 1, -4.2, -4),
          makePlayer(5, 1, 2, 4.2, -4),
        ]
      : [
          // Team 0 (blue) attacks the -z rim, starts on the +z half
          makePlayer(0, 0, 0, 0, 2),
          makePlayer(1, 0, 1, -6, 4.5),
          makePlayer(2, 0, 2, 6, 4.5),
          makePlayer(3, 0, 3, -3, 7.5),
          makePlayer(4, 0, 4, 3, 7.5),
          // Team 1 (red) attacks the +z rim, defends the -z half first
          makePlayer(5, 1, 0, 0, -1.5),
          makePlayer(6, 1, 1, -5, -4.5),
          makePlayer(7, 1, 2, 5, -4.5),
          makePlayer(8, 1, 3, -2.5, -7.5),
          makePlayer(9, 1, 4, 2.5, -7.5),
        ]
  const bounds = mode === '3v3' ? COURT_3V3 : COURT_5V5
  Object.assign(COURT, bounds)
  return {
    mode,
    perTeam: mode === '3v3' ? 3 : 5,
    players,
    ball: {
      pos: new THREE.Vector3(0, 1, 2.5),
      vel: new THREE.Vector3(),
      state: 'held',
      holder: 0,
      passTo: -1,
      shotT: 0,
      shotWillScore: false,
      shotPoints: 2,
      shooterId: -1,
      scored: false,
      spin: 0,
      passDist: 0,
      passArc: 0,
      passFromY: 1.3,
    },
    possession: 0,
    scores: [0, 0],
    phase: 'play',
    phaseT: 0,
    controlled: 0,
    meterActive: false,
    meterValue: 0,
    meterWindow: [0.64, 0.8],
    shotDist: 0,
    message: 'FIRST TO 21 - CHECK BALL',
    messageT: 2.5,
    camPos: new THREE.Vector3(0, 8, 14),
    camLook: new THREE.Vector3(0, 1, -4),
    camShake: 0,
    time: 0,
    mustClear: false,
    inboundTeam: -1,
  }
}

// Mutable singleton game state (perf: avoid React re-renders in the sim loop)
export const G: GameData = createGame()
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__G = G
}

// Rebuild the singleton in place for a new mode (references to G stay valid)
export function setGameMode(mode: GameMode) {
  const fresh = createGame(mode)
  Object.assign(G, fresh)
}

// Rim helpers bound to the live game mode. `team` is the ATTACKING team.
export function rimOf(team: 0 | 1) {
  return attackRim(G.mode, team)
}
export function rimGroundOf(team: 0 | 1) {
  return attackRimGround(G.mode, team)
}

export function distToRim(p: THREE.Vector3, team: 0 | 1 = 0) {
  const rg = rimGroundOf(team)
  const dx = p.x - rg.x
  const dz = p.z - rg.z
  return Math.sqrt(dx * dx + dz * dz)
}

export function isThree(p: THREE.Vector3, team: 0 | 1 = 0) {
  return distToRim(p, team) > THREE_PT_RADIUS
}

// ---------- HUD store (synced from the loop at low frequency) ----------
interface HudState {
  scores: [number, number]
  possession: 0 | 1
  meterActive: boolean
  meterValue: number
  meterWindow: [number, number]
  message: string
  over: boolean
  winner: 0 | 1
  started: boolean
  mode: GameMode
  setHud: (p: Partial<HudState>) => void
}

export const useHud = create<HudState>((set) => ({
  scores: [0, 0],
  possession: 0,
  meterActive: false,
  meterValue: 0,
  meterWindow: [0.64, 0.8],
  message: '',
  over: false,
  winner: 0,
  started: false,
  mode: '3v3',
  setHud: (p) => set(p),
}))
