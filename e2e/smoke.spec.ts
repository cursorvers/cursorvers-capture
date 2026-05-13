import { test, expect } from "@playwright/test";

test.describe("Smoke (S12)", () => {
  test("home heading is Cursorvers Capture", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Cursorvers Capture" }),
    ).toBeVisible();
  });

  test("sign-in control is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("signin-button-google")).toBeVisible();
  });

  test("camera control is disabled until signed in", async ({ page }) => {
    await page.goto("/");
    const cameraButton = page.getByTestId("camera-button-disabled");
    await expect(cameraButton).toBeVisible();
    await expect(cameraButton).toBeDisabled();
  });

  test("/not-invited shows copy for non-invited users", async ({ page }) => {
    await page.goto("/not-invited");
    await expect(page.getByRole("heading", { name: "ご招待されていません" })).toBeVisible();
  });

  test("/full shows trial capacity message", async ({ page }) => {
    await page.goto("/full");
    await expect(page.getByRole("heading", { name: "お試し定員に達しました" })).toBeVisible();
  });

  test("privacy page mentions processor / controller roles", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByText("処理者（processor）")).toBeVisible();
    await expect(page.getByText("管理者（controller）")).toBeVisible();
  });

  test("terms page mentions Phase B pricing note", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "4. Phase B・料金" })).toBeVisible();
  });

  test("exactly one capture button on home with 撮影する label", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button").filter({ hasText: "撮影する" })).toHaveCount(1);
  });
});
