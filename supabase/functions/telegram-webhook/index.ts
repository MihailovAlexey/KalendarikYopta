import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildMiniAppKeyboard, telegramApi } from "../_shared/telegram.ts";
import { jsonResponse } from "../_shared/cors.ts";

type TelegramMessage = {
  chat?: { id: number; type?: string; title?: string };
  from?: { first_name?: string };
  text?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

type EventRow = {
  title: string;
  start_date: string;
  end_date: string | null;
  place: string;
  city: string;
  external_url: string | null;
};

type TelegramBotProfile = {
  username?: string;
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

function getMoscowDateParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  return {
    year: parts.find((part) => part.type === "year")?.value ?? "1970",
    month: parts.find((part) => part.type === "month")?.value ?? "01",
    day: parts.find((part) => part.type === "day")?.value ?? "01",
  };
}

function getMoscowTodayIso() {
  const { year, month, day } = getMoscowDateParts();
  return `${year}-${month}-${day}`;
}

function parseDate(dateString: string) {
  return new Date(`${dateString}T12:00:00.000Z`);
}

function formatDateRange(event: EventRow) {
  const start = parseDate(event.start_date);
  const end = event.end_date ? parseDate(event.end_date) : null;

  if (!end) {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
    }).format(start);
  }

  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() &&
    start.getUTCFullYear() === end.getUTCFullYear();

  if (sameMonth) {
    const month = new Intl.DateTimeFormat("ru-RU", {
      month: "long",
    }).format(start);

    return `${start.getUTCDate()}-${end.getUTCDate()} ${month}`;
  }

  const startLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(start);

  const endLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(end);

  return `${startLabel} — ${endLabel}`;
}

function formatEventLine(event: EventRow) {
  const linkLine = event.external_url ? `\n${event.external_url}` : "";
  return `• ${formatDateRange(event)} — ${event.title}\n${event.place}, ${event.city}${linkLine}`;
}

function normalizeCommand(text: string) {
  const command = text.split(/\s+/)[0] ?? "";
  return command.toLowerCase().split("@")[0];
}

function getCommandArgs(text: string) {
  const [, ...rest] = text.trim().split(/\s+/);
  return rest.join(" ").trim();
}

function escapeIlike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

async function loadNearEvents(limit: number) {
  const todayIso = getMoscowTodayIso();
  const { data, error } = await supabase
    .from("events")
    .select("title, start_date, end_date, place, city, external_url")
    .eq("status", "published")
    .gte("start_date", todayIso)
    .order("start_date", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data satisfies EventRow[];
}

async function loadTodayEvents() {
  const todayIso = getMoscowTodayIso();
  const { data, error } = await supabase
    .from("events")
    .select("title, start_date, end_date, place, city, external_url")
    .eq("status", "published")
    .lte("start_date", todayIso)
    .or(`end_date.gte.${todayIso},end_date.is.null`)
    .order("start_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).filter((event) => {
    const endDate = event.end_date ?? event.start_date;
    return endDate >= todayIso;
  }) satisfies EventRow[];
}

async function loadCurrentMonthEvents() {
  const { year, month } = getMoscowDateParts();
  const monthStart = `${year}-${month}-01`;
  const monthEnd = `${year}-${month}-31`;
  const { data, error } = await supabase
    .from("events")
    .select("title, start_date, end_date, place, city, external_url")
    .eq("status", "published")
    .gte("start_date", monthStart)
    .lte("start_date", monthEnd)
    .order("start_date", { ascending: true });

  if (error) {
    throw error;
  }

  return data satisfies EventRow[];
}

