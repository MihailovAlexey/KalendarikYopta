import { getSupabasePublicKey, isSupabaseConfigured } from "./supabase";
import { getTelegramInitData, isTelegramWebAppAvailable } from "./telegramWebApp";

type SubscriptionAction = "subscribe" | "unsubscribe";

type SubscriptionResponse = {
  ok?: boolean;
  error?: string;
  action?: SubscriptionAction;
  title?: string;
};

export async function syncEventSubscription(
  eventSlug: string,
  action: SubscriptionAction,
) {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      mode: "local" as const,
      message: "Supabase не настроен. Пока меняем подписку только локально.",
    };
  }

  if (!isTelegramWebAppAvailable()) {
    return {
      ok: false,
      mode: "local" as const,
      message:
        "Приложение открыто вне Telegram. Реальная подписка станет доступна внутри Mini App.",
    };
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
  const publicKey = getSupabasePublicKey();
  const initData = getTelegramInitData();

  if (!initData || !publicKey) {
    return {
      ok: false,
      mode: "local" as const,
      message: "Telegram initData или Supabase key недоступны. Подписка не подтверждена сервером.",
    };
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/event-subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publicKey,
      Authorization: `Bearer ${publicKey}`,
      "x-telegram-init-data": initData,
    },
    body: JSON.stringify({
      eventSlug,
      action,
    }),
  });

  const json = (await response.json()) as SubscriptionResponse;

  if (!response.ok || !json.ok) {
    return {
      ok: false,
      mode: "remote" as const,
      message: json.error ?? "Не удалось обновить подписку.",
    };
  }

  return {
    ok: true,
    mode: "remote" as const,
    message:
      action === "subscribe"
        ? `Подписка на "${json.title ?? eventSlug}" сохранена.`
        : `Подписка на "${json.title ?? eventSlug}" отключена.`,
  };
}
