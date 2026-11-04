# DESIGN.md

Single source of truth for how this product looks, sounds and moves. Read this before writing any UI. If a screen needs something this file does not cover, extend this file in the same commit.

Product working name: **Yatharth** (set via `NEXT_PUBLIC_BRAND_NAME`, never hard-coded). The lab's own name is `NEXT_PUBLIC_LAB_NAME` and is what patients see in the header.

---

## 1. The one idea

**Your health file, kept by people who know you.**

Every report is a page in the patient's file. Pages sit behind tabs. A person at the lab files each page, writes on it, and calls the patient when it matters. If something on screen is not a file, a page, a tab or a person, it does not belong.

The product must feel calm, homely and unhurried. It must never feel clinical, alarming or like a sales app. Words are plain and kind, never childish, and never playful near a result.

## 2. Who it is for (one adaptive system, not two apps)

- A 68-year-old on an old Android phone on 3G who has never used a portal.
- A 30-year-old on a metro who wants the answer in 5 seconds and may compare with last time.
- A daughter checking her parents' reports.
- Front-desk staff on a desktop, working fast and calmly.

Two reading modes, chosen once ("How would you like to read this?") and changeable any time:
- **Simple**: one result at a time, very large type, a spoken option, Back/Next.
- **Compact**: all results on one screen, tighter leading, square corners, a trend line with one sentence of story.

Text size (Aa) is always one tap away.

## 3. Motif: the index tab

The tab shape is the brand. It appears on language choice, family members, result progress, the "You" marker on the ruler, section dividers (a small notch in the rule) and empty states (drawings of the folder itself). A cropped corner of any screen should be recognisable.

## 4. Tokens

Put these in `app/globals.css` as CSS variables on day 1. Nothing else hard-codes a colour.

| Token | Hex | Job |
|---|---|---|
| `--desk` | `#DCD2BD` | behind the file |
| `--page` | `#FAF6EE` | every page |
| `--ink` | `#161513` | text, rules, frames |
| `--ink-soft` | `#3A3631` | secondary text (still AAA on page) |
| `--green` | `#0F5A43` | ONLY "yours" or "the next step" |
| `--sky` | `#D7E3EE` | quiet tabs |
| `--rose` | `#F1D9DC` | the "please call us" page |
| `--sage` | `#DCE7D6` | usual range band |
| `--sand` | `#F4E9C6` | gentle highlight |
| `--clay` | `#8A3B26` | the words "a little low", text only |
| `--field` | `#FFFDF7` | input background |

Rules:
- Green is never used for status. "Usual" is plain ink with a tick. Status always carries a word, never colour alone.
- No red anywhere in patient screens. The please-call page is a muted rose page, nothing more.
- Body text contrast at least 7:1 (AAA). Large text at least 4.5:1.

## 5. Type

- Display and numbers that matter: **Newsreader** (500 weight, italic for the greeting).
- Body and UI: **Atkinson Hyperlegible Next**.
- Telugu: Noto Sans Telugu (body), Noto Serif Telugu (display). Hindi: Noto Sans Devanagari, Noto Serif Devanagari.
- No monospace anywhere in the patient app.

Scale: body 19px (22px when Aa is on), minimum 17px anywhere. One large serif moment per screen (52 to 96px: a name, a number or a sentence), then quiet 15 to 19px text. Telugu and Hindi get line-height 1.7 and display size about 42px, because the scripts are taller.

**Performance rule for fonts:** self-host with `next/font/local` (subset to Latin, Telugu, Devanagari; only the weights above), `font-display: swap`, system serif and sans fallbacks. No request to Google Fonts at runtime.

## 6. Surface, texture and frame

- Page frame: heavy double rule. `border: 2.5px solid var(--ink)` plus `box-shadow: inset 0 0 0 6px var(--page), inset 0 0 0 7.5px var(--ink)`.
- Paper grain: **do not use the full-page SVG feTurbulence filter from the design mock**. It is heavy on cheap phones. Use one tiny tiled image (under 4 KB, a base64 or static PNG at 120px) as `background-image` on the desk, or a plain CSS texture. Test scroll on a throttled CPU.
- Hand-drawn feel: a few key SVG strokes may use a very small displacement; most lines are plain paths with slightly uneven control points. Never animate a filter.
- Corners: 12px on Simple mode, 2px on Compact mode.
- Touch targets at least 48px. Primary buttons at least 60px tall.

## 7. Components

- **Tab bar**: a row of tabs; the selected one is raised, takes the page colour and has no bottom border; others are tinted and 8px lower. Used for language, family members, result numbers.
- **Primary button**: `--green` fill, `--page` text, a round arrow chip on the right. One per screen. Everything else is an outline button.
- **Outline button**: 2px ink border, `--page` fill.
- **Field**: 2.5px ink border, 62px tall, label above, helper text 0.8em below.
- **Ruler (reference range)**: a hand-drawn horizontal line, a sage band for the usual range with its numbers printed, and a small green tab hanging from the line where the patient's value sits, labelled "You". It is one image to a screen reader with a full sentence label ("Haemoglobin 10.2, usual range 12.0 to 15.5, a little low").
- **Progress strip**: Sample given, Tested, Doctor signed, You read it, as four tabs, the current one raised in green.
- **Notice template**: one layout reused for link expired, link invalid, session timeout, slow net, empty and error. Each has a small drawing (kettle, empty folder, door ajar, unlit lamp, filed-away page) and a line signed by "the front desk".
- **Bottom bar**: "Call the lab" and "Call me back" on every patient screen.
- **Staff table**: plain, dense, sticky header, status as words with a small icon.

