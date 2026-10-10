import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAnimationFrame, useReducedMotion, useViewportActive } from '../kinematics/react'
import { cancelFrame, requestFrame, subscribeFrame } from '../kinematics/scheduler'
import { standardEase, tweenNumber } from '../kinematics/timeline'
import { PageTransition } from '../components/Motion'
import { PageHero, CtaBand } from '../components/Sections'
import { VerticalTabExplorer } from '../components/VerticalTabExplorer'
import { SegmentSlider } from '../components/SegmentSlider'
import { industries } from '../site'

const taskLabels = {
  vision: 'Vision',
  forecasting: 'Forecasting',
  analysis: 'Analysis',
  retrieval: 'Retrieval',
} as const

const applicationTasks = [
  { title: taskLabels.vision, verb: 'Observe', desc: 'Detection, classification, segmentation, anomaly detection and inspection across imagery.' },
  { title: taskLabels.forecasting, verb: 'Anticipate', desc: 'Signals, trends and uncertainty translated into forward-looking estimates.' },
  { title: taskLabels.analysis, verb: 'Interpret', desc: 'Structured evidence combined to explain patterns, compare options and support decisions.' },
  { title: taskLabels.retrieval, verb: 'Find', desc: 'Search, extraction and synthesis across documents, records and knowledge bases.' },
] as const

const applicationTaskExplorerItems = applicationTasks.map((task) => ({
  id: task.title.toLowerCase(),
  label: task.title,
}))

const systemSignals = [
  { id: 'Image', formats: 'PNG, TIFF, JPEG, DICOM' },
  { id: 'Video', formats: 'MP4, MOV, AVI' },
  { id: 'Audio', formats: 'WAV, MP3, M4A' },
  { id: 'Text', formats: 'PDF, DOCX, TXT' },
  { id: 'Structured Data', formats: 'CSV, JSON, SQL' },
] as const

type SystemSignal = (typeof systemSignals)[number]['id']

const systemExamples: { title: string; desc: string; caption: string; signals: readonly SystemSignal[] }[] = [
  {
    title: taskLabels.vision,
    desc: 'Detection, classification, segmentation, inspection',
    caption: 'Illustrative mix for vision: image, video, and structured data shown as one possible architecture for detection, classification, segmentation, anomaly surfacing, and inspection. Actual combinations vary by challenge and available signals.',
    signals: ['Image', 'Video', 'Structured Data'],
  },
  {
    title: taskLabels.forecasting,
    desc: 'Signals, trends, uncertainty, forward estimates',
    caption: 'Illustrative mix for forecasting: structured data, image, and text shown as one possible architecture for trends, uncertainty, and forward-looking estimates. Actual combinations vary by challenge and available signals.',
    signals: ['Image', 'Text', 'Structured Data'],
  },
  {
    title: taskLabels.analysis,
    desc: 'Patterns, comparisons, decision support',
    caption: 'Illustrative mix for analysis: text, image, and structured data shown as one possible architecture for explaining patterns, comparing evidence, and supporting decisions. Actual combinations vary by challenge and available signals.',
    signals: ['Image', 'Text', 'Structured Data'],
  },
  {
    title: taskLabels.retrieval,
    desc: 'Search, extraction, synthesis across knowledge',
    caption: 'Illustrative mix for retrieval: text, structured data, and image shown as one possible architecture for search, extraction, and synthesis across documents, records, and knowledge bases. Actual combinations vary by challenge and available signals.',
    signals: ['Image', 'Text', 'Structured Data'],
  },
  {
    title: 'Multimodal assistance',
    desc: 'Grounded retrieval, reasoning, next-step support',
    caption: 'Illustrative mix for multimodal assistance: text, image, audio, and structured data shown as one possible architecture for grounded retrieval, reasoning, and next-step support. Actual combinations vary by challenge and available signals.',
    signals: ['Text', 'Image', 'Audio', 'Structured Data'],
  },
]

const depthLabels = ['Context', 'Task', 'System', 'Supervision'] as const

type DepthIndex = 0 | 1 | 2 | 3

/**
 * One geometry model for the System plot. The hub, both rings and every signal
 * trajectory are derived from the field the three-region grid actually gives us,
 * so the drawing fills its field at any viewport instead of carrying fixed
 * coordinates authored for one earlier size.
 */
