/**
 * Public website feature switches.
 *
 * Build-time Vite flags, read once here so pages consume a resolved boolean
 * rather than the environment. Leadership profiles are strict positive
 * opt-in: anything other than the exact string `true` leaves them off.
 */
export const features = {
  leadershipProfiles: import.meta.env.VITE_SHOW_LEADERSHIP_PROFILES === 'true',
} as const
