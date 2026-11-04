import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/cookies";
import styles from "../desk.module.css";
import { StaffSignInForm } from "./form";

export const metadata: Metadata = { title: "Desk sign in" };

/** Staff sign in with email and password. Patients never see this page. */
export default async function StaffSignInPage() {
  const session = await currentSession();
  if (session?.kind === "STAFF") redirect("/desk/patients");
  const lab = process.env.NEXT_PUBLIC_LAB_NAME || "Lab";
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100dvh", padding: 16 }}>
      <main className={styles.sheet} style={{ width: "100%", maxWidth: 440 }}>
        <span className={styles.brand}>{lab} · desk</span>
        <h1 className={styles.title} style={{ marginTop: 16 }}>
          Good morning.
        </h1>
        <p className={styles.muted} style={{ marginTop: 0 }}>
          Sign in to find patients, import results and make today&apos;s calls.
        </p>
        <StaffSignInForm />
      </main>
    </div>
  );
}
