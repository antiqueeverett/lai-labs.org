import { useEffect, useRef } from 'react'
import { subscribeFrame } from '../kinematics/scheduler'
import { useReducedMotion } from '../kinematics/react'

type Point = { x: number; y: number }
type CountryDefinition = { classes: string; d: string }
type RouteGeometry = {
  d: string
  start: Point
  end: Point
  length: number
  samples: Array<Point & { distance: number }>
}
type JourneyRoutes = Record<'blueSouth' | 'blueEurope' | 'redSouth' | 'redEurope', RouteGeometry>
type Camera = Point & { zoom: number }
type Surface = {
  cssWidth: number
  cssHeight: number
  pixelRatio: number
  fit: number
  insetX: number
  insetY: number
}

type AboutJourneyCanvasProps = {
  countries: CountryDefinition[]
  routeGeometry: JourneyRoutes
}

const CAMERA_KEYS = [
  {t:0,x:879.55,y:742.90,zoom:3.7389},{t:1200,x:878.20,y:745.20,zoom:3.7420},
  {t:2800,x:874.10,y:751.90,zoom:3.7350},{t:3900,x:866.50,y:757.20,zoom:3.6000},
  {t:5000,x:842.00,y:733.00,zoom:3.0500},{t:6200,x:826.00,y:660.00,zoom:2.4300},
  {t:7550,x:819.20,y:545.00,zoom:2.0200},{t:8750,x:812.50,y:335.00,zoom:2.4200},
  {t:9800,x:806.80,y:215.00,zoom:3.5000},{t:10850,x:801.50,y:185.00,zoom:4.3000},
  {t:11650,x:796.75,y:177.40,zoom:4.7200},{t:12200,x:796.38,y:176.99,zoom:4.7500},
  {t:12700,x:804.00,y:250.00,zoom:3.5200},{t:13250,x:828.00,y:465.00,zoom:2.3200},
  {t:13700,x:879.55,y:742.90,zoom:3.7389},{t:14000,x:879.55,y:742.90,zoom:3.7389},
].map(key => ({ ...key, logZoom: Math.log(key.zoom) }))

const DURATION = 14000
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const smootherstep = (value: number) => { const t = clamp01(value); return t * t * t * (t * (t * 6 - 15) + 10) }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const overlayOpacity = (elapsed: number) => elapsed < 360
  ? smootherstep(elapsed / 360)
  : elapsed < 11600
    ? 1
    : elapsed < 12400
      ? 1 - smootherstep((elapsed - 11600) / 800)
      : 0

function buildMonotoneSpline(field: 'x' | 'y' | 'logZoom') {
  const count = CAMERA_KEYS.length
  const x = CAMERA_KEYS.map(key => key.t / 1000)
  const y = CAMERA_KEYS.map(key => key[field])
  const intervals = x.slice(1).map((value, index) => value - x[index])
  const secants = intervals.map((interval, index) => (y[index + 1] - y[index]) / interval)
  const slopes = new Array<number>(count).fill(0)
  const endpointSlope = (h0: number, h1: number, delta0: number, delta1: number) => {
    let slope = ((2 * h0 + h1) * delta0 - h0 * delta1) / (h0 + h1)
    if (Math.sign(slope) !== Math.sign(delta0)) slope = 0
    else if (Math.sign(delta0) !== Math.sign(delta1) && Math.abs(slope) > Math.abs(3 * delta0)) slope = 3 * delta0
    return slope
  }
  slopes[0] = endpointSlope(intervals[0], intervals[1], secants[0], secants[1])
  slopes[count - 1] = endpointSlope(
    intervals[count - 2],
    intervals[count - 3],
    secants[count - 2],
    secants[count - 3],
  )
  for (let index = 1; index < count - 1; index += 1) {
    const previous = secants[index - 1]
    const next = secants[index]
    if (previous === 0 || next === 0 || Math.sign(previous) !== Math.sign(next)) continue
    const previousWeight = 2 * intervals[index] + intervals[index - 1]
    const nextWeight = intervals[index] + 2 * intervals[index - 1]
    slopes[index] = (previousWeight + nextWeight) / (previousWeight / previous + nextWeight / next)
  }
  return { x, y, slopes }
}

