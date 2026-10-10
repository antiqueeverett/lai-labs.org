import { useEffect, useRef, useState } from 'react'
import { PageTransition } from '../components/Motion'
import { PageHero, CtaBand } from '../components/Sections'
import { VerticalTabExplorer } from '../components/VerticalTabExplorer'
import { AboutJourneyMap } from '../components/AboutJourneyMap'
import { features } from '../lib/features'
import { useFocusTrap } from '../lib/useFocusTrap'

const founders = {
  john: {
    name: 'John',
    discipline: 'AI Systems & Engineering',
    education: 'PhD · KTH Royal Institute of Technology',
    image: '/brand/john-shamu.png',
    summary: 'Systems thinking shaped around measurable evidence, failure modes and the conditions under which AI can be trusted in operation.',
    bio: [
      'John is an engineer, researcher, founder and director of Label AI, focused on the measurement and systems discipline required to make AI reliable in operation. His background spans electrical and electronic engineering, instrumentation, industrial process monitoring, Industry 4.0, and applied AI—fields in which performance has to be measured against reality rather than demonstrated in isolation. That repertoire gives him a practical instinct for signal, evidence, failure, and the conditions under which a system can be trusted.',
      'For John, operational AI is an engineering problem before it is a model problem. He asks what information is reliable, how uncertainty propagates, how performance is validated, where human judgment must remain in control, and what happens when the system is wrong. Africa and Europe are both home, reinforcing a view that robust technology must survive different operating conditions without lowering the technical standard.',
      'At Label AI, John brings that systems perspective to consequential institutional and enterprise workflows. A multi-hazard early-warning collaboration is one early test of that approach. His aim is to help build AI systems whose reliability can be demonstrated rather than asserted: systems designed around evidence, measurable performance, human accountability, and the realities in which they must operate.',
    ],
  },
  everett: {
    name: 'Everett',
    discipline: 'Applied AI & Machine Learning',
    education: 'PhD · Bauhaus-Universität Weimar',
    image: '/brand/everett-mthunzi.png',
    summary: 'Applied AI focused on the information-to-decision layer: systems people can examine, use and act on in consequential work.',
    bio: [
      'Everett is a machine learning engineer, founder and director of Label AI, working at the point where advanced AI has to become useful in real decisions. His focus is the information-to-decision layer: turning ambiguous institutional and enterprise problems into systems that can retrieve, structure, interpret, and process information in ways people can examine and act on. For Everett, the question is not simply what a model can do, but what the whole system must do for its output to deserve a place in real work.',
      'Africa and Europe are both home, and that experience shapes how he builds. Different institutions, infrastructure, data environments, and ways of working make him wary of one-size-fits-all technology. The standard should not change with geography; the system should. That means starting with the problem, respecting domain expertise, making uncertainty visible, and using AI only where it creates a demonstrable advantage.',
      'At Label AI, Everett is applying that discipline to consequential workflows. A multi-hazard early-warning collaboration is one early proving ground: a setting where fragmented information, timeliness, uncertainty, and human accountability all matter. His ambition is to build Label AI into a company known for turning powerful AI into evidence-grounded operational capability—and for knowing when not to automate at all.',
    ],
  },
} as const

type FounderKey = keyof typeof founders

/* Peer standards, not a sequence: the rail carries no order, numbering or
   step language, and each panel states only the governing rule. */
const principles = [
  {
    key: 'accountability',
    label: 'Accountability',
    statement: 'Responsibility is explicit.',
    explanation: 'Decision authority, delivery responsibility and escalation paths are defined from the start.',
  },
  {
    key: 'evidence',
    label: 'Evidence',
    statement: 'Readiness requires evidence.',
    explanation: 'Success criteria and baselines are set before evaluation; representative testing documents performance, operating limits and observed failure modes before release.',
  },
  {
    key: 'production',
    label: 'Operational Control',
    statement: 'Production remains observable and controlled.',
    explanation: 'Monitoring, security controls and rollback or recovery paths are defined before deployment.',
  },
  {
    key: 'transfer',
    label: 'Operational Independence',
    statement: 'Independence is designed in.',
    explanation: 'Documentation, maintenance responsibilities, operating knowledge and handover are part of delivery so ongoing operation can continue without Label AI.',
  },
] as const

const principleExplorerItems = principles.map((item) => ({ id: item.key, label: item.label }))

