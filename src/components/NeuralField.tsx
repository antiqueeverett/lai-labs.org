import { useCallback, useEffect, useRef } from 'react'
import { useAnimationFrame, useReducedMotion, useViewportActive } from '../kinematics/react'
import { easeInOutCubic } from '../kinematics/timeline'

/** Node positions in the accepted 1200×800 field. */
const nodes = [
  { x: 120, y: 140 }, { x: 300, y: 90 }, { x: 480, y: 180 }, { x: 660, y: 110 },
  { x: 840, y: 200 }, { x: 1020, y: 130 }, { x: 200, y: 340 }, { x: 420, y: 400 },
  { x: 640, y: 330 }, { x: 880, y: 420 }, { x: 1080, y: 360 }, { x: 320, y: 600 },
  { x: 560, y: 560 }, { x: 780, y: 640 }, { x: 1000, y: 580 },
]

const streams: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
  [0, 6], [2, 7], [3, 8], [4, 9], [5, 10],
  [6, 7], [7, 8], [8, 9], [9, 10],
  [6, 11], [7, 12], [8, 13], [9, 14], [11, 12], [12, 13], [13, 14],
]

const packets = [0, 3, 6, 11, 15, 18]

/**
 * One low-resolution decorative canvas replaces the former 42 independently
 * animated SVG attributes. It retains the accepted streams, pulsing nodes and
 * travelling packets while committing the complete field once per canonical
 * scheduler frame. The browser scales the intentionally soft 600×400 surface.
 */
export function NeuralField({ className = '', active = true }: { className?: string; active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  const visible = useViewportActive(canvasRef, 0.05)
  const animate = active && visible && !reduce

  const draw = useCallback((time: number, moving: boolean) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !context) return

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.save()
    context.scale(0.5, 0.5)
    context.lineCap = 'round'

    context.beginPath()
    streams.forEach(([from, to]) => {
      context.moveTo(nodes[from].x, nodes[from].y)
      context.lineTo(nodes[to].x, nodes[to].y)
    })
    context.strokeStyle = 'rgba(90,169,242,0.22)'
    context.lineWidth = 1
    context.setLineDash([3, 11])
    context.lineDashOffset = moving ? -140 * ((time / 3200) % 1) : 0
    context.stroke()
    context.setLineDash([])

    nodes.forEach((node, index) => {
      const wave = moving
        ? (Math.sin((time / 3000) * Math.PI * 2 - (index % 5) * 1.256) + 1) / 2
        : 0.35
      context.beginPath()
      context.arc(node.x, node.y, 8 + wave * 5.5, 0, Math.PI * 2)
      context.fillStyle = `rgba(90,169,242,${(0.035 + wave * 0.045).toFixed(3)})`
      context.fill()
      context.beginPath()
      context.arc(node.x, node.y, 2.4 + wave * 0.65, 0, Math.PI * 2)
      context.fillStyle = `rgba(130,205,255,${(0.5 + wave * 0.5).toFixed(3)})`
      context.fill()
    })

    if (moving) {
      packets.forEach((streamIndex, index) => {
        const [from, to] = streams[streamIndex]
        const delayed = time - index * 700
        const cycle = ((delayed % 4000) + 4000) % 4000
        if (delayed < 0 || cycle >= 2600) return
        const raw = cycle / 2600
        const progress = easeInOutCubic(raw)
        const x = nodes[from].x + (nodes[to].x - nodes[from].x) * progress
        const y = nodes[from].y + (nodes[to].y - nodes[from].y) * progress
        const opacity = Math.max(0, Math.min(1, raw / 0.18, (1 - raw) / 0.18))
        context.beginPath()
        context.arc(x, y, 2.6, 0, Math.PI * 2)
        context.fillStyle = `rgba(150,215,255,${opacity.toFixed(3)})`
        context.fill()
      })
    }

    context.restore()
  }, [])

  useEffect(() => {
    if (!animate) draw(0, false)
  }, [animate, draw])

  useAnimationFrame(time => draw(time, true), animate, {
    phase: 'write',
    label: `neural-field:${className || 'default'}`,
  })

  return (
    <canvas
      ref={canvasRef}
      className={`neural-field ${className}`}
      width="600"
      height="400"
      aria-hidden="true"
    />
  )
}
