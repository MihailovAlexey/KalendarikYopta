import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyTelegramWebAppData } from "./telegram.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

export async function requireAdmin(headers: Headers) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN secret.");
  }

  const initData = headers.get("x-telegram-init-data");
  if (!initData) {
    return {
      ok: false as const,
      status: 401,
      error: "Missing x-telegram-init-data header.",
    };
  }

  const telegramSession = await verifyTelegramWebAppData(initData, botToken);
  const { data: adminRow, error } = await supabase
    .from("admins")
    .select("id, role")
    .eq("telegram_user_id", telegramSession.user.id)
    .single();

  if (error || !adminRow) {
    return {
      ok: false as const,
      status: 403,
      error: "Admin access denied.",
      user: telegramSession.user,
    };
  }

  return {
    ok: true as const,
    user: telegramSession.user,
    admin: adminRow,
    supabase,
  };
}

