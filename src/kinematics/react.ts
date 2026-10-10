import { useEffect, useRef, useState, type RefObject } from 'react'
import { subscribeFrame, type FramePhase } from './scheduler'

/**
 * React animation-frame hook backed by the repository-wide scheduler. The
 * callback receives elapsed time and per-frame delta in ms.
 *
 * `active` gates the subscription itself rather than the callback body: a
 * consumer that has nothing to animate must not hold the shared scheduler
 * open, otherwise one idle subscriber keeps a 60 Hz native frame alive for the
 * whole document. The elapsed-time origin survives an inactive interval, so a
 * looping timeline resumes on the same clock it left.
 */
export function useAnimationFrame(
  callback: (time: number, delta: number) => void,
  active = true,
  { phase = 'write', label = 'react-animation' }: { phase?: FramePhase; label?: string } = {},
) {
  const callbackRef = useRef(callback)
  const startRef = useRef<number | null>(null)

  callbackRef.current = callback

  useEffect(() => {
    if (!active) return
    return subscribeFrame(({ now, deltaMs }) => {
      if (startRef.current === null) startRef.current = now
      callbackRef.current(now - startRef.current, deltaMs)
    }, { phase, label })
  }, [active, phase, label])
}

/**
 * Low-frequency visibility gate for expensive decorative animation. It begins
 * inactive so cold mount cannot start work before the observer has established
 * that the owning surface is genuinely visible.
 */
export function useViewportActive<T extends Element>(ref: RefObject<T | null>, threshold = 0.05) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (!('IntersectionObserver' in window)) {
      setActive(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      setActive(Boolean(entry?.isIntersecting && entry.intersectionRatio >= threshold))
    }, { threshold: [0, threshold] })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, threshold])

  return active
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return reduced
}

export function useInView<T extends Element>(
  ref: RefObject<T | null>,
  { once = false, rootMargin = '0px' }: { once?: boolean; rootMargin?: string } = {},
) {
  const [inView, setInView] = useState(false)
  const seen = useRef(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (!('IntersectionObserver' in window)) {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      const visible = Boolean(entry?.isIntersecting)
      if (visible) seen.current = true
      setInView(once ? seen.current : visible)
      if (visible && once) observer.disconnect()
    }, { rootMargin })
    observer.observe(element)
    return () => observer.disconnect()
  }, [once, ref, rootMargin])

  return inView
}
