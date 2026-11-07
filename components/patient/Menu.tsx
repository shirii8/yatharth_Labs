"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { signOutAction } from "@/app/actions/patient";
import type { Messages } from "@/lib/i18n";
import {
  BookIcon,
  ChevronIcon,
  DoorIcon,
  GearIcon,
  HomeIcon,
  PeopleIcon,
  ShieldIcon,
} from "./Icons";
import styles from "./menu.module.css";

/**
 * The menu on phones and tablets. A real modal dialog: it traps focus, closes
 * with Escape, a tap outside or the Close button, and closes itself after any
 * move to another page. On laptops the header has room, so this button hides
 * and a Settings link shows instead.
 */
export function Menu({
  t,
  languages,
  labName,
  textSize,
}: {
  t: Messages["nav"];
  /** English, Telugu, Hindi, with the current one marked. Built on the server. */
  languages: { code: string; label: string; current: boolean }[];
  labName: string;
  /** The Aa switch, passed in so the menu reuses the same control. */
  textSize: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  // Any navigation closes the menu, so the next page is never hidden behind it.
  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  const open = () => dialog.current?.showModal();
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        onClick={open}
        aria-label={t.menu}
      >
        <span className={styles.burger} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className={styles.triggerWord}>{t.menu}</span>
      </button>
      <dialog
        ref={dialog}
        className={styles.panel}
        aria-label={t.label}
        // A tap on the dim area around the panel closes it.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className={styles.inner}>
          <div className={styles.head}>
            <span className={styles.brand}>{labName}</span>
            <button type="button" className={styles.close} onClick={close}>
              <span aria-hidden="true" className={styles.cross} />
              {t.close}
            </button>
          </div>
          <nav aria-label={t.label}>
            <ul className={styles.list}>
              <Item href="/family" icon={<HomeIcon />} label={t.home} hint={t.homeHint} />
              <Item href="/settings/people" icon={<PeopleIcon />} label={t.people} />
              <Item
                href="/preference?back=/settings"
                icon={<BookIcon />}
                label={t.reading}
                advanced
              />
              <Item href="/me/data" icon={<ShieldIcon />} label={t.data} />
              <Item href="/settings" icon={<GearIcon />} label={t.allSettings} advanced />
            </ul>
          </nav>
          <div className={styles.row}>
            <span className={styles.rowLabel}>{t.language}</span>
            <div className={styles.langs}>
              {languages.map(({ code, label, current }) => (
                // A plain link: the language is a cookie, so the whole page reloads in it.
                <a
                  key={code}
                  lang={code}
                  href={`/lang/${code}?next=${encodeURIComponent(pathname)}`}
                  aria-current={current ? "true" : undefined}
                  className={styles.lang}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
          <div className={`${styles.row} ${styles.inline}`} data-advanced="">
            <span className={styles.rowLabel}>{t.textSize}</span>
            {textSize}
          </div>
          <form action={signOutAction}>
            <button type="submit" className={styles.signOut}>
              <DoorIcon />
              {t.signOut}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}

function Item({
  href,
  icon,
  label,
  hint,
  advanced = false,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  hint?: string;
  advanced?: boolean;
}) {
  return (
    <li data-advanced={advanced ? "" : undefined}>
      <Link href={href} prefetch={false} className={styles.item}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.words}>
          <span>{label}</span>
          {hint ? <span className={styles.hint}>{hint}</span> : null}
        </span>
        <span className={styles.chev}>
          <ChevronIcon />
        </span>
      </Link>
    </li>
  );
}
