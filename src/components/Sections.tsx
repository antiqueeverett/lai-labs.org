import { Link } from 'react-router-dom'
import { IconFrame } from './Icon'
import { Reveal } from './Motion'
import { Cover } from './Cover'
import { AbstractCover } from './AbstractCover'
import { HeroBrandRelay } from './HeroBrandRelay'
import { ReachOutButton } from './ReachOut'
import { brand } from '../site'

/** Inner-page hero header — full-bleed satellite/abstract cover + glow. */
export function PageHero({
  title,
  highlight,
  sub,
  brandRelay = false,
  cover,
  coverPosition,
  abstract,
}: {
  title: string
  highlight?: string
  sub: string
  /** run the optional brand-to-hero sheen relay onto `highlight`; the canonical tagline slot is always present */
  brandRelay?: boolean
  /** optional full-bleed satellite cover image */
  cover?: string
  coverPosition?: string
  /** generated non-satellite cover theme (takes precedence over `cover`) */
  abstract?: 'timeseries' | 'cells'
}) {
  const hasCover = Boolean(cover || abstract)
  return (
    <section className={`page-hero${hasCover ? ' has-cover' : ''}`}>
      {abstract ? (
        <AbstractCover theme={abstract} />
      ) : cover ? (
        <Cover src={cover} tint="full" position={coverPosition} />
      ) : (
        <div className="hero-grid-bg" />
      )}
      <div className="container">
        <Reveal
          className={`page-hero-inner${brandRelay ? ' has-relay' : ''}`}
        >
          <HeroBrandRelay
            line1={title}
            line2={highlight}
            titleClassName="page-hero-title"
            relay={brandRelay}
          />
          <p className="page-hero-sub">{sub}</p>
        </Reveal>
      </div>
    </section>
  )
}

/** Reusable conversion band used at the foot of most pages. */
export function CtaBand({
  title = 'Let’s scope your AI implementation',
  sub = 'Tell us about your institution, your data, and your goals. We’ll return an honest, practical view of what’s feasible — and where to start.',
  label = 'Talk to us',
  showExplore = true,
  showContactDetails = true,
  withArrow = true,
}: {
  title?: string
  sub?: string
  label?: string
  showExplore?: boolean
  showContactDetails?: boolean
  withArrow?: boolean
}) {
  return (
    <section className="section cta">
      <div className="container">
        <Reveal className="cta-card">
          <div className={`cta-inner${showContactDetails ? '' : ' cta-inner-single'}`}>
            <div>
              <div className="cta-cluster">
                <h2 className="cta-title">{title}</h2>
                {sub ? <p>{sub}</p> : null}
                <div className="hero-actions">
                  <ReachOutButton label={label} withArrow={withArrow} />
                  {showExplore && (
                    <Link className="btn btn-ghost" to="/solutions">
                      Explore
                    </Link>
                  )}
                </div>
              </div>
            </div>
            {showContactDetails && (
              <div className="contact-list">
                <div className="contact-item">
                  <IconFrame name="mail" />
                  <div>
                    <div className="k">Email</div>
                    <div className="val">{brand.email}</div>
                  </div>
                </div>
                <div className="contact-item">
                  <IconFrame name="pin" />
                  <div>
                    <div className="k">Delivery</div>
                    <div className="val">{brand.locations}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
