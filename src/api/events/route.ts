import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_FEED_URL,
  fetchNormalizedEvents,
  type NormalizedEvent,
} from "../../(frontend)/akotestaa/shellproto/eventFeedClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- 1. LÄHTEET JA VARADATA ---

const LINKED_EVENTS_FAMILY_URL =
  "https://api.hel.fi/linkedevents/v1/event/?start=today&keyword_OR=yso:p4354,yso:p13050,yso:p4363,yso:p10557,yso:p11017,yso:p2771&include=location,keywords&page_size=50";

const FALLBACK_EVENTS: NormalizedEvent[] = [
  {
    id: "fallback-oodi-satutuokio",
    title: "Perheiden aamusatu ja lorupiiri",
    startDate: "2026-11-22T09:30:00.000Z",
    endDate: "2026-11-22T10:30:00.000Z",
    locationName: "Keskustakirjasto Oodi",
    address: "Töölönlahdenkatu 4, Helsinki",
    city: "Helsinki",
    coordinates: { lat: 60.1741, lng: 24.9381 },
    description:
      "Lämminhenkinen aamuhetki lapsiperheille: loruja, satuja ja yhteistä lukuhetkeä.",
    url: "https://oodihelsinki.fi",
    ageRangeLabel: "1–4 v",
    tags: ["kirjasto", "satuhetki", "maksuton"],
    source: "fallback-seed",
  },
  {
    id: "fallback-weegee-taidepaja",
    title: "Sunnuntain avoin taidepaja lapsille ja aikuisille",
    startDate: "2026-11-22T12:00:00.000Z",
    endDate: "2026-11-22T14:00:00.000Z",
    locationName: "Näyttelykeskus WeeGee / EMMA",
    address: "Ahertajantie 5, Espoo",
    city: "Espoo",
    coordinates: { lat: 60.1786, lng: 24.7944 },
    description:
      "Kokeile eri kuvan tekemisen tapoja yhdessä perheen kanssa non-stop-työpajassa.",
    url: "https://espoo.fi",
    ageRangeLabel: "4–10 v",
    tags: ["taide", "työpaja", "viikonloppu"],
    source: "fallback-seed",
  },
  {
    id: "fallback-heureka-tiedetuokio",
    title: "Pienten tutkijoiden ihmettelyhetki",
    startDate: "2026-11-24T10:00:00.000Z",
    endDate: "2026-11-24T11:00:00.000Z",
    locationName: "Heureka",
    address: "Kuninkaalantie 7, Vantaa",
    city: "Vantaa",
    coordinates: { lat: 60.2876, lng: 25.0405 },
    description:
      "Helppoja havaintoja ja kokeiluja arjen ilmiöistä perheen pienimmille.",
    url: "https://heureka.fi",
    ageRangeLabel: "3–6 v",
    tags: ["tiede", "lapset", "sisätila"],
    source: "fallback-seed",
  },
];

// --- 2. NORMALISOINTI- JA SUODATINAPUFUNKTIOT ---

function inferAgeRangeLabel(text: string): string {
  const range = text.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*v/i);
  if (range) return `${range[1]}–${range[2]} v`;
  if (/vauva|vauvoille/i.test(text)) return "0–2 v";
  if (/taapero|taaperoille|satuhetk/i.test(text)) return "1–3 v";
  if (/leikki-ikä|alle kouluikä/i.test(text)) return "3–6 v";
  if (/kouluikä|alakoulu/i.test(text)) return "7–12 v";
  return "Lapset & perheet";
}

function normalizeCityName(rawLocality: string, fallbackText: string): string {
  const clean = rawLocality.trim();
  if (clean) {
    if (/helsinki|helsingfors/i.test(clean)) return "Helsinki";
    if (/espoo|esbo/i.test(clean)) return "Espoo";
    if (/vantaa|vanda/i.test(clean)) return "Vantaa";
    if (/kauniainen|grankulla/i.test(clean)) return "Kauniainen";
    return clean;
  }

  const lower = fallbackText.toLowerCase();
  if (
    lower.includes("espoo") ||
    lower.includes("tapiola") ||
    lower.includes("leppävaara") ||
    lower.includes("sello")
  ) {
    return "Espoo";
  }
  if (
    lower.includes("vantaa") ||
    lower.includes("tikkurila") ||
    lower.includes("myyrmäki") ||
    lower.includes("heureka")
  ) {
    return "Vantaa";
  }
  if (lower.includes("kauniainen")) {
    return "Kauniainen";
  }
  return "Helsinki";
}