function systemPlotGeometry(width: number, height: number) {
  // The rings sit against the right of the field so the trajectories traverse the
  // field rather than converging halfway across it and leaving the rest empty.
  const ringOuter = Math.min(height * 0.94, width * 0.76)
  const margin = Math.max(6, width * 0.02)
  const cx = width - ringOuter / 2 - margin
  const cy = height / 2

  return {
    cx,
    cy,
    // Ratios kept from the accepted hub/ring proportions (31 : 52 : 74).
    hub: ringOuter * 0.419,
    ringInner: ringOuter * 0.703,
    ringOuter,
    // Signal i leaves the left edge at the vertical centre of its own rail row.
    // The rail lays its five entries out as five equal rows over the same height,
    // so every trajectory starts exactly opposite the signal it carries.
    paths: systemSignals.map((_, index) => {
      const y = (height * (index + 0.5)) / systemSignals.length
      const control = cx * 0.5625
      return `M 0 ${y} C ${control} ${y}, ${control} ${cy}, ${cx} ${cy}`
    }),
  }
}

function cubicPoint(start: number, controlA: number, controlB: number, end: number, t: number) {
  const inverse = 1 - t
  return inverse ** 3 * start
    + 3 * inverse ** 2 * t * controlA
    + 3 * inverse * t ** 2 * controlB
    + t ** 3 * end
}

const taskAnalysisSources = [
  { x: 51, y: 38 }, { x: 93, y: 38 }, { x: 129, y: 38 },
  { x: 51, y: 78 }, { x: 93, y: 78 }, { x: 129, y: 78 },
  { x: 51, y: 118 }, { x: 93, y: 118 }, { x: 129, y: 118 },
] as const

const taskAnalysisCells = [
  { x: 243.5, y: 43.5 }, { x: 274.5, y: 43.5 }, { x: 305.5, y: 43.5 },
  { x: 243.5, y: 74.5 }, { x: 274.5, y: 74.5 }, { x: 305.5, y: 74.5 },
  { x: 243.5, y: 105.5 }, { x: 274.5, y: 105.5 }, { x: 305.5, y: 105.5 },
] as const

const taskAnalysisOutcomes = [
  { x: 494, y: 45 },
  { x: 494, y: 78 },
  { x: 494, y: 111 },
] as const

/**
 * Retrieval target windows, measured against `public/img/ocr1.png` (1672x941)
 * rather than estimated: each entry is the oriented box of one real OCR field,
 * so the long edges track that line's own perspective angle on the document.
 */
const taskRetrievalTargets = [
  { x: 767, y: 396, w: 93, h: 31, angle: 16.81 },   // given name — ABEDE
  { x: 1222, y: 378, w: 200, h: 33, angle: 15.57 }, // document number — AB123456789
  { x: 697, y: 469, w: 138, h: 32, angle: 17.7 },   // date of birth — 12 DEC 1992
  { x: 809, y: 630, w: 281, h: 34, angle: 18.53 },  // authority — UTOPIA PASSPORT OFFICE
] as const

/**
 * Vision region of interest, in `public/img/needle-suture.jpg` source pixels
 * (1772x1186): the point where the suture thread meets the needle.
 */
const visionRoi = { x: 860, y: 684, w: 130, h: 84 }

