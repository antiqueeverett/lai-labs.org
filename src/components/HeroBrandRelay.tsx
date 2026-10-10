import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAnimationFrame, useReducedMotion, useViewportActive } from '../kinematics/react'
import { cubicBezier, easeInOutCubic } from '../kinematics/timeline'
import { brand } from '../site'

const { mark: BRAND_MARK, tagline: TAGLINE_PARTS } = brand.lockup
const { prefix: TAGLINE_PREFIX, suffix: TAGLINE_SUFFIX } = TAGLINE_PARTS
const TAGLINE_SLOT_WORDS = TAGLINE_PARTS.words
const TAGLINE = `${TAGLINE_PREFIX} ${TAGLINE_SLOT_WORDS[0]} ${TAGLINE_SUFFIX}`
const TAGLINE_FONT_SAMPLE = TAGLINE

const MARK_PAINT_LEFT = (49.674225 - 49) / 55
const MARK_PAINT_RIGHT = (102.985771 - 49) / 55
const MARK_PAINT_WIDTH = MARK_PAINT_RIGHT - MARK_PAINT_LEFT
const MIN_SLOGAN_FONT_SIZE = 16

function setInlineStyle(element: HTMLElement, property: string, value: string) {
  if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value)
}

function displayFont(slogan: HTMLElement) {
  const { fontWeight, fontSize, fontFamily } = getComputedStyle(slogan)
  return `${fontWeight} ${fontSize} ${fontFamily}`
}

function canonicalWidth(parts: HTMLElement[]) {
  return parts.reduce((width, part) => width + part.getBoundingClientRect().width, 0)
}

function fitLockup(
  brandElement: HTMLElement,
  slogan: HTMLElement,
  parts: HTMLElement[],
  alternates: HTMLElement,
) {
  const [, canonicalWord] = parts
  const container = brandElement.parentElement
  if (!container || !canonicalWord) return

  if (slogan.style.getPropertyValue('--hero-slogan-fitted-size')) {
    slogan.style.removeProperty('--hero-slogan-fitted-size')
  }
  const normalFontSize = parseFloat(getComputedStyle(slogan).fontSize)
  const naturalSloganWidth = canonicalWidth(parts)
  if (!naturalSloganWidth || !normalFontSize) return

  const box = getComputedStyle(container)
  const availableWidth =
    container.getBoundingClientRect().width -
    parseFloat(box.paddingLeft) -
    parseFloat(box.paddingRight) -
    parseFloat(box.borderLeftWidth) -
    parseFloat(box.borderRightWidth)
  if (!(availableWidth > 0)) return

  const canonicalWordWidth = canonicalWord.getBoundingClientRect().width
  let widestWordWidth = canonicalWordWidth
  for (const word of Array.from(alternates.children)) {
    widestWordWidth = Math.max(widestWordWidth, word.getBoundingClientRect().width)
  }
  const naturalWidestWidth = naturalSloganWidth - canonicalWordWidth + widestWordWidth
  const emblemLimit = (availableWidth * MARK_PAINT_WIDTH) / naturalSloganWidth
  const reelLimit =
    availableWidth /
    ((naturalSloganWidth * MARK_PAINT_LEFT) / MARK_PAINT_WIDTH + naturalWidestWidth)
  const fitScale = Math.min(1, emblemLimit, reelLimit)
  let settledSloganWidth = naturalSloganWidth
  if (fitScale < 1) {
    setInlineStyle(
      slogan,
      '--hero-slogan-fitted-size',
      `${Math.max(MIN_SLOGAN_FONT_SIZE, normalFontSize * fitScale)}px`,
    )
    settledSloganWidth = canonicalWidth(parts)
  }

  const emblemCanvasWidth = settledSloganWidth / MARK_PAINT_WIDTH
  setInlineStyle(brandElement, '--hero-brand-width', `${emblemCanvasWidth}px`)
  setInlineStyle(slogan, '--slogan-inset', `${emblemCanvasWidth * MARK_PAINT_LEFT}px`)
}

