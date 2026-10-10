import { clamp, integrateFixed, stepSpring, type SpringState } from './physics'
import { scheduleAfter, subscribeFrame } from './scheduler'

type Track = 'blue' | 'red'
type Scene = 'empty' | 'draw' | 'settle' | 'explore' | 'dissolve' | 'static'
type Phase = { name: 'both' | 'blue' | 'red'; tracks: Track[] }

type WavePoint = {
  x: number
  y: number
  sinTheta: number
}

type WaveGeometry = {
  d: string
  xs: Float32Array
  ys: Float32Array
  distances: Float32Array
  totalLength: number
}

type TrackState = {
  distance: number
  velocity: number
  delayMs: number
  elapsedDelayMs: number
  nextNode: number
  done: boolean
}

type PulseState = {
  coreElement: SVGCircleElement
  ringElement: SVGCircleElement
  baseCoreRadius: number
  coreSpring: SpringState
  ringRadius: number
  ringVelocity: number
  initialRingVelocity: number
  released: boolean
  age: number
  releaseLabel: () => void
}

export type CinematicDualWaveOptions = {
  interactionResumeGraceMs?: number
}

const PHASES: Phase[] = [
  { name: 'both', tracks: ['blue', 'red'] },
  { name: 'blue', tracks: ['blue'] },
  { name: 'red', tracks: ['red'] },
]

const CFG = {
  worldWidth: 1440,
  worldHeight: 720,
  x0: 170,
  x1: 1270,
  centerY: 360,
  amplitude: 122,
  period: 550,
  phase: { blue: 0, red: Math.PI } satisfies Record<Track, number>,
  nodeXs: [170, 445, 720, 995, 1270],
  minVelocity: 96,
  initialVelocity: 196,
  gravity: 120,
  rollingResistance: 1.25,
  inertiaFactor: 0.6,
  dualDelayMs: 130,
  hoverIntentMs: 100,
  explorationIdleMs: 12000,
  dissolveMs: 520,
  emptyBreathMs: 320,
  pulseCoreStiffness: 86,
  pulseCoreDamping: 15,
  pulseRingDrag: 3.65,
  sampleStep: 2,
}

/**
 * Mount the accepted cinematic dual-wave experience into React-rendered static
 * markup. The high-frequency state lives entirely outside React: no setState,
 * no component render, and no layout read occurs per frame.
 *
 * Performance contract:
 * - one repository-wide RAF subscription while motion is actually changing;
 * - no RAF work while offscreen, in the 12s reading state, or during interaction;
 * - cached viewport metrics maintained by ResizeObserver;
 * - precomputed polyline arc length/slope tables instead of SVG geometry queries
 *   in the frame loop;
 * - one cheap rectangular clip mutation per active track; large Gaussian glow
 *   paths remain geometrically static instead of changing dash geometry;
 * - compositor-friendly camera movement via one translate3d+scale transform;
 * - the DOM pulse layer is intentionally empty in JSX, so transient SVG pulse
 *   children can be managed imperatively without conflicting with React.
 */
