"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");
var Core = require("../src/filter-core.js");

// Minimal DOM tree implementation supporting the CSS selectors used by filter-core.js.
function parseSimpleSelectorPart(part) {
  var trimmed = part.trim();
  if (trimmed === "*") {
    return function (el) {
      return el.nodeType === 1;
    };
  }

  var tagMatch = trimmed.match(/^[a-zA-Z0-9_-]+/);
  var tag = tagMatch ? tagMatch[0].toUpperCase() : null;
  var idMatch = trimmed.match(/#([a-zA-Z0-9_-]+)/);
  var id = idMatch ? idMatch[1] : null;

  var classes = [];
  var withoutAttrs = trimmed.replace(/\[[^\]]+\]/g, "");
  var classRe = /\.([a-zA-Z0-9_-]+)/g;
  var cm;
  while ((cm = classRe.exec(withoutAttrs)) !== null) {
    classes.push(cm[1]);
  }

  var attrs = [];
  var attrRe = /\[([a-zA-Z0-9_-]+)(?:(\*=|=)"([^"]*)")?\]/g;
  var am;
  while ((am = attrRe.exec(trimmed)) !== null) {
    attrs.push({ name: am[1], op: am[2] || null, value: am[3] || "" });
  }

  return function (el) {
    if (!el || el.nodeType !== 1) {
      return false;
    }
    if (tag && el.tagName !== tag) {
      return false;
    }
    if (id && el.getAttribute("id") !== id) {
      return false;
    }
    for (var i = 0; i < classes.length; i += 1) {
      if (!el.classList.contains(classes[i])) {
        return false;
      }
    }
    for (var j = 0; j < attrs.length; j += 1) {
      var a = attrs[j];
      if (!el.hasAttribute(a.name)) {
        return false;
      }
      var actual = el.getAttribute(a.name) || "";
      if (a.op === "=" && actual !== a.value) {
        return false;
      }
      if (a.op === "*=" && actual.indexOf(a.value) === -1) {
        return false;
      }
    }
    return true;
  };
}