/** Corner brackets for one target window: four L-shaped arms, no centre dot. */
function retrievalTargetCorners({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const arm = 14
  const drop = 12
  return [
    `M${x} ${y + drop}V${y}H${x + arm}`,
    `M${x + w - arm} ${y}H${x + w}V${y + drop}`,
    `M${x + w} ${y + h - drop}V${y + h}H${x + w - arm}`,
    `M${x + arm} ${y + h}H${x}V${y + h - drop}`,
  ].join('')
}

function VisionTaskMedia({ reduce }: { reduce: boolean }) {
  const mediaRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const roiRef = useRef<HTMLDivElement | null>(null)
  const zoomBoxRef = useRef<HTMLDivElement | null>(null)
  const zoomSceneRef = useRef<HTMLDivElement | null>(null)
  const scanRef = useRef<HTMLDivElement | null>(null)
  const scanRangeRef = useRef({ start: 0, end: 0 })
  const visible = useViewportActive(mediaRef, 0.08)

  /**
   * Place the region of interest, the scan sweep and the magnified crop from the
   * one source-pixel rectangle above. The projection is read back from the
   * rendered image (its `cover` fit, object-position and transform), so the
   * region stays on the junction at any stage size instead of needing a
   * per-breakpoint percentage that drifts off the subject.
   */
  const syncZoom = () => {
    const media = mediaRef.current
    const image = imageRef.current
    const roi = roiRef.current
    const zoomBox = zoomBoxRef.current
    const zoomScene = zoomSceneRef.current
    if (!media || !image || !roi || !zoomBox || !zoomScene) return
    if (!image.naturalWidth || !image.naturalHeight) return

    const mediaRect = media.getBoundingClientRect()
    const imageRect = image.getBoundingClientRect()
    const style = getComputedStyle(image)
    const scale = style.transform === 'none' ? 1 : new DOMMatrixReadOnly(style.transform).a
    if (!scale || !imageRect.width) return

    const boxWidth = imageRect.width / scale
    const boxHeight = imageRect.height / scale
    const [posX = '50%', posY = '50%'] = style.objectPosition.split(' ')
    const cover = Math.max(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight)
    const insetX = (parseFloat(posX) / 100) * (boxWidth - image.naturalWidth * cover)
    const insetY = (parseFloat(posY) / 100) * (boxHeight - image.naturalHeight * cover)
    const project = (u: number, v: number) => ({
      x: imageRect.left - mediaRect.left + (insetX + u * cover) * scale,
      y: imageRect.top - mediaRect.top + (insetY + v * cover) * scale,
    })

    const near = project(visionRoi.x, visionRoi.y)
    const far = project(visionRoi.x + visionRoi.w, visionRoi.y + visionRoi.h)
    const roiWidth = far.x - near.x
    const roiHeight = far.y - near.y
    if (roiWidth <= 0 || roiHeight <= 0) return

    roi.style.left = `${near.x}px`
    roi.style.top = `${near.y}px`
    roi.style.width = `${roiWidth}px`
    roi.style.height = `${roiHeight}px`
    scanRangeRef.current = { start: near.x, end: far.x }
    scanRef.current?.style.setProperty('transform', `translate3d(${near.x}px, 0, 0)`)

    // Cap the inspector by width and by the height left above the annotation,
    // so the magnified crop never grows into the note at the bottom-right.
    const effectiveScale = Math.min(4, 248 / roiWidth, (mediaRect.height * 0.68) / roiHeight)

    zoomBox.style.width = `${roiWidth * effectiveScale}px`
    zoomBox.style.height = `${roiHeight * effectiveScale}px`
    zoomScene.style.width = `${mediaRect.width * effectiveScale}px`
    zoomScene.style.height = `${mediaRect.height * effectiveScale}px`
    zoomScene.style.left = `${-near.x * effectiveScale}px`
    zoomScene.style.top = `${-near.y * effectiveScale}px`
  }

  useEffect(() => {
    const media = mediaRef.current
    if (!media) return

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncZoom)
    observer?.observe(media)
    window.addEventListener('resize', syncZoom)
    const frame = requestFrame(syncZoom)

    return () => {
      cancelFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', syncZoom)
    }
  }, [])

  useAnimationFrame((time) => {
    const scan = scanRef.current
    if (!scan) return
    const { start, end } = scanRangeRef.current
    const phase = (time % 5000) / 5000
    const pingPong = phase < 0.5 ? phase * 2 : (1 - phase) * 2
    const eased = 0.5 - Math.cos(Math.PI * pingPong) / 2
    scan.style.transform = `translate3d(${start + (end - start) * eased}px, 0, 0)`
  }, visible && !reduce, { phase: 'write', label: 'industries-vision-scan' })

  const visionSrc = '/img/needle-suture.jpg'

  return (
    <div ref={mediaRef} className="application-task-media-stage application-task-media-vision">
      <img ref={imageRef} className="application-task-media-image" src={visionSrc} alt="" onLoad={syncZoom} />
      <div className="application-task-media-layer">
        <div ref={scanRef} className="application-task-vision-scan" />
        <div ref={roiRef} className="application-task-vision-roi">
          <span className="application-task-vision-dot" />
        </div>
        <div ref={zoomBoxRef} className="application-task-vision-zoom">
          <div ref={zoomSceneRef} className="application-task-vision-zoom-scene">
            <img src={visionSrc} alt="" onLoad={syncZoom} />
          </div>
        </div>
        <div className="application-task-vision-note">Needle–suture junction</div>
      </div>
    </div>
  )
}

