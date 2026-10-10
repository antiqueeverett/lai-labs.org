import {
  createElement,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react'
import { useInView, useReducedMotion } from '../kinematics/react'
import { standardEase, tweenNumber } from '../kinematics/timeline'

function prepareEntrance(element: HTMLElement, offset: number) {
  element.style.opacity = '0'
  element.style.transform = `translate3d(0,${offset}px,0)`
  element.style.willChange = 'transform, opacity'
}

function runEntrance(
  element: HTMLElement,
  { delayMs, durationMs, offset, label }: { delayMs: number; durationMs: number; offset: number; label: string },
) {
  return tweenNumber({
    from: 0,
    to: 1,
    durationMs,
    delayMs,
    ease: standardEase,
    label,
    write: progress => {
      element.style.opacity = progress.toFixed(4)
      element.style.transform = `translate3d(0,${((1 - progress) * offset).toFixed(3)}px,0)`
    },
    complete: () => {
      element.style.opacity = '1'
      element.style.transform = 'none'
      element.style.removeProperty('will-change')
    },
  })
}

/** Fade-up on scroll into view, advanced by the canonical scheduler. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = 'div',
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'li' | 'article' | 'section'
}) {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const inView = useInView(ref, { once: true, rootMargin: '0px 0px -8% 0px' })

  useLayoutEffect(() => {
    if (!reduce && ref.current) prepareEntrance(ref.current, 24)
  }, [reduce])

  useEffect(() => {
    const element = ref.current
    if (!element || !inView || reduce) return
    return runEntrance(element, {
      delayMs: delay * 1000,
      durationMs: 600,
      offset: 24,
      label: `reveal:${className ?? as}`,
    })
  }, [as, className, delay, inView, reduce])

  return createElement(as, { ref, className }, children)
}

/** Class contract for direct children of `Stagger`. */
export const staggerItemClass = 'kinematic-stagger-item'

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const inView = useInView(ref, { once: true, rootMargin: '0px 0px -6% 0px' })

  useLayoutEffect(() => {
    if (reduce || !ref.current) return
    for (const child of Array.from(ref.current.children)) {
      if (child instanceof HTMLElement) prepareEntrance(child, 22)
    }
  }, [reduce])

  useEffect(() => {
    if (!inView || reduce || !ref.current) return
    const stops = Array.from(ref.current.children).map((child, index) =>
      child instanceof HTMLElement
        ? runEntrance(child, {
            delayMs: 50 + index * 80,
            durationMs: 550,
            offset: 22,
            label: `stagger:${className ?? 'group'}:${index}`,
          })
        : () => undefined,
    )
    return () => stops.forEach(stop => stop())
  }, [className, inView, reduce])

  return <div ref={ref} className={className}>{children}</div>
}

/** Per-route entry transition. Route exits stay immediate and non-blocking. */
export function PageTransition({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  useLayoutEffect(() => {
    const element = ref.current
    if (!element || reduce) return
    prepareEntrance(element, 14)
    return runEntrance(element, {
      delayMs: 0,
      durationMs: 400,
      offset: 14,
      label: 'page-transition',
    })
  }, [reduce])

  return <div ref={ref}>{children}</div>
}
