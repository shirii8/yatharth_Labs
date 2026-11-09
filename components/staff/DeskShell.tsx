import Link from "next/link";
import type { ReactNode } from "react";
import styles from "@/app/desk/desk.module.css";
import { signOutStaffAction } from "@/app/desk/actions";
import { can, type StaffAction } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import type { StaffUser } from "@/lib/generated/prisma/client";

const NAV: { href: string; label: string; action: StaffAction }[] = [
  { href: "/desk/import", label: "Import results", action: "import" },
  { href: "/desk/patients", label: "Patients", action: "desk" },
  { href: "/desk/calls", label: "Callbacks and flags", action: "callbacks" },
  { href: "/desk/wording", label: "Wording approvals", action: "approveWording" },
  { href: "/desk/ai-review", label: "AI summary review", action: "reviewAi" },
  { href: "/desk/report", label: "Delivery report", action: "report" },
  { href: "/desk/doctor", label: "My patients' reports", action: "doctorReports" },
];

const ROLE_NAME = { FRONT_DESK: "front desk", LAB_ADMIN: "lab admin", DOCTOR: "referring doctor" };

/** The desk frame: a sidebar showing only what this role may do, and the sheet. Doctors use it too. */
export async function DeskShell({
  staff,
  current,
  children,
}: {
  staff: StaffUser;
  current: string;
  children: ReactNode;
}) {
  const open = await db.callbackTask.count({ where: { status: "OPEN" } });
  const lab = process.env.NEXT_PUBLIC_LAB_NAME || "Lab";
  return (
    <div className={styles.layout}>
      <aside className={styles.side}>
        <span className={styles.brand}>
          {lab} · {staff.role === "DOCTOR" ? "doctors" : "desk"}
        </span>
        <nav className={styles.nav} aria-label="Desk">
          {NAV.filter((n) => can(staff.role, n.action)).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={current === n.href ? "page" : undefined}
              prefetch={false}
            >
              {n.label}
              {n.href === "/desk/calls" && open > 0 ? (
                <span className={styles.badge} aria-label={`${open} open`}>
                  {open}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
        <span className={styles.who}>
          {staff.name} · {ROLE_NAME[staff.role]}
        </span>
        <form action={signOutStaffAction}>
          <button type="submit" className={styles.signOut}>
            Sign out
          </button>
        </form>
      </aside>
      <main className={styles.sheet}>{children}</main>
    </div>
  );
}
