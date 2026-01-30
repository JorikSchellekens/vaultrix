#!/usr/bin/env node
/**
 * Creates tauri/icons/icon.png (valid 32x32 RGBA PNG) so Tauri can load it at runtime.
 * Run from repo root: node scripts/ensure-tauri-icon.cjs
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const iconsDir = path.join(root, "tauri", "icons");
const iconPath = path.join(iconsDir, "icon.png");

// PNG CRC32 (IEEE polynomial)
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  crcTable[n] = c >>> 0;
}
function crc32(buf, prev = 0) {
  let c = prev ^ 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function writeChunk(out, type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const chunk = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(chunk), 0);
  out.push(len, chunk, crc);
}

function createPng32x32() {
  const width = 32;
  const height = 32;
  // Raw scanlines: each row starts with filter byte 0, then 32*4 RGBA
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter: none
    for (let x = 0; x < width; x++) {
      raw.push(72, 72, 72, 255); // grey
    }
  }
  const rawBuf = Buffer.from(raw);
  const compressed = zlib.deflateSync(rawBuf, { level: 9 });

  const out = [];
  out.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  writeChunk(out, "IHDR", ihdr);
  writeChunk(out, "IDAT", compressed);
  writeChunk(out, "IEND", Buffer.alloc(0));

  return Buffer.concat(out);
}

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}
fs.writeFileSync(iconPath, createPng32x32());
console.log("Created", iconPath);
