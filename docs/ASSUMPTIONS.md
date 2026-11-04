# Assumptions

Everything here is something the client brief does not say, or says loosely, and that this build had to decide. Each line is added in the same commit as the code that relies on it. The Technical Design Document lists all of them.

Sources, in order of authority: the client brief, then `DESIGN.md`, then the build plan.

## Client and scope

- A1. The client is the lab chain in Vijayawada described in the brief. An earlier build plan said Navi Mumbai; that was an error and the brief wins.
- A2. Roles built in the core slice are patient and front-desk staff, as the brief asks. A `lab_admin` role is added only to approve wording (templates and translations), because front-desk staff should not change medical wording.
- A3. Referring doctor view and the operations delivery report are optional depth. They are built only if the core slice is finished.

## Lab system and delivery

- A4. The LIS export folder is simulated by uploading its CSV in the staff console. The import service takes a file, so a folder watcher can call the same code later. No change to the LIS, which is out of scope.
- A5. A report counts as signed when its export row says `Ready` or `Ready (critical)`. `Processing` means tested but not signed, and is never shown to the patient as a result.
- A6. Messages go out as SMS through a mock provider. WhatsApp, which the brief also allows, would be a second implementation of the same interface.
- A7. The signed PDF comes from the LIS and is not in the sample data, so the demo serves a generated stand-in clearly marked as a sample.

## Links and sign-in

- A8. Read literally, the brief says a link opens its one report for 72 hours, and after that the patient signs in with an OTP to reopen it. The build follows that reading.

## Data and hosting

- A9. "Hosting in India" is met with the database in Supabase's Mumbai region and Vercel functions pinned to the Mumbai region.
- A10. Seed data uses the brief's sample patients, orders and results. Phone numbers are fake (+91 90000 0000x), and extra family members are invented.

## AI summaries

- A11. The AI makes real model calls; it is a required feature, not a mock. Rules decide every flag. The AI only writes the wording, and a checker rejects any output whose numbers or flag words do not match the rules, or that uses banned words. On a rejected output, a timeout or no API key, the patient sees the plain rule line and the full report link.
- A12. The AI receives only the test name, analyte names, values, units, ranges and rule flags. No name, phone, age or order ID is sent, so no personal data leaves India. An India-hosted model (for example Sarvam) can replace it behind the same interface.
- A13. Critical results never reach the AI. Tests with an approved locked template use the template text and make no AI call at read time.
- A14. Telugu and Hindi wording written by the AI is a draft until a lab_admin approves it. Until then the patient sees English.

## Import format and test catalog

- A15. The LIS export has the brief's sample columns (Order ID, Patient, Parameter, Result, Reference Range, Status, Referring Doctor) plus Phone, Age, Sex, Test Code, and optional Relation and Signed At. The brief does not give the full layout, and a patient cannot be reached without a phone number.
- A16. A patient is matched by phone number plus name. A new name on a known number becomes a new family member on that number.
- A17. Critical limits (for example potassium 6.0 mmol/L and above, haemoglobin 7.0 g/dL and below) are placeholders. The brief gives none, so the lab doctor must confirm them before go-live. A report is also critical whenever the LIS marks it "Ready (critical)".
- A18. CBC and Electrolytes have locked, doctor-approved templates in the demo; Lipid and Thyroid do not, so the demo shows both the template path and the AI path.

## Sign-in and sessions

- A19. The brief asks for a daily cap on codes but gives no number. The cap is 5 codes per number in 24 hours.
- A20. A patient session ends after 30 minutes without use and after 12 hours at most. A session opened from an SMS link lasts at most 2 hours and opens only that report. Staff sessions end after 2 hours idle or 10 hours.
- A21. Three demo numbers (+91 90000 00001 to 00003) accept a fixed code only when DEMO_MODE is on, so reviewers can sign in without a phone. It is off by default.
