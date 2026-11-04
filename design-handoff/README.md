# Lab reports portal: design handoff

**Concept:** *Your health file, kept by people who know you.* Each report is a page in the patient's file, behind its own index tab. A person at the lab files it, writes on it and calls you when it matters.

This folder contains everything needed to build the UI in code. The design is finished; build it as specified.

## What's here

| Folder | What it is | How to use it |
|---|---|---|
| `screens-png/` | A 2x screenshot of every screen and state | The visual truth. Match these. |
| `screens-html/` | The same screens as plain static HTML with inline styles and real copy | Open in a browser. Lift exact sizes, spacing, copy and SVG paths. Not production code. |
| `design/tokens.css` | Colours, type, shape and motion tokens, plus `.page`, `.tab` and `.btn-*` | Import globally and use the variables, not raw hex. |
| `fonts/` | Self-hosted woff2 files and `fonts.css` (Latin, Telugu, Devanagari) | Copy to `public/fonts`. Do not call Google Fonts at runtime. |
| `source/` | The original design-canvas files (`*.dc.html`) and `canvas.json` | Reference only. Each holds its copy dictionaries (en / te / hi) and its state logic in the `<script>` block at the bottom. |

## Screen map

Suggested routes assume Next.js App Router. Rename freely.

| # | Screen file(s) | Suggested route | States to build |
|---|---|---|---|
| 10 | `10-sign-in` (+ `.te`, `.hi`) | `/` | language tabs en / te / hi, Aa size toggle |
| 11 | `11-code`, `.wrong`, `.locked` | `/code` | normal, wrong code (tries left), locked 15 min after 5 wrong tries |
| 12 | `12-consent` | `/consent` | once per person; checkbox must be ticked |
| 13 | `13-reading-preference` | `/preference` | Simple or Compact, shown once, changeable via Aa |
| 14 | `14-whose-file` | `/family` | family as index tabs; a person with a critical result has a dot plus words |
| 15 | `15-reports-list` | `/file/[personId]` | new (green tab), being prepared (kettle), filed away / expired |
| 16 | `16-report-simple` (+ `.te`, `.hi`) | `/file/[personId]/[reportId]` | one result per tab, Back / Next, Listen, ruler |
| 17 | `17-report-compact` | same route, `?view=compact` | all results, trend line plus one sentence |
| 18 | `18-critical-please-call` (+ `.te`) | same route when critical | **no value, no summary**; fixed safety note; callback already requested |
| 19 | `19-flag.step1/2/3` (+ `step1.te`) | `/file/.../flag` | three steps; creates a staff task |
| 20 | `20-notice.*` | shared `<Notice kind>` | expired, invalid, timeout, loading (slow net), empty, error |
| 21 | `21-data-and-choices` (+ `.withdraw`) | `/me/data` | access ledger, preferences, consent withdrawal with consequences listed first |
| 22 | `22-printable-report-a4` | `/file/.../print` (print CSS) | one A4 page |
| 30–33 | `30-staff-sign-in`, `31-staff-csv-import`, `32-staff-patient-desk`, `33-staff-add-family-member` | `/desk/...` | import row errors (bad phone, unknown test code) with inline fixes; delivery; access log; callbacks; flag inbox; add a member with consent |
| 00–03 | `00-before-and-after`, `01-03 hero-*` | — | Rationale and motion specs, not app screens |

## Rules that must survive implementation

1. **One accent, one job.** `--accent` (ink-green) means only "this is yours / the next step": primary buttons, the active result tab, the "You" marker on the ruler, the underline thread. Never use it for status, and don't put black on primary buttons.
2. **The index-tab motif everywhere:** languages, family, results 1–4, the "You" marker, divider notches, and the empty-state drawings. Build one `<Tabs>` component and reuse it.
3. **One big serif moment per screen** (`--hero`, Newsreader 500): a name, a number or a sentence. Everything else is quiet 15–19 px sans.
4. **Status is always a word plus a mark.** Colour is never the only signal.
5. **Flags come from rules, not AI.** Whether a value is low or usual is decided by the lab's rule against the reference range printed on the signed report. The ruler band and marker positions come from the same numbers, and every result says so in its footnote.
6. **Critical value:** show no number and no summary. The page fades in (no slide), gives one sentence, a green "Call the lab now" button that breathes every 4 s, and shows "We have asked our team to call you" with a tick. The safety note is fixed text approved by the lab doctor. Avoid "urgent", "critical" and "abnormal" in patient copy.
7. **Call the lab and Call me back are on every patient screen.**
8. **Telugu and Hindi:** use line-height `--lh-indic` and smaller hero sizes (about 42 px). Buttons grow in height and never clip; check `16-report-simple.te.png`. Telugu and Hindi strings are drafts and need native-speaker review before they go into the locked templates.

## Motion (all CSS; see hero PNGs 01–03 for frames)

- **Opening a report** (`01`, 900 ms): your green tab lifts 6 px over 0–180 ms. The page slides up out of the folder with `--ease-paper` (180–420 ms). The greeting fades in and rises 8 px (by 600 ms). The green thread underline draws by `stroke-dashoffset` (by 900 ms). Then nothing moves.
- **Value finds its place** (`02`, 1.3 s): the number is printed first and stays still. The ruler draws left to right (0–300 ms). The usual band fades in and widens from its centre (to 500 ms). The "You" tab slides in from the left and rests at the value, 600 ms with `--ease-paper` (to 1100 ms). Then the words "A little low…" arrive (1300 ms).
- **Critical** (`03`): the page fades in over 300 ms. The phone cord draws (1.2 s). The tick fills green (1.6 s). The button halo breathes every 4 s.
- **Being prepared:** the kettle's steam breathes on a 4.5 s cycle.
- Animate only transform, opacity and stroke-dashoffset. Under `prefers-reduced-motion`, show the final frame at once.

## Budgets and accessibility

- Under **150 KB first load per page**. Subset fonts per locale (load only `fonts.css` faces for the active script). There are no images; all drawings are inline SVG. Server-render; ship little JS.
- Touch targets: 56 px minimum, primary 60–64 px. Body text 19 px minimum (22 in Simple mode). Body contrast is AAA.
- The ruler is one `role="img"` with a full-sentence `aria-label` (see `screens-html`). Tabs use real `role="tab"` / `aria-selected`, or links with `aria-current`.
- "Listen" uses the browser's `speechSynthesis`. Hide the button if no voice exists for the locale.
- OTP inputs use `autocomplete="one-time-code"`.

## Placeholders to replace

`[Lab name]`, `[LAB PHONE]`, `[LAB DOCTOR NAME]`, `[REPORT ID]`, and the `tel:+910000000000` links. Patient names and values are sample data only.
