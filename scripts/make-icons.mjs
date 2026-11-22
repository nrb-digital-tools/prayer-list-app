// Makes the home-screen icons (a southwest sunset with a cross) with no extra packages.
// Run: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// Southwest sunset: sky gradient, a pale sun, dark mesas, and a cross in front of the sun.
// Each pixel is sampled 4 x 4 times, so the round and sloped edges are smooth.
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function colorAt(u, v) {
  const dark = [0x4a, 0x24, 0x18];
  // Cross
  if ((Math.abs(u - 0.5) <= 0.035 && v >= 0.24 && v <= 0.8) || (Math.abs(v - 0.38) <= 0.035 && Math.abs(u - 0.5) <= 0.15)) return dark;
  // Ground and mesas (left mesa is higher, right mesa is lower)
  const left = Math.max(0, Math.min(1, (u - 0.02) / 0.06, (0.42 - u) / 0.08));
  const right = Math.max(0, Math.min(1, (u - 0.66) / 0.06, (1.0 - u) / 0.06));
  const top = Math.min(0.8, 0.8 - left * 0.14, 0.8 - right * 0.09);
  if (v >= top) return dark;
  // Sun
  if ((u - 0.5) ** 2 + (v - 0.52) ** 2 <= 0.26 ** 2) return [0xf6, 0xd5, 0x8e];
  // Sky: ochre at the top, then orange, then terracotta near the ground
  return v < 0.45 ? mix([0xd9, 0xa4, 0x41], [0xd0, 0x74, 0x34], v / 0.45) : mix([0xd0, 0x74, 0x34], [0xa6, 0x45, 0x2a], (v - 0.45) / 0.35);
}
function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const S = 4;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let j = 0; j < S; j++)
        for (let i = 0; i < S; i++) {
          const c = colorAt((x + (i + 0.5) / S) / size, (y + (j + 0.5) / S) / size);
          sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2];
        }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let k = 0; k < 3; k++) raw[o + k] = Math.round(sum[k] / (S * S));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
for (const s of [180, 192, 512]) writeFileSync(`public/icons/icon-${s}.png`, png(s));
console.log("Icons written to public/icons");
