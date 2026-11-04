import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { PrimaryButton } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { requireConsentedPatient } from "@/lib/auth/guards";
import { localeFromCookie, messages } from "@/lib/i18n";
import { setReadingModeAction } from "../actions/patient";

export const metadata: Metadata = { title: "How would you like to read this?" };

/** Simple or Compact, chosen once and changeable from any report. */
export default async function PreferencePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; back?: string }>;
}) {
  const { household } = await requireConsentedPatient();
  const params = await searchParams;
  const t = messages(localeFromCookie((await cookies()).get("lang")?.value)).preference;
  const mode =
    params.mode === "compact" || (!params.mode && household.readingMode === "COMPACT")
      ? "COMPACT"
      : "SIMPLE";
  const back = params.back ?? "";
  const tab = (m: "simple" | "compact") =>
    `/preference?mode=${m}${back ? `&back=${encodeURIComponent(back)}` : ""}`;

  return (
    <Shell
      mode={mode === "COMPACT" ? "compact" : "simple"}
      tabs={
        <Tabs
          label={t.label}
          items={[
            { key: "s", label: t.simple, href: tab("simple"), current: mode === "SIMPLE" },
            {
              key: "c",
              label: t.compact,
              href: tab("compact"),
              current: mode === "COMPACT",
              tint: "var(--sage)",
            },
          ]}
        />
      }
    >
      <h1 className={shell.hero} style={{ fontSize: 40, lineHeight: 1.05 }}>
        {t.title}
      </h1>
      <p style={{ margin: 0 }}>{mode === "SIMPLE" ? t.simpleBody : t.compactBody}</p>
      <Preview mode={mode} />
      <form action={setReadingModeAction}>
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="back" value={back} />
        <PrimaryButton>{mode === "SIMPLE" ? t.ctaSimple : t.ctaCompact}</PrimaryButton>
      </form>
      <p style={{ margin: 0, fontSize: "0.85em", color: "var(--ink-soft)" }}>{t.note}</p>
    </Shell>
  );
}

/** A small picture of each style, drawn with the same pieces as the real report. */
function Preview({ mode }: { mode: "SIMPLE" | "COMPACT" }) {
  const box = {
    border: "2px solid var(--ink)",
    background: "var(--field)",
    padding: 16,
    borderRadius: mode === "SIMPLE" ? 12 : 2,
  };
  if (mode === "SIMPLE") {
    return (
      <div aria-hidden="true" style={{ ...box, display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 15, color: "var(--ink-soft)" }}>Result 1 of 3</span>
        <span style={{ fontWeight: 700 }}>Haemoglobin</span>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 56, lineHeight: 1 }}>10.2</span>
        <svg viewBox="0 0 300 30" width="100%" height="30">
          <rect x="120" y="6" width="110" height="14" fill="var(--sage)" />
          <path d="M4 13H296" stroke="var(--ink)" strokeWidth="1.6" />
          <path d="M70 13v10h-10v8h20v-8h-10" fill="var(--green)" stroke="var(--green)" />
        </svg>
        <span style={{ color: "var(--clay)", fontWeight: 700 }}>A little low.</span>
      </div>
    );
  }
  return (
    <div aria-hidden="true" style={{ ...box, display: "grid", gap: 8, fontSize: 16 }}>
      {[
        ["Haemoglobin", "10.2", "A little low"],
        ["White blood cells", "7.1", "Usual"],
        ["Platelets", "262", "Usual"],
      ].map(([n, v, w]) => (
        <div
          key={n}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            gap: 10,
            borderBottom: "1px solid var(--rule)",
            paddingBottom: 6,
          }}
        >
          <span>{n}</span>
          <strong>{v}</strong>
          <span style={{ color: w === "Usual" ? "var(--ink)" : "var(--clay)" }}>{w}</span>
        </div>
      ))}
    </div>
  );
}
