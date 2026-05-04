# Telegram Bot Setup

## Что уже готово в репозитории

- Mini App frontend;
- edge function `telegram-webhook`;
- edge function `event-subscribe`;
- edge function `send-reminders`.

## Что нужно сделать руками

### 1. Создать бота

Через `@BotFather`:

- `/newbot`
- задать имя;
- получить `TELEGRAM_BOT_TOKEN`

### 2. Подготовить публичный URL Mini App

Подойдет:

- `Cloudflare Pages`
- `Vercel`

После деплоя появится URL приложения, его нужно сохранить как `TELEGRAM_MINI_APP_URL`.

### 3. Настроить Supabase

1. Создать проект.
2. Выполнить [schema.sql](../supabase/schema.sql).
3. Выполнить [seed.sql](../supabase/seed.sql).
4. Добавить secrets:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_MINI_APP_URL`

### 4. Задеплоить Edge Functions

Нужны функции:

- `telegram-webhook`
- `event-subscribe`
- `send-reminders`

### 5. Прописать webhook Telegram-бота

URL webhook будет таким:

`https://<project-ref>.supabase.co/functions/v1/telegram-webhook`

Запрос к Bot API:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<project-ref>.supabase.co/functions/v1/telegram-webhook"}'
```

### 6. Проверить сценарий

1. Открыть чат с ботом.
2. Отправить `/start`.
3. Нажать кнопку открытия календаря.
4. Открыть Mini App.
5. Нажать подписку на событие.
6. Проверить, что запись появилась в `event_subscriptions`.

## Как работают подписки

- фронтенд отправляет `eventSlug`;
- edge function читает `Telegram.WebApp.initData`;
- сервер валидирует подпись Telegram;
- подписка пишется в `event_subscriptions`.

## Как работают напоминания

- `send-reminders` ищет подписки на события;
- если событие скоро начнется, функция шлет сообщение через Bot API;
- после отправки пишет `last_reminder_24h_at` или `last_reminder_3h_at`, чтобы не дублировать сообщение.
