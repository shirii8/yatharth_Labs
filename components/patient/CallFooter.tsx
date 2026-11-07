import Link from "next/link";
import uiStyles from "@/components/ui/ui.module.css";
import styles from "./shell.module.css";

/** "Call the lab" and "Call me back", on every patient screen. */
export function CallFooter({
  callLab,
  callMeBack,
  inline = false,
}: {
  callLab: string;
  callMeBack: string;
  /** In the laptop header: a compact row instead of the full-width bottom bar. */
  inline?: boolean;
}) {
  const phone = process.env.NEXT_PUBLIC_LAB_PHONE || "+910000000000";
  const Tag = inline ? "div" : "footer";
  return (
    <Tag className={inline ? styles.inlineCalls : styles.footer}>
      <a className={uiStyles.outline} href={`tel:${phone}`}>
        {callLab}
      </a>
      <Link className={uiStyles.outline} href="/call-me-back" prefetch={false}>
        {callMeBack}
      </Link>
    </Tag>
  );
}
