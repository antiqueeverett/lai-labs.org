import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../kinematics/react'
import { staggerSvgDraw, staggerSvgScale } from '../kinematics/entrance'
import { NeuralField } from './NeuralField'

/** Smooth pseudo-random timeseries paths (telemetry / trend abstract). */
const trendPaths = [
  'M0 460 C 150 430, 250 360, 380 380 S 620 300, 760 250 S 1000 180, 1200 140',
  'M0 560 C 180 540, 300 500, 460 500 S 720 430, 900 400 S 1080 360, 1200 330',
  'M0 650 C 160 640, 320 610, 500 600 S 760 560, 940 540 S 1100 520, 1200 500',
]

/** Scattered "cell" particles for the segmentation-style theme. */
const cells = [
  { x: 160, y: 200, r: 46 }, { x: 340, y: 320, r: 30 }, { x: 520, y: 180, r: 38 },
  { x: 700, y: 300, r: 54 }, { x: 880, y: 200, r: 26 }, { x: 1030, y: 330, r: 42 },
  { x: 260, y: 520, r: 34 }, { x: 480, y: 560, r: 48 }, { x: 720, y: 540, r: 28 },
  { x: 940, y: 560, r: 40 }, { x: 1120, y: 470, r: 22 },
]

type Theme = 'timeseries' | 'cells'

/**
 * License-clean generated cover for non-satellite pages. Dark blue/black canvas
 * + electrifying-blue neural motif + a theme layer. Reduced-motion safe.
 */
export function AbstractCover({ theme, className = '' }: { theme: Theme; className?: string }) {
  const reduce = useReducedMotion()
  const pathRefs = useRef<Array<SVGPathElement | null>>([])
  const cellRefs = useRef<Array<SVGCircleElement | null>>([])

  useEffect(() => {
    if (reduce) return
    if (theme === 'timeseries') {
      return staggerSvgDraw(pathRefs.current.filter(Boolean) as SVGPathElement[], {
        durationMs: 1800,
        initialDelayMs: 200,
        staggerMs: 250,
        label: 'abstract-trends',
      })
    }
    return staggerSvgScale(cellRefs.current.filter(Boolean) as SVGCircleElement[], {
      durationMs: 900,
      initialDelayMs: 150,
      staggerMs: 80,
      label: 'abstract-cells',
    })
  }, [reduce, theme])
  return (
    <div className={`cover abstract-cover ${className}`} aria-hidden="true">
      <div className="abstract-base" />
      <NeuralField className="abstract-neural" />

      {theme === 'timeseries' && (
        <svg className="abstract-svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="ac-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(47,143,230,0.22)" />
              <stop offset="100%" stopColor="rgba(47,143,230,0)" />
            </linearGradient>
          </defs>
          {trendPaths.map((d, i) => (
            <g key={i}>
              <path d={`${d} L1200 800 L0 800 Z`} fill="url(#ac-area)" opacity={0.5 - i * 0.12} />
              <path
                ref={element => { pathRefs.current[i] = element }}
                d={d}
                fill="none"
                stroke="rgba(120,200,255,0.55)"
                strokeWidth={1.5}
              />
            </g>
          ))}
        </svg>
      )}

      {theme === 'cells' && (
        <svg className="abstract-svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          {cells.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r={c.r} fill="rgba(47,143,230,0.06)" />
              <circle
                ref={element => { cellRefs.current[i] = element }}
                cx={c.x} cy={c.y} r={c.r}
                fill="none"
                stroke="rgba(120,200,255,0.4)"
                strokeWidth={1.2}
                strokeDasharray="4 6"
                style={{ transformOrigin: `${c.x}px ${c.y}px` }}
              />
              <circle cx={c.x} cy={c.y} r={2.4} fill="rgba(150,215,255,0.9)" />
            </g>
          ))}
        </svg>
      )}

      <div className="cover-tint" />
    </div>
  )
}