function ForecastingTaskMedia({ reduce }: { reduce: boolean }) {
  const mediaRef = useRef<HTMLDivElement | null>(null)
  const nowRef = useRef<HTMLDivElement | null>(null)
  const nextRef = useRef<HTMLDivElement | null>(null)
  const visible = useViewportActive(mediaRef, 0.08)

  useAnimationFrame((time) => {
    const nowNode = nowRef.current
    const nextNode = nextRef.current
    if (!nowNode || !nextNode) return

    const phase = (time % 6400) / 6400
    const wave = 0.5 - Math.cos(phase * Math.PI * 2) / 2
    const apply = (node: HTMLElement, progress: number) => {
      node.style.opacity = String(0.32 + progress * 0.68)
      node.style.transform = `scale(${0.78 + progress * 0.22})`
    }
    apply(nowNode, 1 - wave)
    apply(nextNode, wave)
  }, visible && !reduce, { phase: 'write', label: 'industries-forecast-bubbles' })

  return (
    <div ref={mediaRef} className="application-task-media-stage application-task-media-forecasting">
      <img className="application-task-media-image" src="/img/heat-map.png" alt="" />
      <div className="application-task-media-layer">
        <div ref={nowRef} className="application-task-forecast-bubble application-task-forecast-now" />
        <div ref={nextRef} className="application-task-forecast-bubble application-task-forecast-next" />
        <span className="application-task-forecast-tag application-task-forecast-tag-now">Current field</span>
        <span className="application-task-forecast-tag application-task-forecast-tag-next">Forecast +12h</span>
        <span className="application-task-media-watermark">AI generated</span>
      </div>
    </div>
  )
}

