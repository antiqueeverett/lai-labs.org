import { PageTransition, Reveal, Stagger, staggerItemClass } from '../components/Motion'
import { PageHero, CtaBand } from '../components/Sections'
import { Counter } from '../components/Counter'
import { Icon, type IconName } from '../components/Icon'
import { impactStats } from '../site'

const focus: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'shield', title: 'Institutional capability development', desc: 'Durable internal structures so AI is owned and governed in-house.' },
  { icon: 'graduation', title: 'Workforce training & development', desc: 'Hands-on enablement that builds real, transferable engineering skill.' },
  { icon: 'link', title: 'Knowledge transfer & handover', desc: 'Clean transfer of systems, documentation, and operational know-how.' },
  { icon: 'eye', title: 'Case-study documentation', desc: 'Evidence-based records of what was deployed and what it changed.' },
  { icon: 'cpu', title: 'Deployment outcomes & metrics', desc: 'Measurable operational results, not experimental outputs.' },
]

const featured = impactStats.filter((s) => s.featured)
const supporting = impactStats.filter((s) => !s.featured)

export function Impact() {
  return (
    <PageTransition>
      <PageHero
        title="We measure success by what"
        highlight="institutions can do without us"
        sub="Our goal is independence: systems that clients own, operate, and scale on their own — generating measurable operational impact."
        abstract="timeseries"
      />

      <section className="section">
        <div className="container">
          <Stagger className="stat-featured">
            {featured.map((s) => (
              <div className={`stat-hero ${staggerItemClass}`} key={s.label}>
                <div className="stat-hero-num text-gradient">
                  <Counter to={s.value} suffix={s.suffix} />
                </div>
                <div className="stat-hero-label">{s.label}</div>
              </div>
            ))}
          </Stagger>

          <Stagger className="stat-band stat-band-sm">
            {supporting.map((s) => (
              <div className={`stat-block ${staggerItemClass}`} key={s.label}>
                <div className="stat-num text-gradient">
                  <Counter to={s.value} suffix={s.suffix} />
                </div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="section why">
        <div className="container">
          <Reveal className="section-head center">
            <h2 className="section-title">Capability that outlasts the engagement</h2>
          </Reveal>
          <Stagger className="grid grid-3">
            {focus.map((f) => (
              <article className={`card service-card ${staggerItemClass}`} key={f.title}>
                <div className="svc-icon">
                  <Icon name={f.icon} size={22} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            ))}
          </Stagger>
        </div>
      </section>

      <CtaBand />
    </PageTransition>
  )
}
