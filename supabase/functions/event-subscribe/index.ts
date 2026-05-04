import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { verifyTelegramWebAppData } from "../_shared/telegram.ts";

type Action = "subscribe" | "unsubscribe";

type SubscribeRequest = {
  eventSlug?: string;
  action?: Action;
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("Missing TELEGRAM_BOT_TOKEN secret.");
    }

    const initData = req.headers.get("x-telegram-init-data");
    if (!initData) {
      return jsonResponse(
        { error: "Missing x-telegram-init-data header." },
        { status: 401 },
      );
    }

    const payload = (await req.json()) as SubscribeRequest;
    if (!payload.eventSlug || !payload.action) {
      return jsonResponse(
        { error: "eventSlug and action are required." },
        { status: 400 },
      );
    }

    const telegramSession = await verifyTelegramWebAppData(initData, botToken);

    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select("id, title, slug, status")
      .eq("slug", payload.eventSlug)
      .single();

    if (eventError || !eventRow || eventRow.status !== "published") {
      return jsonResponse({ error: "Event not found." }, { status: 404 });
    }

    if (payload.action === "subscribe") {
      const { error } = await supabase.from("event_subscriptions").upsert(
        {
          event_id: eventRow.id,
          telegram_user_id: telegramSession.user.id,
          telegram_username: telegramSession.user.username ?? null,
          notify_24h: true,
          notify_3h: true,
        },
        {
          onConflict: "event_id,telegram_user_id",
        },
      );

      if (error) {
        throw error;
      }

      return jsonResponse({
        ok: true,
        action: "subscribe",
        eventSlug: eventRow.slug,
        title: eventRow.title,
      });
    }

    const { error: deleteError } = await supabase
      .from("event_subscriptions")
      .delete()
      .eq("event_id", eventRow.id)
      .eq("telegram_user_id", telegramSession.user.id);

    if (deleteError) {
      throw deleteError;
    }

    return jsonResponse({
      ok: true,
      action: "unsubscribe",
      eventSlug: eventRow.slug,
      title: eventRow.title,
    });
  } catch (error) {
    console.error("event-subscribe failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 500 },
    );
  }
});

