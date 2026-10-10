import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAnimationFrame, useReducedMotion } from '../kinematics/react'
import { Icon } from './Icon'
import { useFocusTrap } from '../lib/useFocusTrap'
import { type DayAvailability, getAvailability } from '../lib/availability'
import { track } from '../lib/track'
import { ReachOutContext, useReachOut } from '../lib/reachOutContext'

// Swap this for your real Formspree form ID.
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xeebypqv'

// How long the closing "thanks" flash stays up before auto-dismissing.
const THANKS_AUTO_CLOSE_MS = 5000

type Intent = { key: string; icon: 'brainCircuit' | 'handshake' | 'puzzle'; title: string; teamLabel: string }
type Step = 'intent' | 'contact' | 'thanks'
type ContinueChoice = 'email' | 'call'
type ThanksMode = ContinueChoice | null

// Lucide outline icons (already defined in Icon.tsx, same stroke width/weight
// as the rest of the set) — brainCircuit / handshake / puzzle.
const INTENTS: Intent[] = [
  { key: 'build', icon: 'brainCircuit', title: 'Build AI', teamLabel: 'AI Solutions' },
  { key: 'partnership', icon: 'handshake', title: 'Partner', teamLabel: 'Partnerships' },
  { key: 'capacity', icon: 'puzzle', title: 'Build Capacity', teamLabel: 'Capacity Building' },
]

// Keyed by Intent.teamLabel — mirrors api/calendar-invite.js's INTENT_COPY so the
// on-screen confirmation matches what the real calendar invite will say.
const THANKS_COPY: Record<string, { email: string; call: string }> = {
  'AI Solutions': {
    email: "Thanks for reaching out — our AI Solutions team will be in touch shortly.",
    call: "Calendar invite sent. Our AI Solutions team will call to scope your project.",
  },
  Partnerships: {
    email: 'Thanks for reaching out — our Partnerships team will be in touch shortly.',
    call: 'Calendar invite sent. Our Partnerships team will call to discuss working together.',
  },
  'Capacity Building': {
    email: 'Thanks for reaching out — our Capacity Building team will be in touch shortly.',
    call: 'Calendar invite sent. Our Capacity Building team will call to discuss training support.',
  },
}
const DEFAULT_THANKS_COPY = {
  email: "We'll be in touch shortly.",
  call: 'Calendar invite sent. Check your email to accept the call.',
}

function parseDateKey(date: string) {
  return new Date(`${date}T00:00:00`)
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTime(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2024, 0, 1, hour, minute))
}

