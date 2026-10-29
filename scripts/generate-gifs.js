"use strict";

// Draws the five CGA animations in docs/images/ (600 x 400, 12 s loops) and the
// og-image.png for shared links. Which rows disappear and what the counter button
// says come from src/filter-core.js; the file names and times are invented.
// Run: node scripts/generate-gifs.js

var fs = require("fs");
var path = require("path");
var assert = require("assert");
var P = require("./cga-pixels.js");

var C = P.C;
var Core = P.Core;
var OUT_DIR = path.resolve(__dirname, "..", "docs", "images");

// Recent Documents, newest first. Native Google Docs have no extension.
var FILES = [
  ["agents.md", "12:41"],
  ["readme.md", "12:38"],
  ["Lesson plan week 3", "12:30"],
  ["changelog.md", "12:22"],
  ["Exhibition text", "11:40"],
  ["contract-old.docx", "11:12"],
  ["todo.md", "10:58"],
  ["Reading list", "10:31"],
  ["status.md", "09:47"],
  ["Letter to the school", "OCT 28"],
  ["invoice-template.doc", "OCT 28"],
  ["Plotter log", "OCT 27"],
  ["Workshop handout", "OCT 25"],
  ["Budget 2027", "OCT 24"]
];

var rows = P.makeRows(FILES);
assert.strictEqual(rows.filter(function (r) { return r.ext; }).length, 7, "seven rows match the default extensions");
assert.strictEqual(P.pillLabel([]), "0 files hidden");
assert.strictEqual(P.pillLabel(rows.filter(function (r) { return r.ext; })), "7 files hidden");
assert.strictEqual(P.pillLabel(rows.filter(function (r) { return r.ext; }), false), "7 files shown · hide");

// One row after the other, from 1 s to 10 s: the sweep of the first animation.
function sweep(rowCount, t) {
  var scan = P.clamp01((t - 1) / 9) * rowCount;
  return function (row, i) {
    return row.ext ? (scan - i - 0.5) / 0.5 : 0;
  };
}

function cycle(seconds) {
  return seconds % P.DURATION;
}

// ---- 01: the home screen ----

function homeScreen(seconds) {
  var t = cycle(seconds);
  P.clear(C.WHITE);
  P.topBar();
  P.newDocument(40, 23);
  P.listHeader(40, 68, 292);
  var list = P.docsList({
    rows: rows, state: sweep(rows.length, t),
    x: 42, nameX: 54, ownerX: 170, timeX: 200, dotsX: 287, right: 292, top: 78, bottom: 78 + 11 * 7
  });
  if (list.headY !== null) {
    P.box(34, list.headY + 2, 3, 3, C.BLUE);
  }
  P.counterPill(4, 158, P.pillLabel(list.hidden), list.hidden.length ? "active" : "quiet");
  P.caption("MARKDOWN AND WORD FILES HIDDEN, NOT MOVED", "DRIVE KEEPS THEM. DOCS SHOWS YOUR DOCUMENTS.");
}

// ---- 02: File > Open, inside a document ----

var pickerRows = P.makeRows(FILES.slice(0, 10));

function fileOpen(seconds) {
  var t = cycle(seconds);
  P.clear(C.WHITE);
  // The open document behind the dialog.
  P.topBar("LETTER TO THE SCHOOL");
  P.text("FILE", 31, 11, C.BLACK);
  P.text("EDIT  VIEW  INSERT  FORMAT  TOOLS", 51, 11, C.MUTED);
  P.pill(248, 3, 40, 10, C.BLUE, C.BLUE);
  P.text("SHARE", 258, 6, C.WHITE);
  P.dottedLine(0, 299, 18, C.LINE);
  P.outline(40, 24, 219, 145, C.LINE);
  for (var y = 40; y < 166; y += 6) {
    P.dottedLine(56, y % 18 === 4 ? 160 : 240, y, C.MUTED);
  }
  // The dialog, with its shadow.
  P.outline(55, 31, 190, 132, C.LINE);
  P.outline(54, 30, 190, 132, C.MUTED);
  P.box(55, 31, 189, 131, C.WHITE);
  P.text("OPEN A FILE", 62, 36, C.BLACK);
  P.text("RECENT", 62, 46, C.BLACK);
  P.hline(62, 84, 53, C.BLUE);
  P.hline(62, 84, 54, C.BLUE);
  P.text("MY DRIVE", 94, 46, C.MUTED);
  P.text("SHARED WITH ME", 130, 46, C.MUTED);
  P.dottedLine(55, 243, 56, C.LINE);
  var list = P.docsList({
    rows: pickerRows, state: sweep(pickerRows.length, t),
    x: 64, nameX: 76, timeX: 208, right: 236, top: 60, bottom: 60 + 11 * 7
  });
  if (list.headY !== null) {
    P.box(58, list.headY + 2, 3, 3, C.BLUE);
  }
  P.dottedLine(55, 243, 141, C.LINE);
  P.pill(206, 147, 28, 10, C.BLUE, C.BLUE);
  P.text("OPEN", 213, 150, C.WHITE);
  P.text("CANCEL", 172, 150, C.MUTED);
  // In the picker the button stays out of sight until something is hidden.
  if (list.hidden.length) {
    P.counterPill(60, 147, P.pillLabel(list.hidden), "active");
  }
  P.caption("FILE > OPEN: THE FILTER RUNS INSIDE THE DIALOG ONLY", "THE DOCUMENT BEHIND IT IS NEVER TOUCHED.");
}

