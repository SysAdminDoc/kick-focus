import { deflateSync } from 'node:zlib';

const SURFACE = [0x0b, 0x0b, 0x0c];
const ACCENT = [0x53, 0xfc, 0x18];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * The Kick Focus mark: a dark rounded tile with an accent focus ring that is
 * open on the right, echoing the focus-mode affordance in the settings UI.
 * Drawn from geometry so the repository ships no opaque binary source art.
 */
function pixel(x, y, size) {
  const unit = size / 32;
  const cx = size / 2 - 0.5;
  const cy = size / 2 - 0.5;
  const dx = x - cx;
  const dy = y - cy;

  const corner = 7 * unit;
  const half = size / 2;
  const ox = Math.abs(dx) - (half - corner);
  const oy = Math.abs(dy) - (half - corner);
  const outside = ox > 0 && oy > 0 ? Math.hypot(ox, oy) > corner : false;
  if (outside) return null;

  const radius = Math.hypot(dx, dy);
  const ringOuter = 10.5 * unit;
  const ringInner = 7.5 * unit;
  const gap = dx > 4.5 * unit && Math.abs(dy) < 3.2 * unit;
  if (radius <= ringOuter && radius >= ringInner && !gap) return ACCENT;

  const dotRadius = 3.1 * unit;
  if (radius <= dotRadius) return ACCENT;

  return SURFACE;
}

export function renderIcon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const color = pixel(x, y, size);
      if (color) {
        raw[offset] = color[0];
        raw[offset + 1] = color[1];
        raw[offset + 2] = color[2];
        raw[offset + 3] = 0xff;
      }
      offset += 4;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