## 8. Voice and microcopy

Plain, warm, specific. Short sentences. Always say what happens next and who is doing it.

- Greeting uses an honorific by language: English "Lakshmi garu" is acceptable only because the lab is in coastal Andhra Pradesh, where patients expect it; Telugu "గారు"; Hindi "जी". Put the honorific in the locale file, not in components.
- Never say "urgent", "critical", "abnormal" or "alert" to a patient. Say "Please call us".
- Never diagnose, never say "nothing to worry about", never promise.
- A flagged value says "a little low" or "a little high" or "much lower than usual". Words come from the locked templates only.
- Every page that explains values ends with: "These words come from the lab's checked wording for this test. Low and usual come from the ranges printed on your signed report. Your doctor's advice comes first."

## 9. Screens (patient, 390px wide)

1. Language and sign in (language tabs, mobile number, Send me a code)
2. Enter code (6 boxes, resend timer, wrong code, lockout after 5 tries for 15 minutes)
3. Consent, once (four plain promises: only this number opens your file; every opening is written down; data stays in India; you can withdraw)
4. How would you like to read this? (Simple or Compact)
5. Whose file? (family tabs, count of ready reports, "Someone missing? The front desk can add them")
6. Reports list (ready, being prepared with progress strip, filed away or expired)
7. Report, Simple (greeting, in short, one result per tab with ruler, what to do next, Listen, Save simple report, Full signed report, Something looks wrong)
8. Report, Compact (all results, trend line with one sentence, same footer)
9. Please call us (critical value: see rules below)
10. Something looks wrong (3 steps, creates a flag for staff)
11. Notice (one template)
12. Your data and choices (see access history, withdraw consent)
13. Printable simple report (A4, one page, large type)

States to design and build for every screen that loads data: loading (on slow internet it may take a minute and says so), empty, error, offline.

Staff (desktop, fluid): sign in; CSV import with row errors; patient desk (search, family on same number, reports with delivery status SMS sent, Delivered, Opened, Resend link, access log, callbacks); callback tasks; add a family member.

## 10. Hero moments (build these three well; keep everything else simple)

All motion is CSS only: `transform` and `opacity` only, never layout properties. `@media (prefers-reduced-motion: reduce)` shows the final frame at once. No bounce anywhere.

a) **Opening a report** (900 ms): the green "Blood count, new" tab lifts 6px; the page slides up out of the folder (`cubic-bezier(.2,.8,.2,1)`); the greeting fades and rises 8px; one hand-drawn green thread underlines it. Then stillness.

b) **The value finds its place**: name, helper line and the big value are printed first and never move. The ruler line draws left to right, the sage band fades in and widens from its centre, the green "You" tab slides in from the left and rests on the value, then the words arrive. Positions come from data and rules, never from a model.

c) **Please call us**: the stillest page in the product. No number, no summary, no red. The page simply appears; the phone cord is drawn; one green tick says someone is already on it; the call button breathes slowly (about a calm breath, 5 to 6 seconds a cycle). Under reduced motion all of that is static.

## 11. The critical value rule (non-negotiable)

When any result crosses its critical threshold:
- The patient page shows **no number, no summary and no flag text** for that report. The page says "Please call us about [name]'s report" and "We kept the explanation for that call, so you are not left reading it alone."
- A callback task is created in the same database transaction as the link, with the value and range visible to staff only.
- A fixed safety note is shown. Its wording is a locked template approved by the lab doctor (placeholder text now, marked `NEEDS DOCTOR APPROVAL` in the seed). It is the same for every report of that kind.
- AI is never involved on this path.

## 12. Performance and accessibility budgets

- First load of any patient page under 150 KB transferred, excluding the one-time font download which is cached.
- No client-side UI library heavier than needed. No animation library. No chart library (the trend line is a small inline SVG).
- Server-render patient pages. Works with a flaky 3G connection: a visible loading state, no layout jump.
- WCAG 2.1 AA minimum, AAA for body text contrast. Real `<button>`, `<a>`, `<input>` + `<label>`. `aria-label` on icon-only controls. Decorative SVG `aria-hidden`. Visible focus ring (3px green outline with 3px offset).
- Test on a 360px wide screen and with text size on.

## 13. Do not

- Do not use stock medical blue, stethoscope or heart icons, stock illustration people, gradients, glass effects, emoji, or a grid of pastel icon tiles.
- Do not use black as the default button colour.
- Do not add dark mode in this build.
- Do not use grey for secondary text; use `--ink-soft`.
- Do not add a feature to a screen that is not listed here without adding it to this file first.
