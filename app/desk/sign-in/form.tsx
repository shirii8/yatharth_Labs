"use client";

import { useActionState } from "react";
import { signInStaffAction, type StaffSignInState } from "../actions";
import styles from "../desk.module.css";

export function StaffSignInForm() {
  const [state, action, pending] = useActionState<StaffSignInState, FormData>(
    signInStaffAction,
    {},
  );
  const message =
    state.error === "WRONG"
      ? "That email and password do not match. Check both and try again."
      : state.error === "LOCKED"
        ? `This account is paused after 5 wrong tries. Try again after ${new Date(
            state.until!,
          ).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
          })}, or ask the lab admin.`
        : state.error === "INVALID"
          ? "Please type a work email and a password."
          : null;

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <label htmlFor="email" style={{ fontWeight: 700 }}>
        Work email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
        className={styles.input}
      />
      <label htmlFor="password" style={{ fontWeight: 700 }}>
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className={styles.input}
      />
      {message ? (
        <p role="alert" className={`${styles.notice} ${styles.error}`}>
          {message}
        </p>
      ) : null}
      <button type="submit" className={styles.btnPrimary} disabled={pending}>
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