const CYCLE_REF = 6.89
const TRAVEL_REF = CYCLE_REF * 0.56
const REST = CYCLE_REF * 0.44
const PEAK = 0.68
const BAND = 2.7
const SWEEP_REF = 2.788
const SPEED = SWEEP_REF / TRAVEL_REF
const LEAD = 0.65 * BAND
const TAIL = 0.36 * BAND
const OVERTRAVEL = LEAD - TAIL

const SLOT_INITIAL_DWELL_MS = 1000
const SLOT_TRANSITION_MS = 260
const SLOT_DWELL_MS = 1000
const SLOT_SEQUENCE = [1, 2, 3, 4, 0] as const
const SLOT_TOTAL_MS =
  SLOT_INITIAL_DWELL_MS +
  (TAGLINE_SLOT_WORDS.length - 1) * (SLOT_TRANSITION_MS + SLOT_DWELL_MS) +
  SLOT_TRANSITION_MS
const slotEase = cubicBezier(0.4, 0.14, 0.3, 1)

type ReelState = {
  current: number
  next: number | null
  progress: number
  width: number
  complete: boolean
}

function reelAt(time: number, widths: number[]): ReelState {
  if (time < SLOT_INITIAL_DWELL_MS) {
    return { current: 0, next: null, progress: 0, width: widths[0], complete: false }
  }
  let cursor = SLOT_INITIAL_DWELL_MS
  let current = 0
  for (const next of SLOT_SEQUENCE) {
    const transitionEnd = cursor + SLOT_TRANSITION_MS
    if (time < transitionEnd) {
      const progress = slotEase((time - cursor) / SLOT_TRANSITION_MS)
      return {
        current,
        next,
        progress,
        width: widths[current] + (widths[next] - widths[current]) * progress,
        complete: false,
      }
    }
    current = next
    cursor = transitionEnd
    const dwell = next === 0 ? 0 : SLOT_DWELL_MS
    if (time < cursor + dwell) {
      return { current, next: null, progress: 0, width: widths[current], complete: false }
    }
    cursor += dwell
  }
  return { current: 0, next: null, progress: 0, width: widths[0], complete: true }
}

/**
 * Canonical brand lockup and choreography. One scheduler subscriber owns the
 * finite verb reel and the subsequent recurring sheen; no timers, React frame
 * state, ResizeObserver animation feedback, or third-party frameloop is used.
 */
export function HeroBrandRelay({
  line1,
  line2,
  titleClassName,
  relay = false,
}: {
  line1: string
  line2?: string
  titleClassName?: string
  relay?: boolean
}) {
  const { key } = useLocation()
  const reduce = useReducedMotion()
  const brandRef = useRef<HTMLAnchorElement>(null)
  const taglineRef = useRef<HTMLParagraphElement>(null)
  const lineRef = useRef<HTMLSpanElement>(null)
  const slotRef = useRef<HTMLSpanElement>(null)
  const currentWordRef = useRef<HTMLSpanElement>(null)
  const nextWordRef = useRef<HTMLSpanElement>(null)
  const prefixRef = useRef<HTMLSpanElement>(null)
  const canonicalWordRef = useRef<HTMLSpanElement>(null)
  const alternateWordsRef = useRef<HTMLSpanElement>(null)
  const suffixRef = useRef<HTMLSpanElement>(null)
  const measurements = useRef({ words: [] as number[], tagline: 0, second: 0 })
  const epoch = useRef(0)
  const lastRenderedPair = useRef('')
  const [fitted, setFitted] = useState(false)
  const visible = useViewportActive(taglineRef)
  const visibleRef = useRef(visible)
  const fittedRef = useRef(false)
  const fontReadyRef = useRef(false)
  const pendingRefit = useRef(false)
  const measureRef = useRef<(() => void) | null>(null)
  visibleRef.current = visible

  useLayoutEffect(() => {
    const brandElement = brandRef.current
    const slogan = taglineRef.current
    const parts = [prefixRef.current, canonicalWordRef.current, suffixRef.current]
    const alternates = alternateWordsRef.current
    if (!brandElement || !slogan || !alternates || parts.some(part => !part)) return

    const measure = () => {
      fitLockup(brandElement, slogan, parts as HTMLElement[], alternates)
      measurements.current.words = [
        (parts[1] as HTMLElement).getBoundingClientRect().width,
        ...Array.from(alternates.children).map(word => word.getBoundingClientRect().width),
      ]
      measurements.current.tagline = slogan.getBoundingClientRect().width
      measurements.current.second = lineRef.current?.getBoundingClientRect().width ?? 0
      if (slotRef.current) setInlineStyle(slotRef.current, 'width', `${measurements.current.words[0]}px`)
      const sweepBand = `${BAND * measurements.current.tagline}px`
      setInlineStyle(slogan, '--sweep-band', sweepBand)
      if (lineRef.current) setInlineStyle(lineRef.current, '--sweep-band', sweepBand)
    }
    measureRef.current = measure

    measure()
    let live = true
    const commit = () => {
      if (!live) return
      fontReadyRef.current = true
      if (!visibleRef.current) {
        pendingRefit.current = true
        return
      }
      measure()
      pendingRefit.current = false
      if (!fittedRef.current) {
        fittedRef.current = true
        setFitted(true)
      }
    }
    void document.fonts.load(displayFont(slogan), TAGLINE_FONT_SAMPLE).then(commit, commit)
    void document.fonts.ready.then(commit)
    const observer = new ResizeObserver(() => {
      if (visibleRef.current) measure()
      else pendingRefit.current = true
    })
    observer.observe(brandElement.parentElement as HTMLElement)
    return () => {
      live = false
      measureRef.current = null
      observer.disconnect()
    }
  }, [])

  useLayoutEffect(() => {
    if (!visible || !pendingRefit.current) return
    measureRef.current?.()
    pendingRefit.current = false
    if (fontReadyRef.current && !fittedRef.current) {
      fittedRef.current = true
      setFitted(true)
    }
  }, [visible])

  useEffect(() => {
    epoch.current += 1
    lastRenderedPair.current = ''
    const current = currentWordRef.current
    const next = nextWordRef.current
    if (current) {
      current.textContent = TAGLINE_SLOT_WORDS[0]
      setInlineStyle(current, 'transform', 'translate3d(0,0,0)')
      setInlineStyle(current, 'opacity', '1')
    }
    if (next) setInlineStyle(next, 'opacity', '0')
  }, [key])

  const startEpoch = useRef({ epoch: -1, time: 0 })
  useAnimationFrame((time) => {
    const slogan = taglineRef.current
    const currentWord = currentWordRef.current
    const nextWord = nextWordRef.current
    const slot = slotRef.current
    const widths = measurements.current.words
    if (!slogan || !currentWord || !nextWord || !slot || widths.length !== TAGLINE_SLOT_WORDS.length) return
    if (startEpoch.current.epoch !== epoch.current) startEpoch.current = { epoch: epoch.current, time }
    const elapsed = time - startEpoch.current.time
    const reel = reelAt(elapsed, widths)
    const pair = `${reel.current}:${reel.next ?? -1}`
    if (pair !== lastRenderedPair.current) {
      currentWord.textContent = TAGLINE_SLOT_WORDS[reel.current]
      if (reel.next !== null) nextWord.textContent = TAGLINE_SLOT_WORDS[reel.next]
      lastRenderedPair.current = pair
    }
    setInlineStyle(slot, 'width', `${reel.width.toFixed(3)}px`)
    if (reel.next === null) {
      setInlineStyle(currentWord, 'transform', 'translate3d(0,0,0)')
      setInlineStyle(currentWord, 'opacity', '1')
      setInlineStyle(nextWord, 'opacity', '0')
    } else {
      setInlineStyle(currentWord, 'transform', `translate3d(0,${(-105 * reel.progress).toFixed(3)}%,0)`)
      setInlineStyle(currentWord, 'opacity', (1 - reel.progress).toFixed(4))
      setInlineStyle(nextWord, 'transform', `translate3d(0,${(105 * (1 - reel.progress)).toFixed(3)}%,0)`)
      setInlineStyle(nextWord, 'opacity', reel.progress.toFixed(4))
    }

    if (!relay || !reel.complete) {
      setInlineStyle(slogan, '--sweep-o', '0')
      if (lineRef.current) setInlineStyle(lineRef.current, '--sweep-o', '0')
      return
    }

    const refWidth = measurements.current.tagline
    if (!refWidth) return
    const secondWidth = measurements.current.second
    const overtravel = OVERTRAVEL * refWidth
    const legOne = refWidth + overtravel
    const legTwo = secondWidth ? secondWidth + overtravel : 0
    const distance = legOne + legTwo
    const duration = distance / (SPEED * refWidth)
    const sheenElapsed = ((elapsed - SLOT_TOTAL_MS) / 1000) % (duration + REST)
    const moved = sheenElapsed < duration
      ? easeInOutCubic(sheenElapsed / duration) * distance
      : distance
    const start = -LEAD * refWidth
    setInlineStyle(slogan, '--sweep-o', String(PEAK))
    setInlineStyle(slogan, '--sweep-x', `${start + moved}px`)
    if (lineRef.current) {
      setInlineStyle(lineRef.current, '--sweep-o', String(PEAK))
      setInlineStyle(lineRef.current, '--sweep-x', `${start + moved - legOne}px`)
    }
  }, fitted && visible && !reduce, { phase: 'write', label: 'hero-brand-relay' })

  const sheenClass = relay && fitted && !reduce ? ' hero-relay-line' : ''

  return (
    <>
      <Link className="hero-brand" to="/" aria-label="Label AI home" ref={brandRef}>
        <img src={BRAND_MARK} alt="" className="hero-brand-mark" loading="eager" />
      </Link>
      <p
        ref={taglineRef}
        className={`hero-slogan${sheenClass}`}
        data-text={sheenClass ? TAGLINE : undefined}
      >
        <span className="visually-hidden">{TAGLINE}</span>
        <span className="hero-slogan-prefix" aria-hidden="true" ref={prefixRef}>{TAGLINE_PREFIX}&nbsp;</span>
        <span className="hero-slogan-canonical-word" aria-hidden="true" ref={canonicalWordRef}>
          {TAGLINE_SLOT_WORDS[0]}
        </span>
        <span className="hero-slogan-alternate-words" aria-hidden="true" ref={alternateWordsRef}>
          {TAGLINE_SLOT_WORDS.slice(1).map(word => <span key={word}>{word}</span>)}
        </span>
        <span className="hero-slogan-slot" aria-hidden="true" ref={slotRef}>
          <span className="hero-slogan-slot-measure">{TAGLINE_SLOT_WORDS[0]}</span>
          <span className="hero-slogan-slot-word" ref={currentWordRef}>{TAGLINE_SLOT_WORDS[0]}</span>
          <span className="hero-slogan-slot-word" ref={nextWordRef} />
        </span>
        <span className="hero-slogan-suffix" aria-hidden="true" ref={suffixRef}>&nbsp;{TAGLINE_SUFFIX}</span>
      </p>
      <h1 className={titleClassName}>
        <span className="hero-title-row hero-title-row-primary">{line1}</span>
        {line2 && (
          <span
            ref={lineRef}
            className={`hero-title-row hero-title-row-secondary text-gradient${sheenClass}`}
            data-text={sheenClass ? line2 : undefined}
          >
            {line2}
          </span>
        )}
      </h1>
    </>
  )
}
