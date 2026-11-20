import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_FEED_URL,
  fetchNormalizedEvents,
  type NormalizedEvent,
} from "../../akotestaa/shellproto/eventFeedClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINKED_EVENTS_URL =
  "https://api.hel.fi/linkedevents/v1/event/?start=today&keyword_OR=yso:p4354,yso:p13050,yso:p4363,yso:p10557,yso:p11017,yso:p2771&include=location,keywords&page_size=50";

async function fetchLinkedEvents(): Promise<NormalizedEvent[]> {
  try {
    const res = await fetch(LINKED_EVENTS_URL, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];

    const payload = (await res.json()) as {
      data?: Array<Record<string, unknown>>;
    };
    const rows = Array.isArray(payload?.data) ? payload.data : [];

    return rows.flatMap((raw) => {
      if (raw.event_status === "EventCancelled") return [];
      const id = String(raw.id ?? "").trim();
      const nameObj = raw.name as { fi?: string; en?: string } | undefined;
      const title = (nameObj?.fi || nameObj?.en || "").trim();
      const startDate =
        typeof raw.start_time === "string" ? raw.start_time : "";
      if (!id || !title || !startDate || /^peruttu:/i.test(title)) return [];

      const loc = raw.location as
        | {
            name?: { fi?: string };
            address_locality?: { fi?: string };
            position?: { coordinates?: [number, number] };
          }
        | undefined;

      const coords = loc?.position?.coordinates;
      const coordinates =
        Array.isArray(coords) && coords.length >= 2
          ? { lat: coords[1], lng: coords[0] }
          : undefined;

      return [
        {
          id: `le-${id}`,
          title,
          startDate,
          locationName: loc?.name?.fi,
          city: loc?.address_locality?.fi || "Helsinki",
          coordinates,
          ageRangeLabel: "Lapset & perheet",
          tags: ["linked-events"],
          source: "linked-events-pks",
        },
      ];
    });
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const [karoRes, linkedEvents] = await Promise.all([
    fetchNormalizedEvents({ feedUrl: DEFAULT_FEED_URL, timeoutMs: 8000 }),
    fetchLinkedEvents(),
  ]);

  const karoEvents = !karoRes.isFallback ? karoRes.events : [];
  let combined = [...karoEvents, ...linkedEvents];

  const city = req.nextUrl.searchParams.get("city")?.trim().toLowerCase();
  if (city && city !== "all") {
    combined = combined.filter((e) =>
      (e.city || "").toLowerCase().includes(city)
    );
  }

  const byCity = combined.reduce<Record<string, number>>((acc, e) => {
    const k = e.city || "Tuntematon";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    events: combined,
    total: combined.length,
    sources: {
      karoCount: karoEvents.length,
      linkedEventsCount: linkedEvents.length,
      byCity,
    },
    isFallback: combined.length === 0,
  });
}