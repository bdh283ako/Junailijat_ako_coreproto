"use client";

import React from "react";
import { buildGoogleCalendarUrl } from "@/lib/googleCalendar";
import type { NormalizedEvent } from "./eventFeedClient";

export interface EventCardProps {
  event: NormalizedEvent;
  isSelected?: boolean;
  onSelect?: (event: NormalizedEvent) => void;
}

export function EventCard({
  event,
  isSelected = false,
  onSelect,
}: EventCardProps) {
  const gcalUrl = buildGoogleCalendarUrl(event);

  const formattedTime = new Date(event.startDate).toLocaleString("fi-FI", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <article
      onClick={() => onSelect?.(event)}
      className={`flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition ${
        isSelected
          ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
          : "border-slate-200 bg-white hover:border-slate-300"
      } ${onSelect ? "cursor-pointer" : ""}`}
    >
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">
            {formattedTime}
          </span>

          <span
            className="inline-flex items-center rounded-full border border-[#2F5D50]/40 bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-ink)]"
            title="Ikähaarukka syötteestä"
          >
            Ikä: {event.ageRangeLabel}
          </span>
        </div>

        <h3 className="text-base font-semibold text-slate-900">
          {event.title}
        </h3>

        {(event.locationName || event.address) && (
          <p className="mt-1 text-sm text-slate-600">
            {[event.locationName, event.address].filter(Boolean).join(" — ")}
          </p>
        )}

        {event.description && (
          <p className="mt-2 line-clamp-2 text-sm text-slate-600">
            {event.description}
          </p>
        )}

        {event.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {event.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div
        className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={gcalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
        >
          Lisää Google Kalenteriin
        </a>

        {event.url && (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Tapahtumasivu →
          </a>
        )}
      </div>
    </article>
  );
}