import { PageTransition, Reveal, Stagger, staggerItemClass } from '../components/Motion'
import { PageHero } from '../components/Sections'
import { ReachOutButton } from '../components/ReachOut'
import { Icon, IconFrame, type IconName } from '../components/Icon'
import { brand } from '../site'

const channels: { icon: IconName; k: string; val: string; href: string }[] = [
  { icon: 'mail', k: 'Email', val: brand.email, href: `mailto:${brand.email}` },
  { icon: 'linkedin', k: 'LinkedIn', val: 'Follow Label AI', href: brand.linkedin },
  { icon: 'pin', k: 'Delivery', val: brand.locations, href: '#' },
]

const journeys = [
  'Government & public institutions',
  'Development organisations & NGOs',
  'Manufacturing & industry',
  'Private-sector enterprises',
  'AI & research institutions',
]

export function Contact() {
  return (
    <PageTransition>
      <PageHero
        title="Clarify the objective"
        highlight="Align on what comes next"
        sub="A focused conversation can establish the context, constraints and priorities that shape the next decision."
        cover="/img/sat-falsecolor.jpg"
        coverPosition="right"
      />

      <section className="section">
        <div className="container contact-page">
          <Stagger className="contact-channels">
            {channels.map((c) => (
              <a
                className={`contact-item ${staggerItemClass}`}
                key={c.k}
                href={c.href}
                target={c.href.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer"
              >
                <IconFrame name={c.icon} />
                <div>
                  <div className="k">{c.k}</div>
                  <div className="val">{c.val}</div>
                </div>
              </a>
            ))}
          </Stagger>

          <Reveal className="card contact-cta-card">
            <h3>Continue the conversation</h3>
            <p>Choose the focus, then continue by email. Call scheduling is not yet available.</p>
            <ReachOutButton label="Let’s Talk" />
            <div className="contact-journeys">
              <span className="k">We work with</span>
              <ul>
                {journeys.map((j) => (
                  <li key={j}>
                    <Icon name="check" size={15} /> {j}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>
    </PageTransition>
  )
}
