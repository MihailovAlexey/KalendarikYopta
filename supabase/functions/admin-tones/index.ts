import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/admin.ts";

type TonePayload = {
  tone?: "violet" | "coral" | "sky" | "amber" | "teal";
  label?: string;
};

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
        .from("event_tones")
        .select("tone, label")
        .order("tone", { ascending: true });

      if (error) {
        throw error;
      }

      return jsonResponse({ ok: true, tones: data ?? [] });
    }

    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const payload = (await req.json()) as TonePayload;
    if (!payload.tone || !payload.label?.trim()) {
      return jsonResponse({ ok: false, error: "tone and label are required." }, { status: 400 });
    }

    const { error } = await auth.supabase.from("event_tones").upsert(
      {
        tone: payload.tone,
        label: payload.label.trim(),
      },
      {
        onConflict: "tone",
      },
    );

    if (error) {
      throw error;
    }

    return jsonResponse({ ok: true, tone: payload.tone, label: payload.label.trim() });
  } catch (error) {
    console.error("admin-tones failed", error);
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
});
