import { AvailabilityStatus } from "src/graphql";
import { TelegramReplyMarkup } from "./telegram.types";

export const buildStatusKeyboard = (): TelegramReplyMarkup => ({
  inline_keyboard: [
    [
      { text: "On shift", callback_data: `status:${AvailabilityStatus.ON_SHIFT}` },
      { text: "Off shift", callback_data: `status:${AvailabilityStatus.OFF_SHIFT}` },
    ],
    [
      { text: "Sick", callback_data: `status:${AvailabilityStatus.SICK}` },
      { text: "Vacation", callback_data: `status:${AvailabilityStatus.VACATION}` },
    ],
    [{ text: "My status", callback_data: "action:status" }],
  ],
});

export const MORNING_PROMPT_TEXT =
  "Good morning! Please confirm your work status for today before 12:00 (Moscow time):";

export const buildReminderText = (hour: number) =>
  `Reminder (${hour}:00 MSK): please confirm today's work status before 12:00.`;

export const FORCE_LOGOUT_TEXT =
  "Your HRM session was ended because today's status was not confirmed by 12:00 (Moscow time). Log in to the HRM app and confirm your status in this chat.";