function matchesSingleChain(el, chainStr) {
  var tokens = chainStr.trim().split(/\s+/);
  var matchers = tokens.map(parseSimpleSelectorPart);
  if (!matchers[matchers.length - 1](el)) {
    return false;
  }
  var current = el.parentElement;
  for (var i = matchers.length - 2; i >= 0; i -= 1) {
    while (current && !matchers[i](current)) {
      current = current.parentElement;
    }
    if (!current) {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}

function matchesSelector(el, selector) {
  var groups = selector.split(",");
  for (var i = 0; i < groups.length; i += 1) {
    if (matchesSingleChain(el, groups[i])) {
      return true;
    }
  }
  return false;
}

function h(tag, attrs, children) {
  var attrMap = Object.create(null);
  if (attrs) {
    var keys = Object.keys(attrs);
    for (var i = 0; i < keys.length; i += 1) {
      if (attrs[keys[i]] !== undefined && attrs[keys[i]] !== null) {
        attrMap[keys[i]] = String(attrs[keys[i]]);
      }
    }
  }

  var childNodes = [];
  var rawChildren = Array.isArray(children)
    ? children
    : children !== undefined
      ? [children]
      : [];

  var el = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    parentElement: null,
    children: [],
    get className() {
      return attrMap.class || "";
    },
    set className(v) {
      attrMap.class = String(v);
    },
    classList: {
      contains: function (cls) {
        var list = (attrMap.class || "").trim().split(/\s+/);
        return list.indexOf(cls) !== -1;
      }
    },
    getAttribute: function (name) {
      return Object.prototype.hasOwnProperty.call(attrMap, name) ? attrMap[name] : null;
    },
    setAttribute: function (name, val) {
      attrMap[name] = String(val);
    },
    removeAttribute: function (name) {
      delete attrMap[name];
    },
    hasAttribute: function (name) {
      return Object.prototype.hasOwnProperty.call(attrMap, name);
    },
    get textContent() {
      var out = "";
      for (var c = 0; c < childNodes.length; c += 1) {
        var ch = childNodes[c];
        out += typeof ch === "string" ? ch : ch.textContent;
      }
      return out;
    },
    matches: function (sel) {
      return matchesSelector(el, sel);
    },
    closest: function (sel) {
      var cur = el;
      while (cur) {
        if (matchesSelector(cur, sel)) {
          return cur;
        }
        cur = cur.parentElement;
      }
      return null;
    },
    querySelectorAll: function (sel) {
      var results = [];
      function walk(node) {
        for (var k = 0; k < node.children.length; k += 1) {
          var child = node.children[k];
          if (matchesSelector(child, sel)) {
            results.push(child);
          }
          walk(child);
        }
      }
      walk(el);
      return results;
    },
    querySelector: function (sel) {
      var all = el.querySelectorAll(sel);
      return all.length > 0 ? all[0] : null;
    }
  };

  for (var j = 0; j < rawChildren.length; j += 1) {
    var item = rawChildren[j];
    if (typeof item === "string") {
      childNodes.push(item);
    } else if (item && item.nodeType === 1) {
      item.parentElement = el;
      el.children.push(item);
      childNodes.push(item);
    }
  }

  return el;
}

test("detectSurface leaves open Google Docs editors and Drive untouched", function () {
  assert.equal(
    Core.detectSurface({ hostname: "docs.google.com", pathname: "/document/u/0/" }, ""),
    "homescreen"
  );
  assert.equal(
    Core.detectSurface({ hostname: "docs.google.com", pathname: "/document/" }, ""),
    "homescreen"
  );
  assert.equal(
    Core.detectSurface(
      { hostname: "docs.google.com", pathname: "/a/school.be/document/u/1/" },
      ""
    ),
    "homescreen"
  );

  // Critical: never run inside an open document editor.
  assert.equal(
    Core.detectSurface(
      { hostname: "docs.google.com", pathname: "/document/d/1AbCdEfGhIjKlMnOp/edit" },
      ""
    ),
    "ignore"
  );
  assert.equal(
    Core.detectSurface(
      {
        hostname: "docs.google.com",
        pathname: "/document/u/0/d/1AbCdEfGhIjKlMnOp/edit"
      },
      ""
    ),
    "ignore"
  );

  // Never run in Sheets, Slides, Forms, or Google Drive itself.
  assert.equal(
    Core.detectSurface({ hostname: "docs.google.com", pathname: "/spreadsheets/u/0/" }, ""),
    "ignore"
  );
  assert.equal(
    Core.detectSurface({ hostname: "drive.google.com", pathname: "/drive/recent" }, ""),
    "ignore"
  );

  // File > Open picker inside Google Docs runs, Gmail or Sheets picker does not.
  assert.equal(
    Core.detectSurface(
      {
        hostname: "drive.google.com",
        pathname: "/picker",
        search: "?protocol=gadgets&origin=https%3A%2F%2Fdocs.google.com"
      },
      "https://docs.google.com/document/d/1AbCd/edit"
    ),
    "picker"
  );
  assert.equal(
    Core.detectSurface(
      {
        hostname: "drive.google.com",
        pathname: "/picker",
        search: "?protocol=gadgets&origin=https%3A%2F%2Fmail.google.com",
        ancestorOrigins: ["https://mail.google.com"]
      },
      "https://mail.google.com/"
    ),
    "ignore"
  );
  assert.equal(
    Core.detectSurface(
      {
        hostname: "docs.google.com",
        pathname: "/picker",
        search: "?protocol=gadgets&origin=https%3A%2F%2Fdocs.google.com"
      },
      "https://docs.google.com/spreadsheets/d/1Sheet/edit"
    ),
    "ignore"
  );
});

test("matchFilteredExtension handles BiDi marks and protects human titles mentioning .md", function () {
  var set = Core.toExtensionSet(["md", "markdown"]);

  assert.equal(Core.matchFilteredExtension("README.md", set), "md");
  assert.equal(Core.matchFilteredExtension("SKILL.MD", set), "md");
  assert.equal(Core.matchFilteredExtension("notes.v2.markdown", set), "markdown");
  assert.equal(Core.matchFilteredExtension(".claude.md", set), "md");
  assert.equal(Core.matchFilteredExtension("\u202AREADME.md\u202C\u200E", set), "md");

  // Human documents that mention .md in prose must stay visible.
  assert.equal(Core.matchFilteredExtension("Notities over .md bestanden", set), null);
  assert.equal(Core.matchFilteredExtension("Vraag over .md", set), null);
  assert.equal(Core.matchFilteredExtension("Projectvoorstel...", set), null);
  assert.equal(Core.matchFilteredExtension("Lesvoorbereiding week 4", set), null);
});

test("applyFilterPass hides .md cards and rows while keeping human docs and owner initials MD", function () {
  var doc = h("div", { class: "root" }, [
    // Template gallery must never be touched
    h("div", { class: "docs-homescreen-templates-container" }, [
      h("div", { class: "docs-homescreen-grid-item" }, [
        h("div", { class: "docs-homescreen-grid-item-title" }, "template.md")
      ])
    ]),
    // Section 1 with toolbar header and only .md items -> items hidden, section kept for toolbar
    h("div", { class: "docs-homescreen-item-section", id: "sec-toolbar" }, [
      h("div", { class: "docs-homescreen-floater-header" }, [
        h("div", { role: "button" }, "Sorteeropties")
      ]),
      h("div", { class: "docs-homescreen-grid-item", id: "card-md" }, [
        h("div", { class: "docs-homescreen-grid-item-title" }, "AGENTS.md")
      ])
    ]),
    // Section 2 without toolbar and only .md items -> section collapses
    h("div", { class: "docs-homescreen-item-section", id: "sec-empty-date" }, [
      h("div", { class: "section-header" }, "Gisteren"),
      h("div", { class: "docs-homescreen-list-item", id: "row-md" }, [
        h("div", { class: "docs-homescreen-list-item-title" }, [
          h("span", { class: "docs-homescreen-list-item-title-value" }, "README.md\u200E")
        ]),
        // Nested role="option" must not double-count
        h("div", { role: "option" }, "README.md")
      ])
    ]),
    // Section 3 with human documents (including owner initials MD and a title mentioning .md)
    h("div", { class: "docs-homescreen-item-section", id: "sec-human" }, [
      h("div", { class: "docs-homescreen-list-item", id: "row-human-1" }, [
        h("div", { class: "docs-homescreen-list-item-title" }, [
          h(
            "span",
            { class: "docs-homescreen-list-item-title-value" },
            "Notities over .md bestanden"
          )
        ]),
        h("div", { class: "docs-homescreen-list-item-owner" }, [h("span", {}, "MD")])
      ]),
      h("div", { class: "docs-homescreen-grid-item", id: "card-human-2" }, [
        h("div", { class: "docs-homescreen-grid-item-title" }, "Jaarverslag 2026.docx")
      ]),
      // Markdown item identified by MIME badge when extension is hidden in title
      h(
        "div",
        {
          class: "docs-homescreen-grid-item",
          id: "card-mime-md",
          "data-mime-type": "text/markdown"
        },
        [h("div", { class: "docs-homescreen-grid-item-title" }, "CHANGELOG")]
      )
    ])
  ]);

  var extSet = Core.toExtensionSet(["md", "markdown"]);
  var stats = Core.applyFilterPass(doc, "homescreen", extSet, new WeakMap(), 1);

  assert.equal(stats.hiddenCount, 3);
  assert.equal(stats.visibleDocCount, 2); // 2 human docs (templates excluded from count)

  assert.equal(
    doc
      .querySelector(".docs-homescreen-templates-container .docs-homescreen-grid-item")
      .getAttribute("data-md-block-hidden"),
    null
  );

  assert.equal(doc.querySelector("#card-md").getAttribute("data-md-block-hidden"), "true");
  assert.equal(doc.querySelector("#row-md").getAttribute("data-md-block-hidden"), "true");
  assert.equal(
    doc.querySelector("#card-mime-md").getAttribute("data-md-block-hidden"),
    "true"
  );

  assert.equal(
    doc.querySelector("#row-human-1").getAttribute("data-md-block-hidden"),
    null
  );
  assert.equal(
    doc.querySelector("#card-human-2").getAttribute("data-md-block-hidden"),
    null
  );

  // Toolbar section stays visible; pure date section with all items hidden collapses.
  assert.equal(
    doc.querySelector("#sec-toolbar").getAttribute("data-md-block-empty-section"),
    null
  );
  assert.equal(
    doc.querySelector("#sec-empty-date").getAttribute("data-md-block-empty-section"),
    "true"
  );
  assert.equal(
    doc.querySelector("#sec-human").getAttribute("data-md-block-empty-section"),
    null
  );
});

test("search autocomplete hides highlighted .md suggestions but keeps search action row", function () {
  var doc = h("div", {}, [
    h("form", { role: "search" }, [
      h("div", { role: "listbox" }, [
        h("div", { role: "option", id: "sug-md" }, [
          h("div", { class: "sug-title" }, [h("b", {}, "read"), "me.md"])
        ]),
        h("div", { role: "option", id: "sug-human" }, [
          h("div", { class: "sug-title" }, [h("b", {}, "Read"), "ing list 2026"])
        ]),
        h("div", { role: "option", id: "sug-action" }, [
          h("div", {}, "Alle resultaten weergeven voor readme.md")
        ])
      ])
    ])
  ]);

  var stats = Core.applyFilterPass(
    doc,
    "homescreen",
    Core.toExtensionSet(["md", "markdown"]),
    null,
    1
  );

  assert.equal(stats.hiddenCount, 1);
  assert.equal(doc.querySelector("#sug-md").getAttribute("data-md-block-hidden"), "true");
  assert.equal(doc.querySelector("#sug-human").getAttribute("data-md-block-hidden"), null);
  assert.equal(doc.querySelector("#sug-action").getAttribute("data-md-block-hidden"), null);
});

test("picker mode filters obfuscated items without hiding containers, headers, or folders", function () {
  var doc = h("div", { role: "listbox", id: "picker-grid" }, [
    h("div", { role: "row", id: "header-row" }, [
      h("div", { role: "columnheader" }, "Naam")
    ]),
    h("div", { role: "option", "data-target": "folder", id: "folder-item" }, [
      h("div", {}, "archive.md")
    ]),
    h(
      "div",
      {
        role: "option",
        id: "picker-md",
        "aria-label": "SKILL.md, Markdown, Geopend om 09:15"
      },
      [h("div", { class: "obf-a1" }, "09:15")]
    ),
    h(
      "div",
      {
        role: "option",
        id: "picker-json",
        "aria-label": "config.json Google Documenten"
      },
      [h("div", { class: "obf-a1" }, "config.json")]
    ),
    h(
      "div",
      {
        role: "option",
        id: "picker-doc",
        "aria-label": "Lesplan ontwerp Google Documenten"
      },
      [h("div", { class: "obf-a1" }, "Lesplan ontwerp")]
    )
  ]);

  var cache = new WeakMap();

  // Pass 1: default (.md, .markdown)
  var stats1 = Core.applyFilterPass(
    doc,
    "picker",
    Core.toExtensionSet(["md", "markdown"]),
    cache,
    1
  );
  assert.equal(stats1.hiddenCount, 1);
  assert.equal(doc.querySelector("#picker-md").getAttribute("data-md-block-hidden"), "true");
  assert.equal(doc.querySelector("#picker-json").getAttribute("data-md-block-hidden"), null);
  assert.equal(doc.querySelector("#picker-doc").getAttribute("data-md-block-hidden"), null);
  assert.equal(doc.querySelector("#folder-item").getAttribute("data-md-block-hidden"), null);
  assert.equal(doc.querySelector("#header-row").getAttribute("data-md-block-hidden"), null);

  // Pass 2: enable .json as well -> hides both .md and .json
  var stats2 = Core.applyFilterPass(
    doc,
    "picker",
    Core.toExtensionSet(["md", "markdown", "json"]),
    cache,
    2
  );
  assert.equal(stats2.hiddenCount, 2);
  assert.equal(
    doc.querySelector("#picker-json").getAttribute("data-md-block-hidden"),
    "true"
  );

  // English (default) and Dutch pill labels
  assert.equal(Core.formatPillLabel(stats2, true, "en"), "2 files hidden");
  assert.equal(Core.formatPillLabel(stats1, true, "en"), "1 .md hidden");
  assert.equal(Core.formatPillLabel(stats1, false, "en"), "1 .md shown · hide");

  assert.equal(Core.formatPillLabel(stats2, true, "nl"), "2 bestanden verborgen");
  assert.equal(Core.formatPillLabel(stats1, true, "nl"), "1 .md verborgen");
  assert.equal(Core.formatPillLabel(stats1, false, "nl"), "1 .md getoond · verberg");
});

test("manifest.json references existing files and excludes Google Docs editor routes", function () {
  var rootDir = path.join(__dirname, "..");
  var manifest = JSON.parse(
    fs.readFileSync(path.join(rootDir, "manifest.json"), "utf8")
  );

  assert.equal(manifest.manifest_version, 3);
  assert.ok(fs.existsSync(path.join(rootDir, manifest.background.service_worker)));
  assert.ok(fs.existsSync(path.join(rootDir, manifest.action.default_popup)));

  Object.values(manifest.icons).forEach(function (rel) {
    assert.ok(fs.existsSync(path.join(rootDir, rel)), "Missing icon: " + rel);
  });

  var homescreenEntry = manifest.content_scripts[0];
  assert.ok(homescreenEntry.exclude_matches.includes("https://docs.google.com/document/d/*"));
  assert.ok(
    homescreenEntry.exclude_matches.includes("https://docs.google.com/document/u/*/d/*")
  );

  // Verify every extension and build script parses cleanly without syntax errors.
  [
    "src/filter-core.js",
    "src/content.js",
    "src/background.js",
    "src/popup.js",
    "scripts/generate-icons.js",
    "scripts/pack.js"
  ].forEach(function (relPath) {
    var code = fs.readFileSync(path.join(rootDir, relPath), "utf8");
    assert.doesNotThrow(function () {
      new vm.Script(code, { filename: relPath });
    });
  });
});

test("English and Dutch locale catalogs match manifest and popup message keys", function () {
  var rootDir = path.join(__dirname, "..");
  var manifestRaw = fs.readFileSync(path.join(rootDir, "manifest.json"), "utf8");
  var manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.default_locale, "en");

  var en = JSON.parse(
    fs.readFileSync(path.join(rootDir, "_locales", "en", "messages.json"), "utf8")
  );
  var nl = JSON.parse(
    fs.readFileSync(path.join(rootDir, "_locales", "nl", "messages.json"), "utf8")
  );

  assert.deepEqual(Object.keys(en).sort(), Object.keys(nl).sort());
  Object.keys(en).forEach(function (key) {
    assert.ok(en[key] && typeof en[key].message === "string" && en[key].message.length > 0);
    assert.ok(nl[key] && typeof nl[key].message === "string" && nl[key].message.length > 0);
  });

  // Check every __MSG_key__ placeholder in manifest.json.
  var msgRe = /__MSG_([a-zA-Z0-9_]+)__/g;
  var mm;
  while ((mm = msgRe.exec(manifestRaw)) !== null) {
    assert.ok(en[mm[1]], "Missing manifest message key in en: " + mm[1]);
    assert.ok(nl[mm[1]], "Missing manifest message key in nl: " + mm[1]);
  }

  // Check every data-i18n* attribute in popup.html.
  var popupHtml = fs.readFileSync(path.join(rootDir, "src", "popup.html"), "utf8");
  var i18nAttrRe = /data-i18n(?:-[a-z-]+)?="([a-zA-Z0-9_]+)"/g;
  var im;
  while ((im = i18nAttrRe.exec(popupHtml)) !== null) {
    assert.ok(en[im[1]], "Missing popup message key in en: " + im[1]);
    assert.ok(nl[im[1]], "Missing popup message key in nl: " + im[1]);
  }
});

