# Maestro Folio — Engineering Handoff and Review Report

**Status:** Functional product prototype  
**Production:** https://maestro-folio-book-viewer.lesrou.chatgpt.site  
**Review branch:** `codex/maestro-folio`  
**Current commit:** `648fb24ace930158bf205ad05753936cc54b4213`

> **Implementation update — 28 July 2026:** The review snapshot below predates the
> storage work completed in `54bfd9d`. IndexedDB now uses a versioned v2 schema
> with separate Blob assets, automatic v1 migration, stable page-ID bookmark
> references, quota/error handling, and Vitest coverage. The library also supports
> exporting and importing complete `.maestro-folio` book packages for safe
> transfer between devices. A Playwright Chromium test now covers the full
> save, export, import, and reopen journey, including book and bookmark audio.
> Library rendering and its list/delete/export/import lifecycle now live in
> dedicated feature modules rather than the root studio component.
> Bookmark state, page-ID resolution, audio updates, modal editing, and both
> bookmark list views are likewise isolated under `src/features/bookmarks`.
> PDF.js rendering, progress/error state, role selection, modal UI, and tested
> cover/index ordering now live under `src/features/importer`.
> Reader geometry, page-turn timing, tilt/fullscreen state, 3D stage rendering,
> and tested spread boundaries now live under `src/features/reader`.
> Book audio state and player rendering now live under `src/features/audio`,
> with shared bookmark-audio validation, a 100 MB safety limit, readable
> file/playback errors, and focused unit coverage.
> Image and PDF imports now validate type and size before changing the book,
> cap PDF imports at 200 pages, surface image read/decode failures, and allow
> in-progress PDF rendering to be cancelled safely.
> Dialogs now trap and restore focus, support Escape dismissal, and expose
> labelled semantics. Editor and sidebar tabs support arrow-key navigation,
> reader controls have accessible names, focus indicators and coarse-pointer
> targets are strengthened, and reduced-motion preferences disable 3D motion.
> Sheet-music pages can now be reordered by drag-and-drop or accessible
> move-earlier/move-later controls. Cover and index roles remain pinned, the
> reader preserves its stable page location, and bookmarks continue resolving
> by page ID through save, reopen, export, and import.
> Page numbering now supports a custom start, every-Nth-page rules, top/bottom
> placement, and outer/inner/center alignment. Cover and index pages are
> excluded automatically, legacy books receive compatible defaults, and the
> complete settings model survives save, reopen, export, and import.
> Existing bookmarks can now be renamed, retargeted to the current spread, and
> have audio replaced or removed. Bookmark order supports drag-and-drop and
> accessible move controls, destructive deletion/audio removal is confirmed,
> and edited order/content remains portable through save and transfer.
> Audio practice controls now provide 0.5×–2× playback speed and reusable loop
> start/end markers. Full-book and bookmark recordings keep independent
> settings through save, reopen, export, and import, with keyboard-accessible
> native controls and focused unit/end-to-end coverage.
> The library now supports title/composer search, recent/title/composer sorting,
> inline renaming, and atomic deep duplication of books and their media.
> Deletion requires explicit confirmation, and duplicate media remains usable
> if the original book is removed.
> PDF import cleanup now targets the PDF.js loading task rather than the loaded
> document proxy, matching the current PDF.js API. Cleanup is idempotent across
> completion and cancellation, preventing the minified
> `destroy is not a function` upload failure.
> PDF reliability messaging now distinguishes password-protected, damaged,
> missing, and incomplete files. Multi-page imports show determinate page
> progress and release each render canvas promptly to reduce peak memory use.
> Cloud synchronization and user accounts remain out of scope.

## 1. Executive summary

Maestro Folio is a browser-based application that converts uploaded sheet music into an interactive 3D book. Users can import image pages or a complete PDF, identify the cover and optional index, turn pages, tilt the book in 3D, attach audio, create named bookmarks, save books locally, and reopen them from a library.

The current implementation is a polished functional prototype. It deliberately uses a local-first architecture: uploaded images, rendered PDF pages, audio, bookmarks, and book metadata are persisted in IndexedDB. There is no backend, cloud synchronization, user account model, or server-side asset storage.

The most valuable areas for senior review are:

