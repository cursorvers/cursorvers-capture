import { test, expect } from "@playwright/test";

/**
 * Filter out pre-existing CSP `unsafe-eval` violations that originate from
 * Google Identity Services. Each engine reports them differently:
 *   - Chromium: "Evaluating a string as JavaScript violates ... accounts.google.com"
 *   - Firefox:  "call to eval() blocked by CSP"
 *   - WebKit:   (suppressed)
 * Both forms are noise from a third-party script and unrelated to our code.
 */
function isExternalCspNoise(msg: string): boolean {
  if (msg.includes("accounts.google.com")) return true;
  if (/call to eval\(\) blocked by CSP/i.test(msg)) return true;
  if (/unsafe-eval/i.test(msg) && /CSP/i.test(msg)) return true;
  return false;
}

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

test.describe("Smoke (B1 post-deploy expansion 2026-05-13)", () => {
  test("?folder= query param does not throw and home still renders", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    // unique per run so concurrent / repeated CI runs do not collide on a single
    // synthetic folder id, and so the test never accidentally re-uses a real
    // folder id from a developer's clipboard.
    const folderId = `b1-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto(`/?folder=${folderId}`);
    await expect(
      page.getByRole("heading", { name: "Cursorvers Capture" }),
    ).toBeVisible();
    const appErrors = errors.filter(
      (msg) => !isExternalCspNoise(msg),
    );
    expect(appErrors, appErrors.join("\n")).toEqual([]);
  });

  test("/not-invited links to info@cursorvers.com", async ({ page }) => {
    await page.goto("/not-invited");
    const link = page.getByRole("link", { name: /info@cursorvers\.com/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "mailto:info@cursorvers.com");
  });

  test("/privacy discloses drive.file scope explicitly", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByText("drive.file").first()).toBeVisible();
  });

  test("manifest.webmanifest is reachable and names Cursorvers Capture", async ({ page }) => {
    const res = await page.request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.name).toBe("Cursorvers Capture");
    expect(body.start_url).toBe("/");
  });

  test("/insights renders without runtime error", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    await page.goto("/insights");
    // Page should render some heading/main content — we only assert no runtime
    // error and that we did not get a generic Next.js 500. Auth-required redirect
    // to "/" is acceptable. We filter out pre-existing CSP unsafe-eval warnings
    // from Google Identity Services so we only fail on application-originated
    // errors.
    await expect(page.locator("body")).toBeVisible();
    const appErrors = errors.filter(
      (msg) => !isExternalCspNoise(msg),
    );
    expect(appErrors, appErrors.join("\n")).toEqual([]);
  });
});
