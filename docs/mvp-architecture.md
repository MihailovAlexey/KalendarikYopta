# MVP Architecture

## Цель

Собрать Telegram Mini App без собственного сервера в классическом смысле: без VPS, без ручной настройки Postgres, без Nginx и без отдельной операционки под backend.

## Рекомендованная схема

### Frontend

- `Vite + React + TypeScript`
- деплой как обычного статического сайта;
- варианты хостинга:
  - `Cloudflare Pages`;
  - `Vercel`.

### Backend

- `Supabase`
  - `Postgres` как managed database;
  - `Table Editor` для ручного управления мероприятиями на старте;
  - `Edge Functions` для серверной логики;
  - `Cron` для запуска уведомлений.

### Telegram

- отдельный Telegram-бот;
- бот открывает Mini App;
- бот же отправляет уведомления подписанным пользователям;
- webhook бота обрабатывается через `Supabase Edge Function`.

## Почему это простой путь

- не нужно администрировать сервер;
- не нужно поднимать базу вручную;
- данные можно редактировать через веб-интерфейс;
- backend можно развивать постепенно;
- MVP можно запустить достаточно быстро.

## Состав MVP

### Обязательно

- таблица `events`;
- таблица `event_subscriptions`;
- таблица `admins`;
- Mini App со списком и календарем;
- карточка мероприятия;
- подписка на напоминание;
- уведомление через бота.

### Можно отложить

- собственная админка;
- медиа-галерея мероприятий;
- импорт из Excel/Google Sheets;
- несколько уровней ролей.

## Таблицы данных

### `events`

- `id`
- `title`
- `slug`
- `start_date`
- `end_date`
- `place`
- `city`
- `external_url`
- `comment`
- `color`
- `status`
- `registration_deadline`
- `tags`
- `created_at`
- `updated_at`

### `event_subscriptions`

- `id`
- `event_id`
- `telegram_user_id`
- `telegram_username`
- `notify_24h`
- `notify_3h`
- `created_at`

### `admins`

- `id`
- `telegram_user_id`
- `role`
- `created_at`

## Права доступа

### Пользователь

- читает только опубликованные мероприятия;
- может подписаться только на себя;
- не может редактировать события.

### Администратор

- создает и изменяет мероприятия;
- видит все статусы;
- видит подписки;
- управляет публикацией.

## Деплой без боли

### Что нужно будет реально поднять

1. Проект в `Supabase`.
2. Статический frontend на `Cloudflare Pages` или `Vercel`.
3. Telegram-бот через `@BotFather`.
4. Webhook на `Supabase Edge Function`.

### Что не нужно

- VPS;
- Docker на сервере;
- ручная установка Postgres;
- nginx-конфиги;
- systemd и фоновые процессы.

## Следующий технический этап

1. Подключить Telegram Mini App SDK.
2. Настроить Supabase-проект.
3. Описать SQL-схему.
4. Подключить frontend к таблице `events`.
5. Добавить подписки и бота.

