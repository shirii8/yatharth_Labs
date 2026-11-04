"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addFamilyAction, type FamilyState } from "../../../actions";
import styles from "../../../desk.module.css";

export function AddFamilyForm({
  householdId,
  phone,
  family,
}: {
  householdId: string;
  phone: string;
  family: string;
}) {
  const [state, action, pending] = useActionState<FamilyState, FormData>(addFamilyAction, {});
  const error = (field: string) =>
    state.errors?.[field] ? (
      <span role="alert" style={{ color: "var(--clay)", fontWeight: 700 }}>
        {state.errors[field]}
      </span>
    ) : null;

  return (
    <form action={action} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
      <h1 className={styles.title}>Add a family member</h1>
      <p className={styles.muted} style={{ margin: 0 }}>
        To {phone}. Already on this number: {family || "nobody yet"}. They will see this
        person&apos;s reports with the same code, so check with the number holder first.
      </p>
      <input type="hidden" name="householdId" value={householdId} />
      <label htmlFor="name" style={{ fontWeight: 700 }}>
        Full name, as on the lab form
      </label>
      <input id="name" name="name" required className={styles.input} />
      {error("name")}
      <label htmlFor="age" style={{ fontWeight: 700 }}>
        Age
      </label>
      <input
        id="age"
        name="age"
        type="number"
        min={0}
        max={120}
        required
        className={styles.input}
      />
      {error("age")}
      <label htmlFor="sex" style={{ fontWeight: 700 }}>
        Sex
      </label>
      <select id="sex" name="sex" className={styles.input} defaultValue="FEMALE">
        <option value="FEMALE">Female</option>
        <option value="MALE">Male</option>
        <option value="OTHER">Other</option>
      </select>
      <label htmlFor="relation" style={{ fontWeight: 700 }}>
        Relation to the number holder
      </label>
      <input
        id="relation"
        name="relation"
        placeholder="Mother, Son, Daughter"
        required
        className={styles.input}
      />
      {error("relation")}
      <div className={styles.actions} style={{ marginTop: 8 }}>
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          Add to this number
        </button>
        <Link href={`/desk/patients/${householdId}`} className={styles.btn}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
