import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/cors.ts";
import { telegramApi } from "../_shared/telegram.ts";

type ReminderRow = {
  subscription_id: string;
  telegram_user_id: number;
  notify_24h: boolean;
  notify_3h: boolean;
  last_reminder_24h_at: string | null;
  last_reminder_3h_at: string | null;
  event_id: string;
  title: string;
  slug: string;
  place: string;
  city: string;
  start_date: string;
  external_url: string | null;
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

function dateDiffHours(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60);
}

function parseDateUtc(dateString: string) {
  return new Date(`${dateString}T12:00:00.000Z`);
}

function formatReminderText(event: ReminderRow, hoursBeforeStart: 24 | 3) {
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(parseDateUtc(event.start_date));

  const linkLine = event.external_url ? `\nСсылка: ${event.external_url}` : "";

  return (
    `Напоминание: через ${hoursBeforeStart} ч. мероприятие "${event.title}".\n` +
    `Дата: ${dateLabel}\n` +
    `Место: ${event.place}, ${event.city}${linkLine}`
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("Missing TELEGRAM_BOT_TOKEN secret.");
    }

    const { data, error } = await supabase
      .from("event_subscriptions")
      .select(
        `
          id,
          telegram_user_id,
          notify_24h,
          notify_3h,
          last_reminder_24h_at,
          last_reminder_3h_at,
          events!inner (
            id,
            title,
            slug,
            place,
            city,
            start_date,
            external_url,
            status
          )
        `,
      )
      .eq("events.status", "published");

    if (error) {
      throw error;
    }

    const now = new Date();
    const reminders: Array<{ subscriptionId: string; reminderType: 24 | 3 }> = [];

    for (const row of data ?? []) {
      const event = Array.isArray(row.events) ? row.events[0] : row.events;
      if (!event) {
        continue;
      }

      const reminderRow: ReminderRow = {
        subscription_id: row.id,
        telegram_user_id: row.telegram_user_id,
        notify_24h: row.notify_24h,
        notify_3h: row.notify_3h,
        last_reminder_24h_at: row.last_reminder_24h_at,
        last_reminder_3h_at: row.last_reminder_3h_at,
        event_id: event.id,
        title: event.title,
        slug: event.slug,
        place: event.place,
        city: event.city,
        start_date: event.start_date,
        external_url: event.external_url,
      };

      const startsAt = parseDateUtc(reminderRow.start_date);
      const hoursUntilStart = dateDiffHours(now, startsAt);

      if (
        reminderRow.notify_24h &&
        !reminderRow.last_reminder_24h_at &&
        hoursUntilStart <= 24 &&
        hoursUntilStart > 3
      ) {
        await telegramApi(botToken, "sendMessage", {
          chat_id: reminderRow.telegram_user_id,
          text: formatReminderText(reminderRow, 24),
        });

        reminders.push({
          subscriptionId: reminderRow.subscription_id,
          reminderType: 24,
        });
      }

      if (
        reminderRow.notify_3h &&
        !reminderRow.last_reminder_3h_at &&
        hoursUntilStart <= 3 &&
        hoursUntilStart > 0
      ) {
        await telegramApi(botToken, "sendMessage", {
          chat_id: reminderRow.telegram_user_id,
          text: formatReminderText(reminderRow, 3),
        });

        reminders.push({
          subscriptionId: reminderRow.subscription_id,
          reminderType: 3,
        });
      }
    }

    for (const reminder of reminders) {
      const field =
        reminder.reminderType === 24 ? "last_reminder_24h_at" : "last_reminder_3h_at";

      const { error: updateError } = await supabase
        .from("event_subscriptions")
        .update({ [field]: new Date().toISOString() })
        .eq("id", reminder.subscriptionId);

      if (updateError) {
        throw updateError;
      }
    }

    return jsonResponse({
      ok: true,
      remindersSent: reminders.length,
    });
  } catch (error) {
    console.error("send-reminders failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 500 },
    );
  }
});
