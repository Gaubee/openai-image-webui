/*
 * Intent: error → user-facing message mapping (2026-10-06 R6)
 * Known API failure patterns map to i18n keys ("errors." namespace) so task
 * cards and form notices render localized copy; unknown errors stay raw.
 */

interface FriendlyErrorMessages {
  unknown: string;
  requestFailed: string;
}

const DEFAULT_FRIENDLY_ERROR_MESSAGES: FriendlyErrorMessages = {
  unknown: "Unknown error.",
  requestFailed: "Request failed. Please check your API key, base URL, model, network, or CORS settings.",
};

/** Ordered: first match wins. Keys live in i18n resources under `errors.`. */
const ERROR_KEY_PATTERNS: ReadonlyArray<{ pattern: RegExp; key: string }> = [
  { pattern: /\b429\b|too many requests|rate.?limit/i, key: "errors.rateLimited" },
  { pattern: /\b40[13]\b|unauthorized|forbidden|invalid[ _-]api[ _-]?key|incorrect[ _-]api[ _-]?key/i, key: "errors.unauthorized" },
  { pattern: /\b404\b|not[ _-]?found|no such model|does not exist/i, key: "errors.notFound" },
  { pattern: /\b5\d\d\b|internal server error|bad gateway|service unavailable|overloaded/i, key: "errors.serverError" },
  { pattern: /failed to fetch|networkerror|load failed|fetch failed/i, key: "errors.network" },
];

export function getErrorMessage(
  error: unknown,
  messages: Pick<FriendlyErrorMessages, "unknown"> = DEFAULT_FRIENDLY_ERROR_MESSAGES,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return messages.unknown;
}

/** True when the value is an i18n error key produced by toI18nError. */
export function isI18nErrorKey(value: string): boolean {
  return value.startsWith("errors.");
}

/** Maps a known failure pattern to an i18n key; falls back to plain friendly text. */
export function toI18nError(
  error: unknown,
  messages: FriendlyErrorMessages = DEFAULT_FRIENDLY_ERROR_MESSAGES,
): string {
  const message = getErrorMessage(error, messages);

  for (const { pattern, key } of ERROR_KEY_PATTERNS) {
    if (pattern.test(message)) {
      return key;
    }
  }

  if (message === "Failed to fetch") {
    return messages.requestFailed;
  }

  return message;
}

export function toFriendlyError(
  error: unknown,
  messages: FriendlyErrorMessages = DEFAULT_FRIENDLY_ERROR_MESSAGES,
): string {
  return toI18nError(error, messages);
}