const CAMERA_SPLINES = {
  x: buildMonotoneSpline('x'),
  y: buildMonotoneSpline('y'),
  logZoom: buildMonotoneSpline('logZoom'),
}

function sampleSpline(spline: ReturnType<typeof buildMonotoneSpline>, timeMs: number) {
  const time = clamp01(timeMs / DURATION) * (DURATION / 1000)
  let index = spline.x.length - 2
  for (let candidate = 0; candidate < spline.x.length - 1; candidate += 1) {
    if (time <= spline.x[candidate + 1]) { index = candidate; break }
  }
  const h = spline.x[index + 1] - spline.x[index]
  const progress = (time - spline.x[index]) / h
  const progress2 = progress * progress
  const progress3 = progress2 * progress
  return (2 * progress3 - 3 * progress2 + 1) * spline.y[index]
    + (progress3 - 2 * progress2 + progress) * h * spline.slopes[index]
    + (-2 * progress3 + 3 * progress2) * spline.y[index + 1]
    + (progress3 - progress2) * h * spline.slopes[index + 1]
}

const cameraAt = (timeMs: number): Camera => ({
  x: sampleSpline(CAMERA_SPLINES.x, timeMs),
  y: sampleSpline(CAMERA_SPLINES.y, timeMs),
  zoom: Math.exp(sampleSpline(CAMERA_SPLINES.logZoom, timeMs)),
})

const COUNTRY_PAINT = {
  '': { fill: 'rgba(214,230,246,.12)', stroke: 'rgba(230,241,255,.24)', width: 1.05, opacity: 1 },
  'touched-blue': { fill: 'rgba(116,203,255,.14)', stroke: 'rgba(203,239,255,.72)', width: 1.52, opacity: .98 },
  'touched-red': { fill: 'rgba(255,124,156,.12)', stroke: 'rgba(255,220,228,.70)', width: 1.52, opacity: .98 },
  'touched-both': { fill: 'rgba(255,231,170,.15)', stroke: 'rgba(255,241,205,.78)', width: 1.6, opacity: .98 },
  'live-blue': { fill: 'rgba(116,203,255,.22)', stroke: 'rgba(222,245,255,.95)', width: 1.96, opacity: 1 },
  'live-red': { fill: 'rgba(255,124,156,.18)', stroke: 'rgba(255,226,232,.92)', width: 1.96, opacity: 1 },
  'live-both': { fill: 'rgba(255,231,170,.22)', stroke: 'rgba(255,244,212,.96)', width: 2.05, opacity: 1 },
} as const

