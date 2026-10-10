import { Hero } from '../components/Hero'
import { CinematicOperatingModel } from '../components/CinematicOperatingModel'
import { CtaBand } from '../components/Sections'
import { PageTransition, Reveal } from '../components/Motion'

export function Home() {
  return (
    <PageTransition>
      <Hero />
      <section className="section">
        <div className="container">
          <Reveal>
            <h2 className="home-section-title"><span className="model-word">Label AI</span> is an Applied AI and Systems Engineering company.</h2>
            <p className="home-section-supporting">We design, evaluate and deploy AI systems for real operating environments, from problem framing and technical validation to production integration and operational handover.</p>
          </Reveal>
        </div>
      </section>
      <CinematicOperatingModel />
      <CtaBand
        title="What are we taking on next?"
        sub=""
        label="Let’s Talk"
        showExplore={false}
        showContactDetails={false}
        withArrow={false}
      />
    </PageTransition>
  )
}
