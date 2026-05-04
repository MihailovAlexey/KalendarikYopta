import type { EventTone } from "../types";

export type ToneLabelMap = Record<EventTone, string>;

export const fallbackToneLabels: ToneLabelMap = {
  violet: "Главный этап",
  coral: "Фестиваль",
  sky: "Выезд / шоу",
  amber: "Локальный ивент",
  teal: "Регистрация горит",
};

