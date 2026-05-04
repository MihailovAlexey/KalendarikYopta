# Календарик

Стартовый frontend-каркас для Telegram Mini App с календарем мероприятий.

## Что уже есть

- адаптивный экран календаря и списка мероприятий;
- стартовые данные на сезон;
- темная визуальная тема на основе Figma-референса по цветам;
- документация по требованиям и архитектуре MVP.

## Технологии

- `Vite`
- `React`
- `TypeScript`

## Локальный запуск

Нужны `node` и `npm`.

```bash
npm install
npm run dev
```

## Подключение Supabase

1. Создать проект в `Supabase`.
2. Выполнить SQL из [supabase/schema.sql](./supabase/schema.sql).
3. При необходимости заполнить тестовые событиями из [supabase/seed.sql](./supabase/seed.sql).
4. Скопировать `.env.example` в `.env` и заполнить:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Если `.env` не заполнен, приложение запустится в локальном демо-режиме на встроенных данных.

## Edge Functions

В репозитории уже подготовлены функции:

- `supabase/functions/telegram-webhook`
- `supabase/functions/event-subscribe`
- `supabase/functions/send-reminders`

Что понадобится из секретов в Supabase:

```bash
TELEGRAM_BOT_TOKEN=...
TELEGRAM_MINI_APP_URL=https://your-mini-app-url.example
```

Пример логики:

- `telegram-webhook` отвечает на `/start` и отдает кнопку открытия Mini App;
- `event-subscribe` принимает подписку из Mini App и валидирует `Telegram.WebApp.initData`;
- `send-reminders` отправляет напоминания подписанным пользователям.

Для напоминаний далее можно повесить cron-задачу на вызов `send-reminders` раз в 15-30 минут.

## Что дальше

1. Создать бота через `@BotFather`.
2. Развернуть frontend на публичный URL.
3. Создать проект в Supabase и залить SQL.
4. Задеплоить edge functions и прописать webhook.
5. Проверить подписку на событие уже внутри Telegram.

## Документация

- [Стартовые требования](./docs/start-requirements.md)
- [Архитектура MVP](./docs/mvp-architecture.md)
- [Настройка Telegram-бота](./docs/telegram-bot-setup.md)
