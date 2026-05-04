import { useEffect, useMemo, useState } from "react";
import type { ToneLabelMap } from "../data/toneLabels";
import {
  createEmptyEditableEvent,
  getAdminSession,
  loadAdminEvents,
  loadAdminTones,
  saveAdminTone,
  saveAdminEvent,
  type EditableEvent,
} from "../lib/adminStore";

type AdminPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  onPublicEventsChanged: () => Promise<void>;
  toneLabels: ToneLabelMap;
};

const toneKeys = ["violet", "coral", "sky", "amber", "teal"] as const;

const statusOptions = [
  { value: "published", label: "Опубликовано" },
  { value: "draft", label: "Черновик" },
  { value: "cancelled", label: "Отменено" },
] as const;

function sortEvents(events: EditableEvent[]) {
  return [...events].sort((left, right) => left.startDate.localeCompare(right.startDate));
}

export function AdminPanel({ isOpen, onClose, onPublicEventsChanged, toneLabels: initialToneLabels }: AdminPanelProps) {
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [events, setEvents] = useState<EditableEvent[]>([]);
  const [toneLabels, setToneLabels] = useState<ToneLabelMap>(initialToneLabels);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [formState, setFormState] = useState<EditableEvent>(createEmptyEditableEvent());
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTone, setIsSavingTone] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const selectedEvent = useMemo(
    () => events.find((event) => event.originalSlug === selectedSlug || event.id === selectedSlug),
    [events, selectedSlug],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let disposed = false;

    async function bootstrapAdmin() {
      setIsCheckingAccess(true);
      setStatusMessage("");
      const session = await getAdminSession();

      if (disposed) {
        return;
      }

      if (!session.ok || !session.isAdmin) {
        setIsAdmin(false);
        setAccessError(session.error ?? "Доступ к управлению закрыт.");
        setIsCheckingAccess(false);
        return;
      }

      setIsAdmin(true);
      setAccessError("");

      const [eventsResult, tonesResult] = await Promise.all([loadAdminEvents(), loadAdminTones()]);
      if (disposed) {
        return;
      }

      if (!eventsResult.ok) {
        setStatusMessage(eventsResult.error ?? "Не удалось загрузить события.");
        setEvents([]);
        setIsCheckingAccess(false);
        return;
      }

      if (tonesResult.ok) {
        setToneLabels(tonesResult.toneLabels);
      }

      const nextEvents = sortEvents(eventsResult.events);
      setEvents(nextEvents);
      const firstEvent = nextEvents[0] ?? createEmptyEditableEvent();
      setSelectedSlug(firstEvent.originalSlug || firstEvent.id);
      setFormState(firstEvent);
      setIsCheckingAccess(false);
    }

    void bootstrapAdmin();

    return () => {
      disposed = true;
    };
  }, [isOpen]);

  useEffect(() => {
    setToneLabels(initialToneLabels);
  }, [initialToneLabels]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [isOpen]);

  useEffect(() => {
    if (selectedEvent) {
      setFormState(selectedEvent);
    }
  }, [selectedEvent]);

  function updateField<Key extends keyof EditableEvent>(field: Key, value: EditableEvent[Key]) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleCreateNew() {
    const empty = createEmptyEditableEvent();
    setSelectedSlug("");
    setFormState(empty);
    setStatusMessage("");
  }

  async function handleSave() {
    setIsSaving(true);
    setStatusMessage("");
    const result = await saveAdminEvent(formState);
    setIsSaving(false);

    if (!result.ok) {
      setStatusMessage(result.error ?? "Не удалось сохранить событие.");
      return;
    }

    const refreshed = await loadAdminEvents();
    if (!refreshed.ok) {
      setStatusMessage(refreshed.error ?? "Событие сохранено, но список не обновился.");
      await onPublicEventsChanged();
      return;
    }

    const nextEvents = sortEvents(refreshed.events);
    const savedEvent =
      nextEvents.find((event) => event.id === formState.id) ??
      nextEvents.find((event) => event.originalSlug === formState.originalSlug) ??
      nextEvents[0] ??
      createEmptyEditableEvent();

    setEvents(nextEvents);
    setSelectedSlug(savedEvent.originalSlug || savedEvent.id);
    setFormState(savedEvent);
    setStatusMessage("Изменения сохранены.");
    await onPublicEventsChanged();
  }

  async function handleSaveTone(tone: keyof ToneLabelMap) {
    setIsSavingTone(true);
    setStatusMessage("");
    const result = await saveAdminTone(tone, toneLabels[tone]);
    setIsSavingTone(false);

    if (!result.ok) {
      setStatusMessage(result.error ?? "Не удалось сохранить метку.");
      return;
    }

    setStatusMessage("Метки цветов сохранены.");
    await onPublicEventsChanged();
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true">
      <div className="admin-panel">
        <div className="admin-header">
          <div>
            <p className="panel-kicker">Управление</p>
            <h2>События</h2>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {isCheckingAccess ? <p className="admin-placeholder">Проверяем доступ...</p> : null}

        {!isCheckingAccess && !isAdmin ? (
          <p className="admin-placeholder">
            {accessError || "У этого Telegram-пользователя нет прав на управление."}
          </p>
        ) : null}

        {!isCheckingAccess && isAdmin ? (
          <div className="admin-content">
            <aside className="admin-sidebar">
              <button className="secondary-button admin-new-button" onClick={handleCreateNew} type="button">
                Новое событие
              </button>

              <div className="admin-event-list">
                {events.map((event) => (
                  <button
                    key={event.originalSlug}
                    className={[
                      "admin-event-row",
                      selectedSlug === event.originalSlug ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSelectedSlug(event.originalSlug)}
                    type="button"
                  >
                    <span className={`legend-swatch ${event.tone}`} />
                    <div className="admin-event-copy">
                      <strong>
                        {event.emoji} {event.title}
                      </strong>
                      <span>
                        {event.startDate} · {event.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <section className="admin-form-grid">
              <div className="admin-field admin-field-wide admin-tone-block">
                <span>Подписи цветовых меток</span>
                <div className="admin-tone-grid">
                  {toneKeys.map((tone) => (
                    <label className="admin-field" key={tone}>
                      <span>{tone}</span>
                      <div className="admin-tone-row">
                        <input
                          value={toneLabels[tone]}
                          onChange={(event) =>
                            setToneLabels((current) => ({
                              ...current,
                              [tone]: event.target.value,
                            }))
                          }
                        />
                        <button
                          className="secondary-button admin-tone-save"
                          disabled={isSavingTone}
                          onClick={() => void handleSaveTone(tone)}
                          type="button"
                        >
                          Сохранить
                        </button>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <label className="admin-field">
                <span>Slug</span>
                <input
                  value={formState.id}
                  onChange={(event) => updateField("id", event.target.value)}
                  placeholder="garage-fest"
                />
              </label>

              <label className="admin-field admin-field-wide">
                <span>Название</span>
                <input
                  value={formState.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  placeholder="Название мероприятия"
                />
              </label>

              <label className="admin-field">
                <span>Дата начала</span>
                <input
                  type="date"
                  value={formState.startDate}
                  onChange={(event) => updateField("startDate", event.target.value)}
                />
              </label>

              <label className="admin-field">
                <span>Дата окончания</span>
                <input
                  type="date"
                  value={formState.endDate ?? ""}
                  onChange={(event) => updateField("endDate", event.target.value || undefined)}
                />
              </label>

              <label className="admin-field">
                <span>Emoji</span>
                <input
                  value={formState.emoji}
                  onChange={(event) => updateField("emoji", event.target.value)}
                  placeholder="🔥"
                />
              </label>

              <label className="admin-field">
                <span>Цвет</span>
                <select
                  value={formState.tone}
                  onChange={(event) => updateField("tone", event.target.value as EditableEvent["tone"])}
                >
                  {toneKeys.map((tone) => (
                    <option key={tone} value={tone}>
                      {toneLabels[tone]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Статус</span>
                <select
                  value={formState.status}
                  onChange={(event) =>
                    updateField("status", event.target.value as EditableEvent["status"])
                  }
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Регистрация до</span>
                <input
                  type="date"
                  value={formState.registrationDeadline ?? ""}
                  onChange={(event) =>
                    updateField("registrationDeadline", event.target.value || undefined)
                  }
                />
              </label>

              <label className="admin-field admin-field-wide">
                <span>Площадка</span>
                <input
                  value={formState.place}
                  onChange={(event) => updateField("place", event.target.value)}
                  placeholder="Игора Драйв"
                />
              </label>

              <label className="admin-field admin-field-wide">
                <span>Город</span>
                <input
                  value={formState.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  placeholder="Санкт-Петербург"
                />
              </label>

              <label className="admin-field admin-field-wide">
                <span>Ссылка</span>
                <input
                  value={formState.link ?? ""}
                  onChange={(event) => updateField("link", event.target.value || undefined)}
                  placeholder="https://..."
                />
              </label>

              <label className="admin-field admin-field-wide">
                <span>Комментарий</span>
                <textarea
                  rows={5}
                  value={formState.comment ?? ""}
                  onChange={(event) => updateField("comment", event.target.value || undefined)}
                  placeholder="Краткая заметка для карточки события"
                />
              </label>

              <div className="admin-actions admin-field-wide">
                <button className="primary-button" disabled={isSaving} onClick={() => void handleSave()} type="button">
                  {isSaving ? "Сохраняем..." : "Сохранить"}
                </button>
                {statusMessage ? <span className="admin-status">{statusMessage}</span> : null}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