function AnalysisTaskMedia({ reduce }: { reduce: boolean }) {
  const mediaRef = useRef<HTMLDivElement | null>(null)
  const routeRef = useRef<SVGPathElement | null>(null)
  const signalRef = useRef<SVGCircleElement | null>(null)
  const sourceRefs = useRef<Array<SVGCircleElement | null>>([])
  const cellRefs = useRef<Array<SVGRectElement | null>>([])
  const visible = useViewportActive(mediaRef, 0.08)

  useEffect(() => {
    const routePath = routeRef.current
    const signal = signalRef.current
    const sources = sourceRefs.current.filter(Boolean) as SVGCircleElement[]
    const cells = cellRefs.current.filter(Boolean) as SVGRectElement[]
    if (!routePath || !signal || sources.length !== taskAnalysisSources.length || cells.length !== taskAnalysisCells.length) return

    let cycle = 0
    let routeLength = 0
    let routeStarted = 0
    let currentCell = -1
    let activeRoute: { source: number; cells: number[]; outcome: number } | null = null

    const clear = () => {
      sources.forEach((node) => node.classList.remove('active'))
      cells.forEach((cell) => cell.classList.remove('active'))
    }

    const buildRoute = () => {
      const source = cycle % taskAnalysisSources.length
      const inputRow = Math.floor(source / 3)
      const outcome = (source + inputRow + 1) % taskAnalysisOutcomes.length
      const pathCells = [inputRow * 3, 4, outcome * 3 + 2]
      cycle = (cycle + 1) % taskAnalysisSources.length
      return { source, cells: pathCells, outcome }
    }

    const routeD = (route: { source: number; cells: number[]; outcome: number }) => {
      const source = taskAnalysisSources[route.source]
      const outcome = taskAnalysisOutcomes[route.outcome]
      return `M${source.x} ${source.y}H144C184 ${source.y} 198 78 230 78L325 78C365 78 386 78 421 78C449 78 463 ${outcome.y} ${outcome.x} ${outcome.y}`
    }

    if (reduce) {
      clear()
      const route = { source: 4, cells: [3, 4, 5], outcome: 1 }
      routePath.setAttribute('d', routeD(route))
      sources[route.source].classList.add('active')
      cells[4].classList.add('active')
      signal.setAttribute('cx', '352')
      signal.setAttribute('cy', '78')
      signal.style.opacity = '1'
      routePath.style.opacity = '1'
      return clear
    }

    if (!visible) {
      signal.style.opacity = '0'
      routePath.style.opacity = '0'
      return clear
    }

    const beginRoute = (now: number) => {
      clear()
      activeRoute = buildRoute()
      routePath.setAttribute('d', routeD(activeRoute))
      sources[activeRoute.source].classList.add('active')
      routeLength = routePath.getTotalLength()
      routeStarted = now
      currentCell = -1
    }

    const tick = (now: number) => {
      if (!activeRoute) beginRoute(now)
      if (!activeRoute) return

      const duration = routeLength * 6.2
      const progress = Math.min(1, (now - routeStarted) / duration)
      const point = routePath.getPointAtLength(routeLength * progress)
      const edgeOpacity = Math.min(1, progress / 0.045, (1 - progress) / 0.045)

      signal.setAttribute('cx', String(point.x))
      signal.setAttribute('cy', String(point.y))
      // Only the travelling signal and its route fade at the loop seam. The
      // source dots are permanent parts of the diagram; fading them would leave
      // each one invisible until its turn came round again.
      signal.style.opacity = String(Math.max(0, edgeOpacity))
      routePath.style.opacity = String(Math.max(0, edgeOpacity))

      let nextCell = -1
      if (point.x >= 230 && point.x <= 325) {
        nextCell = Math.min(activeRoute.cells.length - 1, Math.floor(((point.x - 230) / 95) * activeRoute.cells.length))
      }
      if (nextCell !== currentCell) {
        if (currentCell >= 0) cells[activeRoute.cells[currentCell]].classList.remove('active')
        currentCell = nextCell
        if (currentCell >= 0) cells[activeRoute.cells[currentCell]].classList.add('active')
      }

      if (progress >= 1) {
        if (currentCell >= 0) cells[activeRoute.cells[currentCell]].classList.remove('active')
        activeRoute = null
      }

    }

    signal.style.opacity = '1'
    routePath.style.opacity = '1'
    const unsubscribe = subscribeFrame(({ now }) => tick(now), {
      phase: 'write',
      label: 'industries-analysis-route',
    })

    return () => {
      unsubscribe()
      clear()
    }
  }, [reduce, visible])

  return (
    <div ref={mediaRef} className="application-task-media-stage application-task-media-analysis">
      <div className="application-task-analysis-panel">
        <svg className="application-task-analysis-svg" viewBox="0 0 520 156" aria-hidden="true">
          <g>
            <path className="application-task-analysis-rail" d="M32 38H144M32 78H144M32 118H144" />
            {taskAnalysisSources.map((point, index) => (
              <circle
                key={`source-${point.x}-${point.y}`}
                ref={(node) => { sourceRefs.current[index] = node }}
                className="application-task-analysis-node"
                cx={point.x}
                cy={point.y}
                r="4"
              />
            ))}
            <path className="application-task-analysis-link" d="M144 38C184 38 198 78 230 78M144 78C188 78 196 78 230 78M144 118C184 118 198 78 230 78" />
            <path ref={routeRef} className="application-task-analysis-route" d="" />
            <circle ref={signalRef} className="application-task-analysis-signal" r="3.3" />
            {taskAnalysisCells.map((point, index) => (
              <rect
                key={`cell-${point.x}-${point.y}`}
                ref={(node) => { cellRefs.current[index] = node }}
                className="application-task-analysis-cell"
                x={point.x - 12.5}
                y={point.y - 12.5}
                width="25"
                height="25"
                rx="1"
              />
            ))}
            <path className="application-task-analysis-out" d="M325 78C367 78 386 78 421 78" />
            <path className="application-task-analysis-branches" d="M421 78C447 78 461 53 494 45M421 78C452 78 463 78 494 78M421 78C447 78 461 103 494 111" />
            {taskAnalysisOutcomes.map((point) => (
              <circle key={`outcome-${point.y}`} className="application-task-analysis-outcome" cx={point.x} cy={point.y} r="3" />
            ))}
          </g>
        </svg>
      </div>
    </div>
  )
}

