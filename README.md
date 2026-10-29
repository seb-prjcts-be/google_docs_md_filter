# MD Block for Google Docs

A small Chrome extension (Manifest V3) that hides Markdown (`.md`, `.markdown`) and Microsoft Word (`.docx`, `.doc`) files from the Google Docs home screen, search autocomplete suggestions, and the `File > Open` dialog.

Synced folders in Google Drive mix external `.docx` and `.md` files into the Google Docs overview alongside native Google Docs documents. When an editor or coding tool touches dozens of `.md` files a day, or shared Drive folders hold Word archives, regular Google Docs get pushed off the screen. This extension hides matching rows visually in the browser (`display: none`). Files in Google Drive stay where they are, and zero extension code runs inside an open document editor.

Interface labels follow your browser language (English and Dutch included via `_locales/`).

## Install from source

1. Download and unzip the latest release archive from [Releases](https://github.com/seb-prjcts-be/google_docs_md_filter/releases) (or clone `https://github.com/seb-prjcts-be/google_docs_md_filter.git`).
2. Open `chrome://extensions` in Chrome, Brave, Edge, Arc, or Vivaldi.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the folder containing `manifest.json`.
5. Open or reload `https://docs.google.com/document/`.

If you run Google Docs as an installed Chrome app (PWA), the same extension applies there too.

## What it does

On the Google Docs home screen (`docs.google.com/document/`), `src/content.js` checks grid cards, list rows, and search autocomplete options. When a filename ends with a filtered extension, or an item carries a Markdown or Microsoft Word MIME type, icon, or badge, the element is hidden. Date sections such as *Yesterday* collapse when all items inside them are hidden, except when a section header holds sort or view controls.

A small button in the bottom-left corner shows how many items are hidden on the current screen (for example `14 .md hidden` or `14 .md verborgen`). Click it once to show hidden files temporarily; click again to hide them.

Document editor URLs (`/document/d/*` and `/document/u/*/d/*`) are excluded through `exclude_matches` in `manifest.json` and checked again in `detectSurface()` inside `src/filter-core.js`. When you choose `File > Open` inside an open document, the filter runs only inside the `/picker` iframe of that dialog.

## Where it runs (and where it does not)

This extension targets the Google Docs document-chooser interface only, so your synced folders can stay intact in Google Drive while the Google Docs app stays reserved for native Google Docs documents.

Runs on:
- the Google Docs home screen (`docs.google.com/document/`)
- search autocomplete suggestions at the top of the Google Docs home screen
- the `File > Open` picker dialog when opened from Google Docs

Does not run on:
- open documents in the Google Docs editor (`docs.google.com/document/d/...`)
- Google Drive (`drive.google.com`), where all `.md`, `.docx`, and synced folders remain visible
- Google Sheets (`/spreadsheets/`), Google Slides (`/presentation/`), and Google Forms (`/forms/`)
- the Google Drive attachment picker inside Gmail or other apps (you can attach `.md` and `.docx` files to emails as usual)
- GitHub or any other website

## Settings

Click the **MD Block** icon in the browser toolbar to open the popup:

- **Filter switch**: pauses or resumes filtering across open Google Docs tabs.
- **File types to hide**: `.md` / `.markdown` and `.docx` / `.doc` (Microsoft Word) are enabled by default. You can untick either of them, tick `.txt`, `.json` / `.jsonl`, `.yaml` / `.yml`, `.toml`, and `.log`, or add custom extensions such as `tex` or `csv`.
- **Counter button**: shows or hides the bottom-left pill on the Google Docs home screen.

## Test and package

Run the test suite (requires Node.js, no external npm packages):

```bash
node --test test/filter.test.js
```

Build a clean `.zip` archive in `dist/` for Chrome Web Store upload or GitHub Releases:

```bash
node scripts/pack.js
```

Regenerate the PNG icons in `icons/`:

```bash
node scripts/generate-icons.js
```

## Status and limits

Tested against the local Node v24.16.0 test suite and verified live on the Google Docs home screen in Chrome on Windows on 2026-10-29.

When many `.md` files sit at the top of Recent Documents, the extension dispatches up to fifteen scroll nudges automatically so Google Docs loads older regular documents into view. If hundreds of `.md` files precede the first regular document, scroll once manually to fetch the next batch.

## Nederlands

Deze extensie werkt uitsluitend in de Google Docs-webapplicatie: op het startscherm (`docs.google.com/document/`), in de zoeksuggesties daarboven en in het venster `Bestand > Openen` vanuit Google Docs. Standaard verbergt ze daar Markdown-bestanden (`.md`, `.markdown`) en Microsoft Word-bestanden (`.docx`, `.doc`), zodat je tussen je gewone Google-documenten werkt.

Geopende documenten in de editor (`/document/d/...`), Google Drive zelf (`drive.google.com`), Google Sheets, Google Slides, het bijlagenvenster in Gmail en alle andere websites blijven volledig ongemoeid. De knop en popup verschijnen automatisch in het Nederlands wanneer Chrome op Nederlands staat. Zie `PUBLISHING.md` voor de stappen om een nieuwe versie in te pakken en te publiceren.

## Licence

MIT, Sebastien Vanblaere. See `LICENSE` and `PRIVACY.md`.

Independent browser extension for the Google Docs web interface; not affiliated with or endorsed by Google LLC.