1. component and state decomposition;
2. persistent media storage strategy;
3. stable page/bookmark identifiers;
4. PDF import performance and memory use;
5. accessibility and keyboard interaction;
6. production suitability of the current vinext beta runtime.

## 2. Product behavior implemented

### Book creation and content

- Upload or replace a cover image.
- Upload an optional index image.
- Upload multiple sheet-music images.
- Import a complete PDF in the browser.
- Render PDF pages into JPEG data URLs using PDF.js.
- Preview all PDF pages before import.
- Choose any PDF page as the cover.
- Choose any other PDF page as the index, or omit the index.
- Preserve the source order of all remaining PDF pages.
- Detect uploaded page proportions and size the 3D book accordingly.
- Render US Letter, A4, square, and landscape content without forced cropping.

### 3D reader

- Closed-cover and open-spread views.
- Animated page turns.
- Previous/next controls and left/right keyboard navigation.
- Drag-to-tilt 3D interaction.
- Fullscreen reader mode.
- Neutral layered page edges behind the active images.
- Visible page-block thickness based on the number of pages.
- Optional generated page numbers, disabled by default.

### Navigation and audio

- Named bookmarks tied to a saved spread.
- Direct jump from a bookmark to its spread.
- Optional audio attachment per bookmark.
- Book-level companion audio.
- Pinned audio player with seeking, duration, mute, and replacement upload.
- Selecting a bookmark loads that bookmark’s audio state.

### Persistence and library

- Save complete books into IndexedDB.
- Reopen saved books from a library.
- Delete saved books.
- Persist page assets, audio data URLs, bookmark metadata, display options, title, and composer.

### Studio UX

- Fixed three-pane desktop workspace.
- Tabbed Details, Content, Audio, and Navigation tools.
- Central 3D reader with pinned controls.
- Right-side Pages and Bookmarks quick-jump panel.
- Responsive two-pane and stacked layouts at narrower breakpoints.

## 3. Technical architecture

### Runtime and build

| Area | Current choice |
|---|---|
| UI | React 19 client components |
| Application surface | Next-compatible App Router source |
| Production compiler/runtime | `vinext` 1.0.0 beta on Vite 8 |
| Hosting target | Cloudflare-compatible worker through OpenAI Sites |
| Icons | `lucide-react` |
| PDF rendering | `pdfjs-dist` |
| Persistence | Browser IndexedDB |
| Styling and 3D | Handwritten CSS and CSS 3D transforms |
| Backend | None |

The source retains Next.js as a dependency, while production builds use:

```text
vinext build && node scripts/package-static.mjs
```

The packaging script copies `.openai/hosting.json` into the generated `dist` directory. The resulting worker entrypoint is `dist/server/index.js`.

### Main source layout

```text
app/
  layout.js              Metadata and root document
  page.js                UI components, state, persistence, PDF import, reader logic
  globals.css            Complete visual system, responsive layout, 3D rendering
public/
  cover.svg
  index.svg
  sheet-1.svg ...        Demonstration book assets
scripts/
  package-static.mjs     Hosting metadata packaging
vite.config.ts           vinext and Cloudflare worker plugins
wrangler.jsonc           Worker and asset configuration
.openai/hosting.json     Sites project binding
```

At the time of this report:

- `app/page.js`: approximately 654 lines.
- `app/globals.css`: approximately 373 lines.
- The production build succeeds.
- `npm audit` reports zero known vulnerabilities.

## 4. Data model

The current persisted shape is implicit JavaScript rather than a versioned schema.

```ts
type Book = {
  id: string;
  title: string;
  composer: string;
  pages: Page[];
  audioSrc: string;        // data URL
  audioName: string;
  showPageNumbers: boolean;
  bookmarks: Bookmark[];
  updatedAt: string;
};

type Page = {
  id: string;
  name: string;
  kind: "cover" | "index" | "page";
  src: string;             // image data URL or bundled asset URL
  originalPage?: number;   // source PDF page
};

type Bookmark = {
  id: string;
  name: string;
  spread: number;
  audioSrc: string;        // optional data URL
  audioName: string;
};
```

IndexedDB currently uses:

```text
Database: maestro-folio
Version: 1
Object store: books
Key path: id
```

## 5. Important implementation details

### Page geometry

The reader measures the loaded image:

```text
spreadAspect = (naturalWidth / naturalHeight) × 2
```

