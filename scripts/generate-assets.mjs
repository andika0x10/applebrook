// Original Applebrook pixel art. No external image dependencies.
// Draw at native pixel resolution; Phaser renders every asset with nearest filtering.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { COLS, ROWS, isRoad, riverCenter } from '../game/world.ts';
import { DISTINCT_ROLES } from '../game/sprites.ts';

const output = fileURLToPath(new URL('../public/assets/applebrook/', import.meta.url));
mkdirSync(output, { recursive: true });
const rgba = value => {
  if (Array.isArray(value)) return value;
  const hex = value.replace('#', '');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255];
};
class Pixels {
  constructor(width, height) { this.width = width; this.height = height; this.data = Buffer.alloc(width * height * 4); }
  pixel(x, y, color) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const c = rgba(color), i = (y * this.width + x) * 4;
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = c[3];
  }
  rect(x, y, w, h, color) {
    const c = rgba(color);
    for (let py = Math.floor(y); py < y + h; py++) for (let px = Math.floor(x); px < x + w; px++) this.pixel(px, py, c);
  }
  line(x1, y1, x2, y2, color, thickness = 1) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
    for (let i = 0; i <= steps; i++) this.rect(Math.round(x1 + (x2 - x1) * i / steps), Math.round(y1 + (y2 - y1) * i / steps), thickness, thickness, color);
  }
  poly(points, color) {
    const minY = Math.floor(Math.min(...points.map(p => p[1]))), maxY = Math.ceil(Math.max(...points.map(p => p[1])));
    for (let y = minY; y <= maxY; y++) {
      const intersections = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) intersections.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length; i += 2) this.rect(Math.ceil(intersections[i]), y, Math.floor(intersections[i + 1]) - Math.ceil(intersections[i]) + 1, 1, color);
    }
  }
  ellipse(cx, cy, rx, ry, color) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.pixel(cx + x, cy + y, color);
  }
  paste(image, x, y) {
    for (let py = 0; py < image.height; py++) for (let px = 0; px < image.width; px++) {
      const i = (py * image.width + px) * 4;
      if (image.data[i + 3]) this.pixel(x + px, y + py, [...image.data.subarray(i, i + 4)]);
    }
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
function crc32(buffer) { let crc = 0xffffffff; for (const n of buffer) crc = crcTable[(crc ^ n) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const name = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}
function png(image) {
  const header = Buffer.alloc(13); header.writeUInt32BE(image.width, 0); header.writeUInt32BE(image.height, 4); header[8] = 8; header[9] = 6;
  const rows = [];
  for (let y = 0; y < image.height; y++) rows.push(Buffer.from([0]), image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const atlas = new Pixels(1024, 1024), frames = {};
let shelfX = 2, shelfY = 2, shelfHeight = 0;
function asset(name, width, height, draw) {
  if (shelfX + width + 2 > atlas.width) { shelfY += shelfHeight + 2; shelfX = 2; shelfHeight = 0; }
  if (shelfY + height > atlas.height) throw new Error('Atlas overflow');
  const image = new Pixels(width, height); draw(image); atlas.paste(image, shelfX, shelfY);
  frames[name] = { frame: { x: shelfX, y: shelfY, w: width, h: height }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: width, h: height }, sourceSize: { w: width, h: height } };
  shelfX += width + 2; shelfHeight = Math.max(shelfHeight, height);
}
const INK = '#46513b', WOOD = '#88674f', WOOD_LIGHT = '#c5a075', WOOD_DARK = '#684c3d';
function shadow(p, x, y, rx, ry) { p.ellipse(x, y, rx, ry, '#354e3c35'); }
function window(p, x, y, w = 9, h = 10) {
  p.rect(x - 1, y - 1, w + 2, h + 2, WOOD_DARK); p.rect(x, y, w, h, '#8eafb0');
  p.rect(x + 1, y + 1, w - 2, 2, '#bdd8cf'); p.rect(x + Math.floor(w / 2), y, 1, h, '#e7d8b1'); p.rect(x, y + Math.floor(h / 2), w, 1, '#e7d8b1');
}
function roof(p, x, y, w, h, colors) {
  const [dark, base, light] = colors;
  p.poly([[x, y + h], [x + 13, y], [x + w - 15, y], [x + w, y + h]], dark);
  p.poly([[x + 2, y + h - 2], [x + 14, y + 1], [x + w - 16, y + 1], [x + w - 3, y + h - 2]], base);
  for (let row = 3; row < h; row += 4) {
    const inset = Math.round((h - row) / h * 13);
    p.rect(x + inset, y + row, w - inset * 2, 1, dark);
    for (let col = x + inset + (row % 3) * 2; col < x + w - inset; col += 7) p.rect(col, y + row - 2, 4, 1, light);
  }
  p.rect(x + 13, y, w - 27, 2, light); p.rect(x, y + h, w + 1, 3, dark);
}
for (let variant = 0; variant < 3; variant++) asset(`house-${variant}`, 66, 68, p => {
  const roofs = [['#733a39', '#a95242', '#d68157'], ['#394c61', '#52768b', '#7796a0'], ['#785335', '#a88141', '#d5ad60']][variant];
  shadow(p, 34, 63, 30, 5);
  p.rect(10, 33, 46, 27, '#c5bc98'); p.rect(12, 33, 31, 25, '#eee2b9'); p.rect(44, 33, 12, 25, '#d5c8a4');
  p.rect(10, 56, 46, 5, '#969a84'); for (let x = 12; x < 55; x += 9) p.rect(x, 58, 6, 1, '#c6c8aa');
  roof(p, 5, 11, 56, 23, roofs);
  p.rect(46, 6, 7, 17, '#8b796b'); p.rect(45, 5, 9, 3, '#b8aa8c'); p.rect(48, 10, 4, 2, '#b5a08b');
  p.rect(29, 41, 11, 19, WOOD_DARK); p.rect(31, 43, 7, 17, '#9c8057'); p.pixel(36, 51, '#e8c671');
  p.rect(27, 60, 15, 3, '#c9c4a9'); p.rect(25, 63, 19, 2, '#b8b49c');
  window(p, 15, 41); window(p, 44, 41, 8, 9);
  p.rect(13, 39, 2, 13, roofs[0]); p.rect(24, 39, 2, 13, roofs[0]);
  p.rect(13, 53, 13, 3, WOOD); p.rect(14, 51, 11, 2, '#74905b'); p.rect(15, 50, 2, 2, '#d99491'); p.rect(21, 50, 2, 2, '#efd4a0');
  p.poly([[25, 28], [33, 19], [42, 28]], roofs[0]); p.rect(28, 28, 11, 6, '#eee2b9'); window(p, 31, 27, 5, 5);
});
asset('barn', 94, 86, p => {
  shadow(p, 48, 80, 44, 6); p.rect(12, 36, 70, 42, '#874d42'); p.rect(15, 36, 54, 40, '#b36450'); p.rect(70, 36, 12, 40, '#965344');
  for (let x = 17; x < 80; x += 6) { p.rect(x, 39, 1, 36, '#8e4d42'); p.rect(x + 1, 40, 1, 34, '#c17a5b'); }
  roof(p, 5, 9, 83, 29, ['#62342f', '#974438', '#c46b48']);
  p.rect(11, 39, 73, 3, '#e5d3a8'); p.rect(12, 42, 3, 35, '#dbc498'); p.rect(79, 42, 3, 35, '#dbc498');
  p.rect(32, 49, 32, 29, '#674c3f'); p.rect(34, 51, 28, 26, '#8d6d4c'); p.rect(47, 50, 2, 28, '#d5bc8d');
  p.line(35, 53, 46, 75, '#cfb48a', 2); p.line(59, 53, 49, 75, '#cfb48a', 2); p.rect(31, 47, 34, 3, '#ecd6aa');
  p.rect(41, 23, 14, 12, '#5c493a'); p.rect(44, 25, 8, 7, '#d5b46b'); p.rect(43, 29, 10, 1, '#b59351');
  window(p, 17, 48, 9, 9); window(p, 68, 48, 9, 9);
  p.rect(10, 77, 75, 3, '#c5bb93');
});
asset('mill', 76, 101, p => {
  shadow(p, 38, 95, 30, 5);
  p.poly([[21, 92], [26, 35], [50, 35], [57, 92]], '#8e9782');
  p.poly([[24, 91], [29, 35], [43, 35], [47, 91]], '#e1d8b6');
  for (let y = 42; y < 91; y += 7) { p.rect(27, y, 25, 1, '#b7b69b'); p.rect(31 + y % 10, y - 5, 5, 1, '#c3c3a7'); }
  p.poly([[20, 38], [38, 15], [56, 38]], '#596c69'); p.poly([[25, 34], [38, 18], [50, 34]], '#7b8f80');
  window(p, 34, 45, 8, 10); window(p, 33, 66, 8, 10);
  p.rect(32, 80, 11, 14, WOOD_DARK); p.rect(34, 82, 7, 12, WOOD); p.rect(18, 91, 40, 4, '#b4b59a');
  p.ellipse(38, 35, 5, 5, WOOD_DARK);
});
asset('mill-sails', 61, 61, p => {
  for (const [x, y, w, h] of [[28, 0, 5, 29], [32, 28, 29, 5], [28, 32, 5, 29], [0, 28, 29, 5]]) p.rect(x, y, w, h, WOOD_DARK);
  for (let n = 0; n < 23; n += 4) {
    p.rect(19, n + 1, 12, 2, '#e4d6aa'); p.rect(n + 37, 20, 2, 12, '#e4d6aa'); p.rect(30, n + 37, 12, 2, '#e4d6aa'); p.rect(n + 1, 30, 2, 12, '#e4d6aa');
  }
  p.line(19, 1, 19, 23, WOOD); p.line(38, 20, 59, 20, WOOD); p.line(41, 38, 41, 59, WOOD); p.line(1, 41, 23, 41, WOOD);
  p.ellipse(30, 30, 4, 4, WOOD); p.ellipse(30, 30, 2, 2, '#d1b887');
});
asset('bakery', 80, 77, p => {
  shadow(p, 40, 70, 35, 5); p.rect(10, 33, 59, 35, '#d1c4a1'); p.rect(12, 34, 45, 32, '#eee1b7');
  roof(p, 4, 10, 71, 26, ['#6d5a4d', '#a17d5c', '#c3a477']);
  p.rect(60, 2, 7, 20, '#9b8870'); p.rect(59, 1, 9, 3, '#c3b296');
  p.rect(18, 41, 25, 16, WOOD_DARK); p.rect(20, 43, 21, 12, '#839a93');
  for (let x = 22; x < 41; x += 6) { p.ellipse(x, 52, 2, 2, '#dcb76a'); p.line(x, 50, x + 1, 50, '#f0d08c'); }
  p.rect(48, 41, 13, 26, WOOD); window(p, 51, 43, 7, 10);
  p.poly([[12, 39], [18, 31], [61, 31], [68, 39]], '#e6dabb');
  for (let x = 15; x < 65; x += 10) { p.rect(x, 34, 5, 7, '#72917b'); }
  p.rect(12, 40, 56, 3, '#e7d8b3'); p.rect(11, 42, 2, 22, WOOD); p.rect(67, 42, 2, 22, WOOD);
  p.rect(24, 23, 29, 8, WOOD_DARK); p.rect(25, 24, 27, 6, '#cab18a');
  p.ellipse(38, 27, 7, 2, '#f1d08d'); p.line(34, 26, 36, 27, WOOD); p.line(39, 26, 41, 27, WOOD);
  p.rect(8, 67, 64, 3, '#aaa58a');
});
asset('orchard-shed', 55, 53, p => {
  shadow(p, 28, 48, 25, 4); p.rect(9, 24, 37, 22, '#b7ad81');
  for (let x = 12; x < 44; x += 5) p.rect(x, 25, 1, 21, '#9c956e');
  roof(p, 3, 8, 48, 17, ['#697b5a', '#8fa172', '#b1ba88']);
  p.rect(21, 30, 12, 17, WOOD_DARK); p.rect(23, 32, 8, 15, WOOD); window(p, 36, 29, 6, 7);
  p.rect(3, 40, 11, 8, WOOD); p.rect(4, 38, 9, 4, '#a9574b');
});
asset('construction', 76, 65, p => {
  shadow(p, 38, 59, 32, 5); p.rect(8, 52, 60, 8, '#b5b19a');
  for (const x of [11, 35, 62]) p.rect(x, 14, 3, 42, WOOD); p.rect(10, 14, 55, 3, WOOD_LIGHT); p.rect(10, 35, 55, 3, WOOD_LIGHT);
  p.line(12, 36, 61, 16, WOOD); p.line(14, 55, 61, 37, WOOD);
  p.rect(13, 45, 23, 8, '#cfb693'); p.rect(14, 43, 21, 3, '#e2c9a3');
  p.poly([[40, 40], [46, 21], [70, 28], [64, 47]], '#98a6a0'); p.line(43, 40, 65, 46, '#c1c9b5', 2);
  p.rect(52, 52, 15, 6, WOOD); p.rect(55, 49, 9, 3, '#b89161');
});
const palettes = {
  spring: ['#385e3e', '#56834b', '#72a451', '#a1bf65'],
  summer: ['#315a3a', '#467942', '#65984b', '#a7ba5b'],
  autumn: ['#754839', '#aa6540', '#ce8b44', '#edb65d'],
  winter: ['#728c82', '#9fb6ab', '#c8d9cf', '#e1eae0'],
};
for (const [season, colors] of Object.entries(palettes)) for (let variant = 0; variant < 3; variant++) {
  asset(`tree-${season}-${variant}`, 44, 66, p => {
    shadow(p, 23, 62, 19, 4); p.rect(20, 38, 6, 23, WOOD_DARK); p.rect(21, 40, 3, 20, WOOD); p.line(22, 49, 14, 41, WOOD_DARK, 2);
    if (variant === 2) {
      for (let i = 0; i < 4; i++) {
        const y = 7 + i * 9, width = 10 + i * 8;
        p.poly([[22, y], [22 - width / 2, y + 17], [22 + width / 2, y + 17]], colors[0]);
        p.poly([[22, y + 1], [23 - width / 2, y + 13], [21 + width / 2, y + 13]], colors[2]);
        p.poly([[22, y + 1], [23 - width / 2, y + 11], [22, y + 13]], colors[3]);
      }
    } else {
      p.ellipse(22, 31, 20, 20, colors[0]); p.ellipse(14, 28, 12, 17, colors[1]); p.ellipse(28, 26, 13, 17, colors[1]);
      p.ellipse(20, 19, 15, 14, colors[2]); p.ellipse(15, 17, 9, 9, colors[3]); p.ellipse(31, 29, 8, 9, colors[2]);
      for (let i = 0; i < 25; i++) { const x = 8 + (i * 11 + variant * 7) % 28, y = 13 + (i * 7) % 29; p.rect(x, y, 2 + i % 3, 2, colors[(i % 3) + 1]); }
      p.rect(7, 35, 5, 2, colors[0]); p.rect(31, 39, 5, 2, colors[0]);
    }
    if (season === 'winter') { p.rect(12, 14, 10, 2, '#eef2e5'); p.rect(25, 29, 12, 2, '#eef2e5'); }
  });
  asset(`apple-${season}-${variant}`, 46, 51, p => {
    shadow(p, 24, 47, 20, 4); p.rect(21, 27, 5, 19, WOOD_DARK); p.rect(22, 30, 2, 16, '#a28155');
    p.line(22, 35, 13, 25, WOOD_DARK, 2); p.line(24, 33, 33, 23, WOOD_DARK, 2);
    p.ellipse(23, 23, 21, 18, colors[0]); p.ellipse(14, 21, 12, 13, colors[1]); p.ellipse(30, 18, 12, 14, colors[2]); p.ellipse(18, 12, 12, 10, colors[2]); p.ellipse(15, 10, 7, 6, colors[3]);
    for (let i = 0; i < 21; i++) { const x = 7 + (i * 13) % 32, y = 10 + (i * 7) % 23; p.rect(x, y, 3, 2, colors[(i % 3) + 1]); }
    for (const [x, y] of [[11, 18], [26, 9], [34, 22], [22, 28], [13, 31], [30, 33]]) {
      if (season === 'spring') { p.rect(x, y, 4, 3, '#edd2c3'); p.rect(x + 1, y - 1, 2, 5, '#f8e8cf'); p.pixel(x + 1, y + 1, '#d5a690'); }
      else if (season === 'autumn') { p.ellipse(x + 1, y, 2, 2, '#bc5d5a'); p.pixel(x, y - 1, '#e4a177'); p.pixel(x + 1, y - 3, WOOD_DARK); }
      else if (season === 'summer') p.rect(x, y, 3, 3, '#b7ba70');
    }
  });
}
asset('wheat-0', 16, 19, p => {
  for (const [x, y] of [[3, 15], [8, 17], [13, 15]]) {
    p.rect(x - 2, y + 1, 5, 1, '#846039');
    p.rect(x, y - 2, 1, 3, '#b59858');
    p.pixel(x, y - 2, '#dcc18a');
  }
});
for (let stage = 1; stage <= 3; stage++) asset(`wheat-${stage}`, 16, 19, p => {
  const ripe = stage === 3;
  for (let i = 0; i < stage + 3; i++) {
    const x = 2 + i * 2 + i % 2, base = 17 - i % 3, h = 3 + stage * 3 + i % 2;
    const tip = x + i % 3 - 1;
    p.line(x, base, tip, base - h, ripe ? '#a87a3e' : '#587745');
    if (!ripe) {
      p.line(x, base - 2, x - 2, base - 5, '#79934c');
      p.line(x, base - 4, x + 2, base - 6, '#9bae5e');
    }
    for (let n = 0; n < (ripe ? 4 : 2); n++) {
      const y = base - h + n * 2;
      p.rect(tip - 1, y, 2, 2, ripe ? ['#eac670', '#f6db90', '#d5a654'][i % 3] : stage === 2 ? '#cabc6b' : '#a4b766');
      p.pixel(tip + 1, y + 1, ripe ? '#ffe4a0' : '#c7cb78');
    }
  }
});
const shirts = ['#7892aa', '#b97470', '#7d9563', '#aa8d65', '#c79a76', '#8c86a5', '#7c9c8e', '#b69b66'];
for (const role of ['', ...DISTINCT_ROLES]) for (let color = 0; color < 8; color++) for (const direction of ['down', 'up', 'left', 'right']) for (let step = 0; step < 3; step++) asset(`npc-${role ? role + '-' : ''}${color}-${direction}-${step}`, 16, 24, p => {
  const stride = step === 1 ? 1 : step === 2 ? -1 : 0;
  const skin = color % 3 === 0 ? '#d4a17a' : color % 3 === 1 ? '#e3b78c' : '#bc8c67';
  p.rect(5, 18, 3, 5 + stride, '#5e665a'); p.rect(9, 18, 3, 5 - stride, '#4e594f');
  p.rect(4, 22 + stride, 4, 2, WOOD_DARK); p.rect(9, 22 - stride, 4, 2, WOOD_DARK);
  p.rect(4, 11, 9, 9, INK); p.rect(5, 11, 7, 8, shirts[color]);
  p.rect(3, 12 + stride, 2, 6, shirts[color]); p.rect(12, 12 - stride, 2, 6, shirts[color]);
  p.rect(3, 17 + stride, 2, 2, skin); p.rect(12, 17 - stride, 2, 2, skin);
  p.rect(6, 9, 5, 4, skin); p.rect(4, 4, 9, 7, '#6a503d'); p.rect(5, 5, 7, 6, skin);
  if (direction !== 'up') {
    if (direction !== 'left') p.pixel(10, 8, '#4b4a3b');
    if (direction !== 'right') p.pixel(6, 8, '#4b4a3b');
    p.rect(7, 11, 3, 1, '#bc8b68');
  } else p.rect(5, 5, 7, 5, '#77563e');
  if (role === 'baker') {
    p.rect(5, 4, 8, 2, '#b7bca3'); p.rect(4, 1, 10, 3, '#fff1cb'); p.rect(5, 0, 7, 4, '#f8e4bd');
    if (direction !== 'up') {
      p.rect(6, 13, 5, 7, '#f2deaf'); p.rect(6, 16, 5, 1, '#a4544c'); p.rect(7, 18, 3, 1, '#c6ad88');
    }
  } else if (role === 'hauler') {
    p.rect(4, 3, 9, 3, '#465f61'); p.rect(6, 2, 5, 2, '#638787');
  } else if (role === 'carpenter') {
    p.rect(4, 3, 9, 3, '#a45142'); p.rect(6, 2, 5, 2, '#cb7950');
    p.rect(3, 5, 11, 1, '#6f4c37'); p.rect(6, 11, 5, 2, '#d78b53');
  } else if (color === 0 || color === 2 || color === 4) {
    p.rect(3, 4, 11, 2, '#b58a4d'); p.rect(5, 1, 7, 4, '#e6bd72'); p.rect(5, 3, 7, 1, '#84613f');
  } else if (color === 1 || color === 5 || color === 7) {
    const cap = color === 1 ? '#a95650' : color === 5 ? '#535874' : '#747742';
    p.rect(4, 2, 9, 4, cap); p.rect(direction === 'right' ? 10 : 3, 5, 4, 1, cap);
    p.rect(6, 1, 5, 1, cap); p.pixel(7, 2, '#d3aa76');
  } else {
    p.rect(5, 2, 7, 3, color === 3 ? '#6b4333' : '#483934');
    p.rect(direction === 'left' ? 11 : 4, 4, 2, 5, color === 3 ? '#976341' : '#5b4238');
  }
  if (role === 'hauler') {
    if (direction === 'up') {
      p.rect(4, 12, 9, 7, '#694d39'); p.rect(5, 12, 7, 6, '#bc925d'); p.rect(5, 14, 7, 1, '#e1b980');
    } else {
      p.rect(5, 12, 2, 7, '#dfb67a'); p.rect(10, 12, 2, 7, '#dfb67a');
      p.rect(6, 16, 4, 1, '#77543f');
    }
  } else if (role === 'carpenter') {
    const side = direction === 'left' ? 3 : 12;
    p.rect(4, 17, 9, 2, '#754931'); p.rect(side, 15, 2, 6, '#bd8754');
    p.rect(side - 1, 14, 4, 2, '#bbc5ac');
  } else if (!role) {
    if (direction === 'up') { p.rect(6, 13, 5, 6, '#a68c61'); p.rect(7, 14, 3, 1, '#c4ab7b'); }
    else { p.rect(6, 14, 1, 6, '#d4c5a0'); p.rect(10, 14, 1, 6, '#d4c5a0'); }
  }
});
asset('tractor', 50, 32, p => {
  shadow(p, 25, 28, 23, 4);
  p.ellipse(13, 23, 9, 9, '#3f4b40'); p.ellipse(13, 23, 6, 6, '#697259'); p.ellipse(13, 23, 3, 3, '#bcaa76');
  p.ellipse(40, 25, 6, 6, '#3f4b40'); p.ellipse(40, 25, 3, 3, '#c2ae7a');
  p.rect(15, 15, 29, 8, '#567653'); p.rect(24, 11, 19, 10, '#78965f'); p.rect(26, 10, 16, 2, '#a1b47a'); p.rect(39, 13, 5, 7, '#d0c7a1');
  p.rect(42, 14, 2, 6, '#6d7564'); p.rect(31, 7, 3, 6, '#566054'); p.rect(30, 6, 5, 2, '#798476');
  p.rect(10, 5, 3, 12, '#c8bd94'); p.rect(9, 2, 17, 3, '#6a8659'); p.rect(8, 1, 19, 2, '#a3b37c');
  p.rect(16, 9, 6, 9, '#9b8161'); p.rect(17, 6, 5, 5, '#d8ac83'); p.rect(15, 5, 8, 2, '#d9c18b');
  p.rect(14, 15, 9, 3, '#68859a'); p.line(21, 14, 26, 14, '#d8ac83', 2); p.ellipse(26, 14, 2, 3, '#475445');
  p.rect(4, 16, 17, 3, '#83965e'); p.rect(3, 15, 18, 1, '#a7b57b');
});
for (const direction of ['up', 'down']) asset('tractor-' + direction, 34, 39, p => {
  const front = direction === 'down';
  shadow(p, 17, 34, 15, 4);
  p.rect(2, 13, 8, 19, '#374638');
  p.rect(24, 13, 8, 19, '#374638');
  p.rect(4, 13, 4, 17, '#5a6c4c');
  p.rect(26, 13, 4, 17, '#5a6c4c');
  p.rect(8, 10, 18, 22, '#4e6d45');
  p.rect(9, 6, 16, 12, '#83a367');
  p.rect(8, 4, 18, 3, '#b8c183');
  p.rect(10, 11, 14, 7, front ? '#576c5c' : '#658462');
  p.rect(13, 11, 8, 5, front ? '#ce9f73' : '#927655');
  p.rect(13, 10, 8, 2, '#d6b77b');
  p.rect(11, 19, 12, 13, '#77965e');
  p.rect(12, 19, 10, 2, '#a6b77c');
  p.rect(12, 29, 10, 4, front ? '#526253' : '#a68e63');
  p.rect(8, 27, 3, 3, front ? '#e9ce8b' : '#b86e52');
  p.rect(23, 27, 3, 3, front ? '#e9ce8b' : '#b86e52');
  p.rect(9, 32, 5, 5, '#3d4a37');
  p.rect(20, 32, 5, 5, '#3d4a37');
});
for (const [resource, c] of Object.entries({ wheat: '#d5b56e', apples: '#bd6c58', flour: '#ded0a6', bread: '#bc8a4e', wood: '#97754e' })) asset(`cargo-${resource}`, 11, 12, p => {
  p.rect(2, 3, 8, 8, WOOD_DARK); p.rect(3, 3, 6, 7, c); p.rect(2, 5, 8, 1, '#bba06b'); p.rect(2, 9, 8, 1, '#bba06b'); p.rect(4, 1, 4, 2, c);
});
asset('bridge', 84, 39, p => {
  shadow(p, 42, 34, 41, 5); p.rect(2, 10, 80, 22, WOOD_DARK); p.rect(3, 11, 78, 20, '#bd9e73');
  for (let x = 5; x < 81; x += 5) { p.rect(x, 11, 1, 20, '#8e7453'); p.rect(x + 1, 14, 2, 1, '#d4b785'); }
  for (const y of [7, 29]) { p.rect(0, y, 84, 3, '#98784f'); p.rect(0, y, 84, 1, '#ddbd83'); for (let x = 1; x < 84; x += 16) { p.rect(x, y - 5, 3, 10, WOOD_DARK); p.rect(x, y - 5, 3, 2, '#d2b17a'); } }
});
for (const green of [false, true]) asset(green ? 'market-green' : 'market', 56, 57, p => {
  shadow(p, 28, 51, 25, 5); p.rect(7, 24, 3, 28, WOOD_DARK); p.rect(46, 24, 3, 28, WOOD_DARK);
  p.rect(8, 35, 40, 15, WOOD); p.rect(9, 34, 39, 3, '#d7b882');
  for (let x = 11; x < 46; x += 9) p.rect(x, 38, 1, 10, WOOD_DARK);
  p.poly([[2, 24], [12, 6], [44, 6], [54, 24]], '#eee3bc');
  for (let x = 5; x < 52; x += 12) p.poly([[x, 24], [x + 6, 8], [x + 11, 8], [x + 7, 24]], green ? '#7a9b7a' : '#bc7066');
  p.rect(2, 24, 52, 5, '#eaddb6'); for (let x = 3; x < 53; x += 12) p.rect(x, 24, 6, 5, green ? '#698967' : '#ad5d55');
  for (let i = 0; i < 4; i++) { p.rect(12 + i * 9, 31, 7, 5, WOOD_DARK); p.rect(13 + i * 9, 29, 5, 5, green ? '#d3b867' : i % 2 ? '#b76b55' : '#a9ac62'); }
});
asset('fence', 18, 16, p => { p.rect(0, 4, 18, 3, '#bda172'); p.rect(0, 10, 18, 2, '#a1875e'); for (const x of [1, 15]) { p.rect(x, 1, 3, 14, WOOD); p.rect(x, 0, 3, 2, '#e0c693'); } });
asset('fence-side', 10, 18, p => { p.rect(3, 0, 2, 18, WOOD); p.rect(0, 1, 8, 3, '#c4a97b'); p.rect(0, 14, 8, 3, '#ac8c61'); });
asset('hay', 22, 19, p => { shadow(p, 11, 16, 10, 3); p.rect(2, 5, 18, 11, '#b79851'); p.rect(3, 3, 16, 12, '#d7b66b'); p.rect(4, 3, 14, 3, '#e9cf85'); for (const x of [7, 15]) p.rect(x, 4, 2, 12, '#917d4e'); for (let x = 4; x < 19; x += 3) p.rect(x, 8, 1, 5, '#c2a05a'); });
asset('crate', 16, 15, p => { shadow(p, 8, 13, 7, 2); p.rect(1, 2, 14, 11, WOOD_DARK); p.rect(2, 3, 12, 9, '#b29364'); p.rect(2, 5, 12, 1, WOOD); p.rect(2, 9, 12, 1, WOOD); p.rect(3, 3, 2, 9, '#cfb17d'); p.rect(11, 3, 2, 9, '#cfb17d'); });
asset('basket', 15, 15, p => { p.ellipse(8, 6, 5, 5, WOOD); p.rect(2, 7, 12, 6, '#c0a172'); p.rect(3, 11, 10, 3, WOOD); for (const [x, y] of [[4, 6], [9, 6], [7, 8]]) p.rect(x, y, 4, 3, '#bd6c58'); });
asset('barrel', 16, 21, p => { shadow(p, 8, 18, 7, 2); p.rect(2, 4, 12, 14, '#96774f'); p.rect(3, 3, 10, 16, '#b19261'); p.ellipse(8, 4, 6, 2, '#d0b07d'); p.rect(2, 7, 12, 2, '#717562'); p.rect(2, 15, 12, 2, '#717562'); p.rect(7, 7, 1, 9, '#cfad77'); });
asset('well', 33, 43, p => { shadow(p, 17, 38, 15, 4); p.ellipse(17, 33, 13, 7, '#939886'); p.rect(4, 29, 26, 6, '#b4b59d'); p.ellipse(17, 28, 13, 6, '#d1c9a6'); p.ellipse(17, 28, 9, 4, '#637d77'); p.rect(7, 12, 3, 19, WOOD); p.rect(24, 12, 3, 19, WOOD); roof(p, 1, 4, 30, 10, ['#68584a', '#9c805a', '#c0a277']); p.line(17, 15, 17, 29, '#d0b686'); });
asset('flowers', 17, 13, p => { for (const [x, y, c] of [[3, 5, '#eed5b7'], [9, 3, '#d7a6a2'], [13, 7, '#e7ce8a']]) { p.rect(x, y, 1, 6, '#6b8a50'); p.rect(x - 1, y - 1, 3, 3, c); p.pixel(x, y, '#e6c66e'); } });
asset('rock', 18, 13, p => { shadow(p, 9, 11, 8, 2); p.poly([[1, 9], [4, 3], [11, 1], [16, 6], [17, 10]], '#8b9a84'); p.poly([[2, 8], [5, 3], [10, 2], [13, 6]], '#b3baa0'); p.line(5, 4, 10, 3, '#ccd0b4'); });
asset('bench', 30, 23, p => { p.rect(4, 3, 23, 7, '#b89a6c'); p.rect(3, 12, 25, 4, '#c6a675'); p.rect(6, 15, 3, 7, WOOD_DARK); p.rect(23, 15, 3, 7, WOOD_DARK); p.rect(6, 8, 2, 5, WOOD); p.rect(23, 8, 2, 5, WOOD); });
asset('sign', 23, 30, p => { p.rect(10, 10, 3, 19, WOOD); p.poly([[1, 3], [17, 3], [22, 8], [17, 13], [1, 13]], '#c5a472'); p.line(5, 7, 15, 7, '#826746', 2); });
asset('mailbox', 16, 25, p => { p.rect(7, 12, 3, 12, WOOD); p.rect(2, 4, 13, 10, '#7b8f85'); p.rect(3, 2, 11, 3, '#a4b29d'); p.rect(3, 6, 7, 5, '#5e746b'); p.rect(12, 3, 1, 7, '#b9675a'); p.rect(12, 3, 4, 3, '#c98a70'); });
asset('lamp', 18, 49, p => { p.rect(7, 13, 3, 35, '#697465'); p.rect(5, 45, 7, 3, '#7d8675'); p.rect(3, 5, 11, 12, '#607062'); p.rect(5, 7, 7, 8, '#e9d6a0'); p.rect(8, 6, 1, 10, '#9a906b'); p.poly([[1, 5], [8, 0], [16, 5]], '#788574'); });
asset('scarecrow', 29, 39, p => { p.rect(13, 14, 3, 25, WOOD); p.rect(2, 15, 25, 3, WOOD); p.poly([[8, 11], [20, 11], [26, 22], [4, 22]], '#9b8671'); p.rect(10, 7, 9, 8, '#d2b888'); p.rect(6, 6, 17, 3, '#d2b879'); p.rect(10, 2, 9, 5, '#d9c48e'); p.rect(10, 21, 4, 7, '#7a8f95'); p.rect(16, 21, 4, 7, '#7a8f95'); });
const plotIcons = {
  mill(p) {
    p.line(16, 8, 16, 25, '#80634b', 2); p.poly([[11, 26], [14, 14], [18, 14], [21, 26]], '#917454');
    p.line(10, 19, 22, 7, '#4b6653', 3); p.line(10, 7, 22, 19, '#4b6653', 3); p.rect(15, 12, 3, 3, '#f4dfa6');
  },
  bakery(p) {
    p.ellipse(16, 15, 9, 6, '#7a4938'); p.ellipse(16, 14, 8, 5, '#b97c45');
    for (const x of [12, 16, 20]) p.line(x, 15, x + 1, 12, '#f2d49a', 2);
  },
  cottage(p) {
    p.rect(10, 12, 13, 10, '#bf925e'); p.poly([[7, 13], [16, 5], [25, 13]], '#8f554b');
    p.rect(14, 16, 4, 6, '#725244'); p.rect(19, 15, 2, 3, '#f4dfa6');
  },
  orchard(p) {
    p.line(16, 8, 18, 6, '#4b6653', 2); p.rect(15, 9, 2, 3, '#77543f');
    p.ellipse(13, 15, 5, 5, '#a95a4c'); p.ellipse(19, 15, 5, 5, '#a95a4c'); p.ellipse(16, 18, 6, 4, '#a95a4c');
    p.rect(11, 13, 2, 3, '#eab184');
  },
};
for (const [kind, drawIcon] of Object.entries(plotIcons)) asset(`plot-${kind}`, 33, 38, p => {
  p.rect(14, 23, 5, 15, WOOD_DARK); p.rect(15, 24, 2, 13, WOOD_LIGHT);
  p.rect(1, 1, 31, 25, WOOD_DARK); p.rect(3, 3, 27, 20, '#f5e1ae');
  p.rect(3, 23, 27, 2, '#bb945e'); p.pixel(5, 5, '#a88a5e'); p.pixel(27, 5, '#a88a5e');
  drawIcon(p);
});
asset('hud-coin', 16, 16, p => {
  p.ellipse(8, 8, 7, 7, '#64472e'); p.ellipse(8, 7, 6, 6, '#d89a3e');
  p.ellipse(7, 6, 5, 5, '#f9cc67'); p.rect(7, 4, 2, 6, '#a76d2e'); p.rect(4, 4, 2, 1, '#ffe499');
});
asset('tool-hammer', 24, 24, p => {
  p.line(6, 20, 17, 8, '#593c2a', 5); p.line(6, 19, 17, 7, '#bc8753', 3);
  p.poly([[6, 4], [10, 1], [20, 11], [16, 16]], '#334340');
  p.poly([[8, 4], [10, 2], [19, 10], [16, 13]], '#a4b6ad');
  p.poly([[7, 5], [9, 3], [13, 7], [10, 9]], '#d9e3c8');
});
asset('tool-book', 24, 24, p => {
  p.rect(3, 4, 18, 19, '#674630'); p.rect(5, 3, 15, 18, '#a66242');
  p.rect(7, 5, 11, 11, '#b77d4f'); p.rect(9, 7, 7, 5, '#e9cb8a');
  p.rect(6, 18, 14, 3, '#e6d5a7'); p.rect(10, 19, 9, 1, '#ae986e');
});
asset('tool-flag', 24, 24, p => {
  p.rect(4, 1, 3, 22, '#9e7552'); p.rect(3, 1, 5, 3, '#e8ba69');
  p.poly([[7, 4], [22, 4], [18, 10], [22, 15], [7, 15]], '#a04f42');
  p.poly([[7, 4], [21, 4], [18, 8], [7, 8]], '#dc8660'); p.rect(7, 8, 3, 6, '#eeb770');
});
for (const [name, colors] of Object.entries({
  'hedge-spring': ['#375c41', '#60834b', '#94ab54'],
  'hedge-summer': ['#31563c', '#4e7941', '#8ba058'],
  'hedge-autumn': ['#684b40', '#987445', '#c9a355'],
  'hedge-winter': ['#74877a', '#a4b6a2', '#dbe7d4'],
})) asset(name, 24, 16, p => {
  shadow(p, 12, 13, 11, 2);
  p.ellipse(12, 9, 10, 5, colors[0]);
  p.ellipse(6, 7, 5, 4, colors[1]);
  p.ellipse(14, 6, 7, 5, colors[1]);
  p.ellipse(18, 8, 4, 3, colors[1]);
  for (let i = 0; i < 6; i++) p.rect(4 + i * 3, 4 + i % 3, 2, 1, colors[2]);
});
asset('festival-table', 78, 24, p => {
  shadow(p, 39, 20, 37, 3); p.rect(5, 11, 3, 12, WOOD_DARK); p.rect(69, 11, 3, 12, WOOD_DARK);
  p.rect(1, 6, 76, 9, WOOD); p.rect(0, 4, 78, 8, '#d7c7a3'); p.rect(0, 5, 78, 2, '#ebdfbd');
  for (let x = 8; x < 75; x += 15) { p.ellipse(x, 6, 4, 2, '#f4e9cb'); p.ellipse(x, 6, 2, 1, '#bd9b5b'); }
  p.rect(32, 1, 10, 6, WOOD); p.rect(33, 0, 8, 3, '#bc6a55'); p.rect(50, 1, 3, 6, '#8b9d73');
});
asset('festival-flags', 116, 35, p => {
  p.rect(2, 4, 2, 30, WOOD); p.rect(112, 4, 2, 30, WOOD);
  for (let x = 3; x < 114; x++) p.pixel(x, 5 + Math.sin((x - 3) / 110 * Math.PI) * 7, WOOD_DARK);
  for (let i = 0; i < 10; i++) { const x = 7 + i * 11, y = 6 + Math.sin((x - 3) / 110 * Math.PI) * 7; p.poly([[x, y], [x + 7, y], [x + 4, y + 9]], ['#be7b64', '#d2b96e', '#8ca175', '#89a5a0'][i % 4]); }
});
// Snow settles on the same building silhouettes; doors and windows stay readable.
for (const name of ['house-0', 'house-1', 'house-2', 'barn', 'mill', 'bakery', 'orchard-shed']) {
  const f = frames[name].frame, original = new Pixels(f.w, f.h);
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const index = ((f.y + y) * atlas.width + f.x + x) * 4;
    original.pixel(x, y, [...atlas.data.subarray(index, index + 4)]);
  }
  asset(`${name}-winter`, f.w, f.h, p => {
    p.paste(original, 0, 0);
    if (name.startsWith('house')) {
      p.rect(20, 10, 24, 3, '#e5eadd'); p.rect(10, 31, 17, 3, '#d5e0d2'); p.rect(42, 31, 17, 3, '#e5eadd');
      p.poly([[14, 22], [20, 14], [37, 14], [42, 19], [25, 19], [22, 22]], '#dce5d5'); p.rect(14, 54, 10, 2, '#e1e7d7');
    } else if (name === 'mill') {
      p.poly([[28, 31], [38, 18], [48, 31], [40, 28], [35, 30]], '#e1e8d8'); p.rect(22, 92, 33, 2, '#e1e8d8');
    } else {
      const roofWidth = name === 'barn' ? 83 : name === 'bakery' ? 71 : 48;
      p.rect(18, 9, roofWidth - 26, 3, '#e3e9dc'); p.rect(8, name === 'barn' ? 36 : name === 'bakery' ? 34 : 23, roofWidth - 4, 3, '#dbe4d4');
      p.rect(20, 17, roofWidth / 2, 4, '#dce5d5');
    }
  });
}

for (const season of Object.keys(palettes)) {
  const p = new Pixels(COLS * 16, ROWS * 16);
  const colors = {
    spring: ['#82a458', '#74954e', '#8dad5a', '#a4ba65', '#cfaf78'],
    summer: ['#88a050', '#77934c', '#96a956', '#aaba61', '#d4b271'],
    autumn: ['#a69b56', '#91864a', '#b4a65a', '#c2b56a', '#d6af78'],
    winter: ['#d5dfcd', '#cbd7c6', '#dce4d3', '#e4e9db', '#c0c9b4'],
  }[season];
  p.rect(0, 0, p.width, p.height, colors[0]);
  let seed = 84;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const [x, y, width, height] of [[150, 113, 110, 75], [335, 210, 110, 70], [511, 167, 55, 69], [715, 165, 104, 102], [717, 469, 106, 77], [134, 473, 102, 70], [434, 521, 109, 66]]) {
    for (let line = -height; line <= height; line += 2) {
      const radius = width * Math.sqrt(1 - (line / height) ** 2);
      const stagger = Math.sin(line / 7) * 5 + Math.cos(line / 17) * 8;
      p.rect(x - radius + stagger, y + line, radius * 2, 2, colors[2]);
    }
  }
  for (let i = 0; i < 4500; i++) {
    p.rect(random() * p.width, random() * p.height, 1 + Math.floor(random() * 5), 1 + Math.floor(random() * 2), colors[1 + i % 3]);
  }
  // Irregular trail edges follow the road tiles used by the villagers.
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) if (isRoad(col, row)) {
    const x = col * 16, y = row * 16;
    const west = isRoad(col - 1, row), east = isRoad(col + 1, row);
    const north = isRoad(col, row - 1), south = isRoad(col, row + 1);
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const distance = Math.min(west ? 16 : px, east ? 16 : 15 - px, north ? 16 : py, south ? 16 : 15 - py);
      const edge = 2 + Math.round(Math.sin((x + px) / 5) + Math.cos((y + py) / 4));
      if (distance < edge) continue;
      const grain = random();
      p.pixel(x + px, y + py, distance < edge + 2 ? (season === 'winter' ? '#afbea7' : '#b49362') :
        grain < .04 ? '#ba9f70' : grain > .96 ? '#e0c38d' : colors[4]);
    }
  }

  // Cobblestones around the stalls and bare soil at the fruit-tree roots.
  for (let row = 0; row < 11; row++) for (let col = 0; col < 16; col++) {
    const x = 393 + col * 7 + (row % 2) * 3, y = 302 + row * 6;
    if ((col === 0 || col === 15 || row === 0 || row === 10) && random() < 0.4) continue;
    p.rect(x, y, 6, 5, '#9c8f6d');
    p.rect(x + 1, y, 5, 4, ['#b6a984', '#c4b691', '#c9bd98'][Math.floor(random() * 3)]);
  }
  for (const [left, width] of [[126, 80], [215, 87]]) {
    p.rect(left, 316, width, 102, season === 'winter' ? '#bec5ac' : '#78573b');
    p.rect(left + 2, 318, width - 4, 98, season === 'winter' ? '#cbd4be' : '#9b7547');
    for (let y = 321; y < 415; y += 14) {
      p.rect(left + 2, y, width - 4, 3, season === 'winter' ? '#b8c4ad' : '#805d3d');
      p.rect(left + 3, y + 3, width - 6, 1, season === 'winter' ? '#dbe0cf' : '#b38453');
    }
  }
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    p.ellipse(655 + col * 36, 145 + row * 45, 16, 10, colors[1]);
    p.ellipse(655 + col * 36, 145 + row * 45, 10, 6, season === 'winter' ? '#b9c8b6' : '#8e874f');
  }
  for (let i = 0; i < 740; i++) {
    const x = Math.floor(random() * p.width), y = Math.floor(random() * p.height);
    if (isRoad(Math.floor(x / 16), Math.floor(y / 16)) || x > 123 && x < 306 && y > 312 && y < 422) continue;
    const color = i % 9 === 0 && season === 'spring' ? '#e6d3a3' : colors[1];
    p.rect(x, y, 1, 3, color); p.pixel(x - 1, y + 1, color); p.pixel(x + 1, y, color);
  }

  const water = season === 'winter' ? ['#a8c8c8', '#8aafb7', '#7c9ca9'] : ['#5b9b91', '#3c7f83', '#346e78'];
  for (let y = 0; y < p.height; y++) {
    const center = Math.round(riverCenter(y / 16) * 16 + 8 + Math.sin(y / 43) * 3);
    const spread = 21 + Math.round(Math.cos(y / 32) * 3);
    p.rect(center - spread - 7, y, spread * 2 + 14, 1, colors[1]);
    p.rect(center - spread - 4, y, spread * 2 + 8, 1, '#b2aa79');
    p.rect(center - spread, y, spread * 2, 1, water[0]);
    p.rect(center - spread + 4, y, spread * 2 - 9, 1, water[1]);
    p.rect(center - 9, y, spread + 2, 1, water[2]);
    if (y % 17 === 0) p.rect(center - 15 + (y % 7), y, 10, 1, '#87b6a7');
    if (y % 29 === 0) p.rect(center + 4, y, 9, 1, '#99c7b4');
    if (season === 'winter' && y % 40 < 12) p.rect(center - 19, y, 36, 1, '#d1e2d6');
  }
  for (let y = 17; y < p.height; y += 14 + Math.floor(random() * 12)) {
    if (y > 268 && y < 307) continue;
    const center = riverCenter(y / 16) * 16 + 8;
    const x = center + (random() < 0.5 ? -1 : 1) * (20 + random() * 7);
    if (season === 'winter') {
      p.ellipse(Math.round(x), y, 6, 2, '#ccdcd1');
    } else if (random() < 0.6) {
      for (let sprig = 0; sprig < 6; sprig++) {
        const height = 3 + Math.floor(random() * 6);
        p.line(x + sprig - 3, y, x + sprig * 2 - 5, y - height, sprig % 2 ? '#3c6945' : '#759b56');
      }
    } else {
      p.ellipse(Math.round(x), y, 5, 3, '#51776d');
      p.ellipse(Math.round(x) - 1, y - 1, 3, 2, '#9fb79d');
    }
  }
  writeFileSync(output + 'terrain-' + season + '.png', png(p));
}
writeFileSync(output + 'village.png', png(atlas));
writeFileSync(output + 'village.json', JSON.stringify({ frames, meta: { app: 'Applebrook original pixel art', image: 'village.png', format: 'RGBA8888', size: { w: 1024, h: 1024 }, scale: '1' } }));
console.log('Generated ' + Object.keys(frames).length + ' original sprites and four seasonal terrains.');