test("Microsoft Word files are hidden via extension, MIME, icon, chip, and picker aria-label", function () {
  var doc = h("div", { class: "root" }, [
    // 1. Word file by .docx filename
    h("div", { class: "docs-homescreen-grid-item", id: "word-ext" }, [
      h("div", { class: "docs-homescreen-grid-item-title" }, "Offerte_2026.docx")
    ]),
    // 2. Word file without .docx in title, detected via Google doclist Word icon URL
    h("div", { class: "docs-homescreen-list-item", id: "word-icon" }, [
      h("div", { class: "docs-homescreen-list-item-icon" }, [
        h("img", {
          src: "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_word_x16.png"
        })
      ]),
      h("div", { class: "docs-homescreen-list-item-title" }, [
        h("span", { class: "docs-homescreen-list-item-title-value" }, "Contract")
      ])
    ]),
    // 3. Word file without .docx in title, detected via DOCX badge chip beside title-value
    h("div", { class: "docs-homescreen-list-item", id: "word-chip" }, [
      h("div", { class: "docs-homescreen-list-item-title" }, [
        h("span", { class: "docs-homescreen-list-item-title-value" }, "Begroting"),
        h("span", { class: "file-badge" }, "DOCX")
      ])
    ]),
    // 4. Native human Google Doc whose title happens to mention "Microsoft Word" -> MUST STAY VISIBLE
    h(
      "div",
      {
        class: "docs-homescreen-list-item",
        id: "human-about-word",
        "aria-label": "Microsoft Word handleiding, Google Documenten, 11:00"
      },
      [
        h("div", { class: "docs-homescreen-list-item-icon" }, [
          h("img", {
            src: "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_document_x16.png"
          })
        ]),
        h("div", { class: "docs-homescreen-list-item-title" }, [
          h(
            "span",
            {
              class: "docs-homescreen-list-item-title-value",
              "aria-label": "Microsoft Word"
            },
            "Microsoft Word"
          )
        ])
      ]
    )
  ]);

  var defaultSet = Core.toExtensionSet(Core.DEFAULT_EXTENSIONS);
  var stats = Core.applyFilterPass(doc, "homescreen", defaultSet, new WeakMap(), 1);

  assert.equal(stats.hiddenCount, 3);
  assert.equal(stats.visibleDocCount, 1);

  assert.equal(doc.querySelector("#word-ext").getAttribute("data-md-block-hidden"), "true");
  assert.equal(doc.querySelector("#word-icon").getAttribute("data-md-block-hidden"), "true");
  assert.equal(doc.querySelector("#word-chip").getAttribute("data-md-block-hidden"), "true");
  assert.equal(
    doc.querySelector("#human-about-word").getAttribute("data-md-block-hidden"),
    null
  );

  // Word-only pill label in NL and EN
  assert.equal(Core.formatPillLabel(stats, true, "nl"), "3 Word verborgen");
  assert.equal(Core.formatPillLabel(stats, true, "en"), "3 Word hidden");
  assert.equal(Core.formatPillLabel(stats, false, "nl"), "3 Word getoond · verberg");

  // Picker aria-label detection when .docx suffix is omitted from display text
  var pickerDoc = h("div", { role: "listbox" }, [
    h(
      "div",
      {
        role: "option",
        id: "picker-word-aria",
        "aria-label": "Syllabus, Microsoft Word, Geopend om 14:20"
      },
      [h("div", {}, "Syllabus")]
    )
  ]);
  var pickerStats = Core.applyFilterPass(pickerDoc, "picker", defaultSet, null, 1);
  assert.equal(pickerStats.hiddenCount, 1);

  // Tooltip breakdown when both .md and Word are hidden
  var mixedStats = { hiddenCount: 5, hiddenByExt: { md: 3, docx: 2 } };
  assert.equal(Core.formatPillLabel(mixedStats, true, "nl"), "5 bestanden verborgen");
  assert.equal(
    Core.formatPillTooltip(mixedStats, true, "nl"),
    "3 .md, 2 Word · Klik om verborgen bestanden tijdelijk te tonen"
  );
});

