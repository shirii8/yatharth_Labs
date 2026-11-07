"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { PrimaryButton } from "@/components/ui/Button";
import type { Messages } from "@/lib/i18n";
import { resendCodeAction, verifyCodeAction, type VerifyState } from "../actions/sign-in";
import styles from "./code.module.css";

const DIGITS = [0, 1, 2, 3, 4, 5];

/**
 * Six boxes, one digit each. The first box accepts the whole code, so the
 * phone's SMS autofill and pasting both work. Each box has its own label.
 */
export function CodeForm({ t, resendAt }: { t: Messages["code"]; resendAt: string | null }) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifyCodeAction, {});
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  function fillFrom(index: number, text: string) {
    const clean = text.replace(/\D/g, "").slice(0, 6 - index);
    if (!clean) return;
    const next = [...digits];
    clean.split("").forEach((d, i) => (next[index + i] = d));
    setDigits(next);
    boxes.current[Math.min(index + clean.length, 5)]?.focus();
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      boxes.current[index - 1]?.focus();
    }
  }

  function onPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    fillFrom(index, event.clipboardData.getData("text"));
  }

  const invalid = state.error === "WRONG";
  const message =
    state.error === "WRONG"
      ? state.attemptsLeft === 1
        ? t.wrongLast
        : t.wrongMore.replace("{n}", String(state.attemptsLeft ?? ""))
      : state.error === "EXPIRED" || state.error === "USED"
        ? t.expired
        : state.error === "BAD_CODE"
          ? t.badCode
          : null;

  return (
    <>
      <form action={action} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t.legend}</legend>
          <div className={styles.boxes}>
            {DIGITS.map((i) => (
              <input
                key={i}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                name={`d${i + 1}`}
                className={styles.box}
                aria-label={t.digit.replace("{n}", String(i + 1))}
                aria-invalid={invalid}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={i === 0 ? 6 : 1}
                pattern="[0-9]*"
                value={digits[i]}
                autoFocus={i === 0}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length > 1) return fillFrom(i, value);
                  const next = [...digits];
                  next[i] = value.replace(/\D/g, "");
                  setDigits(next);
                  if (next[i] && i < 5) boxes.current[i + 1]?.focus();
                }}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={(e) => onPaste(i, e)}
              />
            ))}
          </div>
        </fieldset>
        {message ? (
          <p role="alert" className={styles.alert}>
            {invalid ? <strong>{t.wrong} </strong> : null}
            {message}
          </p>
        ) : null}
        <PrimaryButton disabled={pending} aria-disabled={pending}>
          {pending ? t.checking : invalid ? t.tryAgain : t.open}
        </PrimaryButton>
      </form>
      <Resend t={t} resendAt={resendAt} />
    </>
  );
}

/** "No SMS yet?" with a visible countdown to the 60 second resend limit. */
function Resend({ t, resendAt }: { t: Messages["code"]; resendAt: string | null }) {
  const [left, setLeft] = useState(() => secondsUntil(resendAt));

  useEffect(() => {
    if (left <= 0) return;
    const timer = setInterval(() => setLeft(secondsUntil(resendAt)), 1000);
    return () => clearInterval(timer);
  }, [left, resendAt]);

  return (
    <div className={styles.resend}>
      <span>{t.noSms}</span>
      {left > 0 ? (
        <span aria-live="polite" suppressHydrationWarning>
          {t.resendIn.replace(
            "{time}",
            `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`,
          )}
        </span>
      ) : (
        <form action={resendCodeAction}>
          <button className={styles.resendButton} type="submit">
            {t.resend}
          </button>
        </form>
      )}
    </div>
  );
}

function secondsUntil(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}
