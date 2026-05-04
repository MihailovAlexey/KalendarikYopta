import { events as fallbackEvents } from "../data/events";
import type { CalendarEvent } from "../types";
import { isSupabaseConfigured, supabase } from "./supabase";

type EventRow = {
  slug: string;
  title: string;
  start_date: string;
  end_date: string | null;
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
  source: "local" | "supabase";
  message: string;
};

function mapEventRow(row: EventRow): CalendarEvent {
  return {
    id: row.slug,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    place: row.place,
    city: row.city,
    link: row.external_url ?? undefined,
    comment: row.comment ?? undefined,
    tone: row.tone,
    status: row.status,
    registrationDeadline: row.registration_deadline ?? undefined,
    tags: row.tags ?? [],
  };
}

export async function loadEvents(): Promise<EventLoadResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      events: fallbackEvents,
      source: "local",
      message: "Supabase не настроен, включен локальный демо-режим.",
    };
  }

  const { data, error } = await supabase
    .from("events")
    .select(
      "slug, title, start_date, end_date, place, city, external_url, comment, tone, status, registration_deadline, tags",
    )
    .eq("status", "published")
    .order("start_date", { ascending: true });

  if (error) {
    console.error("Supabase events load failed:", error);
    return {
      events: fallbackEvents,
      source: "local",
      message: "Не удалось получить события из Supabase, оставлен локальный fallback.",
    };
  }

  if (!data || data.length === 0) {
    return {
      events: fallbackEvents,
      source: "local",
      message: "Таблица events пока пустая, показаны локальные тестовые данные.",
    };
  }

  return {
    events: data.map(mapEventRow),
    source: "supabase",
    message: "События загружены из Supabase.",
  };
}

