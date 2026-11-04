// Builds docs/TDD.pdf from docs/tdd/tdd.template.html.
// The assumptions are read from docs/ASSUMPTIONS.md, so the TDD can never drift from it.
// Usage: LIVE_URL=https://... UNIT=99 DB=67 node scripts/build-tdd.mjs
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) => escape(s).replace(/`([^`]+)`/g, "<code>$1</code>");

function assumptionsHtml(markdown) {
  const out = [];
  let open = false;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) {
      if (open) out.push("</ul>");
      out.push(`<h3>${inline(line.slice(3))}</h3><ul>`);
      open = true;
    } else if (line.startsWith("- ")) {
      out.push(`<li>${inline(line.slice(2))}</li>`);
    }
  }
  if (open) out.push("</ul>");
  return out.join("\n");
}

const root = resolve(".");
const template = readFileSync("docs/tdd/tdd.template.html", "utf8");
const html = template
  .replace("{{ASSUMPTIONS}}", assumptionsHtml(readFileSync("docs/ASSUMPTIONS.md", "utf8")))
  .replace(
    "{{LIVE_URL}}",
    process.env.LIVE_URL
      ? `<a href="${process.env.LIVE_URL}">${process.env.LIVE_URL}</a>`
      : "not deployed yet",
  )
  .replace("{{COMMIT}}", execSync("git rev-parse --short HEAD").toString().trim())
  .replace("{{UNIT}}", process.env.UNIT ?? "see npm test")
  .replace("{{DB}}", process.env.DB ?? "see npm test");
writeFileSync("docs/tdd/TDD.html", html);

const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve(root, "docs/tdd/TDD.html")).href, { waitUntil: "load" });
await page.pdf({ path: "docs/TDD.pdf", format: "A4", printBackground: true });
await browser.close();
console.log("Wrote docs/TDD.pdf");