async function searchEventsByTitle(rawQuery: string, limit = 5) {
  const query = escapeIlike(rawQuery);
  const { data, error } = await supabase
    .from("events")
    .select("title, start_date, end_date, place, city, external_url")
    .eq("status", "published")
    .ilike("title", `%${query}%`)
    .order("start_date", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data satisfies EventRow[];
}

async function sendText(botToken: string, chatId: number, text: string) {
  await telegramApi(botToken, "sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

async function getMiniAppDirectLink(botToken: string) {
  const profile = await telegramApi<TelegramBotProfile>(botToken, "getMe", {});
  if (!profile.username) {
    throw new Error("Bot username is missing in getMe response.");
  }

  return `https://t.me/${profile.username}?startapp`;
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return jsonResponse({
      ok: true,
      message: "Telegram webhook is alive.",
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const miniAppUrl = Deno.env.get("TELEGRAM_MINI_APP_URL");

    if (!botToken || !miniAppUrl) {
      throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_MINI_APP_URL secret.");
    }

    const update = (await req.json()) as TelegramUpdate;
    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim();

    if (!chatId || !text) {
      return jsonResponse({ ok: true, ignored: true });
    }

    const command = normalizeCommand(text);

    if (command === "/start" || command === "/calendar") {
      const firstName = message.from?.first_name ?? "друг";
      const isGroup = message.chat?.type === "group" || message.chat?.type === "supergroup";

      if (isGroup) {
        const directLink = await getMiniAppDirectLink(botToken);
        await sendText(
          botToken,
          chatId,
          `Привет, ${firstName}.\n\nОткрыть календарь из группы можно по прямой ссылке:\n${directLink}`,
        );
      } else {
        await telegramApi(botToken, "sendMessage", {
          chat_id: chatId,
          text:
            `Привет, ${firstName}.\n\n` +
            "Это календарь летних мероприятий. Открой мини-приложение кнопкой ниже, чтобы посмотреть события и подписаться на напоминания.",
          reply_markup: buildMiniAppKeyboard(miniAppUrl),
        });
      }
    } else if (command === "/near") {
      const events = await loadNearEvents(3);
      const reply =
        events.length > 0
          ? `Ближайшие мероприятия:\n\n${events.map(formatEventLine).join("\n\n")}`
          : "Ближайших опубликованных мероприятий пока нет.";
      await sendText(botToken, chatId, reply);
    } else if (command === "/today") {
      const events = await loadTodayEvents();
      const reply =
        events.length > 0
          ? `Сегодня в календаре:\n\n${events.map(formatEventLine).join("\n\n")}`
          : "На сегодня мероприятий в календаре нет.";
      await sendText(botToken, chatId, reply);
    } else if (command === "/month") {
      const events = await loadCurrentMonthEvents();
      const { year, month } = getMoscowDateParts();
      const monthLabel = new Intl.DateTimeFormat("ru-RU", {
        month: "long",
      }).format(parseDate(`${year}-${month}-01`));
      const reply =
        events.length > 0
          ? `Мероприятия на ${monthLabel}:\n\n${events.map(formatEventLine).join("\n\n")}`
          : `На ${monthLabel} опубликованных мероприятий пока нет.`;
      await sendText(botToken, chatId, reply);
    } else if (command === "/find") {
      const query = getCommandArgs(text);
      if (!query) {
        await sendText(
          botToken,
          chatId,
          'Использование: /find <часть названия>\nНапример: /find iddc',
        );
      } else {
        const events = await searchEventsByTitle(query, 5);
        const reply =
          events.length > 0
            ? `Найдено по запросу "${query}":\n\n${events.map(formatEventLine).join("\n\n")}`
            : `По запросу "${query}" ничего не найдено.`;
        await sendText(botToken, chatId, reply);
      }
    } else if (command === "/help") {
      const isGroup = message.chat?.type === "group" || message.chat?.type === "supergroup";
      await sendText(
        botToken,
        chatId,
        [
          isGroup ? "Команды для группы:" : "Доступные команды:",
          "/calendar — открыть календарь",
          "/near — ближайшие 3 мероприятия",
          "/today — что идет сегодня",
          "/month — события текущего месяца",
          "/find <название> — поиск по названию",
          "/help — показать эту подсказку",
        ].join("\n"),
      );
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("telegram-webhook failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 500 },
    );
  }
});