function RetrievalTaskMedia({ reduce }: { reduce: boolean }) {
  const mediaRef = useRef<HTMLDivElement | null>(null)
  const targetRefs = useRef<Array<SVGGElement | null>>([])
  const visible = useViewportActive(mediaRef, 0.08)

  useEffect(() => {
    const targets = targetRefs.current.filter(Boolean) as SVGGElement[]
    if (!targets.length) return
    if (reduce || !visible) {
      targets.forEach((target) => { target.style.opacity = '1' })
      return
    }

    const stops = targets.map((target, index) => {
      target.style.opacity = '0'
      return tweenNumber({
        from: 0,
        to: 1,
        durationMs: 600,
        delayMs: index * 160,
        ease: standardEase,
        label: `industries-retrieval-target:${index}`,
        write: opacity => { target.style.opacity = opacity.toFixed(4) },
      })
    })
    return () => stops.forEach(stop => stop())
  }, [reduce, visible])

  return (
    <div ref={mediaRef} className="application-task-media-stage application-task-media-retrieval">
      <img className="application-task-media-image" src="/img/ocr1.png" alt="" />
      <div className="application-task-media-layer">
        <svg className="application-task-retrieval-overlay" viewBox="0 0 1672 941" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {taskRetrievalTargets.map((target) => {
            const corners = retrievalTargetCorners(target)
            return (
              <g
                key={`retrieval-${target.x}-${target.y}`}
                ref={(node) => { targetRefs.current[taskRetrievalTargets.indexOf(target)] = node }}
                className="application-task-retrieval-target"
                transform={`rotate(${target.angle} ${target.x + target.w / 2} ${target.y + target.h / 2})`}
              >
                <rect
                  className="application-task-retrieval-target-body"
                  x={target.x}
                  y={target.y}
                  width={target.w}
                  height={target.h}
                  rx="2"
                />
                <path className="application-task-retrieval-target-glow" d={corners} />
                <path className="application-task-retrieval-target-corners" d={corners} />
              </g>
            )
          })}
        </svg>
        <span className="application-task-media-watermark">AI generated</span>
      </div>
    </div>
  )
}

function ApplicationTaskMedia({ activeTask, reduce }: { activeTask: number; reduce: boolean }) {
  if (activeTask === 0) return <VisionTaskMedia reduce={reduce} />
  if (activeTask === 1) return <ForecastingTaskMedia reduce={reduce} />
  if (activeTask === 2) return <AnalysisTaskMedia reduce={reduce} />
  return <RetrievalTaskMedia reduce={reduce} />
}

