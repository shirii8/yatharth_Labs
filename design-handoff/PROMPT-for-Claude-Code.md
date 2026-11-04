Paste this into Claude Code after copying the `design-handoff/` folder into the repo root:

---

The finished UI design for the patient reports portal is in `design-handoff/`. Read `design-handoff/README.md` first. It covers the concept, the screen map, the rules that must survive, motion and budgets.

Then implement the screens in our Next.js app:

1. Copy `design-handoff/fonts/` to `public/fonts/` and import `design-handoff/design/tokens.css` (adjust the font path) in the global stylesheet. Use the CSS variables, not raw hex values.
2. Build the shared pieces first: `Page` (double-ruled sheet), `Tabs` (the index-tab motif), `PrimaryButton` / `SecondaryButton`, `RangeRuler` (value marker plus usual band, positions computed from the report's reference range), `CallFooter` (Call the lab and Call me back), and `Notice` (one component, six kinds).
3. Then build each route in the README's screen map. Match `design-handoff/screens-png/<name>.png`, and take exact copy, sizes and SVG paths from `design-handoff/screens-html/<name>.html`. The `.te` and `.hi` files show the Telugu and Hindi layouts. Put all copy into our i18n message files rather than hard-coding it.
4. Wire the screens to our existing data, auth (OTP), consent and access-log logic. Keep rule-based flags; never compute "low" or "usual" in the UI from anything except the stored reference range and rule result.
5. Add the CSS motion from the README's Motion section, with `prefers-reduced-motion` respected.
6. Check each page's first-load size stays under 150 KB, and that Telugu text doesn't clip in buttons at 390 px width.

Work screen by screen. After each one, compare a screenshot at 390 px against the PNG and fix any differences before moving on.