test("migrateStoredSettings upgrades v1 storage to include Word once and respects v2 choices", function () {
  var v1Upgrade = Core.migrateStoredSettings({
    enabled: true,
    extensions: ["md", "markdown"],
    showPill: true
  });
  assert.equal(v1Upgrade.migrated, true);
  assert.equal(v1Upgrade.settings.settingsVersion, 2);
  assert.ok(v1Upgrade.settings.extensions.includes("docx"));
  assert.ok(v1Upgrade.settings.extensions.includes("doc"));

  // Once on v2, if user intentionally unchecks Word, keep their choice.
  var v2Choice = Core.migrateStoredSettings({
    enabled: true,
    extensions: ["md", "markdown"],
    showPill: true,
    settingsVersion: 2
  });
  assert.equal(v2Choice.migrated, false);
  assert.deepEqual(v2Choice.settings.extensions, ["md", "markdown"]);
});

test("normalizeSettings and normalizeExtension sanitize user input safely", function () {
  assert.equal(Core.normalizeExtension(".MD"), "md");
  assert.equal(Core.normalizeExtension("  ..json_l  "), "json_l");
  assert.equal(Core.normalizeExtension("*.md"), "");
  assert.equal(Core.normalizeExtension(""), "");

  var emptyAllowed = Core.normalizeSettings({ enabled: false, extensions: [], showPill: false });
  assert.equal(emptyAllowed.enabled, false);
  assert.deepEqual(emptyAllowed.extensions, []);
  assert.equal(emptyAllowed.showPill, false);
});

