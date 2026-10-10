import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Nav } from './Nav'
import { Footer } from './Footer'
import { ReachOutProvider } from './ReachOut'

export function Layout() {
  const location = useLocation()

  // Scroll to top on route change (unless navigating to an in-page anchor).
  // Services links to the homepage Operating Model, which is a full-bleed
  // composition rather than a heading: that one anchor is centred so the whole
  // model is visible on arrival. Every other hash keeps its native behaviour.
  useEffect(() => {
    if (location.hash === '#operating-model') {
      document.getElementById('operating-model')?.scrollIntoView({
        behavior: 'instant' as ScrollBehavior,
        block: 'center',
        inline: 'nearest',
      })
      return
    }
    if (!location.hash) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname, location.hash])

  return (
    <ReachOutProvider>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Outlet key={location.pathname} />
      </main>
      <Footer />
    </ReachOutProvider>
  )
}
