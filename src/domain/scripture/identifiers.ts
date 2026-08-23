import { z } from "zod";

export const scriptureLanguages = ["ja", "en", "both"] as const;
export type ScriptureLanguage = (typeof scriptureLanguages)[number];

export const scriptureTranslations = ["JSS3", "NKJV"] as const;
export type ScriptureTranslation = (typeof scriptureTranslations)[number];

export const scriptureBookCodeSchema = z
  .string()
  .regex(/^[A-Z0-9][A-Z0-9_-]{0,15}$/);

export const positiveSmallIntSchema = z
  .string()
  .regex(/^[1-9]\d{0,4}$/)
  .transform(Number)
  .refine((value) => value <= 32767);

export const nonNegativeSmallIntSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,4})$/)
  .transform(Number)
  .refine((value) => value <= 32767);

export function hasExactQueryMultiplicity(
  searchParams: URLSearchParams,
  {
    optional = [],
    required,
  }: { optional?: readonly string[]; required: readonly string[] },
) {
  const allowed = new Set([...required, ...optional]);
  return (
    ![...searchParams.keys()].some((key) => !allowed.has(key)) &&
    required.every((key) => searchParams.getAll(key).length === 1) &&
    optional.every((key) => searchParams.getAll(key).length <= 1)
  );
}
