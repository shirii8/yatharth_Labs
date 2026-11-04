import { Tabs } from "@/components/ui/Tabs";
import type { Messages } from "@/lib/i18n";
import type { FamilyMember } from "@/lib/patient/family";
import { firstName } from "@/lib/patient-format";

/**
 * One index tab per person on this number. A person with a report to call
 * about gets a dot plus the words in the tab's label, never colour alone.
 */
export function FamilyTabs({
  people,
  currentId,
  href,
  t,
  keepTint = false,
}: {
  people: FamilyMember[];
  currentId: string;
  href: (personId: string) => string;
  t: Messages["family"];
  keepTint?: boolean;
}) {
  return (
    <Tabs
      label={t.label}
      keepTint={keepTint}
      items={people.map((x) => ({
        key: x.person.id,
        href: href(x.person.id),
        current: x.person.id === currentId,
        tint: x.tint,
        ariaLabel: `${x.person.name}, ${
          x.call ? t.tabCall : x.fresh.length ? t.tabNew : t.tabNothing
        }`,
        label: (
          <>
            {firstName(x.person.name)}
            {x.call ? (
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "var(--clay)",
                  display: "inline-block",
                }}
              />
            ) : null}
          </>
        ),
      }))}
    />
  );
}
