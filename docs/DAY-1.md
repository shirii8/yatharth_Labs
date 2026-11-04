# Day 1 (4 November 2026)

## Done

- Repo, secrets policy, DESIGN.md, design handoff, assumptions file (A1 to A22).
- Next.js 16, strict TypeScript, ESLint, Prettier, Vitest. Next.js 16 instead of 14 because 14 has unfixed critical advisories.
- Database: 17 tables in Prisma 7, one commit per group, and an append-only trigger on the access log.
- Rules, each test first: flags against the printed range, critical limits, 72 hour links, phone normalising, hashing and encryption, OTP limits.
- LIS CSV import: row validation with plain-sentence errors, idempotent import, link and critical call created in the same transaction as sign-off, SMS after commit.
- Patient sign-in by OTP, server-side sessions, access joined through the household (IDOR tests), consent, reading preference, whose file.
- Summaries: rules plus locked templates; AI paragraph for unlocked tests, checked before showing, stored for review.
- Patient screens: reports list, report Simple and Compact with the ruler and trend, please call us, notices, SMS link page, call me back, something looks wrong, data and choices.
- 140 tests passing (unit and database).

## Cut or changed

- Next.js 14 replaced by 16 (security).
- The deployment target is still Vercel plus Supabase (Mumbai); not deployed yet.

## Next

- Printable report and the signed PDF stand-in.
- Staff console: sign in, CSV import, patient desk with resend and access log, callback tasks, add family member, wording approvals and the AI review queue.
- End-to-end tests, Lighthouse, deployment, deployment.md and the TDD.
