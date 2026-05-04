export type EventTone = "violet" | "coral" | "sky" | "amber" | "teal";

export type EventStatus = "published" | "draft" | "cancelled";

export type CalendarEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  emoji: string;
  place: string;
  city: string;
  link?: string;
  comment?: string;
  tone: EventTone;
  status: EventStatus;
  registrationDeadline?: string;
};
