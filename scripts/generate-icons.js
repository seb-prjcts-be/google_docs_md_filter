"use strict";

var fs = require("fs");
var path = require("path");
var zlib = require("zlib");

function makeCrcTable() {
  var table = new Uint32Array(256);
  for (var n = 0; n < 256; n += 1) {
    var c = n;
    for (var k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

var CRC_TABLE = makeCrcTable();

function crc32(buf) {
  var crc = 0xffffffff;
  for (var i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  var typeBuf = Buffer.from(type, "ascii");
  var lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  var crcInput = Buffer.concat([typeBuf, data]);
  var crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  var signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  var stride = width * 4;
  var raw = Buffer.alloc((stride + 1) * height);
  for (var y = 0; y < height; y += 1) {
    var rowOffset = y * (stride + 1);
    raw[rowOffset] = 0; // filter: None
    rgba.copy(raw, rowOffset + 1, y * stride, (y + 1) * stride);
  }

  var compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function blend(dst, idx, r, g, b, alpha) {
  var a = clamp(alpha, 0, 1);
  if (a <= 0) {
    return;
  }
  var dstA = dst[idx + 3] / 255;
  var outA = a + dstA * (1 - a);
  if (outA <= 0) {
    return;
  }
  dst[idx] = Math.round((r * a + dst[idx] * dstA * (1 - a)) / outA);
  dst[idx + 1] = Math.round((g * a + dst[idx + 1] * dstA * (1 - a)) / outA);
  dst[idx + 2] = Math.round((b * a + dst[idx + 2] * dstA * (1 - a)) / outA);
  dst[idx + 3] = Math.round(outA * 255);
}

function sdRoundedRect(px, py, cx, cy, hw, hh, radius) {
  var qx = Math.abs(px - cx) - hw + radius;
  var qy = Math.abs(py - cy) - hh + radius;
  var outX = Math.max(qx, 0);
  var outY = Math.max(qy, 0);
  return Math.hypot(outX, outY) + Math.min(Math.max(qx, qy), 0) - radius;
}

function sdSegment(px, py, ax, ay, bx, by) {
  var pax = px - ax;
  var pay = py - ay;
  var bax = bx - ax;
  var bay = by - ay;
  var denom = bax * bax + bay * bay;
  var h = denom > 0 ? clamp((pax * bax + pay * bay) / denom, 0, 1) : 0;
  return Math.hypot(pax - bax * h, pay - bay * h);
}

function renderIcon(size) {
  var buf = Buffer.alloc(size * size * 4, 0);
  var aa = 1.0 / size;

  for (var y = 0; y < size; y += 1) {
    for (var x = 0; x < size; x += 1) {
      var u = (x + 0.5) / size;
      var v = (y + 0.5) / size;
      var idx = (y * size + x) * 4;

      // Document page in Google Docs blue (#2b7de9), with folded top-right corner.
      var dDoc = sdRoundedRect(u, v, 0.46, 0.50, 0.32, 0.40, 0.07);
      var foldCut = u + (1.0 - v) - 1.56;
      var dPage = Math.max(dDoc, foldCut);
      var pageAlpha = clamp(0.5 - dPage / aa, 0, 1);
      blend(buf, idx, 43, 125, 233, pageAlpha);

      // Folded corner flap (#8ab4f8).
      if (u >= 0.56 && v <= 0.32) {
        var inFold = Math.max(dDoc, -(u + (1.0 - v) - 1.56));
        var foldBox = Math.max(0.56 - u, v - 0.32);
        var dFlap = Math.max(inFold, foldBox);
        var flapAlpha = clamp(0.5 - dFlap / aa, 0, 1);
        blend(buf, idx, 138, 180, 248, flapAlpha);
      }

      // Clean white text lines on the document.
      var lineYs = [0.42, 0.54, 0.66];
      var lineHalfW = [0.19, 0.19, 0.13];
      var lineCenterX = [0.45, 0.45, 0.39];
      for (var li = 0; li < lineYs.length; li += 1) {
        var dLine = sdRoundedRect(
          u,
          v,
          lineCenterX[li],
          lineYs[li],
          lineHalfW[li],
          0.028,
          0.025
        );
        var lineAlpha = clamp(0.5 - dLine / aa, 0, 1);
        blend(buf, idx, 255, 255, 255, lineAlpha * 0.95);
      }

      // Bottom-right filter badge circle (white rim + slate-coral badge + diagonal slash).
      var bx = 0.73;
      var by = 0.74;
      var dRim = Math.hypot(u - bx, v - by) - 0.23;
      blend(buf, idx, 255, 255, 255, clamp(0.5 - dRim / aa, 0, 1));

      var dBadge = Math.hypot(u - bx, v - by) - 0.19;
      blend(buf, idx, 201, 74, 56, clamp(0.5 - dBadge / aa, 0, 1));

      // Crisp minus / block bar inside the badge.
      var dBar = sdSegment(u, v, bx - 0.085, by, bx + 0.085, by) - 0.032;
      blend(buf, idx, 255, 255, 255, clamp(0.5 - dBar / aa, 0, 1));
    }
  }

  return encodePng(size, size, buf);
}

var iconsDir = path.join(__dirname, "..", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

var sizes = [16, 32, 48, 128];
for (var i = 0; i < sizes.length; i += 1) {
  var sz = sizes[i];
  var outPath = path.join(iconsDir, "icon" + sz + ".png");
  fs.writeFileSync(outPath, renderIcon(sz));
}

console.log("Generated PNG icons:", sizes.join(", "));
