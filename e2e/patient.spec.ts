import { expect, test, type Page } from "@playwright/test";

const DEMO_CODE = process.env.DEMO_OTP ?? "246810";

async function signIn(page: Page, phone: string, code: string) {
  await page.goto("/");
  await page.getByLabel("Your mobile number").fill(phone);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await page.waitForURL("**/code");
  for (let i = 0; i < 6; i++) {
    await page.getByLabel(`Digit ${i + 1} of 6`).fill(code[i]!);
  }
  await page.getByRole("button", { name: /Open my file|Try again/ }).click();
}

async function passConsentAndPreference(page: Page) {
  await page.waitForURL((url) => !url.pathname.startsWith("/code"));
  if (page.url().includes("/consent")) {
    await page.getByLabel("I agree to get my reports by SMS and read them here.").check();
    await page.getByRole("button", { name: "Agree and continue" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/consent"));
  }
  if (page.url().includes("/preference")) {
    await page.getByRole("button", { name: "Read it the Simple way" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/preference"));
  }
  if (page.url().includes("/setup")) {
    await expect(page.getByRole("heading", { name: "Who is on this number?" })).toBeVisible();
    await page.getByRole("button", { name: "This is right, continue" }).click();
  }
  await page.waitForURL("**/family**");
}

test("sign in with a code and read a report explained by rule", async ({ page }) => {
  await signIn(page, "9000000001", DEMO_CODE);
  await passConsentAndPreference(page);

  await page.getByRole("link", { name: "Open my file" }).click();
  await page.waitForURL("**/file/**");
  await page
    .getByRole("link", { name: /Open the page|Read it again/ })
    .first()
    .click();
  await page.waitForURL(/\/file\/[^/]+\/[^/]+/);

  // The flag and its words come from the rule against the printed range.
  await expect(page.getByRole("heading", { name: "Haemoglobin" })).toBeVisible();
  await expect(page.getByText("A little low.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Haemoglobin 10\.2 g\/dL, usual 12\.0–15\.5, A little low/ }),
  ).toBeVisible();
  await expect(page.getByText(/These words come from the lab's checked wording/)).toBeVisible();
});

test("a critical result shows no value, only please call us", async ({ page }) => {
  await signIn(page, "9000000003", DEMO_CODE);
  await passConsentAndPreference(page);
  await page.getByRole("link", { name: "Open my file" }).click();
  await page.getByRole("link", { name: "See what to do" }).click();
  await page.waitForURL(/\/file\/[^/]+\/[^/]+/);

  await expect(page.getByRole("heading", { name: /Please call us/ })).toBeVisible();
  await expect(page.getByText("We have asked our team to call you.")).toBeVisible();
  // No number, no flag words, no alarming words anywhere on the page.
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/6\.8|mmol|Potassium|critical|urgent|abnormal|high/i);
});

test("five wrong codes pause the number for 15 minutes", async ({ page }) => {
  // A fresh number each run, not on file: it gets the same screens, but no SMS.
  const phone = `98${String(Date.now()).slice(-8)}`;
  await signIn(page, phone, "000000");
  for (let attempt = 2; attempt <= 5; attempt++) {
    await expect(page.getByText(/That one did not match/)).toBeVisible();
    for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1} of 6`).fill("1");
    await page.getByRole("button", { name: "Try again" }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Let us pause for a little while." }),
  ).toBeVisible();
});

test("Home and the menu reach settings, and a relation can be changed", async ({ page }) => {
  await signIn(page, "9000000001", DEMO_CODE);
  await passConsentAndPreference(page);

  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("link", { name: "People on this number" }).click();
  await page.waitForURL("**/settings/people");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByLabel(/Ramana Rao K is/).selectOption("Spouse");
  await page.getByRole("button", { name: "Save these" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await expect(page.getByLabel(/Ramana Rao K is/)).toHaveValue("Spouse");

  // On a phone, a page with a way back keeps Home in the menu.
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: /Home/ }).click();
  await page.waitForURL("**/family**");
  await expect(page.getByRole("link", { name: "Open my file" })).toBeVisible();
});
