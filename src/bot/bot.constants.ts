import { AvailabilityStatus } from "src/graphql";

export const STATUS_LABELS: Record<AvailabilityStatus, string> = {
  [AvailabilityStatus.ON_SHIFT]: "On shift",
  [AvailabilityStatus.OFF_SHIFT]: "Off shift",
  [AvailabilityStatus.SICK]: "Sick",
  [AvailabilityStatus.VACATION]: "On vacation",
  [AvailabilityStatus.UNKNOWN]: "Unknown",
};

export const LINK_CODE_TTL_MINUTES = Number(process.env.BOT_LINK_CODE_TTL_MINUTES ?? 15);
