// ---------------------------------------------------------------------------
// MOCK AVAILABILITY LAYER
// ---------------------------------------------------------------------------
// This generates realistic-looking mock availability so the date/time picker
// can be built and used today. To go live, replace `getAvailability()` with a
// call to a backend endpoint that queries the real calendar:
//   - Google:    Calendar API `freebusy.query` against the connected account
//   - Microsoft: Graph API `getSchedule` / `/calendarView`
// Both require a server-side OAuth connection — not something that can be
// done from the browser alone.
// ---------------------------------------------------------------------------

export type DayAvailability = {
  date: string // YYYY-MM-DD
  slots: string[] // e.g. ["09:00", "09:30", ...] in the visitor's local time
}

const BOOKING_TIMES = ['12:00', '13:00', '15:00', '16:00', '17:00']

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export async function getAvailability(daysAhead = 35): Promise<DayAvailability[]> {
  await new Promise((res) => setTimeout(res, 300))

  const results: DayAvailability[] = []
  let cursor = new Date()
  cursor.setDate(cursor.getDate() + 1)

  for (let i = 0; i < daysAhead; i++) {
    const day = cursor.getDay()
    const dateStr = formatDate(cursor)
    if (day === 0 || day === 1 || day === 6) {
      // Only Tuesday through Friday are bookable.
      results.push({ date: dateStr, slots: [] })
    } else {
      // All bookable weekdays show the same fixed set of times, so the
      // picker stays consistent day to day.
      results.push({ date: dateStr, slots: [...BOOKING_TIMES] })
    }
    cursor = new Date(cursor)
    cursor.setDate(cursor.getDate() + 1)
  }

  return results
}
