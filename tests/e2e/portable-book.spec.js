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

  await page.getByRole("tab", { name: "Content", exact: true }).click();
  await page.locator(".editor-scroll input[accept='image/*']").first()
    .setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") });
  await expect(page.getByRole("alert")).toContainText("is not a supported image");
  await page.getByRole("button", { name: "Dismiss notification" }).click();

  const contentTab = page.getByRole("tab", { name: "Content", exact: true });
  await contentTab.focus();
  await contentTab.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Details", exact: true })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Details", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Title").fill("E2E Portable Score");
  await page.getByLabel("Composer").fill("Test Composer");
  await expect(page.getByLabel("Title")).toHaveValue("E2E Portable Score");
  await page.getByRole("switch", { name: "Display page numbers" }).click();
  await page.getByLabel("Start at").fill("7");
  await page.getByRole("combobox", { name: /^Number every/ }).selectOption("2");
  await page.getByRole("combobox", { name: /^Position/ }).selectOption("top");
  await page.getByRole("combobox", { name: /^Alignment/ }).selectOption("inner");
  await expect(page.locator(".page-no")).toHaveText("7");
  await expect(page.locator(".page-no")).toHaveClass(/top/);
  await expect(page.locator(".page-no")).toHaveClass(/left/);

  await page.getByRole("tab", { name: "Audio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Book recording", exact: true })).toBeVisible();
  const bookAudioInput = page.locator(".editor-scroll input[accept='audio/*']");
  await bookAudioInput.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not audio") });
  await expect(page.getByRole("alert")).toHaveText("Choose an MP3, WAV, M4A, AAC, OGG, or FLAC audio file.");
  await bookAudioInput.setInputFiles(audioFile("book-tone.mp3"));
  await expect(page.locator(".audio-file-card").getByText("book-tone.mp3", { exact: true })).toBeVisible();
  await page.getByLabel("Playback speed").selectOption("1.25");

  await page.getByRole("button", { name: "Next spread" }).click();
  await expect(page.getByText("Pages 3–4", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".page-no")).toHaveText("9");
  const bookmarkTrigger = page.getByRole("button", { name: "Bookmark here", exact: true });
  await bookmarkTrigger.click();
  const bookmarkDialog = page.getByRole("dialog", { name: "Name this piece" });
  await expect(page.getByLabel("Bookmark name")).toBeFocused();
  await page.getByLabel("Bookmark name").press("Shift+Tab");
  await expect(bookmarkDialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Add bookmark", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Name this piece" })).toBeHidden();
  await expect(bookmarkTrigger).toBeFocused();

  await bookmarkTrigger.click();
  await bookmarkDialog.getByLabel("Bookmark name").fill("Opening theme");
  await bookmarkDialog.locator("input[type='file']").setInputFiles(audioFile("opening-theme.mp3"));
  await bookmarkDialog.getByRole("button", { name: "Add bookmark", exact: true }).click();

  await page.getByRole("button", { name: "Move Moonlight II later" }).click();
  await page.getByRole("button", { name: "Move Moonlight II later" }).click();
  await expect(page.locator("[aria-live='polite']")).toContainText("Moonlight II moved to position 6.");
  await page.getByRole("tab", { name: "Navigation", exact: true }).click();
  await expect(page.getByText(/Opening theme/).first()).toBeVisible();
  await expect(page.getByText(/Pages 5–5/).first()).toBeVisible();

  await page.getByRole("button", { name: "Previous spread" }).click();
  await expect(page.getByText("Pages 3–4", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Edit Opening theme" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit bookmark" });
  await editDialog.getByLabel("Bookmark name").fill("Finale");
  await editDialog.getByRole("button", { name: "Use current page" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await editDialog.getByRole("button", { name: "Remove recording" }).click();
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Finale/).first()).toBeVisible();
  await expect(page.getByText(/Pages 3–4 · No audio/).first()).toBeVisible();

  await page.getByRole("button", { name: "Add", exact: true }).click();
  await bookmarkDialog.getByLabel("Bookmark name").fill("Encore");
  await bookmarkDialog.locator("input[type='file']").setInputFiles(audioFile("encore.mp3"));
  await bookmarkDialog.getByRole("button", { name: "Add bookmark", exact: true }).click();
  await page.getByLabel("Playback speed").selectOption("0.75");
  await page.getByRole("button", { name: "Move Encore earlier" }).click();
  await expect(page.locator(".bookmark-row").first()).toContainText("Encore");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete Encore" }).click();
  await expect(page.locator(".bookmark-row").first()).toContainText("Encore");

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

  await page.getByRole("tab", { name: "Details", exact: true }).click();
  await expect(page.getByLabel("Title")).toHaveValue("E2E Portable Score");
  await expect(page.getByLabel("Composer")).toHaveValue("Test Composer");
  await expect(page.getByRole("switch", { name: "Display page numbers" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Start at")).toHaveValue("7");
  await expect(page.getByRole("combobox", { name: /^Number every/ })).toHaveValue("2");
  await expect(page.getByRole("combobox", { name: /^Position/ })).toHaveValue("top");
  await expect(page.getByRole("combobox", { name: /^Alignment/ })).toHaveValue("inner");
  await expect(page.locator(".page-no")).toHaveText("7");
  await expect(page.locator(".audio-bar").getByText("book-tone.mp3", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Playback speed")).toHaveValue("1.25");

  await page.getByRole("tab", { name: "Navigation", exact: true }).click();
  await expect(page.locator(".bookmark-row")).toHaveCount(2);
  await expect(page.locator(".bookmark-row").first()).toContainText("Encore");
  await page.locator(".bookmark-row").first().locator(".bookmark-open").click();
  await expect(page.getByLabel("Playback speed")).toHaveValue("0.75");
  await expect(page.locator(".bookmark-row").nth(1)).toContainText("Finale");
  await expect(page.locator(".bookmark-row").nth(1)).toContainText("Pages 3–4 · No audio");
  await page.getByRole("tab", { name: "Pages", exact: true }).click();
  await expect(page.locator(".page-open")).toHaveCount(6);
  await expect(page.locator(".page-open").last()).toHaveAttribute("aria-label", /Moonlight II/);

  await page.getByRole("button", { name: "My library 2", exact: true }).click();
  const libraryCards = page.locator("article.library-card");
  await libraryCards.nth(1).getByRole("button", { name: "Rename E2E Portable Score" }).click();
  await libraryCards.nth(1).getByLabel("New title for E2E Portable Score").fill("Practice Copy");
  await libraryCards.nth(1).getByRole("button", { name: "Save title for E2E Portable Score" }).click();
  await expect(page.getByRole("heading", { name: "Practice Copy", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Duplicate Practice Copy" }).click();
  await expect(page.getByRole("heading", { name: "Practice Copy copy", exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search books" }).fill("Practice");
  await expect(page.locator("article.library-card")).toHaveCount(2);
  await page.getByLabel("Sort by").selectOption("title");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete Practice Copy copy" }).click();
  await expect(page.locator("article.library-card")).toHaveCount(2);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Practice Copy copy" }).click();
  await expect(page.locator("article.library-card")).toHaveCount(1);
});
