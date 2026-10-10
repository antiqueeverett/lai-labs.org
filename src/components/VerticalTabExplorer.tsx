import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useReducedMotion } from '../kinematics/react'
import { cubicBezier, tweenNumber } from '../kinematics/timeline'
import { IconFrame, type IconName } from './Icon'

export type VerticalTabExplorerItem = {
  id: string
  label: string
  icon?: IconName
}

type ExplorerOrientation = 'vertical' | 'horizontal'

type IndicatorGeometry = {
  left: number
  width: number
}

/** Trace easing for the active-service indicator. */
const traceEase = cubicBezier(0.2, 0.72, 0.25, 1)

/**
 * Shared tab/explorer contract for major page-level choices.
 * The rail owns presentation, optional icon placement, ARIA relationships,
 * roving focus, keyboard navigation, and the horizontal active indicator.
 * Consumers own only the active panel content.
 */
export function VerticalTabExplorer({
  id,
  items,
  activeIndex,
  onChange,
  ariaLabel,
  panel,
  className,
  panelClassName,
  orientation = 'vertical',
}: {
  id: string
  items: readonly VerticalTabExplorerItem[]
  activeIndex: number
  onChange: (index: number) => void
  ariaLabel: string
  panel: ReactNode
  className?: string
  panelClassName?: string
  orientation?: ExplorerOrientation
}) {
  const reduce = Boolean(useReducedMotion())
  const tabListRef = useRef<HTMLDivElement | null>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const labelRefs = useRef<Array<HTMLSpanElement | null>>([])
  const indicatorRef = useRef<HTMLSpanElement | null>(null)
  const indicatorGeometry = useRef<IndicatorGeometry | null>(null)
  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex
  const panelId = `${id}-panel`
  const activeItem = items[activeIndex]

  /* Measured in the rail's own content coordinates, so the indicator stays
     aligned while the constrained-width rail scrolls horizontally. */
  const measureIndicator = (index: number): IndicatorGeometry | null => {
    const tabList = tabListRef.current
    const label = labelRefs.current[index]
    if (!tabList || !label) return null

    const listRect = tabList.getBoundingClientRect()
    const labelRect = label.getBoundingClientRect()
    return {
      left: labelRect.left - listRect.left + tabList.scrollLeft,
      width: labelRect.width,
    }
  }

  const writeIndicator = ({ left, width }: IndicatorGeometry) => {
    const indicator = indicatorRef.current
    if (!indicator) return
    indicator.style.opacity = '1'
    indicator.style.transform = `translate3d(${left.toFixed(3)}px,0,0) scaleX(${width.toFixed(3)})`
  }

  useLayoutEffect(() => {
    if (orientation !== 'horizontal') return
    const target = measureIndicator(activeIndex)
    if (!target) return

    /* First paint and reduced motion place the indicator directly: there is no
       previous position to travel from, and no motion to honour. */
    const from = indicatorGeometry.current
    if (reduce || !from) {
      indicatorGeometry.current = target
      writeIndicator(target)
      return
    }

    return tweenNumber({
      from: 0,
      to: 1,
      durationMs: 360,
      ease: traceEase,
      label: `${id}:active-indicator`,
      write: progress => {
        const geometry = {
          left: from.left + (target.left - from.left) * progress,
          width: from.width + (target.width - from.width) * progress,
        }
        indicatorGeometry.current = geometry
        writeIndicator(geometry)
      },
      complete: () => {
        indicatorGeometry.current = target
        writeIndicator(target)
      },
    })
  }, [activeIndex, id, orientation, reduce])

  useEffect(() => {
    if (orientation !== 'horizontal') return
    const tabList = tabListRef.current
    if (!tabList) return
    let cancelled = false

    const sync = () => {
      if (cancelled) return
      const target = measureIndicator(activeIndexRef.current)
      if (!target) return
      indicatorGeometry.current = target
      writeIndicator(target)
    }

    /* The labels are observed as well as the rail: a font swap changes a label's
       width without changing the rail's box, so observing the rail alone would
       leave the indicator measured against the fallback face. */
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(sync)
    observer?.observe(tabList)
    labelRefs.current.forEach(label => { if (label) observer?.observe(label) })
    window.addEventListener('resize', sync)

    return () => {
      cancelled = true
      observer?.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [orientation])

  const selectFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null
    if (orientation === 'horizontal') {
      if (event.key === 'ArrowRight') next = index + 1
      else if (event.key === 'ArrowLeft') next = index - 1
    } else {
      if (event.key === 'ArrowDown') next = index + 1
      else if (event.key === 'ArrowUp') next = index - 1
    }
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    if (next === null) return

    event.preventDefault()
    const normalized = (next + items.length) % items.length
    onChange(normalized)
    tabRefs.current[normalized]?.focus()
  }

  return (
    <div
      className={`vertical-tab-explorer${className ? ` ${className}` : ''}`}
      data-orientation={orientation}
    >
      <div
        ref={tabListRef}
        className="vertical-tab-explorer-tabs"
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation={orientation}
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(node: HTMLButtonElement | null) => { tabRefs.current[index] = node }}
            type="button"
            id={`${id}-tab-${item.id}`}
            className="theme-tab vertical-tab-explorer-tab"
            role="tab"
            tabIndex={index === activeIndex ? 0 : -1}
            aria-selected={index === activeIndex}
            aria-controls={panelId}
            onClick={() => onChange(index)}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => selectFromKeyboard(event, index)}
          >
            {item.icon ? <IconFrame name={item.icon} /> : null}
            <span
              ref={(node: HTMLSpanElement | null) => { labelRefs.current[index] = node }}
              className="vertical-tab-explorer-label"
            >
              {item.label}
            </span>
          </button>
        ))}
        {orientation === 'horizontal' ? (
          <span ref={indicatorRef} className="vertical-tab-explorer-indicator" aria-hidden="true" />
        ) : null}
      </div>
      <div
        id={panelId}
        className={`vertical-tab-explorer-panel${panelClassName ? ` ${panelClassName}` : ''}`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${activeItem.id}`}
        tabIndex={0}
      >
        {panel}
      </div>
    </div>
  )
}
