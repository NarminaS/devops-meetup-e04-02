const COLORS = ['#aa3bff', '#ff4d6d', '#ffbe0b', '#3a86ff', '#06d6a0', '#fb5607']

/** Longest possible piece animation, used to clean up finished bursts. */
export const MAX_CONFETTI_DURATION_MS = 1600
const MIN_CONFETTI_DURATION_MS = 900

export interface ConfettiPiece {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  rotate: number
  color: string
  size: number
  duration: number
  round: boolean
}

let nextId = 0

/** Create a burst of confetti pieces originating from (x, y) in viewport coordinates. */
export function createBurst(x: number, y: number, count: number): ConfettiPiece[] {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2
    const distance = 60 + Math.random() * 160
    return {
      id: nextId++,
      x,
      y,
      dx: Math.cos(angle) * distance,
      // bias upwards so the burst looks like an explosion before gravity kicks in
      dy: Math.sin(angle) * distance - 80,
      rotate: (Math.random() - 0.5) * 1080,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 6,
      duration:
        MIN_CONFETTI_DURATION_MS +
        Math.random() * (MAX_CONFETTI_DURATION_MS - MIN_CONFETTI_DURATION_MS),
      round: Math.random() < 0.3,
    }
  })
}
