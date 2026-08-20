export type LogValue =
  boolean | number | string | null | LogValue[] | { [key: string]: LogValue };

type LogLevel = "error" | "info" | "warn";

export interface LogEntry {
  attributes?: Record<string, LogValue>;
  event: string;
  level: LogLevel;
  requestId?: string;
}

const sensitiveKey =
  /authorization|cookie|credential|password|secret|session|token/i;

function redact(value: LogValue, key?: string): LogValue {
  if (key && sensitiveKey.test(key)) {
    return "[REDACTED]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redact(childValue, childKey),
      ]),
    );
  }

  return value;
}

export function writeLog(entry: LogEntry): void {
  const payload = {
    attributes: entry.attributes ? redact(entry.attributes) : undefined,
    event: entry.event,
    level: entry.level,
    requestId: entry.requestId,
    timestamp: new Date().toISOString(),
  };

  console[entry.level](JSON.stringify(payload));
}