export function AboutJourneyCanvas({ countries: countryDefinitions, routeGeometry }: AboutJourneyCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const rootNode = rootRef.current
    const canvasNode = canvasRef.current
    if (!rootNode || !canvasNode) return
    const contextNode = canvasNode.getContext('2d')
    if (!contextNode) return
    const root: HTMLDivElement = rootNode
    const canvas: HTMLCanvasElement = canvasNode
    const context: CanvasRenderingContext2D = contextNode
    const rootStyles = getComputedStyle(root)
    const cssColor = (property: string, fallback: string) => rootStyles.getPropertyValue(property).trim() || fallback
    const colors = {
      mapFill: cssColor('--about-map-fill', 'rgba(214,230,246,.12)'),
      mapStroke: cssColor('--about-map-stroke', 'rgba(230,241,255,.24)'),
      routeBlue: cssColor('--about-route-blue', '#67c1ff'),
      routeRed: cssColor('--about-route-red', '#ff6d90'),
      routeGold: cssColor('--about-route-gold', '#ffe39d'),
    }

    const countries = countryDefinitions.map(({ classes, d }) => ({ classes, path: new Path2D(d) }))
    const engagedCountries = {
      zimbabwe: countries.find(({ classes }) => classes.includes('country-zimbabwe')),
      southAfrica: countries.find(({ classes }) => classes.includes('country-south-africa')),
      germany: countries.find(({ classes }) => classes.includes('country-germany')),
      sweden: countries.find(({ classes }) => classes.includes('country-sweden')),
    }
    if (Object.values(engagedCountries).some(country => !country)) return

    const rasterScale = 2
    const countryRaster = document.createElement('canvas')
    countryRaster.width = 1600 * rasterScale
    countryRaster.height = 900 * rasterScale
    const rasterContext = countryRaster.getContext('2d')
    if (!rasterContext) return
    rasterContext.scale(rasterScale, rasterScale)
    rasterContext.fillStyle = colors.mapFill
    rasterContext.strokeStyle = colors.mapStroke
    rasterContext.lineWidth = .95
    countries.forEach(({ classes, path }) => {
      if (classes.includes('country-engaged')) return
      rasterContext.fill(path)
      rasterContext.stroke(path)
    })

    const routes = Object.fromEntries(Object.entries(routeGeometry).map(([key, route]) => [key, { ...route, path: new Path2D(route.d) }])) as {
      [Key in keyof JourneyRoutes]: JourneyRoutes[Key] & { path: Path2D }
    }
    type Route = typeof routes[keyof typeof routes]
    let surface: Surface = { cssWidth: 0, cssHeight: 0, pixelRatio: 1, fit: 0, insetX: 0, insetY: 0 }
    let lastElapsed = 0

    const resizeSurface = () => {
      const cssWidth = root.clientWidth
      const cssHeight = root.clientHeight
      if (!cssWidth || !cssHeight) return false
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      const outputWidth = Math.max(1, Math.round(cssWidth * pixelRatio))
      const outputHeight = Math.max(1, Math.round(cssHeight * pixelRatio))
      if (canvas.width !== outputWidth) canvas.width = outputWidth
      if (canvas.height !== outputHeight) canvas.height = outputHeight
      const fit = Math.min(cssWidth / 1600, cssHeight / 900)
      surface = {
        cssWidth,
        cssHeight,
        pixelRatio,
        fit,
        insetX: (cssWidth - 1600 * fit) / 2,
        insetY: (cssHeight - 900 * fit) / 2,
      }
      return true
    }
    if (!resizeSurface()) return

    function routePoint(route: Route, distance: number) {
      const bounded = Math.max(0, Math.min(route.length, distance))
      const sampleCount = route.samples.length - 1
      if (bounded <= 0) return route.samples[0]
      if (bounded >= route.length) return route.samples[sampleCount]
      const scaled = (bounded / route.length) * sampleCount
      const index = Math.floor(scaled)
      const fraction = scaled - index
      const a = route.samples[index]
      const b = route.samples[index + 1]
      return { x: lerp(a.x, b.x, fraction), y: lerp(a.y, b.y, fraction) }
    }

    const travelScale = (t: number) => 1 + Math.sin(Math.PI * clamp01(t)) * .042
    const landingScale = (t: number) => { const value = clamp01(t); return 1 + Math.sin(value * Math.PI * 2.05) * (1 - value) * .075 }
    const idleScale = (t: number, offset: number) => 1.012 + Math.sin((t + offset) * Math.PI * 2) * .014

    function routeState(elapsed: number) {
      let blueSegment = routes.blueSouth; let redSegment = routes.redSouth
      let blueDistance = 0; let redDistance = 0; let blueScale = .96; let redScale = .96
      let blueSouthReveal = 0; let blueEuropeReveal = 0; let redSouthReveal = 0; let redEuropeReveal = 0
      if (elapsed < 700) {
        const t = elapsed / 700; blueScale = lerp(.91, 1, smootherstep(t)); redScale = lerp(.91, 1, smootherstep(t))
      } else if (elapsed < 3600) {
        const t = (elapsed - 700) / 2900; const progress = smootherstep(t)
        blueDistance = routes.blueSouth.length * progress; redDistance = routes.redSouth.length * progress
        blueSouthReveal = blueDistance; redSouthReveal = redDistance; blueScale = travelScale(t); redScale = travelScale(t)
      } else if (elapsed < 4500) {
        const t = (elapsed - 3600) / 900; blueDistance = routes.blueSouth.length; redDistance = routes.redSouth.length
        blueSouthReveal = routes.blueSouth.length; redSouthReveal = routes.redSouth.length
        blueScale = landingScale(t); redScale = landingScale(Math.min(1, t + .035))
      } else if (elapsed < 5900) {
        blueDistance = routes.blueSouth.length; redDistance = routes.redSouth.length
        blueSouthReveal = routes.blueSouth.length; redSouthReveal = routes.redSouth.length
      } else if (elapsed < 9700) {
        const t = (elapsed - 5900) / 3800; const progress = smootherstep(t)
        blueSegment = routes.blueEurope; redSegment = routes.redEurope
        blueDistance = routes.blueEurope.length * progress; redDistance = routes.redEurope.length * progress
        blueSouthReveal = routes.blueSouth.length; redSouthReveal = routes.redSouth.length
        blueEuropeReveal = blueDistance; redEuropeReveal = redDistance; blueScale = travelScale(t); redScale = travelScale(t)
      } else if (elapsed < 10800) {
        const t = (elapsed - 9700) / 1100; blueSegment = routes.blueEurope; redSegment = routes.redEurope
        blueDistance = routes.blueEurope.length; redDistance = routes.redEurope.length
        blueSouthReveal = routes.blueSouth.length; redSouthReveal = routes.redSouth.length
        blueEuropeReveal = routes.blueEurope.length; redEuropeReveal = routes.redEurope.length
        blueScale = landingScale(t); redScale = landingScale(t)
      } else {
        const t = (elapsed - 10800) / (DURATION - 10800); blueSegment = routes.blueEurope; redSegment = routes.redEurope
        blueDistance = routes.blueEurope.length; redDistance = routes.redEurope.length
        blueSouthReveal = routes.blueSouth.length; redSouthReveal = routes.redSouth.length
        blueEuropeReveal = routes.blueEurope.length; redEuropeReveal = routes.redEurope.length
        blueScale = idleScale(t, 0); redScale = idleScale(t, .32)
      }
      return { blueSegment, redSegment, blueDistance, redDistance, blueScale, redScale, blueSouthReveal, blueEuropeReveal, redSouthReveal, redEuropeReveal }
    }

    const worldTransform = (camera: Camera) => {
      const tx = 800 - camera.x * camera.zoom
      const ty = 450 - camera.y * camera.zoom
      context.setTransform(
        surface.pixelRatio * surface.fit * camera.zoom,
        0,
        0,
        surface.pixelRatio * surface.fit * camera.zoom,
        surface.pixelRatio * (surface.insetX + surface.fit * tx),
        surface.pixelRatio * (surface.insetY + surface.fit * ty),
      )
    }
    const worldToCss = (point: Point, camera: Camera) => ({
      x: surface.insetX + surface.fit * (800 + (point.x - camera.x) * camera.zoom),
      y: surface.insetY + surface.fit * (450 + (point.y - camera.y) * camera.zoom),
    })

    function countryStates(elapsed: number) {
      const southProgress = elapsed <= 700 ? 0 : elapsed >= 3600 ? 1 : (elapsed - 700) / 2900
      const europeProgress = elapsed <= 5900 ? 0 : elapsed >= 9700 ? 1 : (elapsed - 5900) / 3800
      const resetting = elapsed >= 11600
      return {
        zimbabwe: !resetting && elapsed >= 380 ? (southProgress < .34 ? 'live-both' : 'touched-both') : '',
        southAfrica: !resetting && southProgress >= .78 ? (elapsed < 6400 ? 'live-both' : 'touched-both') : '',
        germany: !resetting && europeProgress >= .985 ? 'live-blue' : '',
        sweden: !resetting && europeProgress >= .985 ? 'live-red' : '',
      } as const
    }

    function drawEngagedCountries(camera: Camera, elapsed: number, staticMode: boolean) {
      const states = staticMode ? { zimbabwe: '', southAfrica: '', germany: '', sweden: '' } as const : countryStates(elapsed)
      const glow = .94 + ((Math.sin((elapsed / 1850) * Math.PI * 2) + 1) / 2) * .06
      Object.entries(engagedCountries).forEach(([key, country]) => {
        if (!country) return
        const state = states[key as keyof typeof states]
        const paint = COUNTRY_PAINT[state]
        context.globalAlpha = state.startsWith('live-') ? glow : paint.opacity
        context.fillStyle = state ? paint.fill : colors.mapFill
        context.strokeStyle = state ? paint.stroke : colors.mapStroke
        context.lineWidth = paint.width / (surface.fit * camera.zoom)
        context.fill(country.path)
        context.stroke(country.path)
      })
      context.globalAlpha = 1
    }

    function routeGradient(route: Route, color: 'blue' | 'red') {
      const gradient = context.createLinearGradient(route.start.x, route.start.y, route.end.x, route.end.y)
      if (color === 'blue') {
        gradient.addColorStop(0, 'rgba(103,193,255,.08)'); gradient.addColorStop(.58, colors.routeBlue); gradient.addColorStop(1, '#def4ff')
      } else {
        gradient.addColorStop(0, 'rgba(255,109,144,.08)'); gradient.addColorStop(.58, colors.routeRed); gradient.addColorStop(1, '#ffe6ed')
      }
      return gradient
    }
    function drawRoute(route: Route, reveal: number, camera: Camera, color: 'blue' | 'red', memory: boolean, opacity: number) {
      const bounded = Math.max(0, Math.min(route.length, reveal))
      if (bounded <= 0) return
      context.setLineDash([bounded, route.length + 1])
      context.lineDashOffset = 0
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.lineWidth = (memory ? 2.05 : 3.1) / (surface.fit * camera.zoom)
      context.globalAlpha = (memory ? .22 : 1) * opacity
      context.strokeStyle = memory
        ? color === 'blue' ? 'rgba(103,193,255,.30)' : 'rgba(255,109,144,.30)'
        : routeGradient(route, color)
      context.stroke(route.path)
      context.setLineDash([])
      context.globalAlpha = 1
    }

    function drawCircle(x: number, y: number, radius: number, fill: string | null, stroke: string | null, width = 1) {
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      if (fill) { context.fillStyle = fill; context.fill() }
      if (stroke) { context.strokeStyle = stroke; context.lineWidth = width; context.stroke() }
    }
    function drawMarker(point: Point, camera: Camera, origin: boolean, radius: number, rippleProgress: number | null) {
      const position = worldToCss(point, camera)
      drawCircle(position.x, position.y, radius * surface.fit, null, origin ? 'rgba(255,255,255,.31)' : 'rgba(255,255,255,.20)', 1.7)
      drawCircle(position.x, position.y, (origin ? 3.3 : 3.7) * surface.fit, 'rgba(255,255,255,.96)', null)
      if (rippleProgress !== null) {
        context.globalAlpha = .9 * (1 - rippleProgress)
        drawCircle(position.x, position.y, 15 * (.25 + rippleProgress * 2.6) * surface.fit, null, colors.routeGold, 2.1)
        context.globalAlpha = 1
      }
    }
    function drawBubble(point: Point, camera: Camera, scale: number, color: string, opacity: number) {
      const position = worldToCss(point, camera)
      const size = surface.fit * scale
      context.save()
      context.globalCompositeOperation = 'screen'
      context.globalAlpha = .15 * opacity; drawCircle(position.x, position.y, 21 * size, color, null)
      context.globalAlpha = .38 * opacity; drawCircle(position.x, position.y, 12.5 * size, color, null)
      context.globalAlpha = .98 * opacity; drawCircle(position.x, position.y, 7.4 * size, color, null)
      context.globalAlpha = .92 * opacity; drawCircle(position.x - 2.3 * size, position.y - 2.7 * size, 2.15 * size, 'rgba(255,255,255,.96)', null)
      context.restore()
    }

    function renderFrame(elapsed: number, staticMode = false) {
      lastElapsed = elapsed
      const camera = staticMode ? { x: 807.30331, y: 221.94089, zoom: 3.39175 } : cameraAt(elapsed)
      const route = staticMode ? {
        blueSegment: routes.blueEurope, redSegment: routes.redEurope,
        blueDistance: routes.blueEurope.length, redDistance: routes.redEurope.length,
        blueScale: 1, redScale: 1,
        blueSouthReveal: routes.blueSouth.length, blueEuropeReveal: routes.blueEurope.length,
        redSouthReveal: routes.redSouth.length, redEuropeReveal: routes.redEurope.length,
      } : routeState(elapsed)
      const bluePosition = routePoint(route.blueSegment, route.blueDistance)
      const redPosition = routePoint(route.redSegment, route.redDistance)
      const overlayAlpha = staticMode ? 1 : overlayOpacity(elapsed)

      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      worldTransform(camera)
      context.drawImage(countryRaster, 0, 0, countryRaster.width, countryRaster.height, 0, 0, 1600, 900)
      drawEngagedCountries(camera, elapsed, staticMode)
      drawRoute(routes.blueSouth, route.blueSouthReveal, camera, 'blue', true, overlayAlpha)
      drawRoute(routes.blueEurope, route.blueEuropeReveal, camera, 'blue', true, overlayAlpha)
      drawRoute(routes.redSouth, route.redSouthReveal, camera, 'red', true, overlayAlpha)
      drawRoute(routes.redEurope, route.redEuropeReveal, camera, 'red', true, overlayAlpha)
      drawRoute(routes.blueSouth, route.blueSouthReveal, camera, 'blue', false, overlayAlpha)
      drawRoute(routes.blueEurope, route.blueEuropeReveal, camera, 'blue', false, overlayAlpha)
      drawRoute(routes.redSouth, route.redSouthReveal, camera, 'red', false, overlayAlpha)
      drawRoute(routes.redEurope, route.redEuropeReveal, camera, 'red', false, overlayAlpha)

      context.setTransform(surface.pixelRatio, 0, 0, surface.pixelRatio, 0, 0)
      const ripple = (start: number) => elapsed >= start && elapsed <= start + 820 ? clamp01((elapsed - start) / 820) : null
      drawMarker({ x: 898.21, y: 711.44 }, camera, true, 12, null)
      drawMarker({ x: 916.08, y: 694.66 }, camera, true, 12, null)
      drawMarker({ x: 824.73, y: 811.10 }, camera, false, 13, staticMode ? null : ripple(3600))
      drawMarker({ x: 788.46, y: 185.88 }, camera, false, 13, staticMode ? null : ripple(9700))
      drawMarker({ x: 822.2, y: 136.63 }, camera, false, 13, staticMode ? null : ripple(9700))
      drawBubble(bluePosition, camera, route.blueScale, colors.routeBlue, overlayAlpha)
      drawBubble(redPosition, camera, route.redScale, colors.routeRed, overlayAlpha)
    }

    let startTime = performance.now()
    let unsubscribeFrame: (() => void) | null = null
    const startAnimation = () => {
      if (unsubscribeFrame) return
      startTime = performance.now()
      unsubscribeFrame = subscribeFrame(({ now }) => renderFrame((now - startTime) % DURATION), {
        phase: 'write',
        label: 'about-journey-map',
      })
    }
    const stopAnimation = () => {
      unsubscribeFrame?.()
      unsubscribeFrame = null
      renderFrame(0)
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!resizeSurface()) return
      // An active subscriber will present the resized surface in the canonical
      // write phase. Only an idle/static scene needs an immediate one-shot draw.
      if (!unsubscribeFrame) renderFrame(lastElapsed, reduced)
    })
    resizeObserver.observe(root)
    if (reduced) {
      renderFrame(0, true)
      return () => resizeObserver.disconnect()
    }
    renderFrame(0)

    let observer: IntersectionObserver | null = null
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= .05) startAnimation()
        else stopAnimation()
      }, { threshold: [0, .05] })
      observer.observe(root)
    } else startAnimation()

    return () => {
      observer?.disconnect()
      unsubscribeFrame?.()
      resizeObserver.disconnect()
    }
  }, [countryDefinitions, reduced, routeGeometry])

  return (
    <div ref={rootRef} className="about-journey-scene">
      <canvas
        ref={canvasRef}
        className="about-journey-canvas"
        role="img"
        aria-label={`${reduced ? '' : 'Animated '}founders journey on a continuous Africa-Europe map`}
      >
        Founders journey from Zimbabwe through South Africa to Germany and Sweden.
      </canvas>
    </div>
  )
}