// ---- 03: the counter button ----

// Clicks at 3 s (pause) and 8 s (resume); rows take 1.5 s to come back or go.
var CLICK_PAUSE = 3;
var CLICK_RESUME = 8;

function counterButton(seconds) {
  var t = cycle(seconds);
  var enabled = t < CLICK_PAUSE || t >= CLICK_RESUME;
  var hiddenRows = rows.filter(function (r) { return r.ext; });
  var n = hiddenRows.length;
  P.clear(C.WHITE);
  P.topBar();
  P.listHeader(40, 24, 292);
  var list = P.docsList({
    rows: rows,
    state: function (row, i) {
      if (!row.ext) {
        return 0;
      }
      var k = hiddenRows.indexOf(row);
      if (t < CLICK_PAUSE) {
        return 1;
      }
      if (t < CLICK_RESUME) {
        return 1 - (t - CLICK_PAUSE - k * 1.5 / n) / 0.3; // one by one, back on screen
      }
      return (t - CLICK_RESUME - k * 1.5 / n) / 0.3;
    },
    x: 42, nameX: 54, ownerX: 170, timeX: 200, dotsX: 287, right: 292, top: 34, bottom: 34 + 11 * 11
  });
  // The button reads the pause, not the rows in motion: the label flips on the click.
  var label = P.pillLabel(hiddenRows, enabled);
  var flash = (t >= CLICK_PAUSE && t < CLICK_PAUSE + 0.2) || (t >= CLICK_RESUME && t < CLICK_RESUME + 0.2);
  var w = P.counterPill(4, 158, label, flash ? "flash" : enabled ? "active" : "paused");
  // The pointer arrives at the button for the first click and stays.
  var px = P.lerp(250, 4 + w - 5, (t - 1.2) / 1.6);
  var py = P.lerp(120, 161, (t - 1.2) / 1.6);
  P.pointer(px, py);
  P.caption("ONE CLICK PAUSES THE FILTER IN EVERY DOCS TAB", "ONE MORE CLICK HIDES THE FILES AGAIN.");
}

// ---- 04: settings ----

var SETTINGS_FILES = [
  ["agents.md", "12:41"],
  ["Lesson plan week 3", "12:30"],
  ["notes.txt", "12:12"],
  ["Exhibition text", "11:40"],
  ["contract-old.docx", "11:12"],
  ["thesis.tex", "10:50"],
  ["Reading list", "10:31"],
  ["status.md", "09:47"],
  ["Letter to the school", "OCT 28"],
  ["Plotter log", "OCT 27"],
  ["Workshop handout", "OCT 25"],
  ["Budget 2027", "OCT 24"]
];
var EXT_DEFAULT = Core.DEFAULT_SETTINGS.extensions;
var EXT_TXT = EXT_DEFAULT.concat(["txt"]);
var EXT_TEX = EXT_TXT.concat([Core.normalizeExtension("tex")]);
var settingsRows = P.makeRows(SETTINGS_FILES, EXT_TEX);
var txtOnly = P.makeRows(SETTINGS_FILES, EXT_TXT);
assert.strictEqual(P.makeRows(SETTINGS_FILES, EXT_DEFAULT).filter(function (r) { return r.ext; }).length, 3);
assert.strictEqual(txtOnly.filter(function (r) { return r.ext; }).length, 4, "ticking .txt hides one more");
assert.strictEqual(settingsRows.filter(function (r) { return r.ext; }).length, 5, "adding tex hides one more");
assert.strictEqual(Core.normalizeExtension("TeX"), "tex");

var PRESETS = Core.OPTIONAL_PRESETS.map(function (p) { return p.label; });
assert.deepStrictEqual(PRESETS.slice(0, 3), [".md / .markdown", ".docx / .doc", ".txt"]);

var TICK_TXT = 2.6;
var TYPE_START = 4.6;
var CLICK_ADD = 7.4;

