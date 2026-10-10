import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Icon } from './Icon'
import { useReachOut } from '../lib/reachOutContext'
import { navTabs } from '../site'

export function Nav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { open: openReachOut } = useReachOut()

  // close mobile menu on route change
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <header className={`nav${open ? ' open' : ''}`}>
      <div className="container nav-inner">
        <nav className="nav-links" aria-label="Primary">
          {navTabs.map((t) => (
            <NavLink key={t.to} to={t.to} className="nav-link">
              {({ isActive }) => (
                <>
                  {t.label}
                  {isActive && <span className="tab-underline" />}
                </>
              )}
            </NavLink>
          ))}
          <button className="btn btn-primary nav-mobile-cta" onClick={openReachOut}>
            Reach Out
          </button>
        </nav>

        <div className="nav-cta">
          <button className="btn btn-primary" onClick={openReachOut}>
            Reach Out
          </button>
          <button
            className="nav-toggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? 'close' : 'menu'} size={22} />
          </button>
        </div>
      </div>
    </header>
  )
}
