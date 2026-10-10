import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAnimationFrame, useReducedMotion, useViewportActive } from '../kinematics/react'
import { Icon } from './Icon'
import { Cover } from './Cover'
import { HeroBrandRelay } from './HeroBrandRelay'
import { NeuralField } from './NeuralField'
import { Reveal } from './Motion'

export function Hero() {
  const reduce = useReducedMotion()
  const heroRef = useRef<HTMLElement>(null)
  const scanRef = useRef<HTMLDivElement>(null)
  const viewportActive = useViewportActive(heroRef)
  const animateDecor = viewportActive && !reduce

  useAnimationFrame((time) => {
    const scan = scanRef.current
    if (!scan) return
    const progress = time < 1200 ? 0 : ((time - 1200) % 7000) / 7000
    scan.style.transform = `translate3d(0,${(progress * (130 / 22) * 100).toFixed(3)}%,0)`
  }, animateDecor, { phase: 'write', label: 'hero-scan' })

  return (
    <section className="hero" id="top" ref={heroRef}>
      <Cover
        src="/img/sat-falsecolor.jpg"
        tint="side"
        overlay={false}
        position="center"
        loading="eager"
        fetchPriority="high"
      />
      <NeuralField className="hero-neural" active={animateDecor} />
      
      {animateDecor && (
        <div
          ref={scanRef}
          className="hero-scan"
          aria-hidden="true"
        />
      )}

      <div className="container hero-inner">
        <Reveal className="hero-copy">
          <HeroBrandRelay
            line1="From problem definition to controlled production"
            line2="Performance and limits evaluated in context."
            relay
          />
          <p className="lead">
            Controls, release criteria and ownership are built into the route to production.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/solutions">
              Services <Icon name="arrowUpRight" size={18} className="btn-arrow" />
            </Link>
          </div>
        </Reveal>
      </div>

    </section>
  )
}
