import type { CalendarEvent } from "../types";
import type { ToneLabelMap } from "../data/toneLabels";
import { getTelegramInitData, isTelegramWebAppAvailable } from "./telegramWebApp";

type AdminSessionResponse = {
  ok: boolean;
  isAdmin: boolean;
  user?: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  } | null;
  role?: string;
  error?: string;
};

type AdminEventRow = {
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
};

type AdminEventsResponse = {
  ok: boolean;
  events?: AdminEventRow[];
  error?: string;
};

type AdminTonesResponse = {
  ok: boolean;
  tones?: Array<{ tone: keyof ToneLabelMap; label: string }>;
  error?: string;
};

export type EditableEvent = CalendarEvent & {
  originalSlug: string;
};

function mapAdminEventRow(row: AdminEventRow): EditableEvent {
  return {
    id: row.slug,
    originalSlug: row.slug,
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

function getAdminHeaders() {
  const initData = getTelegramInitData();
  return {
    "Content-Type": "application/json",
    "x-telegram-init-data": initData,
  };
}

function getFunctionsBaseUrl() {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
}

function mapToneRows(rows: Array<{ tone: keyof ToneLabelMap; label: string }>) {
  return rows.reduce<ToneLabelMap>(
    (accumulator, row) => {
      accumulator[row.tone] = row.label;
      return accumulator;
    },
    {
      violet: "Главный этап",
      coral: "Фестиваль",
      sky: "Выезд / шоу",
      amber: "Локальный ивент",
      teal: "Регистрация горит",
    },
  );
}

export function createEmptyEditableEvent(): EditableEvent {
  const today = new Date().toISOString().slice(0, 10);
  return {
    originalSlug: "",
    id: "",
    title: "",
    startDate: today,
    emoji: "📍",
    place: "",
    city: "",
    tone: "sky",
    status: "draft",
  };
}

export async function getAdminSession() {
  if (!isTelegramWebAppAvailable() || !getTelegramInitData()) {
    return { ok: false, isAdmin: false, error: "Telegram session is not available." };
  }

  const response = await fetch(`${getFunctionsBaseUrl()}/admin-session`, {
    headers: getAdminHeaders(),
  });
  return (await response.json()) as AdminSessionResponse;
}

export async function loadAdminEvents() {
  const response = await fetch(`${getFunctionsBaseUrl()}/admin-events`, {
    headers: getAdminHeaders(),
  });
  const json = (await response.json()) as AdminEventsResponse;

  return {
    ok: json.ok,
    error: json.error,
    events: (json.events ?? []).map(mapAdminEventRow),
  };
}

export async function loadAdminTones() {
  const response = await fetch(`${getFunctionsBaseUrl()}/admin-tones`, {
    headers: getAdminHeaders(),
  });
  const json = (await response.json()) as AdminTonesResponse;

  return {
    ok: json.ok,
    error: json.error,
    toneLabels: mapToneRows(json.tones ?? []),
  };
}

export async function saveAdminTone(tone: keyof ToneLabelMap, label: string) {
  const response = await fetch(`${getFunctionsBaseUrl()}/admin-tones`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({
      tone,
      label,
    }),
  });

  return (await response.json()) as { ok: boolean; error?: string };
}

export async function saveAdminEvent(event: EditableEvent) {
  const response = await fetch(`${getFunctionsBaseUrl()}/admin-events`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({
      originalSlug: event.originalSlug || undefined,
      event: {
        slug: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        emoji: event.emoji,
        place: event.place,
        city: event.city,
        link: event.link,
        comment: event.comment,
        tone: event.tone,
        status: event.status,
        registrationDeadline: event.registrationDeadline,
      },
    }),
  });

  const json = (await response.json()) as { ok: boolean; error?: string };
  return json;
}