The result is clamped to a safe range and passed to CSS as `--book-aspect`. Equal proportional insets ensure that a closed page retains the source ratio and an open spread is exactly twice its width.

### PDF import

PDF.js is dynamically imported only when a PDF is selected. Pages are rendered sequentially:

- maximum target width: 1,400 pixels;
- maximum scale: 2×;
- output: JPEG data URL at quality 0.9;
- rendering occurs on a browser canvas;
- the worker asset is bundled by Vite.

### Book thickness

Each side receives a `--stack` value derived from the number of pages on that side, capped at 14. CSS translates neutral page-stack layers in X, Y, and Z to provide visible paper depth.

### Bookmarks

Bookmarks currently point to a numeric spread, not a stable page ID. This is simple and works while page order is unchanged, but becomes fragile when pages are inserted, removed, or reordered.

## 6. Known limitations and technical debt

### High priority

1. **Media persisted as data URLs**
   - PDF-rendered JPEGs and audio files are stored inside book records.
   - This inflates memory and storage usage by roughly one third versus binary blobs.
   - Large scores and recordings may exceed browser quotas.
   - Saving or reading a book requires transferring large serialized values.

2. **Monolithic client component**
   - Persistence, PDF processing, book state, reader behavior, modal flows, library state, and most UI are in `app/page.js`.
   - This raises regression risk and makes isolated testing difficult.

3. **Bookmark stability**
   - Bookmark locations use spread numbers.
   - Page insertions or removals can cause a bookmark to point to the wrong music.
   - Bookmarks should reference stable page IDs, with the spread derived at render time.

4. **No schema versioning or migrations**
   - IndexedDB is version 1 with an unversioned application object.
   - Future data-model changes need explicit migration and backward-compatibility handling.

5. **No media limits or quota handling**
   - There is no file-size limit, PDF page limit, storage estimate, quota warning, or recovery flow.
   - `putBook` does not currently surface transaction errors to the UI.

### Medium priority

1. **No automated tests**
   - No unit, component, accessibility, or end-to-end tests are currently configured.
   - Production builds are the primary regression check.

2. **Object URL/blob lifecycle**
   - The app uses data URLs rather than object URLs and blobs.
   - Moving to blobs will require explicit URL creation and revocation.

3. **PDF import cancellation**
   - A long PDF render cannot currently be cancelled.
   - Closing the modal does not abort work already in progress.

4. **Rendering resolution**
   - The fixed 1,400-pixel PDF width may be insufficient for zoomed notation on high-density displays.
   - Higher resolution would increase storage pressure.
   - A source-PDF or tiled rendering strategy may be preferable.

5. **Page-number semantics**
   - Generated numbering is a simple display toggle.
   - Cover/index offsets, alternating placement, every-N-page rules, and custom starts are not implemented.

6. **Audio model**
   - Playback state is local to the `AudioBar`.
   - There is no playlist behavior, automatic bookmark-to-audio synchronization, waveform, playback-rate control, or persisted playback position.

7. **Accessibility**
   - Basic button labels and keyboard page navigation exist.
   - A complete focus-order, modal focus-trap, reduced-motion, high-contrast, screen-reader, and touch-target audit is still required.

8. **Error handling**
   - PDF errors are shown, but image decode, audio decode, IndexedDB failures, and media playback errors need explicit handling.

### Lower priority

- Drag-to-reorder is advertised as future behavior and is not implemented.
- Library sorting, search, duplication, import/export, and cover editing are not implemented.
- There is no cloud sync or cross-device access.
- No analytics or observability is configured.
- Styles are in one large global stylesheet.
- Several dependencies are on beta or rapidly evolving versions, especially vinext.

## 7. Security and privacy posture

Current positive properties:

- User files are processed locally in the browser.
- There is no application API that receives uploaded scores or recordings.
- No credentials or API secrets are embedded in the client.
- `npm audit` currently reports zero known vulnerabilities.

Items requiring review:

- Data URLs from user-selected files are displayed directly in media elements.
- PDF.js expands the browser attack surface for untrusted PDFs and should remain promptly patched.
- The application should define upload size/type validation rather than relying only on file-picker accept filters.
- Production access is currently controlled by the hosting platform rather than application-level authorization.
- A privacy and deletion policy will be required if cloud persistence is added.

## 8. Performance assessment

Likely bottlenecks:

