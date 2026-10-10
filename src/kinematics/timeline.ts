import { clamp } from './physics'
import { subscribeFrame } from './scheduler'

export type Easing = (progress: number) => number

export const linear: Easing = progress => progress
export const easeInOutCubic: Easing = progress =>
  progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2

/** CSS-compatible cubic Bézier easing solved against the curve's x axis. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const sample = (a: number, b: number, t: number) => {
    const c = 3 * a
    const d = 3 * (b - a) - c
    const e = 1 - c - d
    return ((e * t + d) * t + c) * t
  }
  return progress => {
    const target = clamp(progress, 0, 1)
    let low = 0
    let high = 1
    let time = target
    for (let iteration = 0; iteration < 12; iteration++) {
      time = (low + high) / 2
      if (sample(x1, x2, time) < target) low = time
      else high = time
    }
    return sample(y1, y2, time)
  }
}

export const standardEase = cubicBezier(0.21, 0.5, 0.27, 1)

export type TweenOptions<T> = {
  from: T
  to: T
  durationMs: number
  delayMs?: number
  ease?: Easing
  interpolate: (from: T, to: T, progress: number) => T
  write: (value: T) => void
  complete?: () => void
  label: string
}

/**
 * One scheduler-owned tween. Numeric interpolation happens in the update phase;
 * presentation is committed once in the write phase of the same browser frame.
 */
export function tween<T>({
  from,
  to,
  durationMs,
  delayMs = 0,
  ease = linear,
  interpolate,
  write,
  complete,
  label,
}: TweenOptions<T>) {
  let elapsedMs = 0
  let value = from
  let shouldWrite = true
  let done = false
  let cancelled = false

  const stopUpdate = subscribeFrame(({ deltaMs }) => {
    if (cancelled || done) return
    elapsedMs += deltaMs
    if (elapsedMs < delayMs) return
    const progress = durationMs <= 0 ? 1 : clamp((elapsedMs - delayMs) / durationMs, 0, 1)
    value = interpolate(from, to, ease(progress))
    shouldWrite = true
    done = progress >= 1
  }, { phase: 'update', label: `${label}:update` })

  const stopWrite = subscribeFrame(() => {
    if (cancelled || !shouldWrite) return
    shouldWrite = false
    write(value)
    if (!done) return
    stopUpdate()
    stopWrite()
    complete?.()
  }, { phase: 'write', label: `${label}:write` })

  return () => {
    cancelled = true
    stopUpdate()
    stopWrite()
  }
}

export function tweenNumber(options: Omit<TweenOptions<number>, 'interpolate'>) {
  return tween({
    ...options,
    interpolate: (from, to, progress) => from + (to - from) * progress,
  })
}

/** One update/write pair for a staggered group, regardless of item count. */
export function staggerNumber({
  count,
  durationMs,
  initialDelayMs,
  staggerMs,
  ease = linear,
  write,
  complete,
  label,
}: {
  count: number
  durationMs: number
  initialDelayMs: number
  staggerMs: number
  ease?: Easing
  write: (index: number, progress: number) => void
  complete?: (index: number) => void
  label: string
}) {
  if (count <= 0) return () => undefined
  let elapsedMs = 0
  let cancelled = false
  const values = new Array<number>(count).fill(0)
  const dirty = new Set<number>()
  const completed = new Set<number>()

  const stopUpdate = subscribeFrame(({ deltaMs }) => {
    if (cancelled) return
    elapsedMs += deltaMs
    for (let index = 0; index < count; index += 1) {
      if (completed.has(index)) continue
      const delay = initialDelayMs + index * staggerMs
      if (elapsedMs < delay) continue
      const progress = durationMs <= 0 ? 1 : clamp((elapsedMs - delay) / durationMs, 0, 1)
      values[index] = ease(progress)
      dirty.add(index)
      if (progress >= 1) completed.add(index)
    }
  }, { phase: 'update', label: `${label}:update` })

  const stopWrite = subscribeFrame(() => {
    if (cancelled || !dirty.size) return
    for (const index of dirty) {
      write(index, values[index])
      if (completed.has(index)) complete?.(index)
    }
    dirty.clear()
    if (completed.size !== count) return
    stopUpdate()
    stopWrite()
  }, { phase: 'write', label: `${label}:write` })

  return () => {
    cancelled = true
    stopUpdate()
    stopWrite()
  }
}
