export type TelegramMiniAppUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramThemeParams = {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  button_color?: string;
  button_text_color?: string;
};

type TelegramWebAppRuntime = {
  ready?: () => void;
  expand?: () => void;
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramMiniAppUser;
  };
  colorScheme?: "light" | "dark";
  themeParams?: TelegramThemeParams;
};

function getWebAppRuntime(): TelegramWebAppRuntime | undefined {
  return window.Telegram?.WebApp;
}

export function initializeTelegramWebApp() {
  const webApp = getWebAppRuntime();
  webApp?.ready?.();
  webApp?.expand?.();
  return webApp;
}

export function getTelegramInitData() {
  return getWebAppRuntime()?.initData ?? "";
}

export function getTelegramUser() {
  return getWebAppRuntime()?.initDataUnsafe?.user;
}

export function isTelegramWebAppAvailable() {
  return Boolean(getWebAppRuntime());
}