function startOfBusinessWindow(date: Date) {
  const d = new Date(date)
  const weekday = d.getDay()
  if (weekday === 0) {
    d.setDate(d.getDate() + 2)
  } else if (weekday === 1) {
    d.setDate(d.getDate() + 1)
  }
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function getBusinessDays(start: Date, count: number) {
  const days: Date[] = []
  const cursor = startOfDay(start)
  while (days.length < count) {
    const weekday = cursor.getDay()
    if (weekday >= 2 && weekday <= 5) {
      days.push(new Date(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function formatShortWeekday(date: Date) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date).toUpperCase()
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date)
}

function toLocalDate(date: string, time: string) {
  return new Date(`${date}T${time}`)
}

// Basic but real email-shape check — good enough to catch typos client-side
// without pretending to be a full RFC 5322 validator.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function isValidEmail(value: string) {
  return EMAIL_RE.test(value.trim())
}

export function ReachOutProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('intent')
  const [intent, setIntent] = useState<Intent | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot — real visitors never fill this in
  const [choice, setChoice] = useState<ContinueChoice | null>(null)
  const [availability, setAvailability] = useState<DayAvailability[]>([])
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [pendingSlot, setPendingSlot] = useState<{ date: string; time: string } | null>(null)
  const [thanksMode, setThanksMode] = useState<ThanksMode>(null)
  const [confirmedCallAt, setConfirmedCallAt] = useState<Date | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [autoCloseActive, setAutoCloseActive] = useState(true)

  const thanksHeadingRef = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const reduce = useReducedMotion()
  const modalRef = useFocusTrap(open)
  const visitorTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', [])

  useAnimationFrame((time) => {
    const pending = document.querySelector<HTMLElement>('.reachout-time[data-pending="true"]')
    if (!pending) return
    const wave = (Math.sin((time / 1400) * Math.PI * 2 - Math.PI / 2) + 1) / 2
    pending.style.boxShadow = `0 0 0 ${(wave * 5).toFixed(2)}px rgba(90,169,242,${(0.35 * (1 - wave)).toFixed(3)})`
  }, Boolean(pendingSlot) && !reduce, { phase: 'write', label: 'reachout-pending' })

  const [weekStart, setWeekStart] = useState<Date>(() => startOfBusinessWindow(new Date()))
  const weekDays = useMemo(() => getBusinessDays(weekStart, 4), [weekStart])
  const availabilityByDate = useMemo(() => new Map(availability.map((day) => [day.date, day])), [availability])
  const visibleWeekAvailability = useMemo(
    () =>
      weekDays.map((date) => {
        const key = formatDateKey(date)
        const entry = availabilityByDate.get(key)
        return {
          date: key,
          label: String(date.getDate()),
          weekday: formatShortWeekday(date),
          available: Boolean(entry?.slots.length),
          slots: entry?.slots ?? [],
        }
      }),
    [weekDays, availabilityByDate]
  )

  const earliestWeekStart = startOfBusinessWindow(new Date())
  const latestWeekStart =
    availability.length > 0
      ? startOfBusinessWindow(parseDateKey(availability[availability.length - 1].date))
      : earliestWeekStart
  const canGoPrevWeek = weekStart > earliestWeekStart
  const canGoNextWeek = weekStart < latestWeekStart
  const hasAnyAvailability = availability.some((day) => day.slots.length > 0)

  const canSubmitDetails = name.trim().length > 0 && isValidEmail(email)

  const selectedDay = availabilityByDate.get(selectedDate)

  useEffect(() => {
    if (!selectedDate) return
    const selected = parseDateKey(selectedDate)
    const start = startOfBusinessWindow(weekStart)
    const end = addDays(start, 6)
    if (selected < start || selected > end) {
      setWeekStart(startOfBusinessWindow(selected))
    }
  }, [selectedDate, weekStart])

  const doOpen = useCallback(() => {
    setStep('intent')
    setIntent(null)
    setName('')
    setEmail('')
    setCompany('')
    setChoice(null)
    setAvailability([])
    setAvailabilityLoaded(false)
    setSelectedDate('')
    setSelectedTime('')
    setPendingSlot(null)
    setThanksMode(null)
    setConfirmedCallAt(null)
    setError('')
    setSubmitting(false)
    setAutoCloseActive(true)
    setOpen(true)
  }, [])
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, close])

  useEffect(() => {
    if (step !== 'thanks' || !open || !autoCloseActive) return
    const timer = setTimeout(close, THANKS_AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [step, open, close, autoCloseActive])

  useEffect(() => {
    if (!open || step !== 'contact' || choice !== 'call' || availabilityLoaded) return

    let cancelled = false
    setAvailabilityLoading(true)
    getAvailability()
      .then((days) => {
        if (cancelled) return
        setAvailability(days)
        const firstBookable = days.find((day) => day.slots.length > 0)
        if (firstBookable) {
          setWeekStart(startOfBusinessWindow(parseDateKey(firstBookable.date)))
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Call availability could not be loaded. Please try again.')
      })
      .finally(() => {
        if (cancelled) return
        setAvailabilityLoaded(true)
        setAvailabilityLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [availabilityLoaded, choice, open, step])

  useEffect(() => {
    if (step === 'thanks') thanksHeadingRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  function pickIntent(i: Intent) {
    setIntent(i)
    setStep('contact')
    setChoice(null)
    setSelectedDate('')
    setSelectedTime('')
    setPendingSlot(null)
    setError('')
    track('reachout_intent_selected', { intent: i.key })
  }

  function pickChoice(nextChoice: ContinueChoice) {
    setChoice(nextChoice)
    setError('')
    if (nextChoice === 'email') {
      setSelectedDate('')
      setSelectedTime('')
      setPendingSlot(null)
    } else if (availability.length > 0 && !selectedDate) {
      const firstBookable = availability.find((day) => day.slots.length > 0)
      if (firstBookable) setWeekStart(startOfBusinessWindow(parseDateKey(firstBookable.date)))
    }
  }

  /**
   * Runs a real network submission. In production, real failures propagate as
   * real errors — a visitor is never told "Thanks" for something that didn't
   * send. In local dev/preview only (import.meta.env.DEV), a failure caused by
   * the backend simply not being configured yet (network error, missing
   * serverless function, placeholder Formspree ID) falls back to a short
   * simulated delay so the flow is demoable end-to-end without live
   * credentials. Remove the DEV branch entirely once both backends are wired
   * up for real — a "mock always succeeds" path has no place in production.
   */
  async function submitOrMock(attempt: () => Promise<void>) {
    try {
      await attempt()
    } catch (err) {
      if (!import.meta.env.DEV) throw err
      console.info('[ReachOut] DEV ONLY: live submission unavailable — completing as mock.', err)
      await new Promise((resolve) => setTimeout(resolve, 650))
    }
  }

  async function sendEmailChoice() {
    if (!intent) return
    if (company.trim().length > 0) {
      // Honeypot tripped — silently pretend success, don't tip off the bot.
      setThanksMode('email')
      setStep('thanks')
      return
    }
    const formData = new FormData()
    formData.append('Name', name)
    formData.append('Email', email)
    formData.append('Goal', intent.title)
    formData.append('Preferred Channel', 'Email')
    formData.append('_subject', `Enquiry: ${intent.title}`)

    await submitOrMock(async () => {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error('Email request failed')
    })

    track('reachout_enquiry_sent', { intent: intent.key })
    setThanksMode('email')
    setStep('thanks')
  }

  async function sendCalendarChoice(callAt: Date) {
    if (!intent) return
    if (company.trim().length > 0) {
      // Honeypot tripped — silently pretend success, don't tip off the bot.
      setThanksMode('call')
      setConfirmedCallAt(callAt)
      setStep('thanks')
      return
    }

    await submitOrMock(async () => {
      const res = await fetch('/api/calendar-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          goal: intent.title,
          teamLabel: intent.teamLabel,
          startAt: callAt.toISOString(),
          timeZone: visitorTimeZone,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.message || 'Calendar request failed')
      }
    })

    track('reachout_calendar_invite_created', { intent: intent.key })
    setThanksMode('call')
    setConfirmedCallAt(callAt)
    setStep('thanks')
  }

  // Approach: tap-again-to-confirm, same button. First tap on a slot stages
  // it (no booking yet). A second tap on that SAME slot books it. Tapping a
  // different slot just moves the pending state there — picking elsewhere
  // *is* the cancel, so there's no separate confirm/back UI.
  function handlePickTime(dateKey: string, slot: string) {
    if (!intent || submitting) return
    if (pendingSlot && pendingSlot.date === dateKey && pendingSlot.time === slot) {
      void handleConfirmPendingSlot()
      return
    }
    setSelectedDate(dateKey)
    setSelectedTime(slot)
    setPendingSlot({ date: dateKey, time: slot })
    setError('')
  }

  async function handleConfirmPendingSlot() {
    if (!intent || !pendingSlot || submitting) return
    const callAt = toLocalDate(pendingSlot.date, pendingSlot.time)
    if (Number.isNaN(callAt.getTime())) return

    setSubmitting(true)
    setError('')
    track('reachout_details_entered', { intent: intent.key, choice: 'call' })
    try {
      await sendCalendarChoice(callAt)
      setPendingSlot(null)
    } catch (err) {
      setError(
        err instanceof Error && err.message !== 'Email request failed'
          ? err.message
          : 'Something went wrong - please try again, or email us directly.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEmailIconClick() {
    if (!intent || !canSubmitDetails || submitting) return
    setChoice('email')
    setSubmitting(true)
    setError('')
    track('reachout_details_entered', { intent: intent.key, choice: 'email' })
    try {
      await sendEmailChoice()
    } catch (err) {
      setError(
        err instanceof Error && err.message !== 'Email request failed'
          ? err.message
          : 'Something went wrong - please try again, or email us directly.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleCalendarIconClick() {
    if (!intent || !canSubmitDetails || submitting) return
    pickChoice('call')
    track('reachout_choice_selected', { intent: intent.key, choice: 'call' })
  }

  return (
    <ReachOutContext.Provider value={{ open: doOpen }}>
      {children}
      <>
        {open && (
          <div
            className="booking-overlay"
            onClick={close}
          >
            <div
              ref={modalRef}
              className={`booking-modal reachout-modal${step === 'intent' ? ' reachout-modal--narrow' : ''}`}
              role="dialog"
              aria-modal="true"
              aria-label="Reach out to Label AI"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="booking-close" onClick={close} aria-label="Close">
                <Icon name="close" size={16} />
              </button>

              {step === 'intent' && (
                <div className="reachout-step reachout-step--flush">
                  <p className="reachout-intent-heading">What should we focus on?</p>
                  <div className="intent-tiles">
                    {INTENTS.map((i) => (
                      <button key={i.key} className="intent-tile" data-intent={i.key} onClick={() => pickIntent(i)}>
                        <span className="intent-tile-badge">
                          <Icon name={i.icon} size={26} />
                        </span>
                        <span className="intent-tile-title">{i.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'contact' && intent && (
                <div className="reachout-step reachout-step--flush">
                  <form className="reachout-choice-form" onSubmit={(e) => e.preventDefault()}>
                    {/* Honeypot — hidden from real users, bots tend to fill every field. */}
                    <input
                      type="text"
                      name="company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="reachout-honeypot"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                    />
                    <div className="field-row">
                      <div className="field">
                        <label htmlFor="ro-name">
                          Name <span aria-hidden="true">*</span>
                        </label>
                        <input
                          id="ro-name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="ro-email">
                          Email <span aria-hidden="true">*</span>
                        </label>
                        <input
                          id="ro-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleEmailIconClick()
                            }
                          }}
                          required
                          aria-invalid={email.trim().length > 0 && !isValidEmail(email)}
                        />
                      </div>
                      <div className="reachout-intent-actions" role="group" aria-label="How would you like to continue?">
                        <button
                          type="button"
                          className="reachout-icon-btn"
                          data-active={choice === 'email'}
                          disabled={!canSubmitDetails || submitting}
                          onClick={handleEmailIconClick}
                          aria-label="Continue by email"
                          title="Continue by email"
                        >
                          <Icon name="send" size={22} />
                        </button>
                        <button
                          type="button"
                          className="reachout-icon-btn"
                          data-active={choice === 'call'}
                          disabled
                          aria-describedby="booking-unavailable"
                          onClick={handleCalendarIconClick}
                          aria-label="Schedule a call"
                          title="Call scheduling is not yet available"
                        >
                          <Icon name="calendarDays" size={21} />
                        </button>
                      </div>
                    </div>

                    <p id="booking-unavailable" className="booking-sub">Call scheduling is not yet available. Please continue by email.</p>

                    <>
                      {choice === 'call' && (
                        <div
                          className="reachout-calendar-panel"
                        >
                          <div className="reachout-calendar-head">
                                  <span>{formatMonthLabel(weekStart)}</span>
                                  <small>{visitorTimeZone}</small>
                                </div>

                                {availabilityLoading ? (
                                  <div className="reachout-calendar-loading">Loading available times...</div>
                                ) : !hasAnyAvailability ? (
                                  <div className="reachout-calendar-loading">
                                    No call slots in the next few weeks — please send an email instead.
                                  </div>
                                ) : (
                                  <>
                                    <div className="reachout-date-row">
                                      <button
                                        type="button"
                                        className="week-nav week-nav--prev"
                                        onClick={() => setWeekStart((d) => addDays(d, -7))}
                                        disabled={!canGoPrevWeek}
                                        aria-label="Previous week"
                                      >
                                        ‹
                                      </button>
                                      {/* Date selection, not a tab interface: picking a
                                          date reveals times in the same flow rather than
                                          swapping panels. Native buttons carrying
                                          `aria-pressed` express exactly that, so there is
                                          no tab relationship left to half-implement. */}
                                      <div
                                        className="reachout-date-strip"
                                        role="group"
                                        aria-label="Choose a call date"
                                      >
                                        {visibleWeekAvailability.map((day) => (
                                          <button
                                            key={day.date}
                                            type="button"
                                            className="reachout-date"
                                            disabled={!day.available || submitting}
                                            onClick={() => {
                                              setSelectedDate(day.date)
                                              setSelectedTime('')
                                              setPendingSlot(null)
                                            }}
                                            aria-pressed={selectedDate === day.date}
                                          >
                                            <span>{day.weekday}</span>
                                            <strong>{day.label}</strong>
                                          </button>
                                        ))}
                                      </div>
                                      <button
                                        type="button"
                                        className="week-nav week-nav--next"
                                        onClick={() => setWeekStart((d) => addDays(d, 7))}
                                        disabled={!canGoNextWeek}
                                        aria-label="Next week"
                                      >
                                        ›
                                      </button>
                                    </div>

                                    <>
                                      {selectedDay && selectedDay.slots.length > 0 && (
                                        <div
                                          key={selectedDate}
                                          className="reachout-time-grid"
                                          role="group"
                                          aria-label="Choose a call time"
                                        >
                                          {selectedDay.slots.map((slot) => {
                                            const isPending =
                                              pendingSlot?.date === selectedDate && pendingSlot?.time === slot
                                            return (
                                              <button
                                                key={slot}
                                                type="button"
                                                className="reachout-time"
                                                data-selected={selectedTime === slot}
                                                data-pending={isPending}
                                                disabled={submitting}
                                                aria-pressed={isPending}
                                                aria-label={
                                                  isPending
                                                    ? `${submitting ? 'Booking' : 'Confirm'} ${formatTime(slot)}`
                                                    : `Select ${formatTime(slot)}`
                                                }
                                                onClick={() => handlePickTime(selectedDate, slot)}
                                              >
                                                {isPending && (
                                                  <span className="reachout-time-pending-label">
                                                    {submitting ? 'Booking…' : 'Confirm'}
                                                  </span>
                                                )}
                                                {formatTime(slot)}
                                              </button>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </>
                                  </>
                                )}
                              </div>
                            )}
                          </>
                  </form>
                  {error && (
                    <div className="reachout-error" role="alert" aria-live="assertive" tabIndex={-1} ref={errorRef}>
                      {error}
                    </div>
                  )}
                </div>
              )}

              {step === 'thanks' && (
                <div
                  className="reachout-step reachout-sent"
                  role="status"
                  aria-live="polite"
                  onMouseEnter={() => setAutoCloseActive(false)}
                  onMouseLeave={() => setAutoCloseActive(true)}
                  onFocus={() => setAutoCloseActive(false)}
                  onBlur={() => setAutoCloseActive(true)}
                >
                  <span className="reachout-sent-icon">
                    <Icon name="check" size={22} />
                  </span>
                  <h3 ref={thanksHeadingRef} tabIndex={-1}>
                    Thanks{name.trim() ? `, ${name.trim().split(' ')[0]}` : ''}.
                  </h3>
                  <p className="booking-sub">
                    {((intent && THANKS_COPY[intent.teamLabel]) || DEFAULT_THANKS_COPY)[
                      thanksMode === 'call' ? 'call' : 'email'
                    ]}
                  </p>
                  {thanksMode === 'call' && confirmedCallAt && (
                    <p className="reachout-call-summary">
                      {new Intl.DateTimeFormat(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(confirmedCallAt)}{' '}
                      ({visitorTimeZone})
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </>
    </ReachOutContext.Provider>
  )
}

/** Primary CTA button that opens the Reach Out flow. */
export function ReachOutButton({
  label = 'Talk to us',
  variant = 'btn-primary',
  withArrow = true,
  className = '',
}: {
  label?: string
  variant?: 'btn-primary' | 'btn-ghost'
  withArrow?: boolean
  className?: string
}) {
  const { open } = useReachOut()
  return (
    <button className={`btn ${variant} ${className}`} onClick={open}>
      {label}
      {withArrow && <Icon name="arrow" size={18} className="btn-arrow" />}
    </button>
  )
}
