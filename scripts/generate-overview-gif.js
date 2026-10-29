"use strict";

// Draws docs/images/overview.gif (600 x 400, 12 s loop) and docs/images/og-image.png
// (its last frame at 1200 x 800): the Google Docs home screen in CGA colours.
// Which rows disappear and what the counter button says come from
// src/filter-core.js itself; the file names and times are invented.

var fs = require("fs");
var path = require("path");
var zlib = require("zlib");
var assert = require("assert");
var Core = require("../src/filter-core.js");

var ROOT_DIR = path.resolve(__dirname, "..");
var OUT_DIR = path.join(ROOT_DIR, "docs", "images");

var W = 300;
var H = 200;
var SCALE = 2;
var FRAMES = 240;
var DELAY_CS = 5; // 50 ms per frame, 240 frames = 12 s

// ---- colours: every Google colour goes to the nearest of the sixteen CGA colours ----

var CGA = [
  "000000", "0000aa", "00aa00", "00aaaa", "aa0000", "aa00aa", "aa5500", "aaaaaa",
  "555555", "5555ff", "55ff55", "55ffff", "ff5555", "ff55ff", "ffff55", "ffffff"
];

function rgb(hex) {
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

// CIELAB (D65): distance as the eye sees it. Plain RGB distance turns Google green
// into dark grey; in Lab it stays green.
function lab(hex) {
  var c = rgb(hex).map(function (v) {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  var x = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047;
  var y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  var z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
  function f(t) {
    return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  }
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function nearestCga(hex) {
  var c = lab(hex);
  var best = null;
  var bestDistance = Infinity;
  for (var i = 0; i < CGA.length; i += 1) {
    var p = lab(CGA[i]);
    var d = Math.pow(c[0] - p[0], 2) + Math.pow(c[1] - p[1], 2) + Math.pow(c[2] - p[2], 2);
    if (d < bestDistance) {
      bestDistance = d;
      best = CGA[i];
    }
  }
  return best;
}

// Source colour on the Docs screen, and the CGA colour it becomes.
var GOOGLE = [
  ["page", "ffffff", "ffffff"],
  ["text", "1f1f1f", "000000"],
  ["muted text and icons", "5f6368", "555555"],
  ["card outline", "c4c7c5", "aaaaaa"],
  ["Docs blue", "4285f4", "5555ff"],
  ["plus, red arm", "ea4335", "ff5555"],
  ["plus, yellow arm", "fbbc04", "ffff55"],
  ["plus, green arm", "34a853", "00aa00"]
];
for (var g = 0; g < GOOGLE.length; g += 1) {
  assert.strictEqual(nearestCga(GOOGLE[g][1]), GOOGLE[g][2], GOOGLE[g][0]);
}
// These land on a colour already in the list.
assert.strictEqual(nearestCga("1a73e8"), "5555ff", "counter dot, src/content.js");
assert.strictEqual(nearestCga("185abd"), "5555ff", "Word icon: in CGA as blue as a Doc, as it nearly is in Docs");

// Lighter greys than CGA has (row dividers dadce0, search bar e9eef6) round to white.
// They are drawn the CGA way instead: light grey dotted into the white.

var PALETTE_HEX = GOOGLE.map(function (row) { return row[2]; });
var PALETTE = PALETTE_HEX.map(rgb);
var WHITE = 0;
var BLACK = 1;
var MUTED = 2;
var LINE = 3;
var BLUE = 4;
var RED = 5;
var YELLOW = 6;
var GREEN = 7;

var GLYPHS = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "101111111111101", O: "010101101101010", P: "110101110100100",
  Q: "010101101111011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111",
  0: "111101101101111", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110",
  4: "101101111001001", 5: "111100110001110", 6: "011100111101111", 7: "111001010010010",
  8: "111101111101111", 9: "111101111001110",
  ".": "000000000000010", ":": "000010000010000", "/": "001001010100100", "-": "000000111000000",
  ",": "000000000010100"
};

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

var extensionSet = Core.toExtensionSet(Core.DEFAULT_SETTINGS.extensions);
var rows = FILES.map(function (file) {
  return { name: file[0], time: file[1], ext: Core.matchFilteredExtension(file[0], extensionSet) };
});

var matched = rows.filter(function (row) { return row.ext; });
assert.strictEqual(matched.length, 7, "seven rows match the default extensions");
assert.strictEqual(rows.length - matched.length, 7, "seven native documents stay");

function pillLabel(hiddenRows) {
  var byExt = {};
  for (var i = 0; i < hiddenRows.length; i += 1) {
    byExt[hiddenRows[i].ext] = (byExt[hiddenRows[i].ext] || 0) + 1;
  }
  return Core.formatPillLabel({ hiddenCount: hiddenRows.length, hiddenByExt: byExt }, true, "en");
}
assert.strictEqual(pillLabel([]), "0 files hidden");
assert.strictEqual(pillLabel(matched), "7 files hidden");

// ---- drawing on a 300 x 200 index buffer ----

var pixels = new Uint8Array(W * H);
var clip = null;

function box(x, y, w, h, color) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  var x0 = Math.max(0, x);
  var y0 = Math.max(0, y);
  var x1 = Math.min(W, x + w);
  var y1 = Math.min(H, y + h);
  if (clip) {
    x0 = Math.max(x0, clip[0]); y0 = Math.max(y0, clip[1]);
    x1 = Math.min(x1, clip[2]); y1 = Math.min(y1, clip[3]);
  }
  for (var j = y0; j < y1; j += 1) {
    for (var i = x0; i < x1; i += 1) {
      pixels[j * W + i] = color;
    }
  }
}

function dot(x, y, color) {
  box(x, y, 1, 1, color);
}

function text(s, x, y, color, size) {
  size = size || 1;
  s = s.toUpperCase();
  for (var i = 0; i < s.length; i += 1) {
    var bits = GLYPHS[s[i]];
    if (!bits) {
      continue;
    }
    for (var j = 0; j < 15; j += 1) {
      if (bits[j] === "1") {
        box(x + (i * 4 + (j % 3)) * size, y + Math.floor(j / 3) * size, size, size, color);
      }
    }
  }
}

function hline(x0, x1, y, color) {
  box(x0, y, x1 - x0 + 1, 1, color);
}

function dottedLine(x0, x1, y, color) {
  for (var x = x0; x <= x1; x += 2) {
    dot(x, y, color);
  }
}

function outline(x, y, w, h, color) {
  hline(x, x + w, y, color);
  hline(x, x + w, y + h, color);
  box(x, y, 1, h + 1, color);
  box(x + w, y, 1, h + 1, color);
}

// A rounded outline: the four corner pixels are left out.
function pill(x, y, w, h, color, fill) {
  box(x + 1, y + 1, w - 1, h - 1, fill);
  hline(x + 1, x + w - 1, y, color);
  hline(x + 1, x + w - 1, y + h, color);
  box(x, y + 1, 1, h - 1, color);
  box(x + w, y + 1, 1, h - 1, color);
}

function disc(cx, cy, r, color) {
  for (var j = -r; j <= r; j += 1) {
    for (var i = -r; i <= r; i += 1) {
      if (i * i + j * j <= r * r + r) {
        dot(cx + i, cy + j, color);
      }
    }
  }
}

// The Docs file icon: a page with a folded corner and two text lines.
function docIcon(x, y, color) {
  box(x, y, 6, 8, color);
  box(x + 4, y, 2, 2, WHITE);
  dot(x + 4, y + 1, color);
  hline(x + 1, x + 4, y + 4, WHITE);
  hline(x + 1, x + 3, y + 6, WHITE);
}

// Any other file: the same page, drawn as an outline.
function fileIcon(x, y, color) {
  hline(x, x + 3, y, color);
  dot(x + 4, y + 1, color);
  box(x + 5, y + 2, 1, 6, color);
  box(x, y, 1, 8, color);
  hline(x, x + 5, y + 7, color);
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

var ROW_H = 11;
var LIST_TOP = 78;
var LIST_BOTTOM = LIST_TOP + ROW_H * 7;

function topBar() {
  // menu
  hline(8, 14, 6, MUTED);
  hline(8, 14, 9, MUTED);
  hline(8, 14, 12, MUTED);
  // Docs icon and name
  docIcon(20, 5, BLUE);
  text("DOCS", 31, 4, BLACK, 2);
  // search bar: one light grey pixel in four reads as Google's pale blue-grey
  pill(76, 2, 160, 13, WHITE, WHITE);
  for (var j = 3; j < 15; j += 2) {
    for (var i = 78 + (j % 4 === 1 ? 0 : 2); i < 235; i += 4) {
      dot(i, j, LINE);
    }
  }
  disc(86, 7, 2, MUTED);
  disc(86, 7, 1, WHITE);
  dot(89, 10, MUTED);
  dot(90, 11, MUTED);
  text("SEARCH", 96, 6, MUTED);
  // apps and account
  for (var a = 0; a < 3; a += 1) {
    for (var b = 0; b < 3; b += 1) {
      dot(262 + a * 2, 5 + b * 2, MUTED);
    }
  }
  disc(283, 8, 6, BLUE);
  disc(283, 8, 4, MUTED);
}

function newDocument() {
  text("START A NEW DOCUMENT", 40, 23, BLACK);
  outline(40, 31, 22, 29, LINE);
  box(41, 32, 21, 28, WHITE);
  box(50, 39, 2, 7, RED);
  box(43, 46, 7, 2, YELLOW);
  box(50, 46, 8, 2, BLUE);
  box(50, 48, 2, 6, GREEN);
}

function listHeader() {
  text("RECENT DOCUMENTS", 40, 68, BLACK);
  text("OWNED BY ANYONE", 150, 68, MUTED);
  hline(212, 216, 70, MUTED);
  hline(213, 215, 71, MUTED);
  dot(214, 72, MUTED);
  // grid view, sort, folder
  outline(236, 67, 8, 6, MUTED);
  box(239, 67, 1, 6, MUTED);
  box(242, 67, 1, 6, MUTED);
  hline(236, 244, 70, MUTED);
  text("AZ", 251, 68, MUTED);
  outline(265, 68, 8, 5, MUTED);
  hline(265, 268, 67, MUTED);
}

function render(seconds) {
  var cycle = seconds % 12;
  var progress = clamp01((cycle - 1) / 9);
  var scan = progress * rows.length;

  box(0, 0, W, H, WHITE);
  topBar();
  newDocument();
  listHeader();

  var hidden = [];
  var y = LIST_TOP;
  var headY = null;
  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var marked = row.ext && scan >= i + 0.5;
    var collapse = row.ext ? clamp01((scan - i - 0.5) / 0.5) : 0;
    var h = ROW_H * (1 - collapse);
    if (marked) {
      hidden.push(row);
    }
    if (i === Math.floor(scan) && progress < 1) {
      headY = y + (scan - i) * h;
    }
    // A row appears only once it fits whole, the way Docs loads the next batch.
    if (h > 0 && y + ROW_H <= LIST_BOTTOM) {
      clip = [30, Math.max(LIST_TOP, Math.floor(y)), 296, Math.min(LIST_BOTTOM, Math.floor(y + h))];
      if (!row.ext || Core.isWordExtension(row.ext)) {
        docIcon(42, y + 1, BLUE);
      } else {
        fileIcon(42, y + 1, MUTED);
      }
      text(row.name, 54, y + 3, marked ? LINE : BLACK);
      text("ME", 170, y + 3, MUTED);
      text(row.time, 200, y + 3, MUTED);
      dot(287, y + 2, MUTED);
      dot(287, y + 4, MUTED);
      dot(287, y + 6, MUTED);
      if (marked) {
        hline(53, 54 + row.name.length * 4, y + 5, BLUE);
      }
      dottedLine(38, 292, y + ROW_H - 1, LINE);
      clip = null;
    }
    y += h;
  }

  if (headY !== null && headY < LIST_BOTTOM) {
    box(34, headY + 2, 3, 3, BLUE);
  }

  // The counter button sits bottom left, over the list, as it does in Docs.
  // Label from filter-core.js; its dot is blue while something is hidden.
  var label = pillLabel(hidden);
  var pillW = label.length * 4 + 16;
  pill(4, 158, pillW, 10, LINE, WHITE);
  disc(10, 163, 1, hidden.length ? BLUE : MUTED);
  text(label, 15, 161, MUTED);

  hline(0, W - 1, 171, LINE);
  text("MARKDOWN AND WORD FILES HIDDEN, NOT MOVED", 12, 178, BLUE);
  text("DRIVE KEEPS THEM. DOCS SHOWS YOUR DOCUMENTS.", 12, 189, BLACK);
}

// ---- GIF89a encoder: one global colour table, delta frames, LZW ----

var TABLE_BITS = Math.max(2, Math.ceil(Math.log2(PALETTE.length)));

function lzw(indices, minCodeSize) {
  var clearCode = 1 << minCodeSize;
  var eoiCode = clearCode + 1;
  var codeSize = minCodeSize + 1;
  var nextCode = eoiCode + 1;
  var table = new Map();
  var bytes = [];
  var cur = 0;
  var shift = 0;

  function emit(code) {
    cur |= code << shift;
    shift += codeSize;
    while (shift >= 8) {
      bytes.push(cur & 0xff);
      cur >>>= 8;
      shift -= 8;
    }
  }

  emit(clearCode);
  var prefix = indices[0];
  for (var i = 1; i < indices.length; i += 1) {
    var k = indices[i];
    var key = (prefix << 8) | k;
    var found = table.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (nextCode === 4096) {
      emit(clearCode);
      table.clear();
      codeSize = minCodeSize + 1;
      nextCode = eoiCode + 1;
    } else {
      if (nextCode >= 1 << codeSize) {
        codeSize += 1;
      }
      table.set(key, nextCode);
      nextCode += 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoiCode);
  if (shift > 0) {
    bytes.push(cur & 0xff);
  }
  return bytes;
}

function subBlocks(bytes) {
  var out = [];
  for (var i = 0; i < bytes.length; i += 255) {
    var chunk = bytes.slice(i, i + 255);
    out.push(chunk.length);
    for (var j = 0; j < chunk.length; j += 1) {
      out.push(chunk[j]);
    }
  }
  out.push(0);
  return out;
}

function u16(n) {
  return [n & 0xff, (n >> 8) & 0xff];
}

function changedBox(prev, next) {
  var x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (var j = 0; j < H; j += 1) {
    for (var i = 0; i < W; i += 1) {
      if (prev[j * W + i] !== next[j * W + i]) {
        if (i < x0) x0 = i;
        if (i > x1) x1 = i;
        if (j < y0) y0 = j;
        if (j > y1) y1 = j;
      }
    }
  }
  return x1 < 0 ? [0, 0, 1, 1] : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

function frameBytes(buffer, rect) {
  var x = rect[0] * SCALE, y = rect[1] * SCALE, w = rect[2] * SCALE, h = rect[3] * SCALE;
  var indices = new Uint8Array(w * h);
  for (var j = 0; j < h; j += 1) {
    var sy = Math.floor((y + j) / SCALE);
    for (var i = 0; i < w; i += 1) {
      indices[j * w + i] = buffer[sy * W + Math.floor((x + i) / SCALE)];
    }
  }
  var out = [0x21, 0xf9, 0x04, 0x04].concat(u16(DELAY_CS), [0x00, 0x00]); // disposal 1: keep
  out = out.concat([0x2c], u16(x), u16(y), u16(w), u16(h), [0x00]);
  return out.concat([TABLE_BITS], subBlocks(lzw(indices, TABLE_BITS)));
}

function encodeGif() {
  var head = Array.from(Buffer.from("GIF89a", "ascii"));
  var packed = 0x80 | ((TABLE_BITS - 1) << 4) | (TABLE_BITS - 1);
  head = head.concat(u16(W * SCALE), u16(H * SCALE), [packed, 0x00, 0x00]);
  for (var c = 0; c < 1 << TABLE_BITS; c += 1) {
    head = head.concat(PALETTE[c] || [0, 0, 0]);
  }
  head = head.concat([0x21, 0xff, 0x0b], Array.from(Buffer.from("NETSCAPE2.0", "ascii")), [0x03, 0x01, 0x00, 0x00, 0x00]);

  var parts = [Buffer.from(head)];
  var prev = null;
  for (var f = 0; f < FRAMES; f += 1) {
    render(f / 20);
    var rect = prev ? changedBox(prev, pixels) : [0, 0, W, H];
    parts.push(Buffer.from(frameBytes(pixels, rect)));
    prev = Uint8Array.from(pixels);
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}

// ---- PNG of the last frame, for og:image ----

var CRC_TABLE = (function () {
  var table = new Uint32Array(256);
  for (var n = 0; n < 256; n += 1) {
    var c = n;
    for (var k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  var crc = 0xffffffff;
  for (var i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  var len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  var body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  var crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(buffer, scale) {
  var w = W * scale, h = H * scale;
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  var raw = Buffer.alloc((w * 3 + 1) * h);
  for (var j = 0; j < h; j += 1) {
    var o = j * (w * 3 + 1);
    for (var i = 0; i < w; i += 1) {
      var c = PALETTE[buffer[Math.floor(j / scale) * W + Math.floor(i / scale)]];
      raw[o + 1 + i * 3] = c[0];
      raw[o + 2 + i * 3] = c[1];
      raw[o + 3 + i * 3] = c[2];
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
var gif = encodeGif();
fs.writeFileSync(path.join(OUT_DIR, "overview.gif"), gif);
render(11);
fs.writeFileSync(path.join(OUT_DIR, "og-image.png"), encodePng(pixels, 4));
console.log("docs/images/overview.gif: 600 x 400, " + FRAMES + " frames, " + FRAMES * DELAY_CS * 10 + " ms, " +
  PALETTE.length + " CGA colours, " + gif.length + " bytes");
console.log("docs/images/og-image.png: 1200 x 800, last frame");
