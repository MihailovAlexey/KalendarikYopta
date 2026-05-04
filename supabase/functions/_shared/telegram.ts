const encoder = new TextEncoder();

type TelegramWebAppUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type TelegramWebAppSession = {
  authDate: number;
  queryId?: string;
  user: TelegramWebAppUser;
};

async function hmacSha256Raw(key: string | Uint8Array, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? encoder.encode(key) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
  return new Uint8Array(signature);
}

async function hmacSha256Hex(key: string | Uint8Array, value: string) {
  const bytes = await hmacSha256Raw(key, value);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userRaw = params.get("user");

  if (!hash || !authDate || !userRaw) {
    throw new Error("Missing hash, auth_date or user in initData.");
  }

  const sortedPairs = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`);

  return {
    authDate,
    hash,
    dataCheckString: sortedPairs.join("\n"),
    queryId: params.get("query_id") ?? undefined,
    user: JSON.parse(userRaw) as TelegramWebAppUser,
  };
}

export async function verifyTelegramWebAppData(initData: string, botToken: string) {
  const normalized = normalizeInitData(initData);
  const secretKey = await hmacSha256Raw("WebAppData", botToken);
  const computedHash = await hmacSha256Hex(secretKey, normalized.dataCheckString);

  if (computedHash !== normalized.hash) {
    throw new Error("Telegram initData hash mismatch.");
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - normalized.authDate;
  if (ageSeconds > 60 * 60 * 24) {
    throw new Error("Telegram initData is too old.");
  }

  return {
    authDate: normalized.authDate,
    queryId: normalized.queryId,
    user: normalized.user,
  } satisfies TelegramWebAppSession;
}

export async function telegramApi<TResponse>(
  botToken: string,
  method: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();
  if (!response.ok || !json.ok) {
    throw new Error(
      `Telegram API ${method} failed: ${json.description ?? response.statusText}`,
    );
  }

  return json.result as TResponse;
}

export function buildMiniAppKeyboard(miniAppUrl: string) {
  return {
    inline_keyboard: [
      [
        {
          text: "Открыть календарь",
          web_app: {
            url: miniAppUrl,
          },
        },
      ],
    ],
  };
}
