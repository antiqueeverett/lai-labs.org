import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from '../kinematics/react'
import { cubicBezier, staggerNumber, standardEase, tweenNumber } from '../kinematics/timeline'
import { PageTransition, Reveal } from '../components/Motion'
import { PageHero, CtaBand } from '../components/Sections'
import { Icon } from '../components/Icon'
import { VerticalTabExplorer } from '../components/VerticalTabExplorer'
import { solutions } from '../site'

const serviceExplorerItems = solutions.map((item, index) => ({
  id: `service-${index}`,
  label: item.title,
}))

type Service = (typeof solutions)[number]

const tickDrawEase = cubicBezier(0.2, 0.68, 0.2, 1)

/**
 * Accepted Trace & Draw micro-motion. The shared explorer owns the moving
 * active-service tracer; this panel only resolves the selected proposition and
 * draws each verification tick. The evidence rows themselves stay spatially
 * fixed and fully present, so nothing a reader is already reading moves.
 */
function ServicePanel({ service }: { service: Service }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const reduce = Boolean(useReducedMotion())

  useLayoutEffect(() => {
    if (reduce) return
    const root = rootRef.current
    if (!root) return

    const proposition = root.querySelector<HTMLElement>('.service-explorer-proposition')
    const checks = Array.from(root.querySelectorAll<SVGPathElement>('.service-explorer-check path'))
    proposition?.style.setProperty('opacity', '0.55')
    proposition?.style.setProperty('will-change', 'opacity')

    checks.forEach(path => {
      path.style.strokeDasharray = '24'
      path.style.strokeDashoffset = '24'
      path.style.opacity = '0.25'
    })
  }, [reduce, service.title])

  useEffect(() => {
    if (reduce) return
    const root = rootRef.current
    if (!root) return

    const proposition = root.querySelector<HTMLElement>('.service-explorer-proposition')
    const checks = Array.from(root.querySelectorAll<SVGPathElement>('.service-explorer-check path'))

    /* The complete state is written by whichever ends first: the timeline, or
       teardown. A cancelled draw therefore never leaves a tick part-drawn. */
    const settleProposition = () => {
      if (!proposition) return
      proposition.style.opacity = '1'
      proposition.style.removeProperty('will-change')
    }
    const settleCheck = (index: number) => {
      const path = checks[index]
      if (!path) return
      path.style.removeProperty('stroke-dasharray')
      path.style.removeProperty('stroke-dashoffset')
      path.style.removeProperty('opacity')
    }

    const stopProposition = proposition
      ? tweenNumber({
          from: 0,
          to: 1,
          durationMs: 240,
          ease: standardEase,
          label: `services:proposition:${service.title}`,
          write: progress => {
            proposition.style.opacity = (0.55 + 0.45 * progress).toFixed(4)
          },
          complete: settleProposition,
        })
      : () => undefined

    const stopChecks = staggerNumber({
      count: checks.length,
      durationMs: 360,
      initialDelayMs: 0,
      staggerMs: 65,
      ease: tickDrawEase,
      label: `services:tick-draw:${service.title}`,
      write: (index, progress) => {
        const path = checks[index]
        if (!path) return
        path.style.strokeDashoffset = (24 * (1 - progress)).toFixed(3)
        path.style.opacity = (0.25 + 0.75 * progress).toFixed(4)
      },
      complete: settleCheck,
    })

    return () => {
      stopProposition()
      stopChecks()
      settleProposition()
      checks.forEach((_path, index) => settleCheck(index))
    }
  }, [reduce, service.title])

  return (
    <div ref={rootRef} className="service-explorer-panel-content">
      <h3 className="service-explorer-proposition">{service.desc}</h3>
      <ul className="service-explorer-points">
        {service.points.map((point) => (
          <li key={point}>
            <Icon className="service-explorer-check" name="check" size={15} />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Solutions() {
  const [activeService, setActiveService] = useState(0)
  const service = solutions[activeService]

  return (
    <PageTransition>
      <PageHero
        title="Handover begins at design"
        highlight="Independent operation is planned from the start"
        sub="Evidence, ownership, documentation and operating roles are carried from framing through transfer."
        brandRelay
        abstract="cells"
      />

      <section className="section services-capabilities">
        <div className="container">
          <Reveal className="services-intro">
            <h2 className="section-title">Services</h2>
            <p className="section-sub">
              Each service is delivered within the{' '}
              <Link className="services-operating-model-link" to="/#operating-model">
                Operating Model
              </Link>
              ’s parallel delivery and assurance tracks, whether commissioned independently or combined with others.
            </p>
          </Reveal>

          <Reveal className="service-explorer-reveal">
            <VerticalTabExplorer
              id="service-explorer"
              items={serviceExplorerItems}
              activeIndex={activeService}
              onChange={setActiveService}
              ariaLabel="Services"
              orientation="horizontal"
              panelClassName="service-explorer-panel"
              panel={<ServicePanel key={service.title} service={service} />}
            />
          </Reveal>
        </div>
      </section>

      <CtaBand title="Which priority do we act on first?" sub="" label="Let’s Talk" showExplore={false} showContactDetails={false} withArrow={false} />
    </PageTransition>
  )
}
