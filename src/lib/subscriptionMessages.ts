type SubscriptionAction = "subscribe" | "unsubscribe";

export function buildSubscriptionStatusMessage(
  eventTitle: string,
  action: SubscriptionAction,
) {
  if (action === "subscribe") {
    return `Подписка на "${eventTitle}" сохранена.`;
  }

  return `Подписка на "${eventTitle}" отключена.`;
}
