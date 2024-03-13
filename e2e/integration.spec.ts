import { expect, test } from "@playwright/test";

test.describe("integration tests for micro frontend", () => {
  test("should mount react sub app", async ({ page }) => {
    await page.goto("/react");
    await expect(
      page.getByRole("heading", { name: "Vite + React" }),
    ).toBeVisible();
  });

  test("should mount vue sub app", async ({ page }) => {
    await page.goto("/vue");
    await expect(
      page.getByRole("heading", { name: "Vite + Vue" }),
    ).toBeVisible();
  });

  test("should mount svelte sub app", async ({ page }) => {
    await page.goto("/svelte");
    await expect(
      page.getByRole("heading", { name: "Vite + Svelte" }),
    ).toBeVisible();
  });

  test("should navigation and mount sub apps", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Vite + React" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "vue" }).click();
    await expect(
      page.getByRole("heading", { name: "Vite + Vue" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "svelte" }).click();
    await expect(
      page.getByRole("heading", { name: "Vite + Svelte" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "react" }).click();
    await expect(
      page.getByRole("heading", { name: "Vite + React" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "vue" }).click();
    await expect(
      page.getByRole("heading", { name: "Vite + Vue" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "svelte" }).click();
    await expect(
      page.getByRole("heading", { name: "Vite + Svelte" }),
    ).toBeVisible();
  });
});
