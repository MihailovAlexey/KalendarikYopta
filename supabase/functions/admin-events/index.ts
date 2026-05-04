import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/admin.ts";

type EventTone = "violet" | "coral" | "sky" | "amber" | "teal";
type EventStatus = "published" | "draft" | "cancelled";

type AdminEventPayload = {
  originalSlug?: string;
  event?: {
    slug: string;
    title: string;
    startDate: string;
    endDate?: string;
    emoji: string;
    place: string;
    city: string;
    link?: string;
    comment?: string;
    tone: EventTone;
    status: EventStatus;
    registrationDeadline?: string;
  };
};

function normalizeText(value?: string | null) {
  const next = value?.trim();
  return next ? next : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = await requireAdmin(req.headers);
    if (!auth.ok) {
      return jsonResponse({ ok: false, error: auth.error }, { status: auth.status });
    }

    if (req.method === "GET") {
      const { data, error } = await auth.supabase
        .from("events")
        .select(
          "slug, title, start_date, end_date, emoji, place, city, external_url, comment, tone, status, registration_deadline",
        )
        .order("start_date", { ascending: true });

      if (error) {
        throw error;
      }

      return jsonResponse({ ok: true, events: data ?? [] });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, { status: 405 });
    }

    const payload = (await req.json()) as AdminEventPayload;
    const event = payload.event;
    if (!event) {
      return jsonResponse({ ok: false, error: "Missing event payload." }, { status: 400 });
    }

    const normalizedSlug = event.slug.trim();
    if (!normalizedSlug || !event.title.trim() || !event.startDate.trim()) {
      return jsonResponse(
        { ok: false, error: "slug, title and startDate are required." },
        { status: 400 },
      );
    }

    const eventData = {
      slug: normalizedSlug,
      title: event.title.trim(),
      start_date: event.startDate,
      end_date: normalizeText(event.endDate),
      emoji: event.emoji.trim() || "📍",
      place: event.place.trim(),
      city: event.city.trim(),
      external_url: normalizeText(event.link),
      comment: normalizeText(event.comment),
      tone: event.tone,
      status: event.status,
      registration_deadline: normalizeText(event.registrationDeadline),
      tags: [],
    };

    if (payload.originalSlug && payload.originalSlug !== normalizedSlug) {
      const { error } = await auth.supabase
        .from("events")
        .update(eventData)
        .eq("slug", payload.originalSlug);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await auth.supabase.from("events").upsert(eventData, {
        onConflict: "slug",
      });

      if (error) {
        throw error;
      }
    }

    return jsonResponse({ ok: true, slug: normalizedSlug });
  } catch (error) {
    console.error("admin-events failed", error);
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
});
