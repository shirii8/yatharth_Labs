# Yatharth: lab report delivery portal

A report delivery portal for a diagnostic lab chain in coastal Andhra Pradesh (6 labs, 38 collection centres). When the pathologist signs a report in the lab system, the patient gets a safe, expiring link by SMS. They sign in with their mobile number and a one-time code, read a plain summary in English, Telugu or Hindi, and download the signed report. Front-desk staff can find a patient, resend links and see delivery status and the access log. Referring doctors see their own patients' reports from the last 90 days, and the lab admin reads a delivery and access report against the brief's targets.

Built as a one-person, 7-day build test. Status: the core slice is complete, tested and live.

## The slice being built

- LIS CSV import, with row-by-row validation
- Automatic report link on sign-off (mock SMS)
- Patient portal: mobile number and OTP, family on one number, report view
- Plain-language summary of out-of-range values (flags by rule, wording from locked templates)
- Front-desk console: search, resend link, delivery status, access log
- Beyond the core: referring doctor view (90 days), delivery and access report, patient settings and first-time setup

## Links

- Live demo: https://yatharth-labs-beryl.vercel.app
- Deployment and local setup: [deployment.md](deployment.md)
- Design: [DESIGN.md](DESIGN.md)
- Assumptions: [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md)

## Stack

Next.js 16 (App Router, server components, TypeScript strict), PostgreSQL with Prisma, Zod, Vitest and Playwright. Run `npm run check` before every push: it runs lint, type checks, format check and tests. SMS and translation sit behind small interfaces with mock defaults, so the app runs with no outside accounts.

## Data

All patient data in this repository is synthetic. No real names, numbers or results.
