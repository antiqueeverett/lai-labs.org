/**
 * Repository-wide frame scheduler.
 *
 * Every native animation path in this repository should schedule through this
 * module rather than owning a private requestAnimationFrame loop. One browser
 * frame therefore services all one-shot callbacks and persistent subscribers.
 * This keeps frame timing coherent and avoids multiplying native RAF queues as
 * the site gains more animated components.
 */
export type FrameSample = {
  now: number
  deltaMs: number
}

export type FrameSubscriber = (sample: FrameSample) => void

export type FramePhase = 'read' | 'update' | 'write'

export type FrameSubscriptionOptions = {
  phase?: FramePhase
  label?: string
}

let nativeFrame = 0
let nextRequestId = 1
let lastNow = 0

type OneShot = {
  callback: FrameRequestCallback
  phase: FramePhase
  label: string
}
const oneShots = new Map<number, OneShot>()
type Subscription = {
  callback: FrameSubscriber
  label: string
}

const subscriptions: Record<FramePhase, Set<Subscription>> = {
  read: new Set(),
  update: new Set(),
  write: new Set(),
}

let frameCount = 0

function subscriberCount() {
  return subscriptions.read.size + subscriptions.update.size + subscriptions.write.size
}

function hasWork() {
  return oneShots.size > 0 || subscriberCount() > 0
}

function ensureFrame() {
  if (!nativeFrame && hasWork() && document.visibilityState !== 'hidden') {
    nativeFrame = window.requestAnimationFrame(flush)
  }
}

function flush(now: number) {
  nativeFrame = 0
  const deltaMs = lastNow ? Math.min(now - lastNow, 50) : 1000 / 60
  lastNow = now

  const queued = [...oneShots.values()]
  oneShots.clear()

  const sample = { now, deltaMs }
  ;(['read', 'update', 'write'] as FramePhase[]).forEach(phase => {
    queued.filter(item => item.phase === phase).forEach(({ callback }) => callback(now))
    subscriptions[phase].forEach(({ callback }) => callback(sample))
  })
  frameCount++

  if (hasWork()) ensureFrame()
  else lastNow = 0
}

/** Coalesced requestAnimationFrame-compatible one-shot. */
export function requestFrame(
  callback: FrameRequestCallback,
  { phase = 'write', label = 'one-shot' }: FrameSubscriptionOptions = {},
) {
  const id = nextRequestId++
  oneShots.set(id, { callback, phase, label })
  ensureFrame()
  return id
}

export function cancelFrame(id: number) {
  oneShots.delete(id)
  if (!hasWork() && nativeFrame) {
    window.cancelAnimationFrame(nativeFrame)
    nativeFrame = 0
    lastNow = 0
  }
}

/** Persistent repository-wide frame subscription. */
export function subscribeFrame(
  callback: FrameSubscriber,
  { phase = 'update', label = 'anonymous' }: FrameSubscriptionOptions = {},
) {
  const subscription = { callback, label }
  subscriptions[phase].add(subscription)
  ensureFrame()
  return () => {
    subscriptions[phase].delete(subscription)
    if (!hasWork() && nativeFrame) {
      window.cancelAnimationFrame(nativeFrame)
      nativeFrame = 0
      lastNow = 0
    }
  }
}

type DelayedTask = {
  callback: () => void
  label: string
  remainingMs: number
  startedAt: number
}

let nextDelayId = 1
let delayWake = 0
const delayedTasks = new Map<number, DelayedTask>()

function accountDelayTime(now: number) {
  delayedTasks.forEach(task => {
    task.remainingMs -= Math.max(0, now - task.startedAt)
    task.startedAt = now
  })
}

function scheduleDelayWake() {
  if (delayWake || !delayedTasks.size || document.visibilityState === 'hidden') return
  const now = performance.now()
  accountDelayTime(now)
  const waitMs = Math.max(0, Math.min(...[...delayedTasks.values()].map(task => task.remainingMs)))
  delayWake = window.setTimeout(flushDelays, waitMs)
}

function flushDelays() {
  delayWake = 0
  const now = performance.now()
  accountDelayTime(now)
  const ready = [...delayedTasks.entries()].filter(([, task]) => task.remainingMs <= 0)
  ready.forEach(([id, task]) => {
    delayedTasks.delete(id)
    requestFrame(() => task.callback(), { phase: 'write', label: task.label })
  })
  scheduleDelayWake()
}

/**
 * Scheduler-owned delay for choreography and interaction intent. Delays share
 * one native timeout, pause while the document is hidden, and only wake RAF for
 * their final write instead of keeping an idle 60 Hz subscription alive.
 */
export function scheduleAfter(delayMs: number, callback: () => void, label = 'delay') {
  const id = nextDelayId++
  delayedTasks.set(id, {
    callback,
    label,
    remainingMs: Math.max(0, delayMs),
    startedAt: performance.now(),
  })
  if (delayWake) {
    window.clearTimeout(delayWake)
    delayWake = 0
  }
  scheduleDelayWake()
  return () => {
    delayedTasks.delete(id)
    if (delayWake) {
      window.clearTimeout(delayWake)
      delayWake = 0
    }
    scheduleDelayWake()
  }
}

/** Read-only diagnostics used by browser validation and leak tests. */
export function getSchedulerSnapshot() {
  const labels = (phase: FramePhase) => [...subscriptions[phase]].map(({ label }) => label).sort()
  return {
    nativeFrameActive: Boolean(nativeFrame),
    oneShots: oneShots.size,
    oneShotLabels: [...oneShots.values()].map(({ label }) => label).sort(),
    delayedTasks: delayedTasks.size,
    delayedLabels: [...delayedTasks.values()].map(({ label }) => label).sort(),
    subscribers: {
      read: subscriptions.read.size,
      update: subscriptions.update.size,
      write: subscriptions.write.size,
      total: subscriberCount(),
    },
    labels: {
      read: labels('read'),
      update: labels('update'),
      write: labels('write'),
    },
    frameCount,
    hidden: document.visibilityState === 'hidden',
  }
}

function visibilityChanged() {
  if (document.visibilityState === 'hidden') {
    if (nativeFrame) window.cancelAnimationFrame(nativeFrame)
    nativeFrame = 0
    lastNow = 0
    if (delayWake) {
      window.clearTimeout(delayWake)
      delayWake = 0
    }
    accountDelayTime(performance.now())
    return
  }
  delayedTasks.forEach(task => { task.startedAt = performance.now() })
  scheduleDelayWake()
  ensureFrame()
}

document.addEventListener('visibilitychange', visibilityChanged)

const diagnosticsKey = Symbol.for('lai.kinematics')
Object.defineProperty(window, diagnosticsKey, {
  configurable: true,
  value: Object.freeze({ snapshot: getSchedulerSnapshot }),
})
