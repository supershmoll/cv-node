import { AvailabilityStatus } from "src/graphql";

export type AiLocale = "en" | "ru";

export type ParsedAvailabilityIntent = {
  status: AvailabilityStatus | null;
  confidence: "high" | "low";
  source: "rule" | "llm" | "none";
};

export type TeamMemberSnapshot = {
  name: string;
  email: string;
  department: string;
  status: AvailabilityStatus;
};

export type TeamAvailabilitySnapshot = {
  members: TeamMemberSnapshot[];
  counts: Record<AvailabilityStatus, number>;
  total: number;
};

export type HrAssistantResult = {
  answer: string;
  source: "ai" | "rules";
};
