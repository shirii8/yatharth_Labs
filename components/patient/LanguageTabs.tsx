import { Tabs } from "@/components/ui/Tabs";
import { LOCALES, LOCALE_LABELS, messages, type Locale } from "@/lib/i18n";

const TINTS: Record<Locale, string> = { en: "var(--sky)", te: "var(--rose)", hi: "var(--sand)" };

/** English, Telugu, Hindi as index tabs. Each is a link that sets the language and comes back. */
export function LanguageTabs({ current, next }: { current: Locale; next: string }) {
  return (
    <Tabs
      label={messages(current).common.language}
      items={LOCALES.map((code) => ({
        key: code,
        label: LOCALE_LABELS[code],
        href: `/lang/${code}?next=${encodeURIComponent(next)}`,
        current: code === current,
        tint: TINTS[code],
        lang: code,
      }))}
    />
  );
}
