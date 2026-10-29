"use strict";

// The shared drawing layer for the CGA animations in docs/images/: a 300 x 200
// index buffer, Google colours translated to CGA, a 3 x 5 pixel font, the parts of
// the Docs screen that return in every scene, and the GIF and PNG encoders.
// scripts/generate-gifs.js holds the scenes.

var fs = require("fs");
var path = require("path");
var zlib = require("zlib");
var assert = require("assert");
var Core = require("../src/filter-core.js");

var W = 300;
var H = 200;
var SCALE = 2;
var FRAMES = 240;
var DELAY_CS = 5; // 50 ms per frame, 240 frames = 12 s
var DURATION = FRAMES * DELAY_CS / 100;

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

// Name, source colour on screen, and the CGA colour it becomes. The palette index
// of each name is its position here.
var GOOGLE = [
  ["WHITE", "page", "ffffff", "ffffff"],
  ["BLACK", "text", "1f1f1f", "000000"],
  ["MUTED", "muted text and icons", "5f6368", "555555"],
  ["LINE", "card outline", "c4c7c5", "aaaaaa"],
  ["BLUE", "Docs blue, counter dot (src/content.js 1a73e8)", "4285f4", "5555ff"],
  ["RED", "plus, red arm", "ea4335", "ff5555"],
  ["YELLOW", "plus, yellow arm; paused button border (f2cf66)", "fbbc04", "ffff55"],
  ["GREEN", "plus, green arm; Sheets", "34a853", "00aa00"],
  ["ORANGE", "paused button dot and text (src/content.js d9822b, 5f4300)", "d9822b", "aa5500"],
  ["DARKRED", "Gmail", "d93025", "aa0000"]
];
var C = {};
var PALETTE_HEX = [];
GOOGLE.forEach(function (row, i) {
  assert.strictEqual(nearestCga(row[2]), row[3], row[1]);
  C[row[0]] = i;
  PALETTE_HEX.push(row[3]);
});
// Colours that land on one already in the table.
assert.strictEqual(nearestCga("1a73e8"), "5555ff", "counter dot");
assert.strictEqual(nearestCga("185abd"), "5555ff", "Word icon: as blue as a Doc, as it nearly is in Docs");
assert.strictEqual(nearestCga("f2cf66"), "ffff55", "paused button border");
assert.strictEqual(nearestCga("5f4300"), "aa5500", "paused button text");
assert.strictEqual(nearestCga("fef7e0"), "ffffff", "paused button background");
// Greys paler than CGA has (dividers dadce0, search bar e9eef6) round to white;
// they are drawn the CGA way instead: light grey dotted into the white.
assert.strictEqual(nearestCga("dadce0"), "ffffff");
var PALETTE = PALETTE_HEX.map(rgb);
assert.ok(PALETTE.length <= 16);

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
  ",": "000000000010100", ">": "100010001010100", "+": "000010111010000", "@": "010101111100011"
};

// ---- drawing on the index buffer ----

var pixels = new Uint8Array(W * H);
var clip = null;

function setClip(rect) {
  clip = rect;
}

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

function clear(color) {
  box(0, 0, W, H, color);
}

