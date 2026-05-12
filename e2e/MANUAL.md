# Manual End-to-End Verification Scenarios

These scenarios require interaction with a Google account and the Google Drive UI, thus they are designed for manual verification.

**Pre-requisite:** Ensure the app is running locally (`pnpm dev`).

## Scenario 0: Folder ID via URL Query Parameter

1.  Start the application locally: `pnpm dev`.
2.  Open your browser and navigate to `http://localhost:3000/?folder=YOUR_TEST_FOLDER_ID` (replace `YOUR_TEST_FOLDER_ID` with an actual Google Drive folder ID).
3.  **Verification:** Observe the "設定: フォルダ ID =" display on the home page. It should immediately show `YOUR_TEST_FOLDER_ID`.
4.  Navigate to the `/settings` page.
5.  **Verification:** Confirm that the "Google Drive フォルダ ID" input field and "現在のフォルダ ID:" display also show `YOUR_TEST_FOLDER_ID`. This confirms the ID was correctly parsed from the URL and persisted.

## Scenario 1: Capture → Upload → Folder Appearance (Verify in Drive UI)

## Scenario 1: Capture → Upload → Folder Appearance (Verify in Drive UI)

1.  Navigate to the home page (`/`).
2.  Ensure a Google Drive folder ID is configured (either via `/?folder=YOUR_FOLDER_ID` or in the `/settings` page).
3.  Click the "ðŸ“¸ æ‘„å½±" (Camera) button.
4.  Allow camera access if prompted.
5.  Take a photo.
6.  Observe the "å‰å›žã®æ‘„å½±:" status message.
7.  **(Future: Once upload functionality is implemented)** Wait for the upload to complete.
8.  Open your Google Drive in a web browser.
9.  Navigate to the configured folder.
10. **Verification:** Confirm that the newly captured image file (named by hash, e.g., `xxxxxxxx.jpeg`) appears in the Google Drive folder.

## Scenario 2: Capture → Toggle Offline → Retry → Online → Completion

1.  Navigate to the home page (`/`).
2.  Ensure signed in and folder ID is configured.
3.  Click the "ðŸ“¸ æ‘„å½±" (Camera) button and take a photo.
4.  Immediately after capturing, go offline:
    *	**Chrome DevTools:** Open DevTools (F12), go to the "Network" tab, and select "Offline" from the throttling dropdown.
    *	**Browser:** Disable Wi-Fi or disconnect network cable.
5.  **(Future: Once upload functionality is implemented)** Observe the app's behavior (it should indicate an offline state and likely show an upload retry mechanism).
6.  Go back online using the same method as step 4.
7.  **(Future: Once upload functionality is implemented)** The app should automatically resume/retry the upload.
8.  **Verification:** Confirm the upload completes successfully and the file appears in Google Drive (Scenario 1, steps 8-10).

## Scenario 3: Wait >1h After Sign-in → Capture → Silent Refresh → Upload Succeeds

1.  Navigate to the home page (`/`) and sign in with your Google account.
2.  Ensure the folder ID is configured.
3.  Keep the browser tab open but *inactive* for at least 60-70 minutes (longer than a typical access token expiry).
4.  After the waiting period, make the tab active again.
5.  Click the "ðŸ“¸ æ‘„å½±" (Camera) button and take a photo.
6.  **(Future: Once upload functionality is implemented)** The app should attempt a silent token refresh.
7.  **Verification:** The upload should proceed successfully without requiring a manual re-sign-in, and the file should appear in Google Drive. This confirms the silent refresh mechanism is working.

## Scenario 4: Capture Same Scene Twice → 2 Distinct Hash-Named Files in Folder

1.  Navigate to the home page (`/`).
2.  Ensure signed in and folder ID is configured.
3.  Click the "ðŸ“¸ æ‘„å½±" (Camera) button. Take a photo of a distinct object/scene.
4.  **(Future: Once upload functionality is implemented)** Wait for the upload to complete.
5.  Without changing the scene or object significantly, click the "ðŸ“¸ æ‘„å½±" (Camera) button again and take a second photo.
6.  **(Future: Once upload functionality is implemented)** Wait for the second upload to complete.
7.  Open your Google Drive and navigate to the configured folder.
8.  **Verification:** Confirm that *two distinct* image files (with different hash-based filenames) appear in the Google Drive folder. This verifies that each capture results in a unique file, even if the content is visually similar.