async function fetchLinkedEventsNormalized(
  timeoutMs = 8000
): Promise<{ events: NormalizedEvent[]; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(LINKED_EVENTS_FAMILY_URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      return { events: [], error: `Linked Events HTTP ${res.status}` };
    }

    const payload = (await res.json()) as {
      data?: Array<Record<string, unknown>>;
    };
    const items = Array.isArray(payload?.data) ? payload.data : [];

    const normalized: NormalizedEvent[] = items.flatMap((raw) => {
      if (raw.event_status === "EventCancelled") return [];

      const id = String(raw.id ?? "").trim();
      const nameObj = raw.name as
        | { fi?: string; en?: string; sv?: string }
        | undefined;
      const title = (nameObj?.fi || nameObj?.en || nameObj?.sv || "").trim();
      if (!title || /^peruttu:/i.test(title)) return [];

      const startDate =
        typeof raw.start_time === "string" ? raw.start_time : "";
      if (!id || !startDate) return [];

      const endDate =
        typeof raw.end_time === "string" ? raw.end_time : undefined;

      const loc = raw.location as
        | {
            name?: { fi?: string; en?: string };
            street_address?: { fi?: string };
            address_locality?: { fi?: string };
            position?: { coordinates?: [number, number] };
          }
        | undefined;

      const locationName = loc?.name?.fi || loc?.name?.en || undefined;
      const street = loc?.street_address?.fi || "";
      const locality = loc?.address_locality?.fi || "";
      const city = normalizeCityName(
        locality,
        `${id} ${locationName ?? ""} ${street} ${title}`
      );
      const address = [street, city].filter(Boolean).join(", ") || undefined;

      // GeoJSON on [longitude, latitude] -> NormalizedEvent odottaa { lat, lng }
      const rawCoords = loc?.position?.coordinates;
      const coordinates =
        Array.isArray(rawCoords) &&
        rawCoords.length >= 2 &&
        typeof rawCoords[0] === "number" &&
        typeof rawCoords[1] === "number"
          ? { lat: rawCoords[1], lng: rawCoords[0] }
          : undefined;

      const shortDescObj = raw.short_description as
        | { fi?: string; en?: string }
        | undefined;
      const description = shortDescObj?.fi || shortDescObj?.en || undefined;

      const infoUrlObj = raw.info_url as
        | { fi?: string; en?: string }
        | undefined;
      const url =
        infoUrlObj?.fi ||
        infoUrlObj?.en ||
        `https://tapahtumat.hel.fi/fi/tapahtumat/${encodeURIComponent(id)}`;

      const rawKeywords = Array.isArray(raw.keywords)
        ? (raw.keywords as Array<{ name?: { fi?: string } }>)
        : [];
      const keywordTags = rawKeywords
        .map((kw) => kw?.name?.fi?.toLowerCase().trim())
        .filter((v): v is string => Boolean(v));

      const offers = Array.isArray(raw.offers)
        ? (raw.offers as Array<{ is_free?: boolean }>)
        : [];
      const isFree = Boolean(offers[0]?.is_free);

      const tags = Array.from(
        new Set([
          ...(isFree ? ["maksuton"] : []),
          ...keywordTags.slice(0, 4),
          "linked-events",
        ])
      );

      const ageRangeLabel = inferAgeRangeLabel(
        `${title} ${description ?? ""} ${tags.join(" ")}`
      );

      return [
        {
          id: `le-${id}`,
          title,
          startDate,
          endDate,
          locationName,
          address,
          city,
          coordinates,
          description,
          url,
          ageRangeLabel,
          tags,
          source: "linked-events-pks",
        },
      ];
    });

    return { events: normalized };
  } catch (err) {
    return {
      events: [],
      error: err instanceof Error ? err.message : "Linked Events fetch error",
    };
  } finally {
    clearTimeout(timer);
  }
}

