export const DEFAULT_SCRIPTURE_FONT_SCALE = 1;
export const MIN_SCRIPTURE_FONT_SCALE = 0.6;
export const MAX_SCRIPTURE_FONT_SCALE = 2.2;
export const SCRIPTURE_FONT_SCALE_STEP = 0.1;
export const SCRIPTURE_FONT_SCALE_STORAGE_KEY =
  "levi.scripture.default-font-scale";
const SCRIPTURE_FONT_SCALE_CHANGE_EVENT = "levi:scripture-font-scale-change";

export const SCRIPTURE_FONT_SCALE_OPTIONS = Array.from(
  {
    length:
      Math.round(
        (MAX_SCRIPTURE_FONT_SCALE - MIN_SCRIPTURE_FONT_SCALE) /
          SCRIPTURE_FONT_SCALE_STEP,
      ) + 1,
  },
  (_, index) =>
    Number(
      (MIN_SCRIPTURE_FONT_SCALE + index * SCRIPTURE_FONT_SCALE_STEP).toFixed(1),
    ),
);

export function parseScriptureFontScale(value: unknown): number {
  const scale = typeof value === "number" ? value : Number(value);
  if (
    !Number.isFinite(scale) ||
    scale < MIN_SCRIPTURE_FONT_SCALE ||
    scale > MAX_SCRIPTURE_FONT_SCALE ||
    !Number.isInteger(Number(scale.toFixed(1)) * 10) ||
    Number(scale.toFixed(1)) !== scale
  )
    return DEFAULT_SCRIPTURE_FONT_SCALE;
  return scale;
}

export function readScriptureFontScale(
  storage?: Pick<Storage, "getItem">,
): number {
  try {
    const source =
      storage ?? (typeof window === "undefined" ? null : window.localStorage);
    return source
      ? parseScriptureFontScale(
          source.getItem(SCRIPTURE_FONT_SCALE_STORAGE_KEY),
        )
      : DEFAULT_SCRIPTURE_FONT_SCALE;
  } catch {
    return DEFAULT_SCRIPTURE_FONT_SCALE;
  }
}

export function writeScriptureFontScale(
  scale: number,
  storage?: Pick<Storage, "setItem">,
): number {
  const normalized = parseScriptureFontScale(scale);
  try {
    const target =
      storage ?? (typeof window === "undefined" ? null : window.localStorage);
    target?.setItem(SCRIPTURE_FONT_SCALE_STORAGE_KEY, String(normalized));
    if (storage === undefined && typeof window !== "undefined")
      window.dispatchEvent(new Event(SCRIPTURE_FONT_SCALE_CHANGE_EVENT));
  } catch {
    // The preference is best-effort when browser storage is unavailable.
  }
  return normalized;
}

export function subscribeScriptureFontScale(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === SCRIPTURE_FONT_SCALE_STORAGE_KEY) onChange();
  };
  window.addEventListener(SCRIPTURE_FONT_SCALE_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SCRIPTURE_FONT_SCALE_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function scriptureFontScalePercentage(scale: number): string {
  return `${Math.round(parseScriptureFontScale(scale) * 100)}%`;
}
