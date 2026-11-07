import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { EasyToggle } from "@/components/patient/EasyToggle";
import {
  BookIcon,
  ChevronIcon,
  DoorIcon,
  EyeIcon,
  GlobeIcon,
  PeopleIcon,
  ShieldIcon,
  TextIcon,
} from "@/components/patient/Icons";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { TextSizeToggle } from "@/components/patient/TextSizeToggle";
import { requireConsentedPatient } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { LOCALES, LOCALE_LABELS, localeFromCookie, messages } from "@/lib/i18n";
import { signOutAction } from "../actions/patient";
import styles from "./settings.module.css";

export const metadata: Metadata = { title: "Settings" };

/**
 * Settings: one list, one row per choice. Rows that open a page end in a
 * chevron; rows that change something at once hold their own switch.
 */
export default async function SettingsPage() {
  const { household } = await requireConsentedPatient();
  const jar = await cookies();
  const locale = localeFromCookie(jar.get("lang")?.value);
  const t = messages(locale);
  const s = t.settings;
  const count = await db.patient.count({ where: { householdId: household.id } });
  const easy = jar.get("easy")?.value === "on";

  return (
    <Shell nav>
      <div className={shell.split}>
        <div className={shell.col}>
          <h1 className={shell.hero}>{s.title}</h1>
          <p style={{ margin: "-8px 0 0" }}>{s.lede}</p>
        </div>
        <div className={shell.col}>
          <ul className={styles.list}>
            <LinkRow
              href="/settings/people"
              icon={<PeopleIcon />}
              label={s.people}
              value={s.peopleCount
                .replace("{count}", String(count))
                .replace("{phone}", household.phoneMasked)}
            />
            <LinkRow
              href="/preference?back=/settings"
              icon={<BookIcon />}
              label={s.reading}
              value={
                easy ? s.readingEasy : household.readingMode === "COMPACT" ? s.compact : s.simple
              }
              advanced
            />
            <Row icon={<GlobeIcon />} label={s.language}>
              <div className={styles.langs}>
                {LOCALES.map((code) => (
                  <a
                    key={code}
                    lang={code}
                    href={`/lang/${code}?next=/settings`}
                    aria-current={code === locale ? "true" : undefined}
                    className={styles.lang}
                  >
                    {LOCALE_LABELS[code]}
                  </a>
                ))}
              </div>
            </Row>
            <Row icon={<EyeIcon />} label={s.easy} hint={s.easyHint}>
              <EasyToggle initial={easy} label={s.easy} states={{ on: s.on, off: s.off }} />
            </Row>
            <Row icon={<TextIcon />} label={s.textSize} hint={s.textSizeHint} advanced>
              <TextSizeToggle
                initial={jar.get("text")?.value === "large"}
                label={t.common.textSize}
              />
            </Row>
            <LinkRow href="/me/data" icon={<ShieldIcon />} label={s.data} value={s.dataHint} />
          </ul>
          <form action={signOutAction} className={styles.signOutForm}>
            <button type="submit" className={styles.signOut}>
              <DoorIcon />
              {s.signOut}
            </button>
            <span className={styles.hint}>{s.signOutHint}</span>
          </form>
        </div>
      </div>
    </Shell>
  );
}

function LinkRow({
  href,
  icon,
  label,
  value,
  advanced = false,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: string;
  advanced?: boolean;
}) {
  return (
    <li data-advanced={advanced ? "" : undefined}>
      <Link href={href} prefetch={false} className={styles.linkRow}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.words}>
          <span className={styles.label}>{label}</span>
          <span className={styles.hint}>{value}</span>
        </span>
        <span className={styles.chev}>
          <ChevronIcon />
        </span>
      </Link>
    </li>
  );
}

function Row({
  icon,
  label,
  hint,
  advanced = false,
  children,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  advanced?: boolean;
  children: ReactNode;
}) {
  return (
    <li className={styles.row} data-advanced={advanced ? "" : undefined}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.words}>
        <span className={styles.label}>{label}</span>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </span>
      <span className={styles.control}>{children}</span>
    </li>
  );
}
