type ReminderEvent = {
  title: string;
  place: string;
  city: string;
  start_date: string;
  external_url: string | null;
};

function parseDateUtc(dateString: string) {
  return new Date(`${dateString}T12:00:00.000Z`);
}

export function buildReminderText(event: ReminderEvent, hoursBeforeStart: 24 | 3) {
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(parseDateUtc(event.start_date));

  const linkLine = event.external_url ? `\nСсылка: ${event.external_url}` : "";

  return (
    `Напоминание: через ${hoursBeforeStart} ч. мероприятие "${event.title}".\n` +
    `Дата: ${dateLabel}\n` +
    `Место: ${event.place}, ${event.city}${linkLine}`
  );
}
