export type ErrorDetailValue =
  | string
  | number
  | boolean
  | null
  | ErrorDetailValue[]
  | { [key: string]: ErrorDetailValue };

export type ErrorDetails = Record<string, ErrorDetailValue>;

const MAX_DETAIL_DEPTH = 5;
const MAX_DETAIL_ARRAY_ITEMS = 50;
const MAX_DETAIL_STRING_LENGTH = 500;
const TRUNCATED_VALUE = "[TRUNCATED]";
const PRIVATE_DETAIL_KEY_PATTERN =
  /(password|secret|token|authorization|cookie|api[_-]?key|access[_-]?key|stack|sql|query|driver[_-]?error|original[_-]?error)/i;

function isPlainRecord(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): ErrorDetailValue | undefined {
  if (depth > MAX_DETAIL_DEPTH) {
    return TRUNCATED_VALUE;
  }

  if (value === null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    return value.length <= MAX_DETAIL_STRING_LENGTH
      ? value
      : `${value.slice(0, MAX_DETAIL_STRING_LENGTH)}${TRUNCATED_VALUE}`;
  }

  if (typeof value !== "object") {
    return undefined;
  }

  if (seen.has(value)) {
    return TRUNCATED_VALUE;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const sanitizedItems: ErrorDetailValue[] = [];

    for (const item of value.slice(0, MAX_DETAIL_ARRAY_ITEMS)) {
      const sanitizedItem = sanitizeValue(item, depth + 1, seen);
      if (sanitizedItem !== undefined) {
        sanitizedItems.push(sanitizedItem);
      }
    }

    return sanitizedItems;
  }

  if (!isPlainRecord(value)) {
    return undefined;
  }

  const sanitizedRecord: Record<string, ErrorDetailValue> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (PRIVATE_DETAIL_KEY_PATTERN.test(key)) {
      continue;
    }

    const sanitizedValue = sanitizeValue(nestedValue, depth + 1, seen);
    if (sanitizedValue !== undefined) {
      sanitizedRecord[key] = sanitizedValue;
    }
  }

  return sanitizedRecord;
}

export function sanitizeErrorDetails(details: unknown): ErrorDetails {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return {};
  }

  const sanitized = sanitizeValue(details, 0, new WeakSet<object>());

  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? sanitized
    : {};
}
