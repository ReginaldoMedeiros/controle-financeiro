// Gera ícones PNG do PWA (sem dependências externas) com um encoder PNG mínimo.
// Desenho: fundo teal com um "anel de moeda" branco — identidade simples de finanças.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
mkdirSync(PUBLIC, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, draw) {
  const channels = 4;
  const raw = Buffer.alloc(size * (size * channels + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * channels + 1);
    raw[rowStart] = 0; // filtro none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y);
      const o = rowStart + 1 + x * channels;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Cores
const BG = [15, 118, 110]; // brand-700
const WHITE = [255, 255, 255];

function drawCoin(size) {
  const cx = size / 2;
  const cy = size / 2;
  const outer = size * 0.34;
  const inner = size * 0.24;
  return (x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= outer && d >= inner) return [...WHITE, 255];
    // pequeno traço vertical no meio (símbolo de cifrão estilizado)
    if (Math.abs(x - cx) < size * 0.025 && Math.abs(y - cy) < size * 0.2) return [...WHITE, 255];
    return [...BG, 255];
  };
}

for (const size of [192, 512]) {
  const png = makePng(size, drawCoin(size));
  writeFileSync(join(PUBLIC, `pwa-${size}x${size}.png`), png);
}
// apple-touch-icon (180x180 recomendado pelo iOS)
writeFileSync(join(PUBLIC, 'apple-touch-icon.png'), makePng(180, drawCoin(180)));

// favicon.svg (vetorial, leve)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0f766e"/>
  <circle cx="32" cy="32" r="16" fill="none" stroke="#fff" stroke-width="5"/>
  <rect x="30" y="16" width="4" height="32" fill="#fff"/>
</svg>`;
writeFileSync(join(PUBLIC, 'favicon.svg'), svg);

console.log('Ícones gerados em public/.');