function settings(seconds) {
  var t = cycle(seconds);
  P.clear(C.WHITE);
  P.topBar();
  P.text("RECENT DOCUMENTS", 12, 24, C.BLACK);
  var list = P.docsList({
    rows: settingsRows,
    state: function (row) {
      if (!row.ext) {
        return 0;
      }
      if (row.ext === "txt") {
        return (t - TICK_TXT - 0.2) / 0.5;
      }
      if (row.ext === "tex") {
        return (t - CLICK_ADD - 0.2) / 0.5;
      }
      return 1;
    },
    x: 12, nameX: 24, timeX: 134, right: 166, top: 34, bottom: 34 + 11 * 11
  });
  P.counterPill(4, 158, P.pillLabel(list.hidden), "active");

  // The popup, with its shadow.
  var X = 178;
  P.outline(X + 1, 23, 116, 136, C.LINE);
  P.outline(X, 22, 116, 136, C.MUTED);
  P.box(X + 1, 23, 115, 135, C.WHITE);
  P.text("MD BLOCK", X + 6, 27, C.BLACK);
  P.pill(X + 86, 27, 20, 7, C.BLUE, C.BLUE);
  P.disc(X + 102, 30, 2, C.WHITE);
  P.text(Core.getMessage("popupStatusOnTab", [P.pillLabel(list.hidden)], "en"), X + 6, 35, C.MUTED);
  P.dottedLine(X + 2, X + 114, 42, C.LINE);
  P.text(Core.getMessage("popupExtensionsHeading", [], "en"), X + 6, 46, C.BLACK);
  var checked = [true, true, t >= TICK_TXT, false, false, false, false];
  for (var i = 0; i < PRESETS.length; i += 1) {
    var y = 55 + i * 9;
    if (checked[i]) {
      P.box(X + 6, y, 6, 6, C.BLUE);
      P.dot(X + 8, y + 3, C.WHITE);
      P.dot(X + 9, y + 2, C.WHITE);
      P.dot(X + 10, y + 1, C.WHITE);
      P.dot(X + 7, y + 2, C.WHITE);
    } else {
      P.outline(X + 6, y, 5, 5, C.MUTED);
    }
    P.text(PRESETS[i], X + 16, y, C.BLACK);
  }
  // The field for an extension of your own, and what gets typed into it.
  P.outline(X + 6, 120, 78, 10, t >= TYPE_START && t < CLICK_ADD ? C.BLUE : C.LINE);
  var typed = "tex".slice(0, Math.max(0, Math.min(3, Math.floor((t - TYPE_START) / 0.5) + 1)));
  if (t < TYPE_START) {
    P.text("TEX OR CSV", X + 10, 123, C.LINE);
  } else {
    P.text(typed, X + 10, 123, t >= CLICK_ADD ? C.LINE : C.BLACK);
  }
  var addFlash = t >= CLICK_ADD && t < CLICK_ADD + 0.2;
  P.pill(X + 88, 120, 20, 10, C.BLUE, addFlash ? C.WHITE : C.BLUE);
  P.text(Core.getMessage("customAddButton", [], "en"), X + 93, 123, addFlash ? C.BLUE : C.WHITE);
  if (t >= CLICK_ADD + 0.2) {
    P.pill(X + 6, 134, 26, 8, C.LINE, C.WHITE);
    P.text(".TEX", X + 9, 136, C.BLACK);
    // the small x that removes the chip
    P.dot(X + 25, 136, C.MUTED);
    P.dot(X + 27, 136, C.MUTED);
    P.dot(X + 26, 137, C.MUTED);
    P.dot(X + 25, 138, C.MUTED);
    P.dot(X + 27, 138, C.MUTED);
  }
  P.dottedLine(X + 2, X + 114, 146, C.LINE);
  P.box(X + 6, 150, 6, 6, C.BLUE);
  P.dot(X + 8, 153, C.WHITE);
  P.dot(X + 9, 152, C.WHITE);
  P.dot(X + 10, 151, C.WHITE);
  P.dot(X + 7, 152, C.WHITE);
  P.text("SHOW COUNTER BUTTON", X + 16, 150, C.BLACK);

  // The pointer: to the .txt box, to the field, to Add.
  var px, py;
  if (t < TICK_TXT) {
    px = P.lerp(150, X + 9, (t - 1) / 1.4);
    py = P.lerp(120, 76, (t - 1) / 1.4);
  } else if (t < TYPE_START) {
    px = P.lerp(X + 9, X + 40, (t - TICK_TXT - 0.6) / 1.2);
    py = P.lerp(76, 126, (t - TICK_TXT - 0.6) / 1.2);
  } else if (t < CLICK_ADD) {
    px = P.lerp(X + 40, X + 98, (t - TYPE_START - 1.6) / 1.0);
    py = P.lerp(126, 126, 1);
  } else {
    px = X + 98;
    py = 126;
  }
  P.pointer(px, py);
  P.caption("TICK A FILE TYPE, OR ADD YOUR OWN, SUCH AS TEX", "THE LIST FOLLOWS AT ONCE. SETTINGS STAY ON THIS COMPUTER.");
}

