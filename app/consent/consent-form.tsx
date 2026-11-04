"use client";

import { useActionState } from "react";
import { OutlineLink, PrimaryButton } from "@/components/ui/Button";
import type { Messages } from "@/lib/i18n";
import { giveConsentAction, type ConsentState } from "../actions/patient";
import styles from "./consent.module.css";

/** The tick box must be ticked by the patient: it is never pre-ticked. */
export function ConsentForm({ t }: { t: Messages["consent"] }) {
  const [state, action, pending] = useActionState<ConsentState, FormData>(giveConsentAction, {});
  const invalid = state.error === "MUST_AGREE";

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <label className={styles.agree} data-invalid={invalid ? "true" : undefined}>
        <input
          type="checkbox"
          name="agree"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? "agree-error" : undefined}
        />
        <span>{t.agree}</span>
      </label>
      {invalid ? (
        <p
          id="agree-error"
          role="alert"
          style={{ margin: 0, color: "var(--clay)", fontWeight: 700 }}
        >
          {t.mustAgree}
        </p>
      ) : null}
      <PrimaryButton disabled={pending} aria-disabled={pending}>
        {t.cta}
      </PrimaryButton>
      <OutlineLink href="/privacy" prefetch={false}>
        {t.notice}
      </OutlineLink>
    </form>
  );
}