function text(s, x, y, color, size) {
  size = size || 1;
  s = String(s).toUpperCase();
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

function textWidth(s, size) {
  return String(s).length * 4 * (size || 1) - (size || 1);
}

function hline(x0, x1, y, color) {
  box(x0, y, x1 - x0 + 1, 1, color);
}

function vline(x, y0, y1, color) {
  box(x, y0, 1, y1 - y0 + 1, color);
}

function dottedLine(x0, x1, y, color) {
  for (var x = x0; x <= x1; x += 2) {
    dot(x, y, color);
  }
}

function outline(x, y, w, h, color) {
  hline(x, x + w, y, color);
  hline(x, x + w, y + h, color);
  vline(x, y, y + h, color);
  vline(x + w, y, y + h, color);
}

// A rounded outline: the four corner pixels are left out.
function pill(x, y, w, h, color, fill) {
  box(x + 1, y + 1, w - 1, h - 1, fill);
  hline(x + 1, x + w - 1, y, color);
  hline(x + 1, x + w - 1, y + h, color);
  vline(x, y + 1, y + h - 1, color);
  vline(x + w, y + 1, y + h - 1, color);
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
  box(x + 4, y, 2, 2, C.WHITE);
  dot(x + 4, y + 1, color);
  hline(x + 1, x + 4, y + 4, C.WHITE);
  hline(x + 1, x + 3, y + 6, C.WHITE);
}

// Any other file: the same page, drawn as an outline.
function fileIcon(x, y, color) {
  hline(x, x + 3, y, color);
  dot(x + 4, y + 1, color);
  vline(x + 5, y + 2, y + 7, color);
  vline(x, y, y + 7, color);
  hline(x, x + 5, y + 7, color);
}

function folderIcon(x, y, color) {
  hline(x, x + 2, y, color);
  box(x, y + 1, 7, 6, color);
}

// A mouse pointer with its tip at (x, y), black with a white edge.
var POINTER = [
  "1", "11", "111", "1111", "11111", "111111", "1111111", "11111111", "11111", "1 11", "   11"
];
function pointer(x, y) {
  for (var pass = 0; pass < 2; pass += 1) {
    for (var j = 0; j < POINTER.length; j += 1) {
      for (var i = 0; i < POINTER[j].length; i += 1) {
        if (POINTER[j][i] !== "1") {
          continue;
        }
        if (pass === 0) {
          for (var dy = -1; dy <= 1; dy += 1) {
            for (var dx = -1; dx <= 1; dx += 1) {
              dot(x + i + dx, y + j + dy, C.WHITE);
            }
          }
        } else {
          dot(x + i, y + j, C.BLACK);
        }
      }
    }
  }
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function lerp(a, b, t) {
  return a + (b - a) * clamp01(t);
}

// ---- the parts of the Docs screen that return in every scene ----

// Menu, Docs icon and name, search bar, apps, account.
function topBar(title) {
  hline(8, 14, 6, C.MUTED);
  hline(8, 14, 9, C.MUTED);
  hline(8, 14, 12, C.MUTED);
  docIcon(20, 5, C.BLUE);
  if (title) {
    text(title, 31, 4, C.BLACK);
    return;
  }
  text("DOCS", 31, 4, C.BLACK, 2);
  // search bar: one light grey pixel in four reads as Google's pale blue-grey
  pill(76, 2, 160, 13, C.WHITE, C.WHITE);
  for (var j = 3; j < 15; j += 2) {
    for (var i = 78 + (j % 4 === 1 ? 0 : 2); i < 235; i += 4) {
      dot(i, j, C.LINE);
    }
  }
  disc(86, 7, 2, C.MUTED);
  disc(86, 7, 1, C.WHITE);
  dot(89, 10, C.MUTED);
  dot(90, 11, C.MUTED);
  text("SEARCH", 96, 6, C.MUTED);
  for (var a = 0; a < 3; a += 1) {
    for (var b = 0; b < 3; b += 1) {
      dot(262 + a * 2, 5 + b * 2, C.MUTED);
    }
  }
  disc(283, 8, 6, C.BLUE);
  disc(283, 8, 4, C.MUTED);
}

// The card that starts a new document, with its plus in four colours.
function newDocument(x, y) {
  text("START A NEW DOCUMENT", x, y, C.BLACK);
  outline(x, y + 8, 22, 29, C.LINE);
  box(x + 1, y + 9, 21, 28, C.WHITE);
  box(x + 10, y + 16, 2, 7, C.RED);
  box(x + 3, y + 23, 7, 2, C.YELLOW);
  box(x + 10, y + 23, 8, 2, C.BLUE);
  box(x + 10, y + 25, 2, 6, C.GREEN);
}

// "Recent documents", the owner filter and the view buttons.
function listHeader(x, y, right) {
  text("RECENT DOCUMENTS", x, y, C.BLACK);
  if (right - x < 200) {
    return;
  }
  text("OWNED BY ANYONE", x + 110, y, C.MUTED);
  hline(x + 172, x + 176, y + 2, C.MUTED);
  hline(x + 173, x + 175, y + 3, C.MUTED);
  dot(x + 174, y + 4, C.MUTED);
  outline(right - 40, y - 1, 8, 6, C.MUTED);
  vline(right - 37, y - 1, y + 5, C.MUTED);
  vline(right - 34, y - 1, y + 5, C.MUTED);
  hline(right - 40, right - 32, y + 2, C.MUTED);
  text("AZ", right - 25, y, C.MUTED);
  outline(right - 11, y, 8, 5, C.MUTED);
  hline(right - 11, right - 8, y - 1, C.MUTED);
}

// Rows of files. Which ones are hidden comes from src/filter-core.js (makeRows);
// how far each one has collapsed at this moment comes from the scene.
// options: rows, state(row, i) -> 0 (shown) .. 1 (gone), x (icon), nameX, ownerX,
// timeX, dotsX, right, top, bottom, rowH.
// Returns the hidden rows and the y of the first row still collapsing (or null).
function docsList(o) {
  var rowH = o.rowH || 11;
  var hidden = [];
  var y = o.top;
  var headY = null;
  for (var i = 0; i < o.rows.length; i += 1) {
    var row = o.rows[i];
    var collapse = clamp01(o.state(row, i));
    var marked = collapse > 0;
    var h = rowH * (1 - collapse);
    if (marked) {
      hidden.push(row);
    }
    if (headY === null && collapse > 0 && collapse < 1) {
      headY = y;
    }
    // A row appears only once it fits whole, the way Docs loads the next batch.
    if (h > 0 && y + rowH <= o.bottom) {
      setClip([o.x - 8, Math.max(o.top, Math.floor(y)), o.right + 4, Math.min(o.bottom, Math.floor(y + h))]);
      if (!row.ext || Core.isWordExtension(row.ext)) {
        docIcon(o.x, y + 1, C.BLUE);
      } else {
        fileIcon(o.x, y + 1, C.MUTED);
      }
      text(row.name, o.nameX, y + 3, marked ? C.LINE : C.BLACK);
      if (o.ownerX) {
        text("ME", o.ownerX, y + 3, C.MUTED);
      }
      if (o.timeX) {
        text(row.time, o.timeX, y + 3, C.MUTED);
      }
      if (o.dotsX) {
        dot(o.dotsX, y + 2, C.MUTED);
        dot(o.dotsX, y + 4, C.MUTED);
        dot(o.dotsX, y + 6, C.MUTED);
      }
      if (marked) {
        hline(o.nameX - 1, o.nameX + textWidth(row.name) + 1, y + 5, C.BLUE);
      }
      dottedLine(o.x - 4, o.right, y + rowH - 1, C.LINE);
      setClip(null);
    }
    y += h;
  }
  return { hidden: hidden, headY: headY };
}

// The counter button, with the label src/filter-core.js formats. mode: "active"
// (something hidden), "quiet" (nothing hidden), "paused" (filter off), or "flash"
// (the moment of a click). Returns its width.
function counterPill(x, y, label, mode) {
  var w = textWidth(label) + 17;
  if (mode === "flash") {
    pill(x, y, w, 10, C.BLUE, C.BLUE);
    disc(x + 6, y + 5, 1, C.WHITE);
    text(label, x + 11, y + 3, C.WHITE);
    return w;
  }
  var paused = mode === "paused";
  pill(x, y, w, 10, paused ? C.YELLOW : C.LINE, C.WHITE);
  disc(x + 6, y + 5, 1, paused ? C.ORANGE : mode === "quiet" ? C.MUTED : C.BLUE);
  text(label, x + 11, y + 3, paused ? C.ORANGE : C.MUTED);
  return w;
}

function pillLabel(hiddenRows, enabled) {
  var byExt = {};
  for (var i = 0; i < hiddenRows.length; i += 1) {
    byExt[hiddenRows[i].ext] = (byExt[hiddenRows[i].ext] || 0) + 1;
  }
  return Core.formatPillLabel({ hiddenCount: hiddenRows.length, hiddenByExt: byExt }, enabled !== false, "en");
}

// Two lines under the screen: what you see, and why it matters.
function caption(line1, line2) {
  hline(0, W - 1, 171, C.LINE);
  text(line1, 12, 178, C.BLUE);
  text(line2, 12, 189, C.BLACK);
}

// A small window with a title bar, for scenes that show several apps at once.
function appWindow(x, y, w, h, title, icon, iconColor) {
  outline(x, y, w, h, C.LINE);
  box(x + 1, y + 1, w - 1, h - 1, C.WHITE);
  hline(x + 1, x + w - 1, y + 10, C.LINE);
  if (icon === "doc") {
    docIcon(x + 4, y + 2, iconColor);
  } else if (icon === "folder") {
    folderIcon(x + 4, y + 2, iconColor);
  } else if (icon === "grid") {
    outline(x + 4, y + 2, 6, 6, iconColor);
    hline(x + 4, x + 10, y + 5, iconColor);
    vline(x + 7, y + 2, y + 8, iconColor);
  } else if (icon === "mail") {
    outline(x + 4, y + 3, 7, 5, iconColor);
    dot(x + 6, y + 5, iconColor);
    dot(x + 7, y + 6, iconColor);
    dot(x + 8, y + 5, iconColor);
  }
  text(title, x + 15, y + 3, C.BLACK);
}

// Files for a scene: name, time, and the extension the filter matches, if any.
function makeRows(files, extensions) {
  var set = Core.toExtensionSet(extensions || Core.DEFAULT_SETTINGS.extensions);
  return files.map(function (file) {
    return { name: file[0], time: file[1], ext: Core.matchFilteredExtension(file[0], set) };
  });
}

// ---- GIF89a encoder: one global colour table, delta frames, LZW ----

var TABLE_BITS = 4;

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

function encodeGif(render) {
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

// ---- PNG of one frame ----

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

function encodePng(scale) {
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
      var c = PALETTE[pixels[Math.floor(j / scale) * W + Math.floor(i / scale)]];
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

// Writes <dir>/<name>.gif and <dir>/<name>.png (the resting frame, for people who
// ask the browser for less motion). Returns the sizes for the log line.
function exportScene(dir, name, render) {
  fs.mkdirSync(dir, { recursive: true });
  var gif = encodeGif(render);
  fs.writeFileSync(path.join(dir, name + ".gif"), gif);
  render(DURATION - 1);
  fs.writeFileSync(path.join(dir, name + ".png"), encodePng(SCALE));
  return name + ".gif: " + W * SCALE + " x " + H * SCALE + ", " + FRAMES + " frames, " + DURATION * 1000 + " ms, " + gif.length + " bytes";
}

module.exports = {
  W: W, H: H, SCALE: SCALE, DURATION: DURATION,
  C: C, PALETTE_HEX: PALETTE_HEX, nearestCga: nearestCga,
  Core: Core,
  clear: clear, box: box, dot: dot, text: text, textWidth: textWidth,
  hline: hline, vline: vline, dottedLine: dottedLine, outline: outline, pill: pill, disc: disc,
  docIcon: docIcon, fileIcon: fileIcon, folderIcon: folderIcon, pointer: pointer,
  clamp01: clamp01, lerp: lerp,
  topBar: topBar, newDocument: newDocument, listHeader: listHeader, docsList: docsList,
  counterPill: counterPill, pillLabel: pillLabel, caption: caption, appWindow: appWindow, makeRows: makeRows,
  encodePng: encodePng, exportScene: exportScene
};
