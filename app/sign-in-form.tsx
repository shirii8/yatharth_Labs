"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import type { Messages } from "@/lib/i18n";
import { sendCodeAction, type SendState } from "./actions/sign-in";

function time(iso?: string) {
  return iso
    ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
    : "";
}

/** Mobile number in, code out. Works as a plain form post before JavaScript loads. */
export function SignInForm({ t }: { t: Messages["signIn"] }) {
  const [state, action, pending] = useActionState<SendState, FormData>(sendCodeAction, {});

  const error =
    state.error === "BAD_PHONE"
      ? t.badPhone
      : state.error === "LOCKED"
        ? t.locked.replace("{time}", time(state.retryAt))
        : state.error === "DAILY_CAP"
          ? t.dailyCap
          : undefined;

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 24 }} noValidate>
      <Field
        id="phone"
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        label={t.phoneLabel}
        placeholder={t.phonePlaceholder}
        hint={t.phoneHint}
        error={error}
        prefix="+91"
        required
        maxLength={16}
      />
      <PrimaryButton disabled={pending} aria-disabled={pending}>
        {pending ? t.sending : t.send}
      </PrimaryButton>
    </form>
  );
}
