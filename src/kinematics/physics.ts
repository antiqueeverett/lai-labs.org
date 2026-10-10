export type SpringState = {
  value: number
  velocity: number
}

export type SpringConfig = {
  stiffness: number
  damping: number
  mass?: number
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Semi-implicit Euler step for a damped harmonic oscillator. */
export function stepSpring(
  state: SpringState,
  target: number,
  dt: number,
  { stiffness, damping, mass = 1 }: SpringConfig,
) {
  const acceleration = (-stiffness * (state.value - target) - damping * state.velocity) / mass
  state.velocity += acceleration * dt
  state.value += state.velocity * dt
}

/**
 * Fixed-substep integration keeps the same physical response on 60/120/144 Hz
 * displays and remains stable after an occasional long frame.
 */
export function integrateFixed(frameSeconds: number, step: (dt: number) => void) {
  let remaining = Math.min(frameSeconds, 0.05)
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 120)
    step(dt)
    remaining -= dt
  }
}
