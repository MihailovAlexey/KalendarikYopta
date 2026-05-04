import { events as fallbackEvents } from "../data/events";
import { fallbackToneLabels, type ToneLabelMap } from "../data/toneLabels";
import type { CalendarEvent } from "../types";
import { isSupabaseConfigured, supabase } from "./supabase";

type EventRow = {
  slug: string;
  title: string;
  start_date: string;
  end_date: string | null;
  emoji: string | null;
  place: string;
  city: string;
  external_url: string | null;
  comment: string | null;
  tone: CalendarEvent["tone"];
  status: CalendarEvent["status"];
  registration_deadline: string | null;
  tags: string[] | null;
};

export type EventLoadResult = {
  events: CalendarEvent[];
  toneLabels: ToneLabelMap;
  source: "local" | "supabase";
  message: string;
};

type ToneRow = {
  tone: keyof ToneLabelMap;
  label: string;
};

function mapEventRow(row: EventRow): CalendarEvent {
  return {
    id: row.slug,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    emoji: row.emoji ?? "📍",
    place: row.place,
    city: row.city,
    link: row.external_url ?? undefined,
    comment: row.comment ?? undefined,
    tone: row.tone,
    status: row.status,
    registrationDeadline: row.registration_deadline ?? undefined,
  };
}

function mapToneRows(rows: ToneRow[] | null | undefined): ToneLabelMap {
  const nextLabels: ToneLabelMap = { ...fallbackToneLabels };

  for (const row of rows ?? []) {
    nextLabels[row.tone] = row.label;
  }

  return nextLabels;
}

export async function loadEvents(): Promise<EventLoadResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      events: fallbackEvents,
      toneLabels: fallbackToneLabels,
      source: "local",
      message: "Supabase не настроен, включен локальный демо-режим.",
    };
  }

  const [eventsResult, tonesResult] = await Promise.all([
    supabase
      .from("events")
      .select(
        "slug, title, start_date, end_date, emoji, place, city, external_url, comment, tone, status, registration_deadline, tags",
      )
      .eq("status", "published")
      .order("start_date", { ascending: true }),
    supabase.from("event_tones").select("tone, label"),
  ]);

  const { data, error } = eventsResult;
  const toneLabels = mapToneRows(tonesResult.data as ToneRow[] | null | undefined);

  if (error) {
    console.error("Supabase events load failed:", error);
    return {
      events: fallbackEvents,
      toneLabels,
      source: "local",
      message: "Не удалось получить события из Supabase, оставлен локальный fallback.",
    };
  }

  if (!data || data.length === 0) {
    return {
      events: fallbackEvents,
      toneLabels,
      source: "local",
      message: "Таблица events пока пустая, показаны локальные тестовые данные.",
    };
  }

  return {
    events: data.map(mapEventRow),
    toneLabels,
    source: "supabase",
    message: "События загружены из Supabase.",
  };
}