export function About() {
  const [activeFounder, setActiveFounder] = useState<FounderKey | null>(null)
  const [missionPage, setMissionPage] = useState<'mission' | 'vision'>('mission')
  const [activePrinciple, setActivePrinciple] = useState(0)
  const bioRef = useFocusTrap(Boolean(activeFounder))
  const bioNameRef = useRef<HTMLHeadingElement>(null)
  /* A click is only a backdrop dismissal when the press *and* the release both
     landed on the backdrop itself. Selecting or dragging text inside the panel
     and releasing over the backdrop still fires `click` on the overlay, so the
     target check alone would close the dialog mid-selection. */
  const backdropPressed = useRef(false)

  useEffect(() => {
    if (!activeFounder) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setActiveFounder(null)
    }
    document.body.classList.add('about-bio-open')
    document.addEventListener('keydown', onKeyDown)
    // Move focus into the dialog so the trap applies; useFocusTrap restores it on close.
    bioNameRef.current?.focus()
    return () => {
      document.body.classList.remove('about-bio-open')
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [activeFounder])

  const principle = principles[activePrinciple]
  const founder = activeFounder ? founders[activeFounder] : null

  return (
    <PageTransition>
      <PageHero
        title="People before abstractions"
        highlight="One technical standard across different contexts"
        sub="Africa and Europe shape how we challenge assumptions before deployment in real operating environments."
        brandRelay
        cover="/img/sat-aerial.jpg"
      />

      <div className="about-ledger">
        <section className="about-mission-vision-section">
          <div className="container">
            <div className="about-mission-vision" data-page={missionPage}>
              <div className="about-mission-vision-viewport">
                <div className="about-mission-vision-track">
                  <section className="about-mission-vision-slide">
                    <h2>Mission</h2>
                    <p>To build AI systems that address defined operational needs and transfer the technical capability required to operate and maintain them.</p>
                  </section>
                  <section className="about-mission-vision-slide">
                    <h2>Vision</h2>
                    <p>A future where organisations have the capability and control to govern and advance the AI systems they use.</p>
                  </section>
                </div>
                <button className="about-mission-vision-edge left" type="button" aria-label="Show Mission" disabled={missionPage === 'mission'} onClick={() => setMissionPage('mission')}>Mission</button>
                <button className="about-mission-vision-edge right" type="button" aria-label="Show Vision" disabled={missionPage === 'vision'} onClick={() => setMissionPage('vision')}>Vision</button>
              </div>
            </div>
          </div>
        </section>

        <section className="about-operating-principles-section">
          <div className="container">
            <div className="about-section-head">
              <h2>Operating principles</h2>
              <p>The standards that govern how work is carried out.</p>
            </div>
            <VerticalTabExplorer
              id="about-operating-principles"
              items={principleExplorerItems}
              activeIndex={activePrinciple}
              onChange={setActivePrinciple}
              ariaLabel="Operating principles"
              orientation="horizontal"
              className="about-principles-explorer"
              panelClassName="about-principles-panel"
              panel={
                <div key={principle.key} className="about-principles-content">
                  <h3>{principle.statement}</h3>
                  <p>{principle.explanation}</p>
                </div>
              }
            />
          </div>
        </section>

        <section className="about-perspective-section">
          <div className="container">
            <div className="about-perspective-head">
              <h2>Global Context</h2>
              <p>Different operating conditions shape technical decisions.</p>
            </div>
            <div className="about-perspective-pair">
              <div className="about-perspective-context">
                <p>Data, infrastructure, workflows, governance and consequences vary across operating environments. Those differences shape architecture, evaluation and deployment decisions; the standard for evidence, reliability and accountability remains constant.</p>
              </div>
              <div className="about-perspective-map">
                <AboutJourneyMap />
              </div>
            </div>
          </div>
        </section>

        {/* Leadership is one build-time opt-in disclosure unit: when profiles are
            disabled the heading, profile markup and section spacing are omitted
            together rather than leaving a hidden or placeholder region. */}
        {features.leadershipProfiles ? (
          <section className="about-leadership-section">
            <div className="container">
              <div className="about-section-head">
                <h2>Leadership</h2>
                <p>Who carries responsibility for those standards.</p>
              </div>
              <div className="about-founder-columns">
                {(Object.entries(founders) as Array<[FounderKey, (typeof founders)[FounderKey]]>).map(([key, item]) => (
                  <article className="about-founder" key={key}>
                    <button className="about-founder-portrait" type="button" aria-label={`Read ${item.name} biography`} aria-haspopup="dialog" onClick={() => setActiveFounder(key)}>
                      <img className="about-founder-photo about-founder-photo-mono" src={item.image} alt={item.name} />
                      <img className="about-founder-photo about-founder-photo-color" src={item.image} alt="" aria-hidden="true" />
                      <span className="about-founder-bio-pill">BIO</span>
                    </button>
                    {/* h3: the names now sit beneath the section's Leadership heading. */}
                    <h3>{item.name}</h3>
                    <div className="about-founder-discipline">{item.discipline}</div>
                    <p>{item.summary}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <CtaBand
          title="Compare notes. See what becomes clearer."
          sub=""
          label="Let’s Talk"
          showExplore={false}
          showContactDetails={false}
          withArrow={false}
        />
      </div>

      {features.leadershipProfiles && founder && (
        <div
          className="about-bio-overlay"
          onPointerDown={(event) => { backdropPressed.current = event.target === event.currentTarget }}
          onClick={(event) => { if (event.target === event.currentTarget && backdropPressed.current) setActiveFounder(null) }}
        >
          <div className="about-bio-panel" ref={bioRef} role="dialog" aria-modal="true" aria-labelledby="about-bio-name">
            <button className="about-bio-close" type="button" aria-label="Close biography" onClick={() => setActiveFounder(null)}>×</button>
            <div className="about-bio-portrait"><img src={founder.image} alt={founder.name} /></div>
            <div className="about-bio-copy">
              <h2 id="about-bio-name" ref={bioNameRef} tabIndex={-1}>{founder.name}</h2>
              <div className="about-bio-discipline">{founder.discipline}</div>
              <div className="about-bio-education">{founder.education}</div>
              <div className="about-bio-text">{founder.bio.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  )
}