- sequential canvas rendering of long PDFs;
- storing many full-size JPEG data URLs in React state;
- duplicating those values into IndexedDB transactions;
- loading complete audio data URLs into memory;
- rendering every page thumbnail at once in the right panel;
- re-rendering a large root component for small state changes.

Recommended direction:

1. Store `Blob` records separately from book metadata.
2. Add a media object store keyed by stable asset IDs.
3. Generate small thumbnails separately from reader-resolution pages.
4. Virtualize long page and bookmark lists.
5. Move PDF processing into a dedicated worker with cancellation and progress events.
6. Split reader, studio, library, import, audio, and persistence into independent modules.

## 9. Recommended refactor boundary

```text
src/
  features/
    books/
      book-types.ts
      book-repository.ts
      book-migrations.ts
    importer/
      pdf-import-worker.ts
      pdf-import-service.ts
    reader/
      BookStage.tsx
      PageTurn.tsx
      reader-geometry.ts
    bookmarks/
      BookmarkList.tsx
      BookmarkEditor.tsx
    audio/
      AudioPlayer.tsx
      audio-store.ts
    studio/
      StudioShell.tsx
      SetupPanel.tsx
      PagePanel.tsx
  db/
    indexed-db.ts
```

A reducer or small state machine would be preferable to the current collection of related `useState` calls. Server state tooling is unnecessary until a backend is introduced.

## 10. Suggested test plan

### Unit

- page/spread index conversion;
- aspect-ratio calculation;
- PDF role ordering;
- bookmark resolution after page mutations;
- data-model migrations;
- audio and page metadata serialization.

### Component

- PDF role selector;
- bookmark creation with and without audio;
- page-number toggle persistence;
- reader controls at first and last spread;
- audio source switching between book and bookmark tracks.

### End to end

- import a 60-page US Letter PDF;
- choose non-default cover and index pages;
- create navigation-only and audio bookmarks;
- save, reload, and reopen the book;
- verify page aspect, bookmark destinations, and audio sources;
- test storage-quota failure;
- test phone, tablet, standard desktop, and large desktop layouts.

### Visual regression

- closed cover;
- open spread;
- thin and thick books;
- US Letter, A4, square, and landscape pages;
- page-turn midpoint;
- no brown frame;
- layered page edges at multiple page counts.

## 11. Proposed roadmap

### Phase 1 — Stabilize the prototype

- Extract types and components.
- Add Vitest and Playwright coverage.
- Introduce a versioned IndexedDB repository.
- Replace data URLs with blobs and asset IDs.
- Make bookmarks page-ID based.
- Add upload limits, quota checks, and errors.
- Perform an accessibility pass.

### Phase 2 — Editing depth

- Drag-to-reorder pages.
- Custom page numbering:
  - start value;
  - cover/index exclusions;
  - every page or every Nth page;
  - top/bottom and inner/outer placement;
  - font and style controls.
- Bookmark editing and reordering.
- Audio playback rate, loop ranges, and optional waveform.

### Phase 3 — Production platform

- Authentication and cloud storage.
- Cross-device library sync.
- Background uploads and resumability.
- Sharing and read-only public book links.
- Export/import package format.
- Observability, backups, and support tooling.

## 12. Questions for the senior reviewer

Please give direct feedback on:

1. Is the local-first architecture appropriate for the expected file sizes and user workflows?
2. Would you keep vinext for this product or return to a more mature Next/OpenNext deployment path?
3. What IndexedDB schema would you use for metadata, page images, thumbnails, PDFs, and audio blobs?
4. Should source PDFs be retained and pages rendered on demand, or should pages remain pre-rendered?
5. What state-management boundary would you introduce first?
6. How would you model bookmarks so they survive page reordering and insertion?
7. What test coverage is required before adding cloud persistence?
8. What accessibility or interaction issues should block a public beta?
9. Which current limitation presents the highest risk of data loss or user frustration?
10. Which parts of the prototype should be retained versus rewritten?

## 13. Feedback format requested

Please classify findings as:

- **P0:** data loss, security, or unusable core workflow;
- **P1:** must address before a public beta;
- **P2:** important maintainability or UX improvement;
- **P3:** optional refinement.

For each finding, please include:

```text
Priority:
Area:
Finding:
Why it matters:
Recommended change:
Suggested acceptance test:
```
