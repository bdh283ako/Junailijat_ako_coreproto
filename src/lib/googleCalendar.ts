export interface CalendarEventInput {
  title: string;
  startDate: string;
  endDate?: string;
  locationName?: string;
  address?: string;
  description?: string;
  url?: string;
}

function toUtcCompact(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function resolveEventTimes(event: CalendarEventInput): {
  startUtc: string;
  endUtc: string;
} | null {
  const startDate = new Date(event.startDate);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  let endDate = event.endDate ? new Date(event.endDate) : null;
  if (!endDate || Number.isNaN(endDate.getTime())) {
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  }

  const startUtc = toUtcCompact(startDate.toISOString());
  const endUtc = toUtcCompact(endDate.toISOString());

  if (!startUtc || !endUtc) return null;
  return { startUtc, endUtc };
}

export function buildGoogleCalendarUrl(event: CalendarEventInput): string {
  const times = resolveEventTimes(event);
  if (!times) {
    return "https://calendar.google.com/calendar/render?action=TEMPLATE";
  }

  const location = [event.locationName, event.address]
    .filter(Boolean)
    .join(", ");

  const details = [
    event.description,
    event.url ? `Lisätiedot: ${event.url}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${times.startUtc}/${times.endUtc}`,
    details,
    location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export const createGoogleCalendarUrl = buildGoogleCalendarUrl;

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcsContent(event: CalendarEventInput): string {
  const times = resolveEventTimes(event);
  const nowUtc = toUtcCompact(new Date().toISOString());
  const startUtc = times?.startUtc ?? nowUtc;
  const endUtc = times?.endUtc ?? nowUtc;

  const location = [event.locationName, event.address]
    .filter(Boolean)
    .join(", ");

  const description = [
    event.description,
    event.url ? `Lisätiedot: ${event.url}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const uid = `${startUtc}-${encodeURIComponent(event.title.slice(0, 24))}@shellproto`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Junailijat//PKS Tapahtumat//FI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    location ? `LOCATION:${escapeIcsText(location)}` : "",
    description ? `DESCRIPTION:${escapeIcsText(description)}` : "",
    event.url ? `URL:${event.url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n");
}