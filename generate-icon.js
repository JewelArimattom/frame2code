/**
 * generate-icon.js — Creates assets/icon.png (128×128) for the VS Code Marketplace.
 * Run with:  node generate-icon.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 128, H = 128;

// ── Colours ──────────────────────────────────────────────────────────────────
const BG     = [0x1a, 0x1a, 0x2e];  // #1a1a2e  (dark navy)
const PURPLE = [0xa2, 0x59, 0xff];  // #A259FF  (Figma purple)
const BLUE   = [0x5a, 0xb8, 0xff];  // #5AB8FF  (code blue)

// ── Raw pixel buffer (RGB, 3 bytes per pixel) ─────────────────────────────────
const pixels = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  pixels[i * 3]     = BG[0];
  pixels[i * 3 + 1] = BG[1];
  pixels[i * 3 + 2] = BG[2];
}

function setPixel(x, y, color) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  pixels[i]     = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
}

// ── Draw rounded rectangle outline (background texture) ──────────────────────
function drawRect(x0, y0, x1, y1, color, thick) {
  for (let t = 0; t < thick; t++) {
    for (let x = x0 + t; x <= x1 - t; x++) {
      setPixel(x, y0 + t, color);
      setPixel(x, y1 - t, color);
    }
    for (let y = y0 + t; y <= y1 - t; y++) {
      setPixel(x0 + t, y, color);
      setPixel(x1 - t, y, color);
    }
  }
}

// ── Draw thick line ───────────────────────────────────────────────────────────
function drawLine(x0, y0, x1, y1, color, thick) {
  // Bresenham line algorithm
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let cx = x0, cy = y0;
  while (true) {
    for (let ty = -Math.floor(thick/2); ty <= Math.floor(thick/2); ty++) {
      for (let tx = -Math.floor(thick/2); tx <= Math.floor(thick/2); tx++) {
        setPixel(cx + tx, cy + ty, color);
      }
    }
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; cx += sx; }
    if (e2 <= dx) { err += dx; cy += sy; }
  }
}

// ── Icon geometry (16 px margin, 6 px handle arm, 5 px thick) ────────────────
const M   = 16;   // outer margin
const ARM = 22;   // corner arm length
const T   = 6;    // stroke thickness

// Top-left corner handle
drawLine(M, M + ARM, M, M, PURPLE, T);
drawLine(M, M, M + ARM, M, PURPLE, T);

// Top-right corner handle
drawLine(W - M, M + ARM, W - M, M, PURPLE, T);
drawLine(W - M, M, W - M - ARM, M, PURPLE, T);

// Bottom-left corner handle
drawLine(M, H - M - ARM, M, H - M, PURPLE, T);
drawLine(M, H - M, M + ARM, H - M, PURPLE, T);

// Bottom-right corner handle
drawLine(W - M, H - M - ARM, W - M, H - M, PURPLE, T);
drawLine(W - M, H - M, W - M - ARM, H - M, PURPLE, T);

// Code slash "/" in the center
drawLine(48, 90, 80, 38, BLUE, 7);

// ── PNG encoding ──────────────────────────────────────────────────────────────
function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const lenBuf  = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcVal  = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcVal]);
}

const IHDR_data = Buffer.alloc(13);
IHDR_data.writeUInt32BE(W, 0);
IHDR_data.writeUInt32BE(H, 4);
IHDR_data[8]  = 8;   // bit depth
IHDR_data[9]  = 2;   // colour type: RGB
IHDR_data[10] = 0;   // compression method
IHDR_data[11] = 0;   // filter method
IHDR_data[12] = 0;   // interlace method

// Raw image data: prepend filter byte 0x00 to each row
const rowSize  = W * 3;
const rawData  = Buffer.alloc(H * (rowSize + 1));
for (let y = 0; y < H; y++) {
  rawData[y * (rowSize + 1)] = 0;   // None filter
  pixels.copy(rawData, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
}

const idat = zlib.deflateSync(rawData, { level: 9 });

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),  // PNG signature
  chunk('IHDR', IHDR_data),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = path.join(__dirname, 'assets', 'icon.png');
fs.writeFileSync(outPath, png);
console.log(`✓  Written ${png.length} bytes → ${outPath}`);
