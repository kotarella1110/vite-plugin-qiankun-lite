import { expect, test } from "@playwright/test";

test.describe("unit tests for individual sub apps", () => {
  test("should mount react sub app", async ({ page }) => {
    await page.goto("http://localhost:8001");
    await expect(
      page.getByRole("heading", { name: "Vite + React" }),
    ).toBeVisible();
  });

  test("should mount vue sub app", async ({ page }) => {
    await page.goto("http://localhost:8002");
    await expect(
      page.getByRole("heading", { name: "Vite + Vue" }),
    ).toBeVisible();
  });

  test("should mount svelte sub app", async ({ page }) => {
    await page.goto("http://localhost:8003");
    await expect(
      page.getByRole("heading", { name: "Vite + Svelte" }),
    ).toBeVisible();
  });
});
