import type { Metadata } from "next";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { TextLink } from "@/components/ui/Button";
import { CONSENT_VERSION } from "@/lib/consent";

export const metadata: Metadata = { title: "Privacy notice" };

/**
 * The full privacy notice behind the four promises (DPDP Act 2023).
 * Plain words; a lawyer's review is listed as a next step in the TDD.
 */
export default function PrivacyPage() {
  const lab = process.env.NEXT_PUBLIC_LAB_NAME || "The lab";
  return (
    <Shell width="narrow">
      <h1 className={shell.hero} style={{ fontSize: 44 }}>
        How we look after your file.
      </h1>
      <section className={shell.stack}>
        <h2 style={{ margin: 0, fontSize: "1.05em" }}>What we keep</h2>
        <p style={{ margin: 0 }}>
          Your name, age, mobile number, the tests you had and their results, as printed on your
          signed report. Your number is stored locked (encrypted), and staff see only its last four
          digits unless they search for it, which is written down.
        </p>
        <h2 style={{ margin: 0, fontSize: "1.05em" }}>Why we keep it</h2>
        <p style={{ margin: 0 }}>
          Only to send your reports to you and explain them in plain words. We do not sell it or use
          it for advertising.
        </p>
        <h2 style={{ margin: 0, fontSize: "1.05em" }}>Who can see it</h2>
        <p style={{ margin: 0 }}>
          You, and the family members you share this number with, each seeing only their own pages.
          Lab staff who need it to help you. Every opening is written down, and you can read that
          record under Your data and choices.
        </p>
        <h2 style={{ margin: 0, fontSize: "1.05em" }}>Where it is kept</h2>
        <p style={{ margin: 0 }}>
          On servers in Mumbai, India. Plain explanations are written with the help of a computer
          program. It is sent only the test names, values and ranges, never your name or number.
        </p>
        <h2 style={{ margin: 0, fontSize: "1.05em" }}>Changing your mind</h2>
        <p style={{ margin: 0 }}>
          You can withdraw consent at any time under Your data and choices. Reports stop opening
          here, and you can still collect printed copies at the lab. {lab} keeps the medical record
          itself for as long as the law requires.
        </p>
        <p style={{ margin: 0, fontSize: "0.8em", color: "var(--ink-soft)" }}>
          Notice version {CONSENT_VERSION}.
        </p>
      </section>
      <TextLink href="/consent">Back</TextLink>
    </Shell>
  );
}
