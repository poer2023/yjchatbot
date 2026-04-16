const { test } = require("playwright/test");

test("capture mock keyboard", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173", { waitUntil: "networkidle" });
  await page.click("#chat-draft");
  await page.waitForTimeout(400);
  await page.screenshot({ path: "artifacts/mock-keyboard-current.png", fullPage: true });
});
