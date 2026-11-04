import { expect, test } from "@playwright/test";

const PASSWORD = process.env.DEMO_STAFF_PASSWORD ?? "";

test("staff import shows each bad row with what to fix, and imports the rest", async ({ page }) => {
  test.skip(!PASSWORD, "Set DEMO_STAFF_PASSWORD to run desk flows.");
  await page.goto("/desk/sign-in");
  await page.getByLabel("Work email").fill("frontdesk@demo.lab");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/desk/patients");

  const id = String(Date.now()).slice(-6);
  const csv = [
    "Order ID,Patient,Phone,Age,Sex,Relation,Test Code,Parameter,Result,Reference Range,Status,Referring Doctor,Signed At",
    `ORD-E2E-${id},E2E Person,+91 97777 ${id.slice(0, 5)},44,F,Self,CBC,Haemoglobin,13.2,12.0-15.5,Ready,,`,
    `ORD-E2E-${id}B,E2E Other,90000001,44,F,Self,CBC,Haemoglobin,13.2,12.0-15.5,Ready,,`,
    `ORD-E2E-${id}C,E2E Third,+91 97777 ${id.slice(0, 5)},44,F,Self,XRAY,Chest,1,0-2,Ready,,`,
  ].join("\n");

  await page.goto("/desk/import");
  await page.getByLabel("LIS export file (CSV)").setInputFiles({
    name: `e2e-${id}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "Import", exact: true }).click();

  await expect(page.getByText(/3 rows\. 1 new/)).toBeVisible();
  await expect(page.getByText(/1 report links sent by SMS/)).toBeVisible();
  await expect(page.getByRole("cell", { name: /10-digit Indian mobile number/ })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: /test code "XRAY" is not one this portal knows/ }),
  ).toBeVisible();
});
