import type { FamilyEvent } from './protoData'

function toUtcCompact(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function parseEventStartDate(evt: FamilyEvent): Date {
  // Jos FamilyEvent sisältää tulevaisuudessa erillisen ISO-kentän, käytetään sitä ensisijaisesti
  const maybeIso = (evt as FamilyEvent & { startDate?: string }).startDate
  if (maybeIso) {
    const parsedIso = new Date(maybeIso)
    if (!Number.isNaN(parsedIso.getTime())) return parsedIso
  }

  // Yritetään jäsentää evt.time (esim. "2026-11-22T10:00:00Z" tai "La 22.11. klo 10:00")
  const direct = new Date(evt.time)
  if (!Number.isNaN(direct.getTime())) return direct

  const fiMatch = evt.time.match(/(\d{1,2})\.(\d{1,2})\.(?:(\d{4}))?(?:.*?(\d{1,2})[:.](\d{2}))?/)
  if (fiMatch) {
    const now = new Date()
    const day = Number(fiMatch[1])
    const month = Number(fiMatch[2]) - 1
    const year = fiMatch[3] ? Number(fiMatch[3]) : now.getFullYear()
    const hour = fiMatch[4] ? Number(fiMatch[4]) : 10
    const minute = fiMatch[5] ? Number(fiMatch[5]) : 0
    const constructed = new Date(year, month, day, hour, minute, 0)
    if (!Number.isNaN(constructed.getTime())) return constructed
  }

  // Varavaihtoehto: seuraava tasatunti
  const fallback = new Date()
  fallback.setHours(fallback.getHours() + 1, 0, 0, 0)
  return fallback
}

export function buildGoogleCalendarUrl(evt: FamilyEvent): string {
  const start = parseEventStartDate(evt)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  const location = [evt.venue, evt.city].filter(Boolean).join(', ')
  const details = [
    evt.description,
    evt.ageGroup ? `Ikähaarukka: ${evt.ageGroup}` : '',
    evt.price ? `Hinta: ${evt.price}` : '',
    evt.url ? `Lisätiedot: ${evt.url}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: evt.title,
    dates: `${toUtcCompact(start)}/${toUtcCompact(end)}`,
    details,
    location,
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}