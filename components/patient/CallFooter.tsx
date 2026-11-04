import Link from "next/link";
import uiStyles from "@/components/ui/ui.module.css";
import styles from "./shell.module.css";

/** "Call the lab" and "Call me back", on every patient screen. */
export function CallFooter({ callLab, callMeBack }: { callLab: string; callMeBack: string }) {
  const phone = process.env.NEXT_PUBLIC_LAB_PHONE || "+910000000000";
  return (
    <footer className={styles.footer}>
      <a className={uiStyles.outline} href={`tel:${phone}`}>
        {callLab}
      </a>
      <Link className={uiStyles.outline} href="/call-me-back" prefetch={false}>
        {callMeBack}
      </Link>
    </footer>
  );
}
