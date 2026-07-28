import { expect, test } from "@playwright/test";

const audioFile = (name) => ({
  name,
  mimeType: "audio/mpeg",
  buffer: Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00])
});

test("saves, exports, imports, and reopens a complete portable book", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1_000);

  await page.getByLabel("Title").fill("E2E Portable Score");
  await page.getByLabel("Composer").fill("Test Composer");
  await expect(page.getByLabel("Title")).toHaveValue("E2E Portable Score");

  await page.getByRole("button", { name: "Audio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Book recording", exact: true })).toBeVisible();
  const bookAudioInput = page.locator(".editor-scroll input[accept='audio/*']");
  await bookAudioInput.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not audio") });
  await expect(page.getByRole("alert")).toHaveText("Choose an MP3, WAV, M4A, AAC, OGG, or FLAC audio file.");
  await bookAudioInput.setInputFiles(audioFile("book-tone.mp3"));
  await expect(page.locator(".audio-file-card").getByText("book-tone.mp3", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Bookmark here", exact: true }).click();
  const bookmarkDialog = page.getByRole("dialog", { name: "Add bookmark" });
  await bookmarkDialog.getByLabel("Bookmark name").fill("Opening theme");
  await bookmarkDialog.locator("input[type='file']").setInputFiles(audioFile("opening-theme.mp3"));
  await bookmarkDialog.getByRole("button", { name: "Add bookmark", exact: true }).click();

  await page.getByRole("button", { name: "Save book", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "My library 1", exact: true }).click();
  await expect(page.getByRole("heading", { name: "E2E Portable Score", exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export E2E Portable Score", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("e2e-portable-score.maestro-folio");
  const packagePath = await download.path();
  expect(packagePath).toBeTruthy();

  await page.locator("input[accept*='.maestro-folio']").setInputFiles(packagePath);
  await expect(page.getByText("“E2E Portable Score” was imported as a new book on this device.", { exact: true })).toBeVisible();

  const cards = page.locator("article.library-card");
  await expect(cards).toHaveCount(2);
  await cards.nth(1).getByRole("button", { name: "E2E Portable Score Open book", exact: true }).click();

  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(page.getByLabel("Title")).toHaveValue("E2E Portable Score");
  await expect(page.getByLabel("Composer")).toHaveValue("Test Composer");
  await expect(page.locator(".audio-bar").getByText("book-tone.mp3", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Navigation", exact: true }).click();
  await expect(page.getByText("Opening theme", { exact: true })).toBeVisible();
  await expect(page.getByText(/opening-theme\.mp3/)).toBeVisible();
});
