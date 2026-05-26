import { AvailabilityStatus } from "src/graphql";

export const STATUS_LABELS: Record<AvailabilityStatus, string> = {
  [AvailabilityStatus.ON_SHIFT]: "On shift",
  [AvailabilityStatus.OFF_SHIFT]: "Off shift",
  [AvailabilityStatus.SICK]: "Sick",
  [AvailabilityStatus.VACATION]: "On vacation",
  [AvailabilityStatus.UNKNOWN]: "Unknown",
};

export const LINK_CODE_TTL_MINUTES = Number(process.env.BOT_LINK_CODE_TTL_MINUTES ?? 15);
export const STATUS_CHECK_TIMEZONE = process.env.STATUS_CHECK_TIMEZONE ?? "Europe/Moscow";
export const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "hrmdiplomabot";

export const MORNING_PROMPT_HOUR = 9;
export const REMINDER_HOURS = [10, 11] as const;
export const DEADLINE_HOUR = 12;

export const UNAUTHORIZED_BOT_MESSAGE =
  "This bot is private. Connect your Telegram account from the HRM app profile first.";

export const normalizeTelegramUsername = (username: string) =>
  username.trim().replace(/^@+/, "").toLowerCase();

export const isValidTelegramUsername = (username: string) =>
  /^[a-zA-Z0-9_]{5,32}$/.test(normalizeTelegramUsername(username));

export const buildTelegramDeepLink = (code: string) =>
  `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${code}`;
