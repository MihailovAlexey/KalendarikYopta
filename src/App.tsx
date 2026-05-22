import { useEffect, useState } from "react";
import { AdminPanel } from "./components/AdminPanel";
import { events as fallbackEvents } from "./data/events";
import { fallbackToneLabels, type ToneLabelMap } from "./data/toneLabels";
import {
  buildMonthGrid,
  eventOccursOnDate,
  formatEventDateRange,
  formatMonthLabel,
  getAvailableMonths,
  getTodayDate,
  getEventsForMonth,
  getUpcomingEvent,
  getWeekdayNames,
  isDatePast,
  isEventPast,
  isSameDay,
  isSameMonth,
  parseIsoDate,
} from "./lib/calendar";
import { getAdminSession } from "./lib/adminStore";
import { loadEvents } from "./lib/eventStore";
import {
  initializeTelegramWebApp,
} from "./lib/telegramWebApp";
import { syncEventSubscription } from "./lib/subscriptions";
import type { CalendarEvent } from "./types";

function App() {
  const [events, setEvents] = useState<CalendarEvent[]>(fallbackEvents);
  const [toneLabels, setToneLabels] = useState<ToneLabelMap>(fallbackToneLabels);
  const [monthIndex, setMonthIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [subscribedEventIds, setSubscribedEventIds] = useState<string[]>([]);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  const availableMonths = getAvailableMonths(events);
  const safeMonthIndex =
    availableMonths.length === 0
      ? 0
      : Math.min(monthIndex, Math.max(availableMonths.length - 1, 0));
  const selectedMonth = availableMonths[safeMonthIndex] ?? new Date(2026, 4, 1, 12);
  const monthEvents = getEventsForMonth(events, selectedMonth);
  const selectedDayEvents =
    selectedDate && isSameMonth(selectedDate, selectedMonth)
      ? monthEvents.filter((event) => eventOccursOnDate(event, selectedDate))
      : [];
  const selectedEvent =
    selectedDayEvents.find((event) => event.id === selectedEventId) ??
    monthEvents.find((event) => event.id === selectedEventId) ??
    selectedDayEvents[0] ??
    monthEvents[0];
  const monthGrid = buildMonthGrid(selectedMonth);
  const weekdayNames = getWeekdayNames();
  const nextEvent = getUpcomingEvent(events);

  useEffect(() => {
    initializeTelegramWebApp();
    void (async () => {
      const session = await getAdminSession();
      setIsAdmin(Boolean(session.ok && session.isAdmin));
    })();
  }, []);

  function resolveMonthIndex(nextEvents: CalendarEvent[]) {
    const nextMonths = getAvailableMonths(nextEvents);
    const today = getTodayDate();
    const currentMonthIndex = nextMonths.findIndex((month) => isSameMonth(month, today));

    if (currentMonthIndex >= 0) {
      return currentMonthIndex;
    }

    const upcomingEvent = getUpcomingEvent(nextEvents, today);
    if (!upcomingEvent) {
      return 0;
    }

    return Math.max(
      nextMonths.findIndex((month) => isSameMonth(month, parseIsoDate(upcomingEvent.startDate))),
      0,
    );
  }

  function resolveSelectedDate(month: Date, nextMonthEvents: CalendarEvent[]) {
    const today = getTodayDate();

    if (isSameMonth(month, today)) {
      return today;
    }

    return nextMonthEvents[0]
      ? parseIsoDate(nextMonthEvents[0].startDate)
      : new Date(month.getFullYear(), month.getMonth(), 1, 12);
  }

  async function refreshPublicEvents() {
    const result = await loadEvents();
    const nextMonths = getAvailableMonths(result.events);
    const nextMonthIndex = resolveMonthIndex(result.events);
    const nextSelectedMonth = nextMonths[nextMonthIndex] ?? new Date(2026, 4, 1, 12);
    const nextMonthEvents = getEventsForMonth(result.events, nextSelectedMonth);
    const nextSelectedDate = resolveSelectedDate(nextSelectedMonth, nextMonthEvents);

    setEvents(result.events);
    setToneLabels(result.toneLabels);
    setMonthIndex(nextMonthIndex);
    setSelectedDate(nextSelectedDate);
    setSelectedEventId(nextMonthEvents[0]?.id ?? result.events[0]?.id ?? "");
  }

  useEffect(() => {
    let isDisposed = false;

    async function bootstrapData() {
      const result = await loadEvents();
      if (isDisposed) {
        return;
      }

      const nextMonths = getAvailableMonths(result.events);
      const nextMonthIndex = resolveMonthIndex(result.events);
      const nextSelectedMonth = nextMonths[nextMonthIndex] ?? new Date(2026, 4, 1, 12);
      const nextMonthEvents = getEventsForMonth(result.events, nextSelectedMonth);
      const nextSelectedDate = resolveSelectedDate(nextSelectedMonth, nextMonthEvents);

      setEvents(result.events);
      setToneLabels(result.toneLabels);
      setMonthIndex(nextMonthIndex);
      setSelectedDate(nextSelectedDate);
      setSelectedEventId(nextMonthEvents[0]?.id ?? result.events[0]?.id ?? "");
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

  useEffect(() => {
    if (!selectedDate || !isSameMonth(selectedDate, selectedMonth)) {
      const nextSelectedDate = resolveSelectedDate(selectedMonth, monthEvents);
      setSelectedDate(nextSelectedDate);
      return;
    }

    const nextDayEvents = monthEvents.filter((event) => eventOccursOnDate(event, selectedDate));
    if (nextDayEvents.length > 0 && !nextDayEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(nextDayEvents[0].id);
    }
  }, [monthEvents, selectedDate, selectedEventId, selectedMonth]);

  function showPreviousMonth() {
    setMonthIndex((index) => {
      const nextIndex = Math.max(index - 1, 0);
      const nextMonth = availableMonths[nextIndex];
      if (nextMonth) {
        const nextMonthEvents = getEventsForMonth(events, nextMonth);
        const nextSelectedDate = resolveSelectedDate(nextMonth, nextMonthEvents);
        setSelectedDate(nextSelectedDate);
        setSelectedEventId(nextMonthEvents[0]?.id ?? "");
      }
      return nextIndex;
    });
  }

  function showNextMonth() {
    setMonthIndex((index) => {
      const nextIndex = Math.min(index + 1, availableMonths.length - 1);
      const nextMonth = availableMonths[nextIndex];
      if (nextMonth) {
        const nextMonthEvents = getEventsForMonth(events, nextMonth);
        const nextSelectedDate = resolveSelectedDate(nextMonth, nextMonthEvents);
        setSelectedDate(nextSelectedDate);
        setSelectedEventId(nextMonthEvents[0]?.id ?? "");
      }
      return nextIndex;
    });
  }

  function handleDayClick(date: Date) {
    const dayEvents = monthEvents.filter((event) => eventOccursOnDate(event, date));
    setSelectedDate(date);
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
          <p className="eyebrow">Лето 2026</p>
          <h1>Календарь мероприятий</h1>
          <p className="hero-text">
            Ближайшие события сезона в одном календаре: даты, площадки, ссылки и
            напоминания в Telegram.
          </p>
          {isAdmin ? (
            <button
              className="secondary-button hero-admin-button"
              onClick={() => setIsAdminPanelOpen(true)}
              type="button"
            >
              Управление событиями
            </button>
          ) : null}
        </div>

        <div className="hero-stats">
          <div className="stat-card">
            <span className="stat-value">{events.length}</span>
            <span className="stat-label">событий в сезоне</span>
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
              const isSelectedDate = selectedDate ? isSameDay(date, selectedDate) : false;
              const isToday = isSameDay(date, new Date());
              const inCurrentMonth = isSameMonth(date, selectedMonth);
              const isPast = isDatePast(date);

              return (
                <button
                  className={[
                    "calendar-day",
                    inCurrentMonth ? "" : "is-muted",
                    isSelectedDate ? "is-selected" : "",
                    isToday ? "is-today" : "",
                    isPast ? "is-past" : "",
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
                        <span className="day-pill-emoji" aria-hidden="true">
                          {event.emoji}
                        </span>
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
            {selectedDayEvents.length > 0 ? (
              <>
                <div className="detail-header">
                  <div>
                    <p className="panel-kicker">На выбранную дату</p>
                    <h2>
                      {selectedDayEvents.length === 1
                        ? "1 мероприятие"
                        : `${selectedDayEvents.length} мероприятий`}
                    </h2>
                  </div>
                  {selectedDate ? (
                    <span className="detail-date">
                      {new Intl.DateTimeFormat("ru-RU", {
                        day: "numeric",
                        month: "long",
                      }).format(selectedDate)}
                    </span>
                  ) : null}
                </div>

                <div className="detail-stack">
                  {selectedDayEvents.map((event) => (
                    <article
                      className={[
                        "detail-card",
                        isEventPast(event) ? "is-past" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={event.id}
                    >
                      <div className="detail-topline">
                        <span className={`event-badge ${event.tone}`}>
                          {toneLabels[event.tone]}
                        </span>
                        <span className="detail-date">{formatEventDateRange(event)}</span>
                      </div>

                      <h2>{event.title}</h2>

                      <p className="detail-meta">
                        {event.place}, {event.city}
                      </p>

                      <p className="detail-comment">
                        {event.comment?.trim() || "Комментарий пока не добавлен."}
                      </p>

                      {event.registrationDeadline ? (
                        <div className="warning-box">
                          Регистрация до{" "}
                          {new Intl.DateTimeFormat("ru-RU", {
                            day: "numeric",
                            month: "long",
                          }).format(parseIsoDate(event.registrationDeadline))}
                        </div>
                      ) : null}

                      <div className="action-row">
                        {event.link ? (
                          <a
                            className="primary-button"
                            href={event.link}
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
                          onClick={() => void toggleSubscription(event.id)}
                          type="button"
                        >
                          {isSubscriptionLoading
                            ? "Обновляем..."
                            : subscribedEventIds.includes(event.id)
                            ? "Напоминание включено"
                            : "Напомнить мне"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                {subscriptionMessage ? (
                  <div className="subscription-box">{subscriptionMessage}</div>
                ) : null}
              </>
            ) : selectedDate && isSameMonth(selectedDate, selectedMonth) ? (
              <>
                <div className="detail-header">
                  <div>
                    <p className="panel-kicker">На выбранную дату</p>
                    <h2>Событий нет</h2>
                  </div>
                  <span className="detail-date">
                    {new Intl.DateTimeFormat("ru-RU", {
                      day: "numeric",
                      month: "long",
                    }).format(selectedDate)}
                  </span>
                </div>

                <p className="detail-comment">На эту дату пока ничего не запланировано.</p>
              </>
            ) : selectedEvent ? (
              <>
                <div className="detail-topline">
                  <span className={`event-badge ${selectedEvent.tone}`}>
                    {toneLabels[selectedEvent.tone]}
                  </span>
                  <span className="detail-date">{formatEventDateRange(selectedEvent)}</span>
                </div>

                <h2>{selectedEvent.title}</h2>
                <p className="detail-meta">
                  {selectedEvent.place}, {selectedEvent.city}
                </p>
                <p className="detail-comment">
                  {selectedEvent.comment?.trim() || "Комментарий пока не добавлен."}
                </p>
              </>
            ) : (
              <p className="detail-comment">Для этого месяца пока нет событий.</p>
            )}
          </section>

          <section className="panel list-panel">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">Список месяца</p>
                <h2>{monthEvents.length} событий</h2>
              </div>
            </div>

            <div className="event-list">
              {monthEvents.map((event) => (
                <button
                  className={[
                    "event-row",
                    selectedDayEvents.some((dayEvent) => dayEvent.id === event.id)
                      ? "is-active"
                      : "",
                    isEventPast(event) ? "is-past" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={event.id}
                  onClick={() => {
                    setSelectedDate(parseIsoDate(event.startDate));
                    setSelectedEventId(event.id);
                  }}
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
        </div>
      </section>

      <AdminPanel
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        onPublicEventsChanged={refreshPublicEvents}
        toneLabels={toneLabels}
      />
    </main>
  );
}

export default App;
