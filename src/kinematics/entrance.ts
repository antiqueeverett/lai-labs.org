import { easeInOutCubic, staggerNumber, standardEase } from './timeline'

export function staggerSvgDraw(
  paths: SVGPathElement[],
  { durationMs, initialDelayMs, staggerMs, label }: {
    durationMs: number
    initialDelayMs: number
    staggerMs: number
    label: string
  },
) {
  paths.forEach(path => {
    path.setAttribute('pathLength', '1')
    path.style.strokeDasharray = '1'
    path.style.strokeDashoffset = '1'
    path.style.opacity = '0'
  })
  return staggerNumber({
    count: paths.length,
    durationMs,
    initialDelayMs,
    staggerMs,
    ease: easeInOutCubic,
    label,
    write: (index, progress) => {
      paths[index].style.strokeDashoffset = progress >= 1 ? '0' : (1 - progress).toFixed(4)
      paths[index].style.opacity = progress >= 1 ? '1' : progress.toFixed(4)
    },
  })
}

export function staggerSvgScale(
  elements: SVGGraphicsElement[],
  { durationMs, initialDelayMs, staggerMs, label }: {
    durationMs: number
    initialDelayMs: number
    staggerMs: number
    label: string
  },
) {
  elements.forEach(element => {
    element.style.transformBox = 'fill-box'
    element.style.transformOrigin = 'center'
    element.style.transform = 'scale(0)'
    element.style.opacity = '0'
  })
  return staggerNumber({
    count: elements.length,
    durationMs,
    initialDelayMs,
    staggerMs,
    ease: standardEase,
    label,
    write: (index, progress) => {
      elements[index].style.transform = progress >= 1 ? 'scale(1)' : `scale(${progress.toFixed(4)})`
      elements[index].style.opacity = progress >= 1 ? '1' : progress.toFixed(4)
    },
  })
}
