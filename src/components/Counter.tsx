import { useEffect, useRef } from 'react'
import { useInView, useReducedMotion } from '../kinematics/react'
import { cubicBezier, tweenNumber } from '../kinematics/timeline'

/**
 * Rolling odometer counter — spins up rapidly then settles when scrolled into view.
 * Reduced-motion: shows the final value immediately.
 */
export function Counter({
  to,
  duration = 1.9,
  prefix = '',
  suffix = '',
  className,
}: {
  to: number
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const valueRef = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, rootMargin: '0px 0px -15% 0px' })
  const reduce = useReducedMotion()

  useEffect(() => {
    const element = ref.current
    const valueElement = valueRef.current
    if (!inView || !element || !valueElement) return
    if (reduce) {
      valueElement.textContent = Math.round(to).toLocaleString()
      element.style.removeProperty('text-shadow')
      return
    }
    return tweenNumber({
      from: 0,
      to,
      durationMs: duration * 1000,
      ease: cubicBezier(0.12, 0.7, 0.1, 1),
      label: 'counter',
      write: value => {
        valueElement.textContent = Math.round(value).toLocaleString()
        const progress = to ? Math.min(1, Math.abs(value / to)) : 1
        const glow = Math.max(0, Math.min(1, progress / 0.16, (1 - progress) / 0.16))
        element.style.textShadow = `0 0 ${(22 * glow).toFixed(2)}px rgba(90,169,242,${(0.55 * glow).toFixed(3)})`
      },
      complete: () => element.style.removeProperty('text-shadow'),
    })
  }, [inView, to, duration, reduce])

  return (
    <span ref={ref} className={`counter ${className ?? ''}`}>
      {prefix}
      <span ref={valueRef}>{reduce ? Math.round(to).toLocaleString() : '0'}</span>
      {suffix}
    </span>
  )
}
