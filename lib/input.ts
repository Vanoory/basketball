// Shared input bus: keyboard stays inside GameLoop, while touch controls
// and gamepads write into this singleton. GameLoop reads/consumes it every
// frame, so all three input methods can be mixed freely.

export type InputAction = 'shootDown' | 'shootUp' | 'pass' | 'steal' | 'restart'

export const INPUT = {
  // Analog movement in SCREEN space (-1..1). Same convention as WASD:
  // moveZ = -1 pushes "up the screen" (camera-relative mapping happens
  // later, in the game loop).
  moveX: 0,
  moveZ: 0,
  sprint: false,
  // One-shot action events queued by touch buttons / gamepad edges,
  // consumed once per frame by the game loop.
  queue: [] as InputAction[],
}

export function pushAction(a: InputAction) {
  if (INPUT.queue.length > 8) return
  INPUT.queue.push(a)
}

export function resetTouchMove() {
  INPUT.moveX = 0
  INPUT.moveZ = 0
}