// ---- 05: where it does not run ----

var MINI_FILES = [["agents.md", ""], ["Lesson plan", ""], ["readme.md", ""], ["Exhibition text", ""], ["todo.md", ""]];
var miniRows = P.makeRows(MINI_FILES);
assert.strictEqual(P.pillLabel(miniRows.filter(function (r) { return r.ext; })), "3 .md hidden");

function staticRows(x, y, list, right) {
  P.docsList({
    rows: list, state: function () { return 0; },
    x: x, nameX: x + 10, right: right, top: y, bottom: y + 10 * list.length, rowH: 10
  });
}

function notHere(seconds) {
  var t = cycle(seconds);
  P.clear(C.WHITE);

  // Drive: folders and every file, as always.
  P.appWindow(4, 4, 92, 74, "DRIVE", "folder", C.YELLOW);
  P.folderIcon(10, 18, C.MUTED);
  P.text("PROJECTS", 22, 19, C.BLACK);
  P.dottedLine(8, 92, 27, C.LINE);
  staticRows(10, 28, P.makeRows([["agents.md", ""], ["Letter", ""], ["readme.md", ""], ["todo.md", ""]]), 92);

  // Sheets: spreadsheets, untouched.
  P.appWindow(104, 4, 92, 74, "SHEETS", "grid", C.GREEN);
  staticRows(110, 18, P.makeRows([["Budget 2027", ""], ["Plotter log", ""], ["Scores", ""]]), 192);
  for (var gy = 52; gy < 76; gy += 6) {
    P.dottedLine(110, 190, gy, C.LINE);
  }
  for (var gx = 110; gx < 192; gx += 20) {
    for (var gy2 = 52; gy2 < 76; gy2 += 2) {
      P.dot(gx, gy2, C.LINE);
    }
  }

  // Gmail: a message with a Markdown file attached.
  P.appWindow(204, 4, 92, 74, "NEW MESSAGE", "mail", C.DARKRED);
  P.text("TO", 210, 18, C.MUTED);
  P.dottedLine(224, 292, 23, C.LINE);
  P.text("SUBJECT", 210, 27, C.MUTED);
  P.dottedLine(242, 292, 32, C.LINE);
  for (var ly = 40; ly < 54; ly += 5) {
    P.dottedLine(210, ly === 50 ? 250 : 290, ly, C.MUTED);
  }
  P.pill(210, 58, 44, 9, C.LINE, C.WHITE);
  P.fileIcon(214, 60, C.MUTED);
  P.text("NOTES.MD", 222, 61, C.BLACK);
  P.pill(262, 58, 28, 9, C.DARKRED, C.DARKRED);
  P.text("SEND", 268, 61, C.WHITE);

  // An open document: the editor is never touched.
  P.appWindow(4, 86, 142, 80, "LETTER TO THE SCHOOL", "doc", C.BLUE);
  P.text("FILE", 10, 100, C.BLACK);
  P.text("EDIT  VIEW  INSERT", 28, 100, C.MUTED);
  P.outline(20, 108, 110, 52, C.LINE);
  for (var dy = 116; dy < 156; dy += 6) {
    P.dottedLine(30, dy % 18 === 8 ? 90 : 120, dy, C.MUTED);
  }

  // The Docs home screen: the one place that filters.
  P.appWindow(154, 86, 142, 80, "DOCS", "doc", C.BLUE);
  P.text("RECENT", 160, 100, C.BLACK);
  var list = P.docsList({
    rows: miniRows, state: sweep(miniRows.length, t),
    x: 160, nameX: 170, right: 292, top: 108, bottom: 108 + 10 * 5, rowH: 10
  });
  P.counterPill(158, 154, P.pillLabel(list.hidden), list.hidden.length ? "active" : "quiet");

  P.caption("DRIVE, SHEETS, GMAIL AND OPEN DOCUMENTS KEEP EVERY FILE", "ONLY THE DOCS HOME SCREEN AND FILE > OPEN ARE FILTERED.");
}

// ---- export ----

var SCENES = [
  ["overview", homeScreen],
  ["02-file-open", fileOpen],
  ["03-counter-button", counterButton],
  ["04-settings", settings],
  ["05-not-here", notHere]
];

SCENES.forEach(function (scene) {
  console.log(P.exportScene(OUT_DIR, scene[0], scene[1]));
});
homeScreen(P.DURATION - 1);
fs.writeFileSync(path.join(OUT_DIR, "og-image.png"), P.encodePng(4));
console.log("og-image.png: 1200 x 800, the resting frame of overview; " + P.PALETTE_HEX.length + " CGA colours in all");
