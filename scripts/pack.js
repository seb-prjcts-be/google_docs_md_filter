"use strict";

var fs = require("fs");
var path = require("path");
var zlib = require("zlib");

var ROOT_DIR = path.resolve(__dirname, "..");
var DIST_DIR = path.join(ROOT_DIR, "dist");

var INCLUDE_PATHS = ["manifest.json", "_locales", "icons", "src"];

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

function toDosDateTime(date) {
  var year = Math.max(1980, date.getFullYear());
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var seconds = Math.floor(date.getSeconds() / 2);

  var dosDate = ((year - 1980) << 9) | (month << 5) | day;
  var dosTime = (hours << 11) | (minutes << 5) | seconds;
  return { dosDate: dosDate, dosTime: dosTime };
}

function collectFiles(relPath, out) {
  var fullPath = path.join(ROOT_DIR, relPath);
  var stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    var entries = fs.readdirSync(fullPath).sort();
    for (var i = 0; i < entries.length; i += 1) {
      var name = entries[i];
      if (name.charAt(0) === ".") {
        continue;
      }
      collectFiles(path.join(relPath, name), out);
    }
    return;
  }

  // Chrome Web Store requires forward slashes in ZIP entry names.
  var zipName = relPath.split(path.sep).join("/");
  out.push({
    zipName: zipName,
    fullPath: fullPath,
    mtime: stat.mtime
  });
}

function buildZip(files) {
  var localParts = [];
  var centralParts = [];
  var offset = 0;

  for (var i = 0; i < files.length; i += 1) {
    var entry = files[i];
    var rawData = fs.readFileSync(entry.fullPath);
    var rawCrc = crc32(rawData);
    var deflated = zlib.deflateRawSync(rawData, { level: 9 });

    var useDeflate = deflated.length < rawData.length;
    var method = useDeflate ? 8 : 0;
    var payload = useDeflate ? deflated : rawData;

    var nameBuf = Buffer.from(entry.zipName, "utf8");
    var dt = toDosDateTime(entry.mtime);

    var localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed: 2.0
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dt.dosTime, 10);
    localHeader.writeUInt16LE(dt.dosDate, 12);
    localHeader.writeUInt32LE(rawCrc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, payload);

    var centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 filename flag
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dt.dosTime, 12);
    centralHeader.writeUInt16LE(dt.dosDate, 14);
    centralHeader.writeUInt32LE(rawCrc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + payload.length;
  }

  var centralBuf = Buffer.concat(centralParts);
  var eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat(localParts.concat([centralBuf, eocd]));
}

var manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, "manifest.json"), "utf8")
);

var files = [];
for (var i = 0; i < INCLUDE_PATHS.length; i += 1) {
  collectFiles(INCLUDE_PATHS[i], files);
}

fs.mkdirSync(DIST_DIR, { recursive: true });
var outName = "md-block-v" + manifest.version + ".zip";
var outPath = path.join(DIST_DIR, outName);
var zipBuffer = buildZip(files);
fs.writeFileSync(outPath, zipBuffer);

console.log(
  "Packed " +
    files.length +
    " files into dist/" +
    outName +
    " (" +
    zipBuffer.length +
    " bytes)"
);
for (var j = 0; j < files.length; j += 1) {
  console.log("  " + files[j].zipName);
}
