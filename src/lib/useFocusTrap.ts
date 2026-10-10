import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Keeps keyboard focus inside a modal while it's open, and returns focus to
 * whatever was focused before it opened once it closes. Doesn't render
 * anything — just wire the returned ref onto the modal's outer element.
 */
export function useFocusTrap(active: boolean): RefObject<HTMLDivElement> {
  const containerRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !containerRef.current) return
      const focusable = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus?.()
    }
  }, [active])

  return containerRef
}
