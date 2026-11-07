import { saveRelationsAction } from "@/app/actions/patient";
import { PrimaryButton, TextLink } from "@/components/ui/Button";
import type { Messages } from "@/lib/i18n";
import { RELATIONS } from "@/lib/patient/relations";
import styles from "./people.module.css";

/**
 * One row per person on the number, each with a plain native select: the
 * phone's own picker is the easiest control for older hands. A relation the
 * lab typed that is not on our list stays as the first choice, so saving
 * never loses it.
 */
export function PeopleForm({
  people,
  t,
  from,
  error,
  saved,
}: {
  people: { id: string; name: string; age: number; relation: string }[];
  t: Messages["people"];
  from: "setup" | "settings";
  error?: string;
  saved?: boolean;
}) {
  const words = (relation: string) => t.relations[relation] ?? relation;

  return (
    <form action={saveRelationsAction} className={styles.form}>
      <input type="hidden" name="from" value={from} />
      {error ? (
        <p role="alert" className={styles.error}>
          {error === "two-self" ? t.twoSelf : t.bad}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className={styles.saved}>
          <span aria-hidden="true" className={styles.tick} />
          {t.saved}
        </p>
      ) : null}
      <ul className={styles.list}>
        {people.map((p, i) => {
          const known = (RELATIONS as readonly string[]).includes(p.relation);
          return (
            <li key={p.id} className={styles.person} style={{ animationDelay: `${i * 60}ms` }}>
              <span className={styles.initial} aria-hidden="true">
                {p.name.trim().charAt(0)}
              </span>
              <label htmlFor={`rel-${p.id}`} className={styles.who}>
                <span className={styles.name}>{t.isLabel.replace("{name}", p.name)}</span>
                <span className={styles.age}>{t.years.replace("{age}", String(p.age))}</span>
              </label>
              <select
                id={`rel-${p.id}`}
                name={`rel:${p.id}`}
                defaultValue={p.relation}
                className={styles.select}
              >
                {known ? null : <option value={p.relation}>{p.relation}</option>}
                {RELATIONS.map((r) => (
                  <option key={r} value={r}>
                    {words(r)}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
      <PrimaryButton>{from === "setup" ? t.cta : t.save}</PrimaryButton>
      <div className={styles.missing}>
        <strong>{t.missingHead}</strong>
        <span>{t.missingBody}</span>
        <TextLink href="/call-me-back" prefetch={false}>
          {t.askCall}
        </TextLink>
      </div>
    </form>
  );
}