export function Industries() {
  const reduce = Boolean(useReducedMotion())
  const [activeDepth, setActiveDepth] = useState<DepthIndex>(0)
  const [activeContext, setActiveContext] = useState(0)
  const [activeTask, setActiveTask] = useState(0)
  const [activeSystemExample, setActiveSystemExample] = useState(0)
  const stageRefs = useRef<Array<HTMLElement | null>>([])
  const systemFieldRef = useRef<HTMLDivElement | null>(null)
  const systemParticleRefs = useRef<Array<SVGCircleElement | null>>([])
  const systemRingOneRef = useRef<HTMLSpanElement | null>(null)
  const systemRingTwoRef = useRef<HTMLSpanElement | null>(null)
  const [systemField, setSystemField] = useState({ width: 0, height: 0 })
  const systemVisible = useViewportActive(systemFieldRef, 0.08)

  useEffect(() => {
    const node = systemFieldRef.current
    if (!node || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect
      setSystemField((current) =>
        current.width === box.width && current.height === box.height
          ? current
          : { width: box.width, height: box.height },
      )
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const stages = stageRefs.current.filter(Boolean) as HTMLElement[]
    if (!stages.length || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        const index = Number((visible.target as HTMLElement).dataset.depthIndex)
        if (Number.isInteger(index)) setActiveDepth(index as DepthIndex)
      },
      { rootMargin: '-28% 0px -54% 0px', threshold: [0.12, 0.35, 0.6] },
    )

    stages.forEach((stage) => observer.observe(stage))
    return () => observer.disconnect()
  }, [])

  const goToDepth = (index: DepthIndex) => {
    setActiveDepth(index)
    stageRefs.current[index]?.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  const context = industries[activeContext]
  const systemExample = systemExamples[activeSystemExample]
  const activeSystemSignals = new Set<SystemSignal>(systemExample.signals)
  const plot = systemPlotGeometry(systemField.width, systemField.height)
  const plotReady = systemField.width > 0 && systemField.height > 0

  useAnimationFrame((time) => {
    systemSignals.forEach((signal, index) => {
      const particle = systemParticleRefs.current[index]
      if (!particle) return
      if (!activeSystemSignals.has(signal.id)) {
        particle.style.opacity = '0'
        return
      }

      const duration = 2400 + index * 180
      const progress = (time % duration) / duration
      const startY = (systemField.height * (index + 0.5)) / systemSignals.length
      const control = plot.cx * 0.5625
      const x = cubicPoint(0, control, control, plot.cx, progress)
      const y = cubicPoint(startY, startY, plot.cy, plot.cy, progress)
      const edgeOpacity = Math.min(1, progress / 0.08, (1 - progress) / 0.08)
      particle.setAttribute('cx', x.toFixed(2))
      particle.setAttribute('cy', y.toFixed(2))
      particle.style.opacity = String(Math.max(0, edgeOpacity))
    })

    const pulse = (node: HTMLElement | null, phaseOffset: number) => {
      if (!node) return
      const phase = ((time + phaseOffset) % 6000) / 6000
      const wave = 0.5 - Math.cos(phase * Math.PI * 2) / 2
      node.style.opacity = String(0.28 + wave * 0.3)
      node.style.transform = `translate(-50%, -50%) scale(${0.94 + wave * 0.1})`
    }
    pulse(systemRingOneRef.current, 0)
    pulse(systemRingTwoRef.current, 3000)
  }, plotReady && activeDepth === 2 && systemVisible && !reduce, {
    phase: 'write',
    label: 'industries-system-field',
  })

  return (
    <PageTransition>
      <PageHero
        title="The application sets the technical path"
        highlight="The benchmark comes before the model"
        sub="Models, data and software are selected according to the operating decision and the conditions in which it must be made."
        brandRelay
        cover="/img/sat-pivot.png"
      />

      <section className="section application-journey">
        <div className="container application-journey-layout">
          <nav className="application-depth-nav" aria-label="Application depth">
            {depthLabels.map((label, index) => (
              <button
                key={label}
                type="button"
                className={index === activeDepth ? 'active' : ''}
                aria-current={index === activeDepth ? 'step' : undefined}
                onClick={() => goToDepth(index as DepthIndex)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="application-depth-content">
            <article
              ref={(node) => { stageRefs.current[0] = node }}
              data-depth-index="0"
              className={`application-depth-stage${activeDepth === 0 ? ' active' : ''}`}
            >
              <h2 className="application-section-question">Where must it work?</h2>

              <div className="application-context-film">
                <div className="application-context-main">
                  {context.img && (
                    <img
                      src={context.img}
                      alt=""
                      loading="lazy"
                      style={context.focus ? ({ '--context-focus': context.focus } as CSSProperties) : undefined}
                    />
                  )}
                </div>
                <div className="application-context-list" role="group" aria-label="Application contexts">
                  {industries.map((item, index) => (
                    <button
                      key={item.title}
                      type="button"
                      className={index === activeContext ? 'active' : ''}
                      aria-pressed={index === activeContext}
                      onClick={() => setActiveContext(index)}
                    >
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              </div>
              <p className="application-context-desc" aria-live="polite">{context.caption}</p>
            </article>

            <article
              ref={(node) => { stageRefs.current[1] = node }}
              data-depth-index="1"
              className={`application-depth-stage${activeDepth === 1 ? ' active' : ''}`}
            >
              <h2 className="application-section-question">What must it do?</h2>

              <VerticalTabExplorer
                id="application-task-explorer"
                items={applicationTaskExplorerItems}
                activeIndex={activeTask}
                onChange={setActiveTask}
                ariaLabel="Application task family"
                orientation="horizontal"
                panel={
                  <div className="application-task-content">
                    <h3 className="application-task-verb">{applicationTasks[activeTask].verb}</h3>
                    <p>{applicationTasks[activeTask].desc}</p>
                    <ApplicationTaskMedia activeTask={activeTask} reduce={reduce} />
                  </div>
                }
              />
            </article>

            <article
              ref={(node) => { stageRefs.current[2] = node }}
              data-depth-index="2"
              className={`application-depth-stage${activeDepth === 2 ? ' active' : ''}`}
            >
              <h2 className="application-section-question">What data must it handle?</h2>

              <div className="application-system-mixer">
                <div className="application-system-signals" role="group" aria-label="Example input signal families">
                  {systemSignals.map((signal) => {
                    const isActive = activeSystemSignals.has(signal.id)
                    return (
                      <div className={`application-system-signal${isActive ? ' active' : ''}`} key={signal.id}>
                        <span>{signal.id}</span>
                        <small>{signal.formats}</small>
                      </div>
                    )
                  })}
                </div>

                <div className="application-system-center">
                  <div
                    className="application-system-field"
                    ref={systemFieldRef}
                    style={{
                      '--sys-cx': `${plot.cx}px`,
                      '--sys-cy': `${plot.cy}px`,
                      '--sys-hub': `${plot.hub}px`,
                      '--sys-ring-inner': `${plot.ringInner}px`,
                      '--sys-ring-outer': `${plot.ringOuter}px`,
                    } as CSSProperties}
                  >
                    {plotReady && (
                      <>
                        <svg viewBox={`0 0 ${systemField.width} ${systemField.height}`} aria-hidden="true">
                          <g>
                            {systemSignals.map((signal, index) => {
                              const isActive = activeSystemSignals.has(signal.id)
                              return (
                                <g key={signal.id}>
                                  <path
                                    className={`application-system-path${isActive ? ' active' : ''}`}
                                    d={plot.paths[index]}
                                  />
                                  {!reduce && (
                                    <circle
                                      ref={(node) => { systemParticleRefs.current[index] = node }}
                                      className="application-system-particle"
                                      r="4"
                                      style={{ opacity: 0 }}
                                    />
                                  )}
                                </g>
                              )
                            })}
                          </g>
                        </svg>
                        <span ref={systemRingOneRef} className="application-system-ring application-system-ring-one" aria-hidden="true" />
                        <span ref={systemRingTwoRef} className="application-system-ring application-system-ring-two" aria-hidden="true" />
                        <div className="application-system-ai">AI</div>
                      </>
                    )}
                  </div>
                </div>

                <div className="application-system-examples" role="group" aria-label="Example application targets">
                  {systemExamples.map((example, index) => {
                    const isActive = index === activeSystemExample
                    return (
                      <button
                        key={example.title}
                        type="button"
                        className={isActive ? 'active' : ''}
                        aria-pressed={isActive}
                        onClick={() => setActiveSystemExample(index)}
                      >
                        <span>{example.title}</span>
                        <small>{example.desc}</small>
                      </button>
                    )
                  })}
                </div>

                <div className="application-system-band">
                  <p className="application-system-caption">{systemExample.caption}</p>

                  <div className="application-system-resolution" role="group" aria-label="System resolution">
                    <div>
                      <strong>Available</strong>
                      <span>Start with the signals the challenge actually provides.</span>
                    </div>
                    <div>
                      <strong>Fit</strong>
                      <span>Combine only the modalities that add decision value.</span>
                    </div>
                    <div>
                      <strong>Resolve</strong>
                      <span>Select the AI approach the application can support operationally.</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article
              ref={(node) => { stageRefs.current[3] = node }}
              data-depth-index="3"
              className={`application-depth-stage${activeDepth === 3 ? ' active' : ''}`}
            >
              <h2 className="application-section-question">What requires human judgment?</h2>

              <div className="application-segmentation">
                <SegmentSlider />
                <div className="application-segmentation-capabilities">
                  <span>Semantic &amp; instance segmentation</span>
                  <span>Detection, classification &amp; keypoints</span>
                  <span>Human-in-the-loop QA at production scale</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <CtaBand
        title="How much complexity do we actually need?"
        sub=""
        label="Let’s Talk"
        showExplore={false}
        showContactDetails={false}
        withArrow={false}
      />
    </PageTransition>
  )
}
