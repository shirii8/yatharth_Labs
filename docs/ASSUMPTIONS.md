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

## Open

- O1. Where AI writes summary wording: only drafting templates and translations for staff approval, or also per report. To be decided before Day 3.
