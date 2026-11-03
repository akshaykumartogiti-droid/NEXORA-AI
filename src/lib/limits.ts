// Server-enforced AI limits (shared so the UI can display the same numbers).
export const AI_LIMITS = {
  requestsPerDay: 50,
  requestsPerMinute: 6,
  maxMessageChars: 8000,
  maxHistoryMessages: 40,
  maxOutputTokens: 4000,
} as const;

export function checkRate(countLastMinute: number, countLastDay: number, perDay: number = AI_LIMITS.requestsPerDay): { ok: true } | { ok: false; reason: string } {
  if (countLastDay >= perDay)
    return { ok: false, reason: `Daily limit of ${perDay} AI requests reached. Try again tomorrow, or upgrade on the Billing page.` };
  if (countLastMinute >= AI_LIMITS.requestsPerMinute)
    return { ok: false, reason: "Too many requests in a minute. Please wait a moment." };
  return { ok: true };
}
