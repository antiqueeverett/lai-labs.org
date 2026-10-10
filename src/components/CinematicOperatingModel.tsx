import { useEffect, useRef } from 'react'
import { mountCinematicDualWave } from '../kinematics/cinematicDualWave'

type Track = 'blue' | 'red'

type NodeDefinition = {
  key: string
  track: Track
  order: number
  label: string
  detail: string
}

const trackLabels: Record<Track, 'Delivery' | 'Assurance'> = {
  blue: 'Delivery',
  red: 'Assurance',
}

const nodes: NodeDefinition[] = [
  {
    key: 'objective',
    track: 'blue',
    order: 0,
    label: 'Objective',
    detail: 'Turn the intended result and success conditions into an explicit basis for design.',
  },
  {
    key: 'requirements',
    track: 'red',
    order: 0,
    label: 'Requirements',
    detail: 'Turn needs, constraints, standards and acceptance conditions into a clear basis for evidence.',
  },
  {
    key: 'design',
    track: 'blue',
    order: 1,
    label: 'Design',
    detail: 'Turn the intervention design into concrete components, interfaces and constraints that can be implemented.',
  },
  {
    key: 'evidence',
    track: 'red',
    order: 1,
    label: 'Evidence',
    detail: 'Use observations, data and results to establish what is true before assessment.',
  },
  {
    key: 'implementation',
    track: 'blue',
    order: 2,
    label: 'Implementation',
    detail: 'Build the representative end-to-end implementation under declared constraints and record what the evidence establishes.',
  },
  {
    key: 'assessment',
    track: 'red',
    order: 2,
    label: 'Assessment',
    detail: 'Compare evidence with requirements and objectives to decide what must change before readiness.',
  },
  {
    key: 'operation',
    track: 'blue',
    order: 3,
    label: 'Operation',
    detail: 'Define the runtime, integration, monitoring and operating conditions required beyond the feasibility environment.',
  },
  {
    key: 'readiness',
    track: 'red',
    order: 3,
    label: 'Readiness',
    detail: 'Test evidence, acceptance, security, deployment and rollback requirements against the production-readiness gap.',
  },
  {
    key: 'outcome',
    track: 'blue',
    order: 4,
    label: 'Outcome',
    detail: 'Conclude whether feasibility is established, conditional or not advisable within the tested operating envelope.',
  },
  {
    key: 'ownership',
    track: 'red',
    order: 4,
    label: 'Ownership',
    detail: 'Transfer the agreed artefacts, documentation, limitations and capability so the client can choose how to continue.',
  },
]

/**
 * Homepage Operating Model.
 *
 * UI contract:
 * - Delivery / blue: Objective → Design → Implementation → Operation → Outcome.
 * - Assurance / coral: Requirements → Evidence → Assessment → Readiness → Ownership.
 * - The movie starts from an empty viewing window; curves are authored into
 *   existence while the camera pulls back and drifts left.
 * - Labels appear only when the physical extrema impulse reaches its first
 *   expansion turning point. There are no permanent node dots.
 * - Chapters loop both → blue → red → both.
 * - Hover intent requires 100 ms of continuous dwell inside a revealed label's
 *   hit area, which extends slightly beyond the visible label so a moving node
 *   needs no pixel-perfect alignment. A pointer that leaves within that window
 *   is inert. Focus/click activate immediately and freeze the exact movie state.
 * - Active disclosure highlights only that node's local stage segment. Leaving
 *   grants the existing one second handoff window before motion resumes.
 * - A completed chapter remains available until twelve continuous seconds of
 *   inactivity. Interaction suspends/restarts that reading window.
 * - There is deliberately no user-facing play/pause control.
 *
 * The frame-level implementation belongs to src/kinematics so React never
 * re-renders per animation frame.
 */
export function CinematicOperatingModel() {
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!frameRef.current) return
    return mountCinematicDualWave(frameRef.current, { interactionResumeGraceMs: 1000 })
  }, [])

  return (
    <section id="operating-model" className="section cinematic-wave-section" aria-labelledby="cinematic-wave-title">
      <div className="container">
        <div className="cinematic-wave-heading">
          <h2 id="cinematic-wave-title" className="home-section-title">
            Operating <span className="model-word">Model</span>
          </h2>
        </div>
      </div>

      <div className="cinematic-wave-shell">
        <div className="cinema-frame" data-cinematic-wave ref={frameRef}>
          <div className="cinema-atmosphere" aria-hidden="true" />
          <div className="cinema-world" data-cinema-world>
            <svg className="cinema-svg" viewBox="0 0 1440 720" aria-hidden="true">
              <defs>
                <filter id="cinemaSignalGlow" x="-180%" y="-180%" width="460%" height="460%">
                  <feGaussianBlur stdDeviation="2.6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="cinemaRibbonBlur" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3.5" />
                </filter>
                <filter id="cinemaPulseGlow" x="-250%" y="-250%" width="600%" height="600%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <clipPath id="cinemaRevealBlue" clipPathUnits="userSpaceOnUse">
                  <rect className="cinema-reveal-clip" data-cinema-reveal-clip="blue" x="0" y="0" width="0" height="720" />
                </clipPath>
                <clipPath id="cinemaRevealRed" clipPathUnits="userSpaceOnUse">
                  <rect className="cinema-reveal-clip" data-cinema-reveal-clip="red" x="0" y="0" width="0" height="720" />
                </clipPath>
              </defs>
              <path className="cinema-ribbon blue" data-cinema-ribbon="blue" clipPath="url(#cinemaRevealBlue)" />
              <path className="cinema-ribbon red" data-cinema-ribbon="red" clipPath="url(#cinemaRevealRed)" />
              <path className="cinema-track blue" data-cinema-track="blue" clipPath="url(#cinemaRevealBlue)" />
              <path className="cinema-track red" data-cinema-track="red" clipPath="url(#cinemaRevealRed)" />
              <path className="cinema-hover-track blue" data-cinema-hover="blue" clipPath="url(#cinemaRevealBlue)" />
              <path className="cinema-hover-track red" data-cinema-hover="red" clipPath="url(#cinemaRevealRed)" />
              <g data-cinema-pulses />
            </svg>

            {nodes.map(node => (
              <button
                type="button"
                className="cinema-node"
                data-cinema-node={node.key}
                data-track={node.track}
                data-order={node.order}
                aria-expanded="false"
                aria-label={`${trackLabels[node.track]} — ${node.label}. ${node.detail}`}
                key={node.key}
              >
                <span className="cinema-node-scale">
                  <span className="cinema-node-label">
                    <span className="cinema-node-title">{node.label}</span>
                    <span className="cinema-node-detail" aria-hidden="true">
                      {node.detail}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container">
        <p className="home-section-supporting cinematic-wave-caption">
          Delivery and assurance form parallel tracks: delivery advances the system from objective to outcome; assurance evaluates evidence against requirements, assesses readiness, and makes operational ownership explicit. The defined scope determines the starting point; the model governs the work within that scope.
        </p>
      </div>
    </section>
  )
}