function deduplicateAndSortEvents(events: NormalizedEvent[]): NormalizedEvent[] {
  const seen = new Set<string>();
  const unique: NormalizedEvent[] = [];

  for (const evt of events) {
    const dayKey = (evt.startDate || "").slice(0, 10);
    const titleKey = evt.title.toLowerCase().replace(/\s+/g, " ").trim();
    const cityKey = (evt.city || "").toLowerCase().trim();
    const dedupKey = `${titleKey}|${dayKey}|${cityKey}`;

    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    unique.push(evt);
  }

  return unique.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function filterEvents(
  events: NormalizedEvent[],
  req: NextRequest
): NormalizedEvent[] {
  const { searchParams } = req.nextUrl;
  const ageFilter = searchParams.get("age")?.trim().toLowerCase();
  const cityFilter = searchParams.get("city")?.trim().toLowerCase();
  const queryFilter = searchParams.get("q")?.trim().toLowerCase();

  return events.filter((event) => {
    if (ageFilter && ageFilter !== "all" && ageFilter !== "kaikki") {
      const matchesAge =
        event.ageRangeLabel.toLowerCase().includes(ageFilter) ||
        event.tags.some((tag) => tag.toLowerCase().includes(ageFilter));
      if (!matchesAge) return false;
    }

    if (cityFilter && cityFilter !== "all" && cityFilter !== "kaikki pks") {
      const cityMatch =
        event.city?.toLowerCase().includes(cityFilter) ||
        event.address?.toLowerCase().includes(cityFilter) ||
        event.locationName?.toLowerCase().includes(cityFilter);
      if (!cityMatch) return false;
    }

    if (queryFilter) {
      const haystack = [
        event.title,
        event.description ?? "",
        event.locationName ?? "",
        event.address ?? "",
        event.ageRangeLabel,
        ...event.tags,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(queryFilter)) return false;
    }

    return true;
  });
}

// --- 3. GET-PÄÄTEPISTE ---

export async function GET(req: NextRequest) {
  const [karoSettled, linkedSettled] = await Promise.allSettled([
    fetchNormalizedEvents({
      feedUrl: DEFAULT_FEED_URL,
      timeoutMs: 8000,
      revalidateSeconds: 300,
    }),
    fetchLinkedEventsNormalized(8000),
  ]);

  const karoResult =
    karoSettled.status === "fulfilled"
      ? karoSettled.value
      : {
          events: [] as NormalizedEvent[],
          sourceUrl: DEFAULT_FEED_URL,
          fetchedAt: new Date().toISOString(),
          isFallback: true,
          error: "Karo feed promise rejected",
        };

  const linkedResult =
    linkedSettled.status === "fulfilled"
      ? linkedSettled.value
      : {
          events: [] as NormalizedEvent[],
          error: "Linked Events promise rejected",
        };

  const liveKaroEvents = !karoResult.isFallback ? karoResult.events : [];
  const liveLinkedEvents = linkedResult.events;
  const combinedLive = deduplicateAndSortEvents([
    ...liveKaroEvents,
    ...liveLinkedEvents,
  ]);

  const hasLiveEvents = combinedLive.length > 0;
  const baseEvents = hasLiveEvents ? combinedLive : FALLBACK_EVENTS;
  const usedFallback = !hasLiveEvents;
  const filteredEvents = filterEvents(baseEvents, req);

  const cityCounts = filteredEvents.reduce<Record<string, number>>((acc, evt) => {
    const key = evt.city || "Tuntematon";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const warnings = [
    karoResult.error ? `Karo: ${karoResult.error}` : null,
    linkedResult.error ? `LinkedEvents: ${linkedResult.error}` : null,
  ].filter(Boolean);

  return NextResponse.json(
    {
      events: filteredEvents,
      total: filteredEvents.length,
      sources: {
        karoCount: liveKaroEvents.length,
        linkedEventsCount: liveLinkedEvents.length,
        byCity: cityCounts,
      },
      sourceUrl: karoResult.sourceUrl,
      fetchedAt: karoResult.fetchedAt,
      isFallback: usedFallback,
      ...(warnings.length > 0 ? { warning: warnings.join(" | ") } : {}),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}