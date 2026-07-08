// Online "play with a friend" networking built on Supabase Realtime
// broadcast channels. Host-authoritative: the host runs the full simulation
// and broadcasts compact state snapshots ~20x/sec; the guest renders those
// snapshots and streams its input (movement + one-shot actions) back.

import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import type { GameMode, MapId, PlayerAnim } from '@/lib/game'

// ---------- Wire types ----------
export interface RoomSettings {
  mode: GameMode
  map: MapId
  kit0: number // host team (team 0)
  kit1: number // guest team (team 1)
}

export type MpAction = 'shootDown' | 'shootUp' | 'pass' | 'steal' | 'restart'

export interface GuestInputMsg {
  mx: number // WORLD-space move dir (guest converts from its own camera)
  mz: number
  sprint: boolean
  actions: MpAction[]
}

// Compact per-player state: numbers only to keep packets small.
// [x, y, z, facing, animIdx, animT, speed, shotStyle, dunkStyle, dunkT,
//  stunT, stumbleT, crossLean, grounded(0|1), celebrateT]
export type PlayerSnap = number[]

export interface Snapshot {
  p: PlayerSnap[]
  // ball: [x, y, z, vx, vy, vz, stateIdx, holder, spin]
  b: number[]
  s: [number, number] // scores
  pos: 0 | 1 // possession
  ph: number // phase idx: 0 play, 1 reset, 2 over
  ctrl: number // guest's controlled player id
  msg: string
  msgT: number
  mc: boolean // mustClear
  // guest shot meter mirrored from the host sim: [active, value, lo, hi]
  gm: [number, number, number, number]
}

export const ANIMS: PlayerAnim[] = [
  'idle',
  'run',
  'shoot',
  'dunk',
  'jump',
  'block',
  'shuffle',
  'fall',
  'pass',
  'celebrate',
  'steal',
  'stumble',
  'catch',
]
export const BALL_STATES = ['held', 'shot', 'pass', 'loose', 'dunk'] as const

// ---------- Singleton state (read directly by the game loop) ----------
export type MpRole = 'host' | 'guest'

export const MP = {
  active: false,
  role: null as MpRole | null,
  code: '',
  peerConnected: false,
  // HOST side: latest input received from the guest
  guestInput: {
    mx: 0,
    mz: 0,
    sprint: false,
    queue: [] as MpAction[],
  },
  // HOST side: which team-1 player the guest is controlling + his meter
  guestControlled: -1,
  guestMeter: { active: false, value: 0, window: [0.64, 0.8] as [number, number] },
  // GUEST side: latest snapshot from the host
  snapshot: null as Snapshot | null,
  snapshotFresh: false,
  // GUEST side: outgoing input accumulator (sent on an interval)
  outInput: { mx: 0, mz: 0, sprint: false, actions: [] as MpAction[] },
}

let supabase: ReturnType<typeof createClient> | null = null
let channel: RealtimeChannel | null = null
let sendTimer: ReturnType<typeof setInterval> | null = null

function client() {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        // The realtime client throttles broadcasts to 10 msgs/sec by default,
        // but the host streams ~20 snapshots/sec and the guest ~30 inputs/sec.
        // Without raising this cap messages queue up and the game stutters.
        realtime: { params: { eventsPerSecond: 50 } },
      },
    )
  }
  return supabase
}

