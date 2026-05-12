import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test(`Test 1 (page load): page.goto('/'), expect "Gdrive Uploader" heading`, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Gdrive Uploader' })).toBeVisible();
  });

  // test(`Test 2 (folder query): goto('/?folder=test123'), expect status panel to show "test123"`, async ({ page }) => {
  //   await page.goto('/');
  //   await expect(page.getByRole('heading', { name: 'Gdrive Uploader' })).toBeVisible();

  //   const folderIdInput = page.getByPlaceholder('フォルダIDを入力');
  //   await expect(folderIdInput).toBeVisible();

  //   await folderIdInput.fill('test123');
  //   await page.getByRole('button', { name: '保存' }).click();

  //   await expect(page.getByText(/フォルダ ID を「test123」に設定しました。/)).toBeVisible({ timeout: 10000 });
  //   await expect(page.getByTestId('folder-id-display')).toHaveText('test123', { timeout: 10000 });
  // });

  test(`Test 3 (sign-in button visible): expect SignInButton present`, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('signin-button-google')).toBeVisible();
  });

  test(`Test 4 (camera button disabled until signed in): expect aria-disabled`, async ({ page }) => {
    await page.goto('/');
    const cameraButton = page.getByTestId('camera-button-disabled');
    await expect(cameraButton).toBeVisible();
    await expect(cameraButton).toBeDisabled();
  });
});