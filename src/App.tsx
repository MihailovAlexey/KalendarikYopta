import { useEffect, useState } from "react";
import { events as fallbackEvents, toneLabels } from "./data/events";
import {
  buildMonthGrid,
  eventOccursOnDate,
  formatEventDateRange,
  formatMonthLabel,
  getAvailableMonths,
  getEventsForMonth,
  getUpcomingEvent,
  getWeekdayNames,
  isSameDay,
  isSameMonth,
  parseIsoDate,
} from "./lib/calendar";
import { loadEvents } from "./lib/eventStore";
import {
  getTelegramUser,
  initializeTelegramWebApp,
  isTelegramWebAppAvailable,
} from "./lib/telegramWebApp";
import { syncEventSubscription } from "./lib/subscriptions";
import type { CalendarEvent } from "./types";

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>(fallbackEvents);
  const [monthIndex, setMonthIndex] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [subscribedEventIds, setSubscribedEventIds] = useState<string[]>([]);
  const [dataMessage, setDataMessage] = useState("Загружаем данные...");
  const [dataSource, setDataSource] = useState<"local" | "supabase">("local");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState("");
  const [telegramUserName, setTelegramUserName] = useState("");
  const [isTelegramMode, setIsTelegramMode] = useState(false);

  const availableMonths = getAvailableMonths(events);
  const safeMonthIndex =
    availableMonths.length === 0
      ? 0
      : Math.min(monthIndex, Math.max(availableMonths.length - 1, 0));
  const selectedMonth = availableMonths[safeMonthIndex] ?? new Date(2026, 4, 1, 12);
  const monthEvents = getEventsForMonth(events, selectedMonth);
  const selectedEvent = monthEvents.find((event) => event.id === selectedEventId) ?? monthEvents[0];
  const monthGrid = buildMonthGrid(selectedMonth);
  const weekdayNames = getWeekdayNames();
  const nextEvent = getUpcomingEvent(events);
  const cities = [...new Set(events.map((event) => event.city))];

  useEffect(() => {
    initializeTelegramWebApp();
    const user = getTelegramUser();
    setTelegramUserName(user?.first_name ?? user?.username ?? "");
    setIsTelegramMode(isTelegramWebAppAvailable());
  }, []);

  useEffect(() => {
    let isDisposed = false;

    async function bootstrapData() {
      setIsLoading(true);
      const result = await loadEvents();

      if (isDisposed) {
        return;
      }

      const nextMonths = getAvailableMonths(result.events);
      const nextMonthIndex = Math.max(
        nextMonths.findIndex((month) => {
          const today = new Date();
          return month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();
        }),
        0,
      );
      const nextSelectedMonth = nextMonths[nextMonthIndex] ?? new Date(2026, 4, 1, 12);
      const nextMonthEvents = getEventsForMonth(result.events, nextSelectedMonth);

      setEvents(result.events);
      setDataSource(result.source);
      setDataMessage(result.message);
      setMonthIndex(nextMonthIndex);
      setSelectedEventId(nextMonthEvents[0]?.id ?? result.events[0]?.id ?? "");
      setIsLoading(false);
    }

    void bootstrapData();

    return () => {
      isDisposed = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedEvent) {
      const nextEventId = monthEvents[0]?.id ?? events[0]?.id ?? "";
      if (nextEventId && nextEventId !== selectedEventId) {
        setSelectedEventId(nextEventId);
      }
    }
  }, [events, monthEvents, selectedEvent, selectedEventId]);

  function showPreviousMonth() {
    setMonthIndex((index) => Math.max(index - 1, 0));
  }

  function showNextMonth() {
    setMonthIndex((index) => Math.min(index + 1, availableMonths.length - 1));
  }

  function handleDayClick(date: Date) {
    const dayEvents = monthEvents.filter((event) => eventOccursOnDate(event, date));
    if (dayEvents[0]) {
      setSelectedEventId(dayEvents[0].id);
    }
  }

  async function toggleSubscription(eventId: string) {
    const alreadySubscribed = subscribedEventIds.includes(eventId);
    const action = alreadySubscribed ? "unsubscribe" : "subscribe";

    setIsSubscriptionLoading(true);
    const result = await syncEventSubscription(eventId, action);

    setSubscribedEventIds((activeIds) => {
      if (alreadySubscribed) {
        return activeIds.filter((id) => id !== eventId);
      }

      return [...activeIds, eventId];
    });

    setSubscriptionMessage(result.message);
    setIsSubscriptionLoading(false);
  }

  return (
    <main className="app-shell">
      <div className="app-backdrop" />

      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Telegram Mini App / MVP</p>
          <h1>Календарик летних мероприятий</h1>
          <p className="hero-text">
            Первый экран для Mini App: темная адаптивная сетка календаря, список и
            карточка события. Цветовое направление основано на твоем Figma-референсе,
            но сама композиция уже заточена под автомобильные и фестивальные ивенты.
          </p>
          <div className={`source-pill ${dataSource}`}>
            {isLoading ? "Загрузка..." : dataMessage}
          </div>
          <div className={`runtime-pill ${isTelegramMode ? "telegram" : "browser"}`}>
            {isTelegramMode
              ? `Режим Telegram${telegramUserName ? ` · ${telegramUserName}` : ""}`
              : "Режим браузера для разработки"}
          </div>
        </div>

        <div className="hero-stats">
          <div className="stat-card">
            <span className="stat-value">{events.length}</span>
            <span className="stat-label">мероприятий в сезоне</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{cities.length}</span>
            <span className="stat-label">городов и выездов</span>
          </div>
          <div className="stat-card accent">
            <span className="stat-value">
              {nextEvent ? formatEventDateRange(nextEvent) : "Скоро"}
            </span>
            <span className="stat-label">ближайшая дата</span>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <div className="calendar-panel panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Календарь</p>
              <h2>{formatMonthLabel(selectedMonth)}</h2>
            </div>

            <div className="calendar-nav">
              <button
                className="ghost-button"
                onClick={showPreviousMonth}
                disabled={monthIndex === 0}
                type="button"
              >
                ←
              </button>
              <button
                className="ghost-button"
                onClick={showNextMonth}
                disabled={safeMonthIndex === availableMonths.length - 1}
                type="button"
              >
                →
              </button>
            </div>
          </div>

          <div className="legend-row">
            {Object.entries(toneLabels).map(([tone, label]) => (
              <div className="legend-item" key={tone}>
                <span className={`legend-swatch ${tone}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="weekdays">
            {weekdayNames.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {monthGrid.map((date) => {
              const dayEvents = monthEvents.filter((event) => eventOccursOnDate(event, date));
              const hasSelectedEvent =
                selectedEvent && dayEvents.some((event) => event.id === selectedEvent.id);
              const isToday = isSameDay(date, new Date());
              const inCurrentMonth = isSameMonth(date, selectedMonth);

              return (
                <button
                  className={[
                    "calendar-day",
                    inCurrentMonth ? "" : "is-muted",
                    hasSelectedEvent ? "is-selected" : "",
                    isToday ? "is-today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={date.toISOString()}
                  onClick={() => handleDayClick(date)}
                  type="button"
                >
                  <span className="day-number">{date.getDate()}</span>

                  <div className="day-events">
                    {dayEvents.slice(0, 2).map((event) => (
                      <span className={`day-pill ${event.tone}`} key={event.id}>
                        {event.title}
                      </span>
                    ))}

                    {dayEvents.length > 2 ? (
                      <span className="day-more">+{dayEvents.length - 2}</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="side-stack">
          <section className="panel detail-panel">
            <div className="detail-topline">
              <span className={`event-badge ${selectedEvent?.tone ?? "violet"}`}>
                {selectedEvent ? toneLabels[selectedEvent.tone] : "Событие"}
              </span>
              {selectedEvent ? (
                <span className="detail-date">{formatEventDateRange(selectedEvent)}</span>
              ) : null}
            </div>

            <h2>{selectedEvent?.title ?? "Нет событий в этом месяце"}</h2>

            {selectedEvent ? (
              <>
                <p className="detail-meta">
                  {selectedEvent.place}, {selectedEvent.city}
                </p>

                <p className="detail-comment">
                  {selectedEvent.comment ??
                    "Комментарий можно будет редактировать из админского интерфейса."}
                </p>

                <div className="tag-row">
                  {selectedEvent.tags.map((tag) => (
                    <span className="tag-chip" key={tag}>
                      #{tag}
                    </span>
                  ))}
                </div>

                {selectedEvent.registrationDeadline ? (
                  <div className="warning-box">
                    Регистрация до{" "}
                    {new Intl.DateTimeFormat("ru-RU", {
                      day: "numeric",
                      month: "long",
                    }).format(parseIsoDate(selectedEvent.registrationDeadline))}
                  </div>
                ) : null}

                <div className="action-row">
                  {selectedEvent.link ? (
                    <a
                      className="primary-button"
                      href={selectedEvent.link}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Открыть ссылку
                    </a>
                  ) : (
                    <button className="primary-button disabled" disabled type="button">
                      Ссылка появится позже
                    </button>
                  )}

                  <button
                    className="secondary-button"
                    disabled={isSubscriptionLoading}
                    onClick={() => void toggleSubscription(selectedEvent.id)}
                    type="button"
                  >
                    {isSubscriptionLoading
                      ? "Обновляем..."
                      : subscribedEventIds.includes(selectedEvent.id)
                      ? "Напоминание включено"
                      : "Напомнить мне"}
                  </button>
                </div>

                {subscriptionMessage ? (
                  <div className="subscription-box">{subscriptionMessage}</div>
                ) : null}
              </>
            ) : (
              <p className="detail-comment">
                Для этого месяца пока нет карточек. После подключения Supabase события
                будут приходить из базы.
              </p>
            )}
          </section>

          <section className="panel list-panel">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">Список месяца</p>
                <h2>{monthEvents.length} событий</h2>
              </div>
              <span className="subtle-note">read-only для пользователей</span>
            </div>

            <div className="event-list">
              {monthEvents.map((event) => (
                <button
                  className={[
                    "event-row",
                    selectedEvent?.id === event.id ? "is-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={event.id}
                  onClick={() => setSelectedEventId(event.id)}
                  type="button"
                >
                  <div className={`event-row-stripe ${event.tone}`} />
                <div className="event-row-copy">
                  <div className="event-row-head">
                    <strong>{event.title}</strong>
                    <span>{formatEventDateRange(event)}</span>
                  </div>
                    <span className="event-row-meta">
                      {event.place}, {event.city}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="panel panel-note">
            <p className="panel-kicker">Как это будет жить в проде</p>
            <h2>Без своего сервера</h2>
            <p className="detail-comment">
              События редактируются в Supabase, Mini App читает только опубликованные
              записи, а Telegram-бот отправляет уведомления по подпискам через cron.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

export default App;
