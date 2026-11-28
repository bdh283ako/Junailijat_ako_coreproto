"use client";

import React, { useEffect, useMemo, useState } from "react";
import { EventCard } from "@/components/EventCard";
import type { NormalizedEvent } from "../app/(frontend)/akotestaa/shellproto/eventFeedClient";

interface EventsApiResponse {
  events: NormalizedEvent[];
  total: number;
  sourceUrl: string;
  fetchedAt: string;
  isFallback: boolean;
  warning?: string;
}

type AgeBucketId = "all" | "0-2" | "3-6" | "7-12" | "all-ages";

const AGE_BUCKETS: { id: AgeBucketId; label: string }[] = [
  { id: "all", label: "Kaikki ikäryhmät" },
  { id: "0-2", label: "0–2 v" },
  { id: "3-6", label: "3–6 v" },
  { id: "7-12", label: "7–12 v" },
  { id: "all-ages", label: "Koko perhe" },
];

const CITIES = ["Kaikki", "Helsinki", "Espoo", "Vantaa"] as const;

function matchesAgeBucket(ageRangeLabel: string, bucket: AgeBucketId): boolean {
  if (bucket === "all") return true;

  const normalized = ageRangeLabel.toLowerCase().trim();

  if (
    normalized.includes("kaikki ikäryhmät") ||
    normalized.includes("koko perhe")
  ) {
    return bucket === "all-ages";
  }

  if (bucket === "all-ages") {
    return false;
  }

  const [bucketMin, bucketMax] =
    bucket === "0-2" ? [0, 2] : bucket === "3-6" ? [3, 6] : [7, 12];

  const rangeMatch = normalized.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    return min <= bucketMax && max >= bucketMin;
  }

  const underMatch = normalized.match(/alle\s+(\d{1,2})/);
  if (underMatch) {
    const max = Number(underMatch[1]);
    return 0 <= bucketMax && max >= bucketMin;
  }

  const plusMatch = normalized.match(/(\d{1,2})\s*\+/);
  if (plusMatch) {
    const min = Number(plusMatch[1]);
    return min <= bucketMax;
  }

  return false;
}

export function GatherHome() {
  const [events, setEvents] = useState<NormalizedEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [selectedAge, setSelectedAge] = useState<AgeBucketId>("all");
  const [selectedCity, setSelectedCity] = useState<string>("Kaikki");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      setIsLoading(true);
      setFetchError(null);

      try {
        const res = await fetch("/api/events", {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          throw new Error(`Rajapinta vastasi virhekoodilla ${res.status}`);
        }

        const data: EventsApiResponse = await res.json();
        if (!isMounted) return;

        setEvents(Array.isArray(data.events) ? data.events : []);
        setIsFallback(Boolean(data.isFallback));
        setFetchedAt(data.fetchedAt ?? null);
      } catch (err) {
        if (!isMounted) return;
        setFetchError(
          err instanceof Error
            ? err.message
            : "Tapahtumien lataus epäonnistui."
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadEvents();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return events.filter((event) => {
      if (!matchesAgeBucket(event.ageRangeLabel, selectedAge)) {
        return false;
      }

      if (selectedCity !== "Kaikki") {
        const cityTarget = selectedCity.toLowerCase();
        const locationText = [
          event.city ?? "",
          event.address ?? "",
          event.locationName ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!locationText.includes(cityTarget)) {
          return false;
        }
      }

      if (q) {
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

        if (!haystack.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [events, selectedAge, selectedCity, searchQuery]);

  const selectedEvent = useMemo(
    () => filteredEvents.find((e) => e.id === selectedEventId) ?? null,
    [filteredEvents, selectedEventId]
  );

  const resetFilters = () => {
    setSelectedAge("all");
    setSelectedCity("Kaikki");
    setSearchQuery("");
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Pääkaupunkiseudun lapsiperhetapahtumat
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Tapahtumasyöte ja kalenterivienti
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Suodata ikähaarukan ja kaupungin mukaan ja vie valitut tapahtumat
            suoraan Google Kalenteriin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 font-medium ${
              isFallback
                ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20"
                : "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20"
            }`}
          >
            {isFallback ? "Varadata käytössä" : "Live-syöte yhdistetty"}
          </span>

          {fetchedAt && (
            <span>
              Päivitetty{" "}
              {new Date(fetchedAt).toLocaleTimeString("fi-FI", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </header>

      <section
        aria-label="Tapahtumien suodattimet"
        className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="mb-2 block text-xs font-semibold text-slate-700">
              Ikähaarukka
            </span>
            <div className="flex flex-wrap gap-1.5">
              {AGE_BUCKETS.map((bucket) => {
                const active = selectedAge === bucket.id;
                return (
                  <button
                    key={bucket.id}
                    type="button"
                    onClick={() => setSelectedAge(bucket.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {bucket.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label
                htmlFor="city-filter"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Kaupunki
              </label>
              <select
                id="city-filter"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-slate-900 focus:outline-none sm:w-36"
              >
                {CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="event-search"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Hae tapahtumaa
              </label>
              <input
                id="event-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Oodi, satu, työpaja..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none sm:w-56"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-3 text-xs text-slate-600">
          <span>
            Näytetään <strong>{filteredEvents.length}</strong> / {events.length}{" "}
            tapahtumaa
          </span>

          {(selectedAge !== "all" ||
            selectedCity !== "Kaikki" ||
            searchQuery.trim() !== "") && (
            <button
              type="button"
              onClick={resetFilters}
              className="font-medium text-slate-900 underline-offset-2 hover:underline"
            >
              Tyhjennä suodattimet
            </button>
          )}
        </div>
      </section>

      {selectedEvent && (
        <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-slate-900 px-4 py-3 text-xs text-white">
          <div>
            <span className="text-slate-400">Valittu tapahtuma: </span>
            <strong className="font-semibold">{selectedEvent.title}</strong>
            {selectedEvent.coordinates && (
              <span className="ml-2 text-slate-300">
                ({selectedEvent.coordinates.lat.toFixed(4)},{" "}
                {selectedEvent.coordinates.lng.toFixed(4)})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSelectedEventId(null)}
            className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20"
          >
            Sulje valinta
          </button>
        </section>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : fetchError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
          <p className="font-semibold">Tapahtumien lataaminen epäonnistui</p>
          <p className="mt-1 text-rose-700">{fetchError}</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-slate-900">
            Valituilla suodattimilla ei löytynyt tapahtumia
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Kokeile laajentaa ikähaarukkaa tai tyhjennä hakuehdot.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Näytä kaikki tapahtumat
          </button>
        </div>
      ) : (
        <section
          aria-label="Tapahtumalista"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              isSelected={event.id === selectedEventId}
              onSelect={(clicked) =>
                setSelectedEventId((prev) =>
                  prev === clicked.id ? null : clicked.id
                )
              }
            />
          ))}
        </section>
      )}
    </main>
  );
}