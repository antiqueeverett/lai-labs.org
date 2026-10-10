import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../kinematics/react'
import { staggerSvgDraw, staggerSvgScale } from '../kinematics/entrance'

/** Abstract large-region field segments — institutional scale, not low-level boxes. */
const segments = [
  'M-20 120 L260 70 L330 250 L40 320 Z',
  'M260 70 L560 30 L640 210 L330 250 Z',
  'M560 30 L880 60 L900 230 L640 210 Z',
  'M880 60 L1240 40 L1240 250 L900 230 Z',
  'M40 320 L330 250 L420 470 L120 540 Z',
  'M330 250 L640 210 L760 440 L420 470 Z',
  'M640 210 L900 230 L980 460 L760 440 Z',
]

/** A few network nodes + dashed links — subtle "AI mesh" hint. */
const meshNodes = [
  { x: 180, y: 150 }, { x: 470, y: 110 }, { x: 720, y: 160 },
  { x: 340, y: 330 }, { x: 620, y: 300 }, { x: 900, y: 340 },
]
const meshLinks = [[0, 1], [1, 2], [0, 3], [1, 4], [3, 4], [4, 5], [2, 5]]

type CoverProps = {
  src: string
  /** 'side' for hero (text on left), 'full' for page headers. */
  tint?: 'side' | 'full'
  /** show the animated segmentation + mesh overlay */
  overlay?: boolean
  className?: string
  position?: string
  loading?: 'eager' | 'lazy'
  fetchPriority?: 'high' | 'low' | 'auto'
}

export function Cover({
  src,
  tint = 'full',
  overlay = true,
  className = '',
  position,
  loading = 'lazy',
  fetchPriority = 'auto',
}: CoverProps) {
  const reduce = useReducedMotion()
  const imageRef = useRef<HTMLImageElement>(null)
  const pathRefs = useRef<Array<SVGPathElement | null>>([])
  const nodeRefs = useRef<Array<SVGCircleElement | null>>([])

  useEffect(() => {
    if (reduce || !overlay) return
    const image = imageRef.current
    let live = true
    let stopPaths: () => void = () => undefined
    let stopNodes: () => void = () => undefined
    const start = () => {
      if (!live) return
      stopPaths = staggerSvgDraw(pathRefs.current.filter(Boolean) as SVGPathElement[], {
        durationMs: 1400,
        initialDelayMs: 200,
        staggerMs: 120,
        label: 'cover-segments',
      })
      stopNodes = staggerSvgScale(nodeRefs.current.filter(Boolean) as SVGCircleElement[], {
        durationMs: 500,
        initialDelayMs: 600,
        staggerMs: 80,
        label: 'cover-nodes',
      })
    }
    if (!image || image.complete) start()
    else image.addEventListener('load', start, { once: true })
    return () => {
      live = false
      image?.removeEventListener('load', start)
      stopPaths()
      stopNodes()
    }
  }, [overlay, reduce])
  return (
    <div className={`cover ${className}`} aria-hidden="true">
      <img
        ref={imageRef}
        className="cover-img"
        src={src}
        alt=""
        loading={loading}
        fetchPriority={fetchPriority}
        style={position ? { objectPosition: position } : undefined}
      />
      <div className={`cover-tint ${tint === 'side' ? 'is-side' : ''}`} />
      {overlay && (
        <svg className="cover-seg" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice">
          {segments.map((d, i) => (
            <path
              key={`s${i}`}
              ref={element => { pathRefs.current[i] = element }}
              d={d}
              fill="transparent"
              stroke="rgba(90,169,242,0.28)"
              strokeWidth={1}
            />
          ))}
          {meshLinks.map(([a, b], i) => (
            <line
              key={`l${i}`}
              x1={meshNodes[a].x} y1={meshNodes[a].y}
              x2={meshNodes[b].x} y2={meshNodes[b].y}
              stroke="rgba(34,211,238,0.22)"
              strokeWidth={1}
              strokeDasharray="3 5"
            />
          ))}
          {meshNodes.map((n, i) => (
            <circle
              key={`n${i}`}
              ref={element => { nodeRefs.current[i] = element }}
              cx={n.x} cy={n.y} r={3}
              fill="rgba(120,200,255,0.85)"
            />
          ))}
        </svg>
      )}
    </div>
  )
}
