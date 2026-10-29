(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MdBlockCore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SETTINGS_VERSION = 2;

  var MARKDOWN_EXTENSIONS = ["md", "markdown"];
  var WORD_EXTENSIONS = ["docx", "doc", "docm", "dotx", "dot", "dotm"];
  var DEFAULT_EXTENSIONS = MARKDOWN_EXTENSIONS.concat(WORD_EXTENSIONS);

  var STORAGE_KEYS = ["enabled", "extensions", "showPill", "settingsVersion"];

  var OPTIONAL_PRESETS = [
    {
      id: "md",
      extensions: MARKDOWN_EXTENSIONS.slice(),
      label: ".md / .markdown",
      noteKey: "presetNoteMd",
      note: "Markdown files"
    },
    {
      id: "word",
      extensions: WORD_EXTENSIONS.slice(),
      label: ".docx / .doc",
      noteKey: "presetNoteWord",
      note: "Microsoft Word"
    },
    {
      id: "txt",
      extensions: ["txt"],
      label: ".txt",
      noteKey: "presetNoteTxt",
      note: "Plain text"
    },
    {
      id: "json",
      extensions: ["json", "jsonl"],
      label: ".json / .jsonl",
      noteKey: "presetNoteJson",
      note: "JSON and log lines"
    },
    {
      id: "yaml",
      extensions: ["yaml", "yml"],
      label: ".yaml / .yml",
      noteKey: "presetNoteYaml",
      note: "YAML config"
    },
    {
      id: "toml",
      extensions: ["toml"],
      label: ".toml",
      noteKey: "presetNoteToml",
      note: "TOML config"
    },
    {
      id: "log",
      extensions: ["log"],
      label: ".log",
      noteKey: "presetNoteLog",
      note: "Log files"
    }
  ];

  var FALLBACK_MESSAGES = {
    en: {
      extName: "MD Block for Google Docs",
      badgeOff: "OFF",
      pillHiddenMd: "$1 .md hidden",
      pillHiddenWord: "$1 Word hidden",
      pillHiddenFilesSingular: "1 file hidden",
      pillHiddenFilesPlural: "$1 files hidden",
      pillShownMd: "$1 .md shown · hide",
      pillShownWord: "$1 Word shown · hide",
      pillShownFilesSingular: "1 file shown · hide",
      pillShownFilesPlural: "$1 files shown · hide",
      pillPausedZero: "Filter paused",
      pillTitleActive: "Click to show hidden files temporarily",
      pillTitlePaused: "Click to hide filtered files again",
      popupStatusDefault: "Only active on the Google Docs home screen",
      popupStatusPaused: "Filter paused",
      popupStatusOnTab: "On this tab: $1",
      popupToggleTitle: "Turn filter on or off",
      popupExtensionsHeading: "File types to hide",
      presetNoteMd: "Markdown files",
      presetNoteWord: "Microsoft Word",
      presetNoteTxt: "Plain text",
      presetNoteJson: "JSON and log lines",
      presetNoteYaml: "YAML config",
      presetNoteToml: "TOML config",
      presetNoteLog: "Log files",
      customInputPlaceholder: "Extra extension, e.g. tex or csv",
      customInputAria: "Add extra extension",
      customAddButton: "Add",
      customErrorInvalid: "Use letters, digits, hyphen, or underscore only.",
      chipRemoveLabel: "Remove .$1",
      popupShowPillLabel: "Show counter button in the bottom-left corner of Google Docs",
      popupFooter:
        "Runs only in Google Docs (home screen, search bar, and File > Open). Open documents, Google Drive, Sheets, Slides, Gmail, and other sites remain untouched."
    },
    nl: {
      extName: "MD Block voor Google Docs",
      badgeOff: "UIT",
      pillHiddenMd: "$1 .md verborgen",
      pillHiddenWord: "$1 Word verborgen",
      pillHiddenFilesSingular: "1 bestand verborgen",
      pillHiddenFilesPlural: "$1 bestanden verborgen",
      pillShownMd: "$1 .md getoond · verberg",
      pillShownWord: "$1 Word getoond · verberg",
      pillShownFilesSingular: "1 bestand getoond · verberg",
      pillShownFilesPlural: "$1 bestanden getoond · verberg",
      pillPausedZero: "Filter gepauzeerd",
      pillTitleActive: "Klik om verborgen bestanden tijdelijk te tonen",
      pillTitlePaused: "Klik om gefilterde bestanden weer te verbergen",
      popupStatusDefault: "Alleen actief op het Google Docs-startscherm",
      popupStatusPaused: "Filter gepauzeerd",
      popupStatusOnTab: "Op dit tabblad: $1",
      popupToggleTitle: "Filter in- of uitschakelen",
      popupExtensionsHeading: "Bestandstypes verbergen",
      presetNoteMd: "Markdown-bestanden",
      presetNoteWord: "Microsoft Word",
      presetNoteTxt: "Platte tekst",
      presetNoteJson: "JSON en logregels",
      presetNoteYaml: "YAML-configuratie",
      presetNoteToml: "TOML-configuratie",
      presetNoteLog: "Logbestanden",
      customInputPlaceholder: "Extra extensie, bijv. tex of csv",
      customInputAria: "Extra extensie toevoegen",
      customAddButton: "Toevoegen",
      customErrorInvalid:
        "Gebruik alleen letters, cijfers, koppelteken of underscore.",
      chipRemoveLabel: ".$1 verwijderen",
      popupShowPillLabel: "Teller-knop tonen linksonder in Google Docs",
      popupFooter:
        "Werkt alleen in Google Docs (startscherm, zoekbalk en Bestand > Openen). Geopende documenten, Google Drive, Sheets, Slides, Gmail en andere sites blijven ongemoeid."
    }
  };

  var DEFAULT_SETTINGS = {
    enabled: true,
    extensions: DEFAULT_EXTENSIONS.slice(),
    showPill: true,
    settingsVersion: SETTINGS_VERSION
  };

  var WORD_EXT_MAP = Object.create(null);
  for (var wi = 0; wi < WORD_EXTENSIONS.length; wi += 1) {
    WORD_EXT_MAP[WORD_EXTENSIONS[wi]] = true;
  }

  var WORD_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
    "application/msword": true,
    "application/vnd.ms-word.document.macroenabled.12": true,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template": true,
    "application/vnd.ms-word.template.macroenabled.12": true
  };

  var WORD_BADGE_LABELS = {
    "microsoft word": true,
    word: true,
    "word-document": true,
    "word document": true,
    "microsoft word-document": true,
    "microsoft word document": true,
    docx: true,
    ".docx": true
  };

  var WORD_CHIP_TEXTS = {
    DOCX: true,
    ".DOCX": true,
    DOC: true,
    ".DOC": true
  };

  // Directional and zero-width characters inserted around filenames by Closure templates.
  var INVISIBLE_CHARS_RE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

  var SEARCH_ACTION_PREFIX_RE =
    /^(?:alle resultaten\b|see all results\b|zoeken naar\b|search for\b|druk op enter\b|press enter\b)/i;

  var ARIA_TYPE_SUFFIX_RE =
    /\s+(?:Google\s+Documenten|Google\s+Docs|Markdown(?:-bestand|\s+file)?|Tekstbestand|Text\s+file|Microsoft\s+Word|Word(?:-document|\s+document)?)(?:\s+.*)?$/i;

  var ARIA_META_SUFFIX_RE =
    /\s+(?:Eigenaar|Owned\s+by|Geopend|Laatst\s+geopend|Last\s+opened|Opened|Gewijzigd|Laatst\s+gewijzigd|Last\s+modified|Modified|Gedeeld|Shared)\b.*$/i;

  var INLINE_HIGHLIGHT_TAGS = {
    B: true,
    STRONG: true,
    EM: true,
    I: true,
    MARK: true,
    WBR: true,
    SPAN: true
  };

  var SPECIFIC_TITLE_VALUE_SELECTOR = [
    ".docs-homescreen-list-item-title-value",
    ".docs-homescreen-grid-item-title",
    ".picker-item-title",
    '[data-target="title"]'
  ].join(", ");

  var FALLBACK_TITLE_SELECTOR = ".docs-homescreen-list-item-title";

  var HOMESCREEN_ITEM_SELECTOR = [
    ".docs-homescreen-grid-item",
    ".docs-homescreen-list-item",
    "tr.gssb_a",
    'form[role="search"] [role="option"]',
    '[role="listbox"] [role="option"]',
    '.docs-homescreen-item-container [role="option"]',
    '.docs-homescreen-item-container [role="row"]'
  ].join(", ");

  var PICKER_ITEM_SELECTOR = [
    '[role="option"]',
    '[role="row"]',
    ".picker-list-item",
    ".picker-grid-item",
    '[data-target="doc"]'
  ].join(", ");

  var NESTED_ITEM_SELECTOR = [
    ".docs-homescreen-grid-item",
    ".docs-homescreen-list-item",
    "tr.gssb_a",
    '[role="option"]',
    '[role="row"]'
  ].join(", ");

  function getMessage(key, substitutions, localeOverride) {
    var subs =
      substitutions === undefined || substitutions === null
        ? []
        : Array.isArray(substitutions)
          ? substitutions.map(String)
          : [String(substitutions)];

    if (
      !localeOverride &&
      typeof chrome !== "undefined" &&
      chrome.i18n &&
      typeof chrome.i18n.getMessage === "function"
    ) {
      var translated = chrome.i18n.getMessage(key, subs);
      if (translated) {
        return translated;
      }
    }

    var lang = String(localeOverride || "en").toLowerCase();
    var dict = lang.indexOf("nl") === 0 ? FALLBACK_MESSAGES.nl : FALLBACK_MESSAGES.en;
    var template = dict[key] || FALLBACK_MESSAGES.en[key] || key;
    for (var i = 0; i < subs.length; i += 1) {
      template = template.split("$" + (i + 1)).join(subs[i]);
    }
    return template;
  }

  function stripInvisible(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.replace(INVISIBLE_CHARS_RE, "").trim();
  }

  function normalizeExtension(raw) {
    if (typeof raw !== "string") {
      return "";
    }
    var cleaned = stripInvisible(raw).replace(/^\.+/, "").toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,23}$/.test(cleaned)) {
      return "";
    }
    return cleaned;
  }

  function normalizeExtensionList(list) {
    if (!Array.isArray(list)) {
      return DEFAULT_EXTENSIONS.slice();
    }
    var seen = Object.create(null);
    var result = [];
    for (var i = 0; i < list.length; i += 1) {
      var ext = normalizeExtension(list[i]);
      if (ext && !seen[ext]) {
        seen[ext] = true;
        result.push(ext);
      }
    }
    return result;
  }

  function normalizeSettings(raw) {
    var source = raw && typeof raw === "object" ? raw : {};
    return {
      enabled:
        typeof source.enabled === "boolean" ? source.enabled : DEFAULT_SETTINGS.enabled,
      extensions: Array.isArray(source.extensions)
        ? normalizeExtensionList(source.extensions)
        : DEFAULT_EXTENSIONS.slice(),
      showPill:
        typeof source.showPill === "boolean"
          ? source.showPill
          : DEFAULT_SETTINGS.showPill,
      settingsVersion:
        typeof source.settingsVersion === "number"
          ? source.settingsVersion
          : SETTINGS_VERSION
    };
  }

  /**
   * Upgrades stored v1 settings (created before Word filtering was added) by
   * enabling Microsoft Word extensions once and bumping settingsVersion to 2.
   */
  function migrateStoredSettings(stored) {
    var source = stored && typeof stored === "object" ? stored : {};
    var hadSavedExtensions = Array.isArray(source.extensions);
    var oldVersion =
      typeof source.settingsVersion === "number" ? source.settingsVersion : 1;

    if (hadSavedExtensions && oldVersion < 2) {
      var merged = normalizeExtensionList(source.extensions.concat(WORD_EXTENSIONS));
      var upgraded = normalizeSettings({
        enabled: source.enabled,
        extensions: merged,
        showPill: source.showPill,
        settingsVersion: SETTINGS_VERSION
      });
      return { settings: upgraded, migrated: true };
    }

    var normalized = normalizeSettings({
      enabled: source.enabled,
      extensions: source.extensions,
      showPill: source.showPill,
      settingsVersion: SETTINGS_VERSION
    });
    return {
      settings: normalized,
      migrated: oldVersion < SETTINGS_VERSION && hadSavedExtensions
    };
  }

  function toExtensionSet(extensions) {
    var set = Object.create(null);
    var list = Array.isArray(extensions) ? extensions : DEFAULT_EXTENSIONS;
    for (var i = 0; i < list.length; i += 1) {
      var ext = normalizeExtension(list[i]);
      if (ext) {
        set[ext] = true;
      }
    }
    return set;
  }

  function isWordExtension(ext) {
    return Boolean(ext && WORD_EXT_MAP[ext]);
  }

  function hasNonDocsPath(urlString) {
    if (typeof urlString !== "string" || !urlString) {
      return false;
    }
    return /\/(?:spreadsheets|presentation|forms|drawings)(?:\/|$)/i.test(urlString);
  }

  function hasDocsOriginHint(locationLike, referrer) {
    var origins = locationLike && locationLike.ancestorOrigins;
    if (origins && typeof origins.length === "number" && origins.length > 0) {
      return origins[0] === "https://docs.google.com";
    }

    var search = (locationLike && locationLike.search) || "";
    if (search) {
      try {
        var params = new URLSearchParams(search);
        var originParam = params.get("origin") || params.get("parent") || "";
        if (originParam) {
          return originParam.indexOf("https://docs.google.com") === 0;
        }
        var hostId = params.get("hostId") || "";
        if (hostId === "docs" || hostId.indexOf("docs") === 0) {
          return true;
        }
      } catch (_err) {
        // Ignore malformed query strings and continue checking referrer.
      }
    }

    if (typeof referrer === "string" && referrer) {
      return referrer.indexOf("https://docs.google.com") === 0;
    }

    return Boolean(locationLike && locationLike.hostname === "docs.google.com");
  }

  function detectSurface(locationLike, referrer) {
    if (!locationLike || typeof locationLike.pathname !== "string") {
      return "ignore";
    }

    var hostname = locationLike.hostname || "";
    var pathname = locationLike.pathname || "";

    if (/\/d\/[^/]+/.test(pathname)) {
      return "ignore";
    }

    if (hasNonDocsPath(pathname)) {
      return "ignore";
    }

    if (pathname === "/picker" || pathname.indexOf("/picker/") === 0) {
      if (hostname !== "docs.google.com" && hostname !== "drive.google.com") {
        return "ignore";
      }
      if (hasNonDocsPath(referrer)) {
        return "ignore";
      }
      if (!hasDocsOriginHint(locationLike, referrer)) {
        return "ignore";
      }
      return "picker";
    }

    if (hostname !== "docs.google.com") {
      return "ignore";
    }

    if (
      pathname === "/" ||
      /^\/u\/\d+\/?$/.test(pathname) ||
      /^(?:\/a\/[^/]+)?\/document(?:\/u\/\d+)?\/?$/.test(pathname)
    ) {
      return "homescreen";
    }

    return "ignore";
  }

  function matchFilteredExtension(candidate, extensionSet) {
    var clean = stripInvisible(candidate);
    if (!clean || clean.length > 300 || clean.indexOf("\n") !== -1) {
      return null;
    }

    var lastDot = clean.lastIndexOf(".");
    if (lastDot <= 0 || lastDot === clean.length - 1) {
      return null;
    }

    var charBeforeDot = clean.charAt(lastDot - 1);
    if (/[\s.]/.test(charBeforeDot)) {
      return null;
    }

    var ext = clean.slice(lastDot + 1).toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,23}$/.test(ext)) {
      return null;
    }

    return extensionSet && extensionSet[ext] ? ext : null;
  }

  function extractFilenameFromAriaLabel(ariaLabel) {
    var clean = stripInvisible(ariaLabel);
    if (!clean) {
      return "";
    }
    var firstLine = clean.split(/\r?\n/)[0].trim();

    var commaIndex = firstLine.indexOf(", ");
    if (commaIndex > 0) {
      firstLine = firstLine.slice(0, commaIndex).trim();
    }

    firstLine = firstLine.replace(ARIA_META_SUFFIX_RE, "").trim();
    firstLine = firstLine.replace(ARIA_TYPE_SUFFIX_RE, "").trim();
    return firstLine;
  }

  function isInlineLabelElement(el) {
    var children = el.children;
    if (!children || children.length === 0) {
      return true;
    }
    for (var i = 0; i < children.length; i += 1) {
      var child = children[i];
      if (!INLINE_HIGHLIGHT_TAGS[child.tagName]) {
        return false;
      }
      if (child.getAttribute("role")) {
        return false;
      }
      if (child.children && child.children.length > 0) {
        return false;
      }
    }
    return true;
  }

  function isInsideSubtree(node, ancestor) {
    if (!node || !ancestor) {
      return false;
    }
    var cur = node;
    while (cur) {
      if (cur === ancestor) {
        return true;
      }
      cur = cur.parentElement;
    }
    return false;
  }

  function isOwnerOrActionSubtree(el, stopAt) {
    var current = el;
    while (current && current !== stopAt) {
      var role = current.getAttribute && current.getAttribute("role");
      if (role === "button" || role === "menu" || role === "menuitem") {
        return true;
      }
      var cls = (current.className && String(current.className)) || "";
      if (
        cls.indexOf("docs-homescreen-list-item-owner") !== -1 ||
        cls.indexOf("docs-homescreen-list-item-time") !== -1 ||
        cls.indexOf("owner") !== -1 ||
        cls.indexOf("avatar") !== -1
      ) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  function findTitleElement(itemEl) {
    return (
      itemEl.querySelector(SPECIFIC_TITLE_VALUE_SELECTOR) ||
      itemEl.querySelector(FALLBACK_TITLE_SELECTOR)
    );
  }

  function hasExplicitMarkdownMimeOrBadge(itemEl, titleEl) {
    var ownMime = (itemEl.getAttribute("data-mime-type") || "").toLowerCase();
    if (ownMime === "text/markdown" || ownMime === "text/x-markdown") {
      return true;
    }

    var mimeNodes = itemEl.querySelectorAll("[data-mime-type]");
    for (var m = 0; m < mimeNodes.length; m += 1) {
      var mime = (mimeNodes[m].getAttribute("data-mime-type") || "").toLowerCase();
      if (mime === "text/markdown" || mime === "text/x-markdown") {
        return true;
      }
    }

    var labelled = itemEl.querySelectorAll("[aria-label], [data-tooltip]");
    for (var i = 0; i < labelled.length; i += 1) {
      var node = labelled[i];
      if (isInsideSubtree(node, titleEl) || isOwnerOrActionSubtree(node, itemEl)) {
        continue;
      }
      var label = stripInvisible(
        node.getAttribute("aria-label") || node.getAttribute("data-tooltip") || ""
      ).toLowerCase();
      if (
        label === "markdown" ||
        label === "markdown-bestand" ||
        label === "markdown file"
      ) {
        return true;
      }
    }

    return false;
  }

  function isMimeIconImageUrl(src) {
    return (
      src.indexOf("doclist/images") !== -1 ||
      src.indexOf("mediatype") !== -1 ||
      src.indexOf("/type/application/") !== -1 ||
      src.indexOf("mime") !== -1
    );
  }

  function hasExplicitWordMimeOrBadge(itemEl, titleEl) {
    var ownMime = (itemEl.getAttribute("data-mime-type") || "").toLowerCase();
    if (WORD_MIME_TYPES[ownMime]) {
      return true;
    }

    var mimeNodes = itemEl.querySelectorAll("[data-mime-type]");
    for (var m = 0; m < mimeNodes.length; m += 1) {
      var mime = (mimeNodes[m].getAttribute("data-mime-type") || "").toLowerCase();
      if (WORD_MIME_TYPES[mime]) {
        return true;
      }
    }

    // Check icon and badge labels outside the document title and owner columns.
    var labelled = itemEl.querySelectorAll("[aria-label], [data-tooltip], [title], img[alt]");
    for (var i = 0; i < labelled.length; i += 1) {
      var node = labelled[i];
      if (isInsideSubtree(node, titleEl) || isOwnerOrActionSubtree(node, itemEl)) {
        continue;
      }
      var rawLabel =
        node.getAttribute("aria-label") ||
        node.getAttribute("data-tooltip") ||
        node.getAttribute("title") ||
        node.getAttribute("alt") ||
        "";
      var cleanLabel = stripInvisible(rawLabel).toLowerCase();
      if (WORD_BADGE_LABELS[cleanLabel]) {
        return true;
      }
    }

    // Check file-type icon images (e.g. gstatic icon_1_word_x16.png or openxmlformats URL).
    var images = itemEl.querySelectorAll("img[src]");
    for (var im = 0; im < images.length; im += 1) {
      var img = images[im];
      if (isOwnerOrActionSubtree(img, itemEl)) {
        continue;
      }
      var src = img.getAttribute("src") || "";
      var inIconSlot = Boolean(
        img.closest(
          ".docs-homescreen-grid-item-icon, .docs-homescreen-list-item-icon, .gssb_e"
        )
      );
      if (inIconSlot || isMimeIconImageUrl(src)) {
        if (
          /(?:[/_-]word[/_.-]|openxmlformats-officedocument\.wordprocessingml|application[/_-]msword)/i.test(
            src
          )
        ) {
          return true;
        }
      }
    }

    // Check explicit Word icon sprite classes and uppercase DOCX/DOC chips.
    var descendants = itemEl.querySelectorAll("*");
    for (var d = 0; d < descendants.length; d += 1) {
      var el = descendants[d];
      if (isInsideSubtree(el, titleEl) || isOwnerOrActionSubtree(el, itemEl)) {
        continue;
      }
      var cls = (el.className && String(el.className)) || "";
      if (
        cls &&
        /(?:^|[\s_-])(?:docs-icon-word|docs-homescreen-icon-word|icon-word)(?:$|[\s_-])/i.test(
          cls
        )
      ) {
        return true;
      }
      if (el.children && el.children.length === 0) {
        var chipText = stripInvisible(el.textContent || "");
        if (WORD_CHIP_TEXTS[chipText]) {
          return true;
        }
      }
    }

    // Check comma-separated metadata segments in item aria-label (e.g. "Verslag, Microsoft Word, 10:15").
    var itemAria = stripInvisible(itemEl.getAttribute("aria-label") || "");
    if (itemAria && itemAria.indexOf(", ") !== -1) {
      var parts = itemAria.split(/\r?\n/)[0].split(", ");
      for (var p = 1; p < parts.length; p += 1) {
        var seg = parts[p].trim().toLowerCase();
        if (WORD_BADGE_LABELS[seg]) {
          return true;
        }
      }
    }

    return false;
  }

  function isDisallowedCandidate(itemEl) {
    if (!itemEl || itemEl.nodeType !== 1) {
      return true;
    }

    if (
      itemEl.closest(
        '.docs-homescreen-templates-container, .goog-menu, [role="menu"], #md-block-pill-host, [data-md-block-ignore="true"]'
      )
    ) {
      return true;
    }

    if (
      itemEl.getAttribute("data-target") === "folder" ||
      itemEl.getAttribute("data-mime-type") === "application/vnd.google-apps.folder"
    ) {
      return true;
    }

    var role = itemEl.getAttribute("role");
    if (role === "columnheader" || itemEl.querySelector('[role="columnheader"]')) {
      return true;
    }

    var isKnownLeafItem =
      itemEl.classList.contains("docs-homescreen-grid-item") ||
      itemEl.classList.contains("docs-homescreen-list-item") ||
      (itemEl.tagName === "TR" && itemEl.classList.contains("gssb_a"));

    if (!isKnownLeafItem && itemEl.querySelector(NESTED_ITEM_SELECTOR)) {
      return true;
    }

    return false;
  }

  function classifyItemElement(itemEl, extensionSet) {
    if (!extensionSet || isDisallowedCandidate(itemEl)) {
      return null;
    }

    var markdownActive = Boolean(extensionSet.md || extensionSet.markdown);
    var wordActive = Boolean(extensionSet.docx || extensionSet.doc);

    // 1. Explicit Google Docs / Picker title element.
    var titleEl = findTitleElement(itemEl);
    if (titleEl) {
      var titleText = stripInvisible(titleEl.textContent || "");
      var matchedFromText = matchFilteredExtension(titleText, extensionSet);
      if (matchedFromText) {
        return { matchedExt: matchedFromText, reason: "title" };
      }

      var titleAttr = stripInvisible(
        titleEl.getAttribute("title") || titleEl.getAttribute("aria-label") || ""
      );
      var matchedFromAttr = matchFilteredExtension(titleAttr, extensionSet);
      if (matchedFromAttr) {
        return { matchedExt: matchedFromAttr, reason: "title-attr" };
      }

      if (markdownActive && hasExplicitMarkdownMimeOrBadge(itemEl, titleEl)) {
        return { matchedExt: "md", reason: "mime" };
      }
      if (wordActive && hasExplicitWordMimeOrBadge(itemEl, titleEl)) {
        return { matchedExt: "docx", reason: "word-mime" };
      }
      return null;
    }

    var fullItemText = stripInvisible(itemEl.textContent || "");
    if (SEARCH_ACTION_PREFIX_RE.test(fullItemText)) {
      return null;
    }

    // 2. Tooltip / title attributes on inner labels.
    var titledNodes = itemEl.querySelectorAll("[title], [data-tooltip]");
    for (var i = 0; i < titledNodes.length; i += 1) {
      var titledNode = titledNodes[i];
      if (isOwnerOrActionSubtree(titledNode, itemEl)) {
        continue;
      }
      var tip =
        titledNode.getAttribute("title") || titledNode.getAttribute("data-tooltip") || "";
      var matchedTip = matchFilteredExtension(tip, extensionSet);
      if (matchedTip) {
        return { matchedExt: matchedTip, reason: "tooltip" };
      }
    }

    // 3. Inline text labels (handles obfuscated Picker rows and <b>...</b> search matches).
    var descendants = itemEl.querySelectorAll("*");
    for (var j = 0; j < descendants.length; j += 1) {
      var node = descendants[j];
      if (!isInlineLabelElement(node) || isOwnerOrActionSubtree(node, itemEl)) {
        continue;
      }
      var labelText = stripInvisible(node.textContent || "");
      if (!labelText || SEARCH_ACTION_PREFIX_RE.test(labelText)) {
        continue;
      }
      var matchedLabel = matchFilteredExtension(labelText, extensionSet);
      if (matchedLabel) {
        return { matchedExt: matchedLabel, reason: "inline-label" };
      }
    }

    // 4. Primary filename segment of aria-label on the item itself.
    var ariaLabel = itemEl.getAttribute("aria-label") || "";
    if (ariaLabel) {
      var primaryName = extractFilenameFromAriaLabel(ariaLabel);
      var matchedAria = matchFilteredExtension(primaryName, extensionSet);
      if (matchedAria) {
        return { matchedExt: matchedAria, reason: "aria-label" };
      }
    }

    // 5. Explicit Markdown or Microsoft Word MIME / badge indicators.
    if (markdownActive && hasExplicitMarkdownMimeOrBadge(itemEl, null)) {
      return { matchedExt: "md", reason: "mime" };
    }
    if (wordActive && hasExplicitWordMimeOrBadge(itemEl, null)) {
      return { matchedExt: "docx", reason: "word-mime" };
    }

    return null;
  }

  function sectionHasToolbarControls(sectionEl) {
    if (
      sectionEl.querySelector(
        ".docs-homescreen-floater-header, .docs-homescreen-list-header"
      )
    ) {
      return true;
    }

    var controls = sectionEl.querySelectorAll('[role="button"], [role="listbox"]');
    for (var i = 0; i < controls.length; i += 1) {
      var ctrl = controls[i];
      if (!ctrl.closest(".docs-homescreen-grid-item, .docs-homescreen-list-item")) {
        return true;
      }
    }
    return false;
  }

  function updateEmptySections(doc) {
    if (!doc || !doc.querySelectorAll) {
      return;
    }
    var sections = doc.querySelectorAll(".docs-homescreen-item-section");
    for (var i = 0; i < sections.length; i += 1) {
      var section = sections[i];
      if (
        section.classList.contains("docs-homescreen-templates-container") ||
        section.querySelector('[class*="templates-templateview"]')
      ) {
        continue;
      }

      var items = section.querySelectorAll(
        ".docs-homescreen-grid-item, .docs-homescreen-list-item"
      );
      if (items.length === 0) {
        section.removeAttribute("data-md-block-empty-section");
        continue;
      }

      var allHidden = true;
      for (var j = 0; j < items.length; j += 1) {
        if (items[j].getAttribute("data-md-block-hidden") !== "true") {
          allHidden = false;
          break;
        }
      }

      if (allHidden && !sectionHasToolbarControls(section)) {
        section.setAttribute("data-md-block-empty-section", "true");
      } else {
        section.removeAttribute("data-md-block-empty-section");
      }
    }
  }

  function applyFilterPass(doc, surface, extensionSet, cache, configRev) {
    var selector = surface === "picker" ? PICKER_ITEM_SELECTOR : HOMESCREEN_ITEM_SELECTOR;
    var candidates = doc.querySelectorAll(selector);

    var hiddenCount = 0;
    var visibleDocCount = 0;
    var hiddenByExt = Object.create(null);

    for (var i = 0; i < candidates.length; i += 1) {
      var el = candidates[i];
      if (
        isDisallowedCandidate(el) ||
        (el.parentElement &&
          el.parentElement.closest(
            '.docs-homescreen-grid-item, .docs-homescreen-list-item, tr.gssb_a, [data-md-block-hidden="true"]'
          ))
      ) {
        if (el.hasAttribute("data-md-block-hidden")) {
          el.removeAttribute("data-md-block-hidden");
          el.removeAttribute("data-md-block-ext");
        }
        continue;
      }

      var snapshot =
        (el.getAttribute("aria-label") || "") +
        "|" +
        (el.getAttribute("data-mime-type") || "") +
        "|" +
        (el.textContent || "").slice(0, 240);

      var decision = null;
      var cached = cache ? cache.get(el) : null;
      if (cached && cached.rev === configRev && cached.snapshot === snapshot) {
        decision = cached.decision;
      } else {
        decision = classifyItemElement(el, extensionSet);
        if (cache) {
          cache.set(el, {
            rev: configRev,
            snapshot: snapshot,
            decision: decision
          });
        }
      }

      if (decision) {
        if (el.getAttribute("data-md-block-hidden") !== "true") {
          el.setAttribute("data-md-block-hidden", "true");
        }
        el.setAttribute("data-md-block-ext", decision.matchedExt);
        hiddenCount += 1;
        hiddenByExt[decision.matchedExt] = (hiddenByExt[decision.matchedExt] || 0) + 1;
      } else {
        if (el.hasAttribute("data-md-block-hidden")) {
          el.removeAttribute("data-md-block-hidden");
          el.removeAttribute("data-md-block-ext");
        }
        if (
          surface === "picker" ||
          el.classList.contains("docs-homescreen-grid-item") ||
          el.classList.contains("docs-homescreen-list-item")
        ) {
          visibleDocCount += 1;
        }
      }
    }

    if (surface === "homescreen") {
      updateEmptySections(doc);
    }

    return {
      hiddenCount: hiddenCount,
      visibleDocCount: visibleDocCount,
      totalCandidates: candidates.length,
      hiddenByExt: hiddenByExt
    };
  }

  function formatBreakdownSummary(byExt) {
    if (!byExt) {
      return "";
    }
    var mdCount = 0;
    var wordCount = 0;
    var otherParts = [];
    var keys = Object.keys(byExt);
    for (var i = 0; i < keys.length; i += 1) {
      var k = keys[i];
      var n = byExt[k] || 0;
      if (n <= 0) {
        continue;
      }
      if (k === "md" || k === "markdown") {
        mdCount += n;
      } else if (isWordExtension(k)) {
        wordCount += n;
      } else {
        otherParts.push(n + " ." + k);
      }
    }
    var parts = [];
    if (mdCount > 0) {
      parts.push(mdCount + " .md");
    }
    if (wordCount > 0) {
      parts.push(wordCount + " Word");
    }
    return parts.concat(otherParts).join(", ");
  }

  function formatPillLabel(stats, enabled, localeOverride) {
    var count = (stats && stats.hiddenCount) || 0;
    var byExt = (stats && stats.hiddenByExt) || {};
    var extKeys = Object.keys(byExt).filter(function (k) {
      return byExt[k] > 0;
    });

    var onlyMarkdown =
      extKeys.length > 0 &&
      extKeys.every(function (k) {
        return k === "md" || k === "markdown";
      });

    var onlyWord =
      extKeys.length > 0 &&
      extKeys.every(function (k) {
        return isWordExtension(k);
      });

    if (!enabled) {
      if (count === 0) {
        return getMessage("pillPausedZero", [], localeOverride);
      }
      if (onlyMarkdown) {
        return getMessage("pillShownMd", [count], localeOverride);
      }
      if (onlyWord) {
        return getMessage("pillShownWord", [count], localeOverride);
      }
      return count === 1
        ? getMessage("pillShownFilesSingular", [], localeOverride)
        : getMessage("pillShownFilesPlural", [count], localeOverride);
    }

    if (onlyMarkdown) {
      return getMessage("pillHiddenMd", [count], localeOverride);
    }
    if (onlyWord) {
      return getMessage("pillHiddenWord", [count], localeOverride);
    }
    return count === 1
      ? getMessage("pillHiddenFilesSingular", [], localeOverride)
      : getMessage("pillHiddenFilesPlural", [count], localeOverride);
  }

  function formatPillTooltip(stats, enabled, localeOverride) {
    var actionText = enabled
      ? getMessage("pillTitleActive", [], localeOverride)
      : getMessage("pillTitlePaused", [], localeOverride);
    var summary = formatBreakdownSummary(stats && stats.hiddenByExt);
    if (!summary) {
      return actionText;
    }
    return summary + " · " + actionText;
  }

  return {
    SETTINGS_VERSION: SETTINGS_VERSION,
    STORAGE_KEYS: STORAGE_KEYS,
    MARKDOWN_EXTENSIONS: MARKDOWN_EXTENSIONS,
    WORD_EXTENSIONS: WORD_EXTENSIONS,
    DEFAULT_EXTENSIONS: DEFAULT_EXTENSIONS,
    OPTIONAL_PRESETS: OPTIONAL_PRESETS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    HOMESCREEN_ITEM_SELECTOR: HOMESCREEN_ITEM_SELECTOR,
    PICKER_ITEM_SELECTOR: PICKER_ITEM_SELECTOR,
    getMessage: getMessage,
    stripInvisible: stripInvisible,
    normalizeExtension: normalizeExtension,
    normalizeExtensionList: normalizeExtensionList,
    normalizeSettings: normalizeSettings,
    migrateStoredSettings: migrateStoredSettings,
    toExtensionSet: toExtensionSet,
    isWordExtension: isWordExtension,
    detectSurface: detectSurface,
    matchFilteredExtension: matchFilteredExtension,
    extractFilenameFromAriaLabel: extractFilenameFromAriaLabel,
    classifyItemElement: classifyItemElement,
    updateEmptySections: updateEmptySections,
    applyFilterPass: applyFilterPass,
    formatBreakdownSummary: formatBreakdownSummary,
    formatPillLabel: formatPillLabel,
    formatPillTooltip: formatPillTooltip
  };
});
