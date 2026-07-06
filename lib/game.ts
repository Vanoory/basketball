import * as THREE from 'three'
import { create } from 'zustand'

// ---------- Constants ----------
export const RIM = new THREE.Vector3(0, 3.05, -9.4)
export const RIM_GROUND = new THREE.Vector3(0, 0, -9.4)
export const THREE_PT_RADIUS = 6.6
export const COURT = { minX: -8.4, maxX: 8.4, minZ: -10.9, maxZ: 4.6 }
export const GRAVITY = -20
export const WIN_SCORE = 21

export const METER_FILL_TIME = 1.05 // seconds to fill meter fully
export const METER_PERFECT_CENTER = 0.72

// ---------- Types ----------
export type PlayerAnim = 'idle' | 'run' | 'shoot' | 'dunk' | 'jump'

export interface PlayerData {
  id: number
  team: 0 | 1
  pos: THREE.Vector3
  facing: number
  anim: PlayerAnim
  animT: number
  vy: number
  grounded: boolean
  speed: number
  aiTimer: number
  spot: THREE.Vector3
  dunkFrom: THREE.Vector3
  dunkT: number
  dunking: boolean
  colors: { jersey: string; shorts: string; skin: string; hair: string }
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
}

export interface GameData {
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
  time: number
}

// ---------- Factory ----------
const TEAM0 = [
  { jersey: '#3b82f6', shorts: '#1d4ed8', skin: '#c68642', hair: '#1c1917' },
  { jersey: '#3b82f6', shorts: '#1d4ed8', skin: '#f1c27d', hair: '#78350f' },
  { jersey: '#3b82f6', shorts: '#1d4ed8', skin: '#8d5524', hair: '#0c0a09' },
]
const TEAM1 = [
  { jersey: '#ef4444', shorts: '#b91c1c', skin: '#f1c27d', hair: '#facc15' },
  { jersey: '#ef4444', shorts: '#b91c1c', skin: '#8d5524', hair: '#1c1917' },
  { jersey: '#ef4444', shorts: '#b91c1c', skin: '#c68642', hair: '#44403c' },
]

function makePlayer(id: number, team: 0 | 1, x: number, z: number): PlayerData {
  return {
    id,
    team,
    pos: new THREE.Vector3(x, 0, z),
    facing: Math.PI, // face the hoop (-z)
    anim: 'idle',
    animT: 0,
    vy: 0,
    grounded: true,
    speed: 0,
    aiTimer: 1 + Math.random() * 2,
    spot: new THREE.Vector3(x, 0, z),
    dunkFrom: new THREE.Vector3(),
    dunkT: 0,
    dunking: false,
    colors: team === 0 ? TEAM0[id % 3] : TEAM1[id % 3],
  }
}

export function createGame(): GameData {
  const players = [
    makePlayer(0, 0, 0, 2.5),
    makePlayer(1, 0, -5.5, -2),
    makePlayer(2, 0, 5.5, -2),
    makePlayer(3, 1, 0, 0.8),
    makePlayer(4, 1, -4.2, -4),
    makePlayer(5, 1, 4.2, -4),
  ]
  return {
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
    time: 0,
  }
}

// Mutable singleton game state (perf: avoid React re-renders in the sim loop)
export const G: GameData = createGame()

export function distToRim(p: THREE.Vector3) {
  const dx = p.x - RIM_GROUND.x
  const dz = p.z - RIM_GROUND.z
  return Math.sqrt(dx * dx + dz * dz)
}

export function isThree(p: THREE.Vector3) {
  return distToRim(p) > THREE_PT_RADIUS
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
  setHud: (p) => set(p),
}))
