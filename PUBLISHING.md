# Delen en publiceren

Dit document bevat de concrete stappen en invulteksten om de extensie open te zetten op GitHub en aan te bieden in de Chrome Web Store.

## 1. Het distributiepakket maken

Draai vanuit deze map:

```powershell
node --test test/filter.test.js
node scripts/pack.js
```

Dat maakt `dist/md-block-v0.1.0.zip` aan met alleen de runtime-bestanden (`manifest.json`, `_locales/`, `icons/` en `src/`) en met forward-slashes in alle paden, zoals de Chrome Web Store vereist.

## 2. Open source zetten op GitHub

1. Maak een publieke repository aan op GitHub, bijvoorbeeld `md-block` of `google-docs-md-block`.
2. Initialiseer git lokaal en push naar je repository:

```powershell
git init
git add .
git commit -m "Initial release v0.1.0"
git branch -M main
git remote add origin https://github.com/seb-prjcts-be/google_docs_md_filter.git
git push -u origin main
```

3. Maak op GitHub onder **Releases** een nieuwe release `v0.1.0` aan en hang `dist/md-block-v0.1.0.zip` eraan. Mensen die de extensie buiten de winkel om willen gebruiken kunnen dat zip-bestand downloaden, uitpakken en inladen via `chrome://extensions` (*Uitgepakte extensie laden*).

## 3. Indienen bij de Chrome Web Store

1. Open het Chrome Web Store Developer Dashboard: https://chrome.google.com/webstore/devconsole
2. Registreer eenmalig als ontwikkelaar (eenmalige kost van 5 USD) als je dat nog niet eerder deed.
3. Klik op **New Item** en upload `dist/md-block-v0.1.0.zip`.

### Invulteksten voor het Store-tabblad (Store listing)

De titel en korte samenvatting leest Google automatisch uit `_locales/en/messages.json` en `_locales/nl/messages.json`. Voor de uitgebreide beschrijving kun je deze tekst gebruiken:

**Engels (Default - English):**

```text
Synced folders in Google Drive mix Markdown (.md) and Microsoft Word (.docx, .doc) files into the Google Docs home screen, pushing native Google Docs documents out of sight.

MD Block for Google Docs works exclusively inside the Google Docs document-chooser views, hiding .md, .markdown, .docx, and .doc entries visually from:
- the Google Docs home screen (docs.google.com/document/, grid view and list view)
- search autocomplete suggestions at the top of the Google Docs home screen
- the File > Open dialog when opened from Google Docs

What stays completely untouched:
- Open documents in the Google Docs editor (/document/d/...): zero extension scripts run while you write or edit.
- Google Drive (drive.google.com): no files are modified, moved, or hidden in Drive itself.
- Google Sheets, Google Slides, Google Forms, the Drive attachment picker in Gmail, and all other websites.

Controls:
- A small counter button in the bottom-left corner shows how many items are hidden on the current view and lets you show or hide them with one click.
- The extension popup lets you toggle Markdown or Microsoft Word separately, and optionally hide .txt, .json, .jsonl, .yaml, .yml, .toml, .log, or custom file extensions.

Open source, no network requests, and no data collection.
Independent browser extension; not affiliated with or endorsed by Google LLC.
```

**Nederlands (optioneel extra taalprofiel in het dashboard):**

```text
Gesynchroniseerde mappen op Google Drive zetten Markdown- (.md) en Microsoft Word-bestanden (.docx, .doc) midden tussen je gewone Google-documenten op het startscherm van Google Docs.

MD Block voor Google Docs werkt uitsluitend in de keuzeschermen van de Google Docs-webapplicatie en verbergt daar .md-, .markdown-, .docx- en .doc-items visueel uit:
- het Google Docs-startscherm (docs.google.com/document/, rasterweergave en lijstweergave)
- de zoeksuggesties bovenin het Google Docs-startscherm
- het venster Bestand > Openen vanuit Google Docs

Wat volledig ongemoeid blijft:
- Geopende documenten in de Google Docs-editor (/document/d/...): tijdens het schrijven en bewerken draait er geen enkel script van deze extensie.
- Google Drive (drive.google.com): al je .md- en .docx-bestanden blijven daar gewoon staan en zichtbaar.
- Google Sheets, Google Slides, Google Forms, de Drive-bijlagenkiezer in Gmail en alle andere websites.

Bediening:
- Een kleine knop linksonder toont hoeveel bestanden er op het huidige scherm verborgen zijn en wisselt met 1 klik tussen verbergen en tonen.
- In de popup kun je Markdown en Microsoft Word los aan- of uitzetten, en optioneel ook .txt, .json, .jsonl, .yaml, .yml, .toml, .log of eigen extensies verbergen.

Open source, geen netwerkverzoeken en geen dataverzameling.
Onafhankelijke browserextensie; niet verbonden aan of ondersteund door Google LLC.
```

### Beeldmateriaal

- **Store icon**: upload `icons/icon128.png`.
- **Screenshots**: maak minstens 1 screenshot van `1280 x 800` (of `640 x 400`) van het Google Docs-startscherm met het pilletje linksonder of de geopende popup (zorg dat persoonlijke documenttitels niet gevoelig zijn).

### Invulteksten voor het Privacy-tabblad (Privacy practices)

Google vraagt voor elk recht een korte toelichting in het Engels:

- **Single purpose description**:
  `Hides Markdown (.md), Microsoft Word (.docx, .doc), and user-selected plain-text file extensions from the Google Docs home screen, search autocomplete, and File > Open picker so native Google Docs remain easy to find.`
- **Storage justification (`storage`)**:
  `Stores the user's local filter preferences (enabled state, selected file extensions, and whether the on-page counter pill is shown) in chrome.storage.local.`
- **Host permission justification (`docs.google.com`, `drive.google.com/picker*`)**:
  `Required to run the DOM filter on the Google Docs home screen (docs.google.com/document/) and inside the File > Open picker iframe (docs.google.com/picker and drive.google.com/picker). Open document editor routes (/document/d/*) are excluded.`
- **Are you using remote code?**:
  Kies **No, I am not using remote code**.
- **Data usage**:
  Vink aan dat de extensie géén gebruikersgegevens verzamelt of verstuurt, en zet de drie verplichte verklaringen onderaan aan.
- **Privacy policy URL** (als je die wilt invullen):
  `https://github.com/seb-prjcts-be/google_docs_md_filter/blob/main/PRIVACY.md`
