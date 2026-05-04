import type { CalendarEvent } from "../types";

const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function getWeekdayNames() {
  return dayNames;
}

export function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatEventDateRange(event: CalendarEvent) {
  const start = parseIsoDate(event.startDate);
  const end = event.endDate ? parseIsoDate(event.endDate) : null;

  if (!end) {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
    }).format(start);
  }

  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    const month = new Intl.DateTimeFormat("ru-RU", {
      month: "long",
    }).format(start);

    return `${start.getDate()}-${end.getDate()} ${month}`;
  }

  const startLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(start);

  const endLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(end);

  return `${startLabel} - ${endLabel}`;
}

export function buildMonthGrid(monthDate: Date) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 12);

  const startWeekday = (start.getDay() + 6) % 7;
  const gridStart = addDays(start, -startWeekday);

  const endWeekday = (end.getDay() + 6) % 7;
  const gridEnd = addDays(end, 6 - endWeekday);

  const days: Date[] = [];
  let cursor = gridStart;

  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return days;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return new Date(next.getFullYear(), next.getMonth(), next.getDate(), 12);
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function eventOccursOnDate(event: CalendarEvent, date: Date) {
  const start = parseIsoDate(event.startDate);
  const end = event.endDate ? parseIsoDate(event.endDate) : start;
  return start <= date && end >= date;
}

export function getEventsForMonth(events: CalendarEvent[], monthDate: Date) {
  return events
    .filter((event) => {
      const start = parseIsoDate(event.startDate);
      return start.getFullYear() === monthDate.getFullYear() && start.getMonth() === monthDate.getMonth();
    })
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
}

export function getAvailableMonths(events: CalendarEvent[]) {
  const seen = new Set<string>();
  const months: Date[] = [];

  for (const event of events) {
    const start = parseIsoDate(event.startDate);
    const key = `${start.getFullYear()}-${start.getMonth()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    months.push(new Date(start.getFullYear(), start.getMonth(), 1, 12));
  }

  return months.sort((left, right) => left.getTime() - right.getTime());
}

export function getUpcomingEvent(events: CalendarEvent[], today = new Date()) {
  const normalizedToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12,
  );

  return [...events]
    .filter((event) => parseIsoDate(event.startDate) >= normalizedToday)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))[0];
}

