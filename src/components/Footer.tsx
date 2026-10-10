import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { brand, navTabs } from '../site'

const cols = [
  {
    title: 'Explore',
    links: navTabs,
  },
  {
    title: 'Company',
    links: [
      { label: 'Contact', to: '/contact' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <Link className="brand" to="/" aria-label="Label AI home">
              <img src={brand.lockup.logo} alt={brand.name} className="brand-logo" />
            </Link>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <h3>{c.title}</h3>
              <ul className="footer-links">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3>Connect</h3>
            <ul className="footer-links">
              <li>
                <a className="footer-email" href={`mailto:${brand.email}`}>
                  <Icon name="mail" size={18} /> {brand.email}
                </a>
              </li>
              <li>
                <a
                  className="footer-linkedin"
                  href={brand.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Label AI on LinkedIn"
                >
                  <Icon name="linkedin" size={18} /> LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            © {new Date().getFullYear()} {brand.legal}. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
