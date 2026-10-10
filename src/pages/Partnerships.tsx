import { PageTransition, Reveal, Stagger, staggerItemClass } from '../components/Motion'
import { PageHero, CtaBand } from '../components/Sections'
import { Icon } from '../components/Icon'
import { partnershipModels, partnerSegments, sdgs } from '../site'

export function Partnerships() {
  return (
    <PageTransition>
      <PageHero
        title="Engagement models for"
        highlight="long-term collaboration"
        sub="We work alongside institutions through structured partnership pathways - chosen to match where you are on your AI journey."
        cover="/img/sat-pivot.png"
        coverPosition="left"
      />

      <section className="section">
        <div className="container">
          <Stagger className="grid grid-2">
            {partnershipModels.map((m) => (
              <article className={`card service-card ${staggerItemClass}`} key={m.title}>
                <div className="svc-icon">
                  <Icon name={m.icon} size={22} />
                </div>
                <h3>{m.title}</h3>
                <p>{m.desc}</p>
              </article>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Partner segments - placeholders only, no logos, no implied endorsement */}
      <section className="section why">
        <div className="container">
          <Reveal className="section-head center">
            <h2 className="section-title">Credible collaboration, honestly represented</h2>
            <p className="section-sub">
              Until engagements and brand usage are formally approved, these are shown as
              professional placeholders - never claims of endorsement.
            </p>
          </Reveal>
          <Stagger className="partner-grid">
            {partnerSegments.map((p) => (
              <article className={`card partner-card ${staggerItemClass}`} key={p.name}>
                <span className="partner-logo">
                  <Icon name={p.icon} size={26} />
                </span>
                <h4>{p.name}</h4>
                <p>{p.desc}</p>
                <span className="partner-status">{p.status}</span>
              </article>
            ))}
          </Stagger>
          <p className="partner-note">
            Partner logos are added only with approved local assets and explicit permission.
          </p>
        </div>
      </section>

      {/* SDG alignment - own branded reference, not official UN logos */}
      <section className="section">
        <div className="container">
          <Reveal className="section-head center">
            <span className="sdg-mark" aria-hidden="true">
              <Icon name="globe" size={34} />
            </span>
            <h2 className="section-title">Aligned with the UN Sustainable Development Goals</h2>
            <p className="section-sub">
              Our capability model - jobs, skills, and institution-owned AI - advances the goals
              development partners care about most.
            </p>
          </Reveal>
          <Stagger className="sdg-grid">
            {sdgs.map((g) => (
              <div className={`sdg-tile sdg-${g.n} ${staggerItemClass}`} key={g.n}>
                <span className="sdg-n">{g.n}</span>
                <span className="sdg-name">{g.name}</span>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      <CtaBand />
    </PageTransition>
  )
}
