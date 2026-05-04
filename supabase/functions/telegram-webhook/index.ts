import { buildMiniAppKeyboard, telegramApi } from "../_shared/telegram.ts";
import { jsonResponse } from "../_shared/cors.ts";

type TelegramMessage = {
  chat?: { id: number };
  from?: { first_name?: string };
  text?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

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

    if (text === "/start" || text === "/calendar") {
      const firstName = message.from?.first_name ?? "друг";
      await telegramApi(botToken, "sendMessage", {
        chat_id: chatId,
        text:
          `Привет, ${firstName}.\n\n` +
          "Это календарь летних мероприятий. Открой мини-приложение кнопкой ниже, чтобы посмотреть события и подписаться на напоминания.",
        reply_markup: buildMiniAppKeyboard(miniAppUrl),
      });
    } else if (text === "/help") {
      await telegramApi(botToken, "sendMessage", {
        chat_id: chatId,
        text:
          "/start или /calendar — открыть календарь\n" +
          "/help — показать эту подсказку",
      });
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

