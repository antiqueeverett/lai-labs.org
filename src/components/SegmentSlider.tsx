import { useRef, useState } from 'react'
import { Icon } from './Icon'

export function SegmentSlider() {
  const [pos, setPos] = useState(52)
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const setFromX = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const p = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.max(0, Math.min(100, p)))
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 3))
    else if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 3))
    else if (e.key === 'Home') setPos(0)
    else if (e.key === 'End') setPos(100)
  }

  return (
    <div
      className="seg"
      ref={ref}
      onPointerDown={(e) => {
        dragging.current = true
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        setFromX(e.clientX)
      }}
      onPointerMove={(e) => dragging.current && setFromX(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <img className="seg-img seg-bw" src="/img/sat-aerial.jpg" alt="Aerial farmland, unlabelled" />

      <div className="seg-color" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img className="seg-img" src="/img/sat-aerial.jpg" alt="" aria-hidden="true" />
        <img className="seg-img seg-mask" src="/img/sat-aerial-segmentation.png" alt="" aria-hidden="true" />
      </div>

      <div className="seg-divider" style={{ left: `${pos}%` }}>
        <button
          type="button"
          className="seg-handle"
          role="slider"
          tabIndex={0}
          aria-label="Drag to reveal AI segmentation"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          onKeyDown={onKey}
        >
          <Icon name="arrow" size={14} className="seg-chevron left" />
          <Icon name="arrow" size={14} className="seg-chevron right" />
        </button>
      </div>

      <span className="seg-tag tl">Raw imagery</span>
      <span className="seg-tag tr">AI segmentation</span>
      <span className="seg-hint">Drag to reveal</span>
    </div>
  )
}
