// Plain constants/types shared by the feedback UI and the status server actions.
// NOTE: must NOT be a "use server" file — those may only export async functions.

export const RESOLUTION_TYPES = [
  "Agreement reached successfully",
  "Agreement reached but not every party was satisfied",
  "Negotiation canceled / abandoned / deprioritized",
  "Other",
] as const;

export const HELPED_SCALE = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree",
] as const;

export type FeedbackInput = {
  resolutionType: string;
  helped: string;
  favorite: string;
  change: string;
  other: string;
};