export function mountCinematicDualWave(
  frame: HTMLElement,
  { interactionResumeGraceMs = 1000 }: CinematicDualWaveOptions = {},
) {
  const worldElement = frame.querySelector<HTMLElement>('[data-cinema-world]')
  const pulseLayerElement = frame.querySelector<SVGGElement>('[data-cinema-pulses]')
  const bluePath = frame.querySelector<SVGPathElement>('[data-cinema-track="blue"]')
  const redPath = frame.querySelector<SVGPathElement>('[data-cinema-track="red"]')
  const blueRibbon = frame.querySelector<SVGPathElement>('[data-cinema-ribbon="blue"]')
  const redRibbon = frame.querySelector<SVGPathElement>('[data-cinema-ribbon="red"]')
  const blueHover = frame.querySelector<SVGPathElement>('[data-cinema-hover="blue"]')
  const redHover = frame.querySelector<SVGPathElement>('[data-cinema-hover="red"]')
  const blueRevealClip = frame.querySelector<SVGRectElement>('[data-cinema-reveal-clip="blue"]')
  const redRevealClip = frame.querySelector<SVGRectElement>('[data-cinema-reveal-clip="red"]')
  const nodes = Array.from(frame.querySelectorAll<HTMLButtonElement>('[data-cinema-node]'))

  if (!worldElement || !pulseLayerElement || !bluePath || !redPath || !blueRibbon || !redRibbon || !blueHover || !redHover || !blueRevealClip || !redRevealClip) {
    return () => undefined
  }

  const world = worldElement
  const pulseLayer = pulseLayerElement
  const paths: Record<Track, SVGPathElement> = { blue: bluePath, red: redPath }
  const ribbons: Record<Track, SVGPathElement> = { blue: blueRibbon, red: redRibbon }
  const hovers: Record<Track, SVGPathElement> = { blue: blueHover, red: redHover }
  const revealClips: Record<Track, SVGRectElement> = { blue: blueRevealClip, red: redRevealClip }

  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = reducedQuery.matches
  let desktop = window.innerWidth > 800
  let visible = false
  let destroyed = false
  let unsubscribeFrame: (() => void) | null = null
  let lastFrameNow = 0
  let closeTimer: (() => void) | null = null
  let hoverIntentTimer: (() => void) | null = null
  let hoverIntentNode: HTMLButtonElement | null = null
  let resumeTimer: (() => void) | null = null
  let explorationTimer: (() => void) | null = null
  let phaseIndex = 0
  let scene: Scene = 'empty'
  let sceneElapsedMs = 0
  let activeNode: HTMLButtonElement | null = null
  let pinnedNode: HTMLButtonElement | null = null
  let trackStates: Partial<Record<Track, TrackState>> = {}
  const pulseStates = new Set<PulseState>()
  const revealed = new Set<HTMLButtonElement>()
  const labelFades = new Map<HTMLButtonElement, number>()
  const cleanups: Array<() => void> = []
  const lastRevealWidth: Record<Track, string> = { blue: '', red: '' }

  const viewport = { width: frame.clientWidth, height: frame.clientHeight }
  const camera = {
    centerX: { value: CFG.x0, velocity: 0 } satisfies SpringState,
    scale: { value: 1, velocity: 0 } satisfies SpringState,
  }

  function waveY(track: Track, x: number) {
    return CFG.centerY - CFG.amplitude * Math.cos((2 * Math.PI * (x - CFG.x0) / CFG.period) + CFG.phase[track])
  }

  function buildGeometry(track: Track): WaveGeometry {
    const count = Math.ceil((CFG.x1 - CFG.x0) / CFG.sampleStep) + 1
    const xs = new Float32Array(count)
    const ys = new Float32Array(count)
    const distances = new Float32Array(count)
    const commands: string[] = new Array(count)
    let totalLength = 0

    for (let index = 0; index < count; index++) {
      const x = index === count - 1 ? CFG.x1 : Math.min(CFG.x1, CFG.x0 + index * CFG.sampleStep)
      const y = waveY(track, x)
      xs[index] = x
      ys[index] = y
      if (index > 0) totalLength += Math.hypot(x - xs[index - 1], y - ys[index - 1])
      distances[index] = totalLength
      commands[index] = `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
    }

    return { d: commands.join(' '), xs, ys, distances, totalLength }
  }

  const geometry = {
    blue: buildGeometry('blue'),
    red: buildGeometry('red'),
  } satisfies Record<Track, WaveGeometry>

  function lowerBound(array: Float32Array, value: number) {
    let lo = 0
    let hi = array.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (array[mid] < value) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  function distanceAtX(track: Track, x: number) {
    const g = geometry[track]
    const index = lowerBound(g.xs, x)
    if (index <= 0) return 0
    const x0 = g.xs[index - 1]
    const x1 = g.xs[index]
    const ratio = x1 === x0 ? 0 : (x - x0) / (x1 - x0)
    // Float32 arc-length samples can round the final stored distance a few
    // ulps above the double-precision accumulator. Clamp the interpolated
    // threshold so the terminal extremum can never sit beyond totalLength and
    // strand the final label in the settle scene.
    return Math.min(
      g.totalLength,
      g.distances[index - 1] + (g.distances[index] - g.distances[index - 1]) * ratio,
    )
  }

  function pointAtDistance(track: Track, distance: number): WavePoint {
    const g = geometry[track]
    const d = clamp(distance, 0, g.totalLength)
    const index = lowerBound(g.distances, d)
    if (index <= 0) {
      const dx = g.xs[1] - g.xs[0]
      const dy = g.ys[1] - g.ys[0]
      return { x: g.xs[0], y: g.ys[0], sinTheta: dy / (Math.hypot(dx, dy) || 1) }
    }
    const previous = index - 1
    const segmentLength = g.distances[index] - g.distances[previous]
    const ratio = segmentLength ? (d - g.distances[previous]) / segmentLength : 0
    const dx = g.xs[index] - g.xs[previous]
    const dy = g.ys[index] - g.ys[previous]
    return {
      x: g.xs[previous] + dx * ratio,
      y: g.ys[previous] + dy * ratio,
      sinTheta: dy / (Math.hypot(dx, dy) || 1),
    }
  }

  const thresholds = {
    blue: CFG.nodeXs.map(x => distanceAtX('blue', x)),
    red: CFG.nodeXs.map(x => distanceAtX('red', x)),
  } satisfies Record<Track, number[]>

  function buildSegmentPath(track: Track, startX: number, endX: number) {
    const commands: string[] = []
    for (let x = startX; x <= endX; x += CFG.sampleStep) {
      commands.push(`${x === startX ? 'M' : 'L'}${x.toFixed(2)} ${waveY(track, x).toFixed(2)}`)
    }
    if ((endX - startX) % CFG.sampleStep) {
      commands.push(`L${endX.toFixed(2)} ${waveY(track, endX).toFixed(2)}`)
    }
    return commands.join(' ')
  }

  const segmentGeometry = {
    blue: [] as string[],
    red: [] as string[],
  }
  ;(['blue', 'red'] as Track[]).forEach(track => {
    CFG.nodeXs.forEach((_, index) => {
      const startIndex = index === CFG.nodeXs.length - 1 ? index - 1 : index
      const endIndex = index === CFG.nodeXs.length - 1 ? index : index + 1
      segmentGeometry[track][index] = buildSegmentPath(track, CFG.nodeXs[startIndex], CFG.nodeXs[endIndex])
    })
  })

  ;(['blue', 'red'] as Track[]).forEach(track => {
    const g = geometry[track]
    paths[track].setAttribute('d', g.d)
    ribbons[track].setAttribute('d', g.d)
    hovers[track].setAttribute('d', g.d)
    revealClips[track].setAttribute('width', '0')
  })

  const nodeByTrackIndex = {
    blue: [] as HTMLButtonElement[],
    red: [] as HTMLButtonElement[],
  }
  nodes.forEach(node => {
    const track = node.dataset.track as Track
    const index = Number(node.dataset.order)
    const x = CFG.nodeXs[index]
    const y = waveY(track, x)
    nodeByTrackIndex[track][index] = node
    node.style.setProperty('--node-x', `${x}px`)
    node.style.setProperty('--node-y', `${y}px`)
    node.dataset.side = y < CFG.centerY ? 'above' : 'below'
    node.dataset.pointX = String(x)
    node.dataset.pointY = String(y)
  })

  function setReveal(track: Track, distance: number) {
    const value = clamp(distance, 0, geometry[track].totalLength)
    const width = value <= 0
      ? '0'
      : (value >= geometry[track].totalLength - 0.5
          ? CFG.x1 + 32
          : pointAtDistance(track, value).x).toFixed(2)
    if (lastRevealWidth[track] === width) return
    lastRevealWidth[track] = width
    revealClips[track].setAttribute('width', width)
  }

  function selectHoverSegment(node: HTMLButtonElement) {
    const track = node.dataset.track as Track
    const index = Number(node.dataset.order)
    hovers[track].setAttribute('d', segmentGeometry[track][index])
    frame.dataset.activeSegment = `${track}-${index}`
  }

  function setTrackVisibility(activeTracks: Track[]) {
    (['blue', 'red'] as Track[]).forEach(track => {
      const enabled = activeTracks.includes(track)
      paths[track].style.opacity = enabled ? '1' : '0'
      ribbons[track].style.opacity = enabled ? '.075' : '0'
      hovers[track].style.removeProperty('opacity')
    })
  }

  function rollingAcceleration(track: Track, distance: number, velocity: number) {
    const { sinTheta } = pointAtDistance(track, distance)
    const resistance = velocity === 0 ? 0 : CFG.rollingResistance * Math.sign(velocity)
    return CFG.inertiaFactor * CFG.gravity * sinTheta - resistance
  }

  function smoothstep(value: number) {
    const t = clamp(value, 0, 1)
    return t * t * t * (t * (t * 6 - 15) + 10)
  }

  function fitScale() {
    return Math.min((viewport.width - 66) / CFG.worldWidth, (viewport.height - 48) / CFG.worldHeight)
  }

  function cameraTargets(progress: number) {
    const t = smoothstep(progress)
    const full = fitScale()
    return {
      centerX: CFG.x0 + (720 - CFG.x0) * t,
      scale: full * (1.72 + (0.95 - 1.72) * t),
    }
  }

  function applyCamera() {
    if (!desktop) return
    const tx = viewport.width / 2 - camera.centerX.value * camera.scale.value
    const ty = viewport.height / 2 - CFG.centerY * camera.scale.value
    world.style.transform = `translate3d(${tx.toFixed(3)}px,${ty.toFixed(3)}px,0) scale(${camera.scale.value.toFixed(6)})`
    const inverse = (1 / camera.scale.value).toFixed(6)
    revealed.forEach(node => {
      node.querySelector<HTMLElement>('.cinema-node-scale')?.style.setProperty('transform', `scale(${inverse})`)
    })
  }

  function resetCamera() {
    const target = cameraTargets(0)
    camera.centerX.value = target.centerX
    camera.centerX.velocity = 0
    camera.scale.value = target.scale
    camera.scale.velocity = 0
    applyCamera()
  }

  function updateCamera(progress: number, dt: number) {
    const target = cameraTargets(progress)
    integrateFixed(dt, step => {
      stepSpring(camera.centerX, target.centerX, step, { stiffness: 52, damping: 15 })
      stepSpring(camera.scale, target.scale, step, { stiffness: 58, damping: 16 })
    })
    applyCamera()
  }

  function releaseNode(node: HTMLButtonElement) {
    if (revealed.has(node)) return
    revealed.add(node)
    node.classList.add('is-revealed')
    node.querySelector<HTMLElement>('.cinema-node-scale')?.style.setProperty('transform', `scale(${(1 / camera.scale.value).toFixed(6)})`)
    if (reduced || !desktop || scene === 'static') {
      node.style.opacity = '1'
      return
    }
    node.style.opacity = '0'
    labelFades.set(node, 0)
  }

  function updateLabelFades(dt: number) {
    labelFades.forEach((elapsed, node) => {
      const nextElapsed = elapsed + dt
      const progress = smoothstep(nextElapsed / 0.26)
      node.style.opacity = progress.toFixed(4)
      if (progress >= 1) labelFades.delete(node)
      else labelFades.set(node, nextElapsed)
    })
  }

  function setDissolveOpacity(progress: number) {
    const opacity = 1 - smoothstep(progress)
    const phase = currentPhase()
    phase.tracks.forEach(track => {
      paths[track].style.opacity = opacity.toFixed(4)
      ribbons[track].style.opacity = (opacity * 0.075).toFixed(4)
    })
    revealed.forEach(node => { node.style.opacity = opacity.toFixed(4) })
  }

  function createPulse(track: Track, index: number, impactVelocity: number) {
    const node = nodeByTrackIndex[track][index]
    if (!node || revealed.has(node)) return
    if (reduced || !desktop) {
      releaseNode(node)
      return
    }

    const namespace = 'http://www.w3.org/2000/svg'
    const core = document.createElementNS(namespace, 'circle')
    const ring = document.createElementNS(namespace, 'circle')
    const x = Number(node.dataset.pointX)
    const y = Number(node.dataset.pointY)
    const scale = Math.max(0.2, camera.scale.value)
    const baseCoreRadius = 3.65 / scale
    const baseRingRadius = 5.2 / scale
    const coreVelocity = clamp(impactVelocity / 42, 3.2, 6.4)
    const ringVelocity = clamp(impactVelocity * 0.255, 28, 64) / scale

    core.setAttribute('cx', String(x))
    core.setAttribute('cy', String(y))
    ring.setAttribute('cx', String(x))
    ring.setAttribute('cy', String(y))
    core.setAttribute('class', `cinema-pulse-core ${track}`)
    ring.setAttribute('class', `cinema-pulse-ring ${track}`)
    pulseLayer.append(ring, core)

    pulseStates.add({
      coreElement: core,
      ringElement: ring,
      baseCoreRadius,
      coreSpring: { value: 0, velocity: coreVelocity },
      ringRadius: baseRingRadius,
      ringVelocity,
      initialRingVelocity: ringVelocity,
      released: false,
      age: 0,
      releaseLabel: () => releaseNode(node),
    })
  }

  function clearPulses() {
    pulseStates.forEach(pulse => {
      pulse.coreElement.remove()
      pulse.ringElement.remove()
    })
    pulseStates.clear()
    pulseLayer.replaceChildren()
  }

  function updatePulses(dt: number) {
    if (!pulseStates.size) return
    const labelsToRelease: Array<() => void> = []
    integrateFixed(dt, step => {
      pulseStates.forEach(pulse => {
        const previousVelocity = pulse.coreSpring.velocity
        stepSpring(pulse.coreSpring, 0, step, {
          stiffness: CFG.pulseCoreStiffness,
          damping: CFG.pulseCoreDamping,
        })
        pulse.ringVelocity += (-CFG.pulseRingDrag * pulse.ringVelocity) * step
        pulse.ringRadius += Math.max(0, pulse.ringVelocity) * step
        pulse.age += step
        if (!pulse.released && previousVelocity > 0 && pulse.coreSpring.velocity <= 0) {
          pulse.released = true
          labelsToRelease.push(pulse.releaseLabel)
        }
      })
    })

    labelsToRelease.forEach(release => release())

    pulseStates.forEach(pulse => {
      const q = Math.max(0, pulse.coreSpring.value)
      const coreRadius = pulse.baseCoreRadius * (0.58 + Math.min(1.15, q * 3.5))
      const coreOpacity = clamp(q * 2.7 + Math.abs(pulse.coreSpring.velocity) * 0.025, 0, 0.96)
      const ringEnergy = clamp(pulse.ringVelocity / pulse.initialRingVelocity, 0, 1)
      pulse.coreElement.setAttribute('r', coreRadius.toFixed(3))
      pulse.coreElement.style.opacity = coreOpacity.toFixed(4)
      pulse.ringElement.setAttribute('r', pulse.ringRadius.toFixed(3))
      pulse.ringElement.style.opacity = (0.72 * ringEnergy).toFixed(4)

      const settled = pulse.age > 0.18
        && Math.abs(pulse.coreSpring.value) < 0.009
        && Math.abs(pulse.coreSpring.velocity) < 0.08
        && pulse.ringVelocity < 0.65
      if (settled) {
        if (!pulse.released) pulse.releaseLabel()
        pulse.coreElement.remove()
        pulse.ringElement.remove()
        pulseStates.delete(pulse)
      }
    })
  }

  function hideAllNodes() {
    nodes.forEach(node => {
      node.classList.remove('is-revealed', 'is-active', 'is-pinned')
      node.style.removeProperty('opacity')
      node.querySelector<HTMLElement>('.cinema-node-scale')?.style.removeProperty('transform')
      node.setAttribute('aria-expanded', 'false')
      node.querySelector<HTMLElement>('.cinema-node-detail')?.setAttribute('aria-hidden', 'true')
    })
    revealed.clear()
    labelFades.clear()
    activeNode = null
    pinnedNode = null
    resumeTimer?.()
    resumeTimer = null
    cancelHoverIntent()
    frame.classList.remove('has-active', 'is-interactive')
    delete frame.dataset.activeTrack
    delete frame.dataset.activeSegment
  }

  function phaseLabelsRevealed(phase: Phase) {
    return phase.tracks.every(track => nodeByTrackIndex[track].every(node => revealed.has(node)))
  }

  function currentPhase() {
    return PHASES[phaseIndex % PHASES.length]
  }

  function setupPhase() {
    const phase = currentPhase()
    scene = 'empty'
    sceneElapsedMs = 0
    trackStates = {}
    frame.dataset.moviePhase = phase.name
    frame.classList.remove('is-dissolving', 'is-interactive')
    hideAllNodes()
    clearPulses()
    setTrackVisibility(phase.tracks)
    phase.tracks.forEach(track => setReveal(track, 0))
    resetCamera()
  }

  function startDraw() {
    const phase = currentPhase()
    scene = 'draw'
    sceneElapsedMs = 0
    trackStates = Object.fromEntries(phase.tracks.map(track => [track, {
      distance: 0,
      velocity: CFG.initialVelocity,
      delayMs: phase.name === 'both' && track === 'red' ? CFG.dualDelayMs : 0,
      elapsedDelayMs: 0,
      nextNode: 0,
      done: false,
    }])) as Partial<Record<Track, TrackState>>
  }

  function beginExplore() {
    scene = 'explore'
    frame.classList.add('is-interactive')
    frame.dataset.explorationState = 'waiting'
    frame.dataset.explorationRemainingMs = String(CFG.explorationIdleMs)
    stopLoop()
    scheduleExplorationAdvance()
  }

  function scheduleExplorationAdvance() {
    explorationTimer?.()
    explorationTimer = null
    if (destroyed || scene !== 'explore' || activeNode || pinnedNode || resumeTimer) return
    frame.dataset.explorationState = 'waiting'
    frame.dataset.explorationRemainingMs = String(CFG.explorationIdleMs)
    explorationTimer = scheduleAfter(CFG.explorationIdleMs, () => {
      explorationTimer = null
      if (destroyed || scene !== 'explore' || activeNode || pinnedNode || resumeTimer) return
      frame.dataset.explorationState = 'complete'
      scene = 'dissolve'
      sceneElapsedMs = 0
      frame.dataset.moviePhase = 'transition'
      frame.classList.remove('is-interactive')
      frame.classList.add('is-dissolving')
      startLoop()
    }, 'operating-model-exploration')
  }

  function markActivity() {
    if (scene === 'explore' && !activeNode && !pinnedNode) scheduleExplorationAdvance()
  }

  function isMoviePaused() {
    return Boolean(activeNode || pinnedNode || resumeTimer)
  }

  function startLoop() {
    if (unsubscribeFrame || destroyed || !visible || reduced || !desktop || isMoviePaused() || scene === 'explore' || scene === 'static') return
    lastFrameNow = 0
    unsubscribeFrame = subscribeFrame(({ now }) => {
      const deltaSeconds = lastFrameNow ? Math.min((now - lastFrameNow) / 1000, 0.05) : 1 / 60
      lastFrameNow = now
      stepMovie(deltaSeconds)
    }, { phase: 'write', label: 'operating-model' })
  }

  function stopLoop() {
    unsubscribeFrame?.()
    unsubscribeFrame = null
    lastFrameNow = 0
  }

  function stepMovie(dt: number) {
    if (destroyed || !visible || reduced || !desktop || isMoviePaused()) {
      stopLoop()
      return
    }

    const phase = currentPhase()
    sceneElapsedMs += dt * 1000

    if (scene === 'empty') {
      if (sceneElapsedMs >= CFG.emptyBreathMs) startDraw()
      return
    }

    if (scene === 'draw') {
      const impacts: Array<{ track: Track; index: number; velocity: number }> = []
      integrateFixed(dt, step => {
        phase.tracks.forEach(track => {
          const state = trackStates[track]
          if (!state || state.done) return
          if (state.elapsedDelayMs < state.delayMs) {
            state.elapsedDelayMs += step * 1000
            return
          }
          state.velocity += rollingAcceleration(track, state.distance, state.velocity) * step
          state.velocity = Math.max(CFG.minVelocity, state.velocity)
          state.distance = Math.min(geometry[track].totalLength, state.distance + state.velocity * step)

          while (state.nextNode < thresholds[track].length && state.distance >= thresholds[track][state.nextNode]) {
            impacts.push({ track, index: state.nextNode, velocity: state.velocity })
            state.nextNode++
          }
          if (state.distance >= geometry[track].totalLength - 0.01) state.done = true
        })
      })

      // Fixed substeps evolve numbers only. Each visible property is committed
      // once after integration, regardless of how many substeps this frame used.
      phase.tracks.forEach(track => {
        const state = trackStates[track]
        if (state) setReveal(track, state.distance)
      })
      impacts.forEach(impact => createPulse(impact.track, impact.index, impact.velocity))

      const progress = Math.max(...phase.tracks.map(track => {
        const state = trackStates[track]
        return state ? state.distance / geometry[track].totalLength : 0
      }))
      updateCamera(progress, dt)
      updatePulses(dt)
      updateLabelFades(dt)

      if (phase.tracks.every(track => trackStates[track]?.done)) {
        phase.tracks.forEach(track => setReveal(track, geometry[track].totalLength))
        scene = 'settle'
        sceneElapsedMs = 0
      }
      return
    }

    if (scene === 'settle') {
      updateCamera(1, dt)
      updatePulses(dt)
      updateLabelFades(dt)
      if (phaseLabelsRevealed(phase) && pulseStates.size === 0 && labelFades.size === 0) beginExplore()
      return
    }

    if (scene === 'dissolve') {
      setDissolveOpacity(sceneElapsedMs / CFG.dissolveMs)
    }

    if (scene === 'dissolve' && sceneElapsedMs >= CFG.dissolveMs) {
      setTrackVisibility([])
      hideAllNodes()
      clearPulses()
      frame.classList.remove('is-dissolving')
      phaseIndex = (phaseIndex + 1) % PHASES.length
      setupPhase()
    }
  }

  function showStatic() {
    stopLoop()
    explorationTimer?.()
    explorationTimer = null
    resumeTimer?.()
    resumeTimer = null
    scene = 'static'
    frame.dataset.moviePhase = 'static'
    frame.classList.remove('is-dissolving')
    hideAllNodes()
    clearPulses()
    setTrackVisibility(['blue', 'red'])
    ;(['blue', 'red'] as Track[]).forEach(track => setReveal(track, geometry[track].totalLength))
    const target = cameraTargets(1)
    camera.centerX.value = target.centerX
    camera.centerX.velocity = 0
    camera.scale.value = target.scale
    camera.scale.velocity = 0
    applyCamera()
    nodes.forEach(releaseNode)
    frame.classList.add('is-interactive')
  }

  function restartMovie() {
    explorationTimer?.()
    explorationTimer = null
    resumeTimer?.()
    resumeTimer = null
    stopLoop()
    if (!visible) return
    if (reduced || !desktop) {
      showStatic()
      return
    }
    phaseIndex = 0
    setupPhase()
    startLoop()
  }

  function setNodeActive(node: HTMLButtonElement, active: boolean) {
    node.classList.toggle('is-active', active)
    node.setAttribute('aria-expanded', active ? 'true' : 'false')
    node.querySelector<HTMLElement>('.cinema-node-detail')?.setAttribute('aria-hidden', active ? 'false' : 'true')
  }

  function beginResumeGrace(startedAt = performance.now()) {
    resumeTimer?.()
    resumeTimer = null
    stopLoop()
    frame.dataset.interactionGrace = 'waiting'
    const elapsed = Math.max(0, performance.now() - startedAt)
    const remaining = Math.max(0, interactionResumeGraceMs - elapsed)
    resumeTimer = scheduleAfter(remaining, () => {
      resumeTimer = null
      frame.dataset.interactionGrace = 'complete'
      if (scene === 'explore') scheduleExplorationAdvance()
      else startLoop()
    }, 'operating-model-resume-grace')
  }

  function holdForInteraction() {
    resumeTimer?.()
    resumeTimer = null
    explorationTimer?.()
    explorationTimer = null
    stopLoop()
    frame.dataset.interactionGrace = 'active'
  }

  function activateNode(node: HTMLButtonElement | null, interactionEndedAt = performance.now()) {
    if (node && !revealed.has(node)) return
    if (node === activeNode) {
      if (node) holdForInteraction()
      return
    }

    if (activeNode && activeNode !== pinnedNode) setNodeActive(activeNode, false)
    activeNode = node

    if (node) {
      selectHoverSegment(node)
      holdForInteraction()
      setNodeActive(node, true)
      frame.classList.add('has-active')
      frame.dataset.activeTrack = node.dataset.track ?? ''
    } else {
      frame.classList.remove('has-active')
      delete frame.dataset.activeTrack
      beginResumeGrace(interactionEndedAt)
    }
  }

  function cancelHoverIntent(node: HTMLButtonElement | null = null) {
    if (node && hoverIntentNode && hoverIntentNode !== node) return
    hoverIntentTimer?.()
    hoverIntentTimer = null
    hoverIntentNode = null
    frame.dataset.hoverIntent = 'none'
  }

  function armHoverIntent(node: HTMLButtonElement, event: PointerEvent) {
    if (!revealed.has(node) || event.pointerType === 'touch') return
    if (activeNode === node || pinnedNode === node) return
    // Dwell, not stillness: the nodes move under the pointer, so a live timer
    // for this node is never restarted by further movement inside its hit area.
    if (hoverIntentNode === node && hoverIntentTimer) return
    if (hoverIntentNode !== node) cancelHoverIntent()
    hoverIntentNode = node
    hoverIntentTimer = scheduleAfter(CFG.hoverIntentMs, () => {
      if (hoverIntentNode !== node || !revealed.has(node) || !node.matches(':hover')) {
        cancelHoverIntent(node)
        return
      }
      hoverIntentTimer = null
      hoverIntentNode = null
      frame.dataset.hoverIntent = 'activated'
      activateNode(node)
    }, 'operating-model-hover-intent')
    frame.dataset.hoverIntent = 'waiting'
  }

  function maybeClose(node: HTMLButtonElement) {
    const interactionEndedAt = performance.now()
    closeTimer?.()
    closeTimer = scheduleAfter(140, () => {
      closeTimer = null
      const detail = node.querySelector<HTMLElement>('.cinema-node-detail')
      if (pinnedNode === node || node.matches(':hover') || detail?.matches(':hover') || document.activeElement === node) return
      if (activeNode === node) activateNode(pinnedNode, interactionEndedAt)
    }, 'operating-model-close-intent')
  }

  nodes.forEach(node => {
    const detail = node.querySelector<HTMLElement>('.cinema-node-detail')
    // pointerenter also arms the dwell, so a label drifting under a stationary
    // pointer locks without requiring the user to move first.
    const pointerIntent = (event: PointerEvent) => {
      closeTimer?.()
      closeTimer = null
      armHoverIntent(node, event)
    }
    const pointerLeave = () => {
      cancelHoverIntent(node)
      maybeClose(node)
    }
    const focus = () => {
      cancelHoverIntent()
      closeTimer?.()
      closeTimer = null
      activateNode(node)
    }
    const detailEnter = () => {
      cancelHoverIntent()
      closeTimer?.()
      closeTimer = null
      activateNode(node)
    }
    const leave = () => maybeClose(node)
    const click = (event: Event) => {
      event.stopPropagation()
      cancelHoverIntent()
      if (pinnedNode === node) {
        node.classList.remove('is-pinned')
        pinnedNode = null
        activateNode(null)
      } else {
        pinnedNode?.classList.remove('is-pinned')
        pinnedNode = node
        node.classList.add('is-pinned')
        activateNode(node)
      }
    }

    node.addEventListener('pointerenter', pointerIntent)
    node.addEventListener('pointermove', pointerIntent)
    node.addEventListener('pointerleave', pointerLeave)
    node.addEventListener('focus', focus)
    node.addEventListener('blur', leave)
    node.addEventListener('click', click)
    detail?.addEventListener('pointerenter', detailEnter)
    detail?.addEventListener('pointerleave', leave)

    cleanups.push(() => {
      node.removeEventListener('pointerenter', pointerIntent)
      node.removeEventListener('pointermove', pointerIntent)
      node.removeEventListener('pointerleave', pointerLeave)
      node.removeEventListener('focus', focus)
      node.removeEventListener('blur', leave)
      node.removeEventListener('click', click)
      detail?.removeEventListener('pointerenter', detailEnter)
      detail?.removeEventListener('pointerleave', leave)
    })
  })

  const activityEvents: Array<keyof HTMLElementEventMap> = ['pointermove', 'pointerdown', 'pointerleave', 'wheel', 'touchstart', 'focusin', 'keydown']
  activityEvents.forEach(type => {
    frame.addEventListener(type, markActivity, { passive: type !== 'keydown' })
    cleanups.push(() => frame.removeEventListener(type, markActivity))
  })

  const outsideClick = (event: MouseEvent) => {
    if (frame.contains(event.target as Node)) return
    pinnedNode?.classList.remove('is-pinned')
    pinnedNode = null
    activateNode(null)
  }
  const escape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    pinnedNode?.classList.remove('is-pinned')
    pinnedNode = null
    activateNode(null)
  }
  document.addEventListener('click', outsideClick)
  document.addEventListener('keydown', escape)
  cleanups.push(() => document.removeEventListener('click', outsideClick))
  cleanups.push(() => document.removeEventListener('keydown', escape))

  const resizeObserver = new ResizeObserver(entries => {
    const entry = entries[0]
    if (!entry) return
    viewport.width = entry.contentRect.width
    viewport.height = entry.contentRect.height
    if (visible && desktop && !reduced && scene !== 'static') {
      const phase = currentPhase()
      const progress = Math.max(...phase.tracks.map(track => {
        const state = trackStates[track]
        return state ? state.distance / geometry[track].totalLength : scene === 'explore' ? 1 : 0
      }))
      const target = cameraTargets(progress)
      camera.centerX.value = target.centerX
      camera.scale.value = target.scale
      applyCamera()
    }
  })
  resizeObserver.observe(frame)
  cleanups.push(() => resizeObserver.disconnect())

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    const nextVisible = Boolean(entry?.isIntersecting && entry.intersectionRatio > 0.14)
    if (nextVisible === visible) return
    visible = nextVisible
    if (visible) restartMovie()
    else {
      stopLoop()
      explorationTimer?.()
      explorationTimer = null
      resumeTimer?.()
      resumeTimer = null
      clearPulses()
    }
  }, { threshold: [0, 0.14, 0.3] })
  intersectionObserver.observe(frame)
  cleanups.push(() => intersectionObserver.disconnect())

  const viewportMode = () => {
    const nextDesktop = window.innerWidth > 800
    if (nextDesktop === desktop) return
    desktop = nextDesktop
    if (visible) restartMovie()
  }
  window.addEventListener('resize', viewportMode, { passive: true })
  cleanups.push(() => window.removeEventListener('resize', viewportMode))

  const reducedChange = (event: MediaQueryListEvent) => {
    reduced = event.matches
    if (visible) restartMovie()
  }
  reducedQuery.addEventListener('change', reducedChange)
  cleanups.push(() => reducedQuery.removeEventListener('change', reducedChange))

  const documentVisibility = () => {
    if (document.visibilityState === 'hidden') {
      stopLoop()
      explorationTimer?.()
      explorationTimer = null
      return
    }
    if (!visible) return
    if (scene === 'explore') scheduleExplorationAdvance()
    else startLoop()
  }
  document.addEventListener('visibilitychange', documentVisibility)
  cleanups.push(() => document.removeEventListener('visibilitychange', documentVisibility))

  if (reduced || !desktop) showStatic()

  return () => {
    destroyed = true
    stopLoop()
    closeTimer?.()
    hoverIntentTimer?.()
    resumeTimer?.()
    explorationTimer?.()
    clearPulses()
    cleanups.forEach(cleanup => cleanup())
  }
}
