import { en, type Messages } from "./en";
import { hi } from "./hi";
import { te } from "./te";

/**
 * Patient copy in English, Telugu and Hindi. Telugu and Hindi files come from the
 * design handoff and are drafts until a native speaker reviews them. Any key a
 * translation does not have yet falls back to English, so no screen is ever blank.
 */

export type Locale = "en" | "te" | "hi";
export const LOCALES: Locale[] = ["en", "te", "hi"];
export const LOCALE_LABELS: Record<Locale, string> = { en: "English", te: "తెలుగు", hi: "हिन्दी" };

export function localeFromCookie(value: string | undefined): Locale {
  return value === "te" || value === "hi" ? value : "en";
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type PartialMessages = DeepPartial<Messages>;

function merge<T>(base: T, over: DeepPartial<T> | undefined): T {
  if (!over) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(over)) {
    const current = out[key];
    out[key] =
      value && typeof value === "object" && !Array.isArray(value) && current
        ? merge(current, value as DeepPartial<typeof current>)
        : value;
  }
  return out as T;
}

const cache: Partial<Record<Locale, Messages>> = {};

export function messages(locale: Locale): Messages {
  cache[locale] ??= locale === "en" ? en : merge(en, locale === "te" ? te : hi);
  return cache[locale]!;
}

/** Fills {name} style placeholders. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export type { Messages };