export function makeRoomCode() {
  // Unambiguous alphabet (no 0/O, 1/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 5; i++)
    code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function queueMpAction(a: MpAction) {
  if (MP.outInput.actions.length > 8) return
  MP.outInput.actions.push(a)
}

// ---------- Host ----------
export function hostRoom(
  code: string,
  settings: RoomSettings,
  cb: {
    onGuestJoin: () => void
    onGuestLeave: () => void
  },
) {
  leaveRoom()
  MP.active = true
  MP.role = 'host'
  MP.code = code
  MP.peerConnected = false

  const ch = client().channel(`hoops:${code}`, {
    config: { broadcast: { self: false }, presence: { key: 'host' } },
  })
  channel = ch

  ch.on('broadcast', { event: 'input' }, ({ payload }) => {
    const m = payload as GuestInputMsg
    MP.guestInput.mx = m.mx
    MP.guestInput.mz = m.mz
    MP.guestInput.sprint = m.sprint
    for (const a of m.actions) {
      if (MP.guestInput.queue.length < 12) MP.guestInput.queue.push(a)
    }
  })
  ch.on('presence', { event: 'join' }, ({ key }) => {
    if (key !== 'host' && !MP.peerConnected) {
      MP.peerConnected = true
      // Hand the guest the room settings so both clients build the same game
      ch.send({ type: 'broadcast', event: 'start', payload: settings })
      cb.onGuestJoin()
    }
  })
  ch.on('presence', { event: 'leave' }, ({ key }) => {
    if (key !== 'host' && MP.peerConnected) {
      MP.peerConnected = false
      cb.onGuestLeave()
    }
  })
  ch.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') await ch.track({ role: 'host' })
  })
}

// Host: broadcast a state snapshot (called from the game loop on a timer)
export function sendSnapshot(snap: Snapshot) {
  channel?.send({ type: 'broadcast', event: 'state', payload: snap })
}

// Host: re-send settings (e.g. if the guest asked again)
export function resendStart(settings: RoomSettings) {
  channel?.send({ type: 'broadcast', event: 'start', payload: settings })
}

// ---------- Guest ----------
export function joinRoom(
  code: string,
  cb: {
    onStart: (settings: RoomSettings) => void
    onHostLeave: () => void
    onJoined: () => void
    onError: (msg: string) => void
  },
) {
  leaveRoom()
  MP.active = true
  MP.role = 'guest'
  MP.code = code
  MP.peerConnected = false

  const ch = client().channel(`hoops:${code}`, {
    config: { broadcast: { self: false }, presence: { key: `guest` } },
  })
  channel = ch

  let started = false
  ch.on('broadcast', { event: 'start' }, ({ payload }) => {
    if (started) return
    started = true
    MP.peerConnected = true
    cb.onStart(payload as RoomSettings)
  })
  ch.on('broadcast', { event: 'state' }, ({ payload }) => {
    MP.snapshot = payload as Snapshot
    MP.snapshotFresh = true
  })
  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState()
    if (!state['host'] && started) cb.onHostLeave()
    if (state['host'] && !MP.peerConnected) MP.peerConnected = true
  })
  ch.on('presence', { event: 'leave' }, ({ key }) => {
    if (key === 'host') cb.onHostLeave()
  })
  ch.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await ch.track({ role: 'guest' })
      cb.onJoined()
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      cb.onError('CONNECTION FAILED - TRY AGAIN')
    }
  })

  // Stream input to the host ~30x/sec
  sendTimer = setInterval(() => {
    if (!channel || !MP.peerConnected) return
    const out = MP.outInput
    channel.send({
      type: 'broadcast',
      event: 'input',
      payload: {
        mx: out.mx,
        mz: out.mz,
        sprint: out.sprint,
        actions: out.actions.splice(0, out.actions.length),
      } satisfies GuestInputMsg,
    })
  }, 33)
}

// ---------- Shared ----------
export function leaveRoom() {
  if (sendTimer) {
    clearInterval(sendTimer)
    sendTimer = null
  }
  if (channel) {
    try {
      channel.unsubscribe()
      client().removeChannel(channel)
    } catch {
      // channel already gone
    }
    channel = null
  }
  MP.active = false
  MP.role = null
  MP.code = ''
  MP.peerConnected = false
  MP.snapshot = null
  MP.snapshotFresh = false
  MP.guestControlled = -1
  MP.guestMeter.active = false
  MP.guestInput.mx = 0
  MP.guestInput.mz = 0
  MP.guestInput.sprint = false
  MP.guestInput.queue.length = 0
  MP.outInput.mx = 0
  MP.outInput.mz = 0
  MP.outInput.sprint = false
  MP.outInput.actions.length = 0
}
