// ---------------------------------------------------------------------------
// Lightweight event tracking.
// ---------------------------------------------------------------------------
// This doesn't assume which analytics tool you're using. If `window.dataLayer`
// exists (Google Tag Manager / GA4's common integration point), events get
// pushed there automatically. Otherwise, events are just logged to the
// console so you can see them during development. Swap the body of `track()`
// for a direct call to your analytics SDK once you've picked one.
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
  }
}

export function track(event: string, data: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event, ...data })
  } else {
    // eslint-disable-next-line no-console
    console.debug('[track]', event, data)
  }
}
