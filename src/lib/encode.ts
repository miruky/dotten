// 盤面を共有用の短い文字列にする。パレット索引 + ランレングスをバイト列に
// 詰め、URLに載せられる base64url(パディングなし)へ変換する。外部ライブラリ
// に頼らず、ブラウザでも Node でも同じ実装で往復できるようにしている。

import { GRID_SIZES, createGrid, type PixelGrid } from './grid';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX = (() => {
  const m = new Map<string, number>();
  for (let i = 0; i < B64.length; i += 1) m.set(B64[i] as string, i);
  return m;
})();

export function bytesToBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = i + 1 < bytes.length ? (bytes[i + 1] as number) : 0;
    const b2 = i + 2 < bytes.length ? (bytes[i + 2] as number) : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 0x03) << 4) | (b1 >> 4)];
    if (i + 1 < bytes.length) out += B64[((b1 & 0x0f) << 2) | (b2 >> 6)];
    if (i + 2 < bytes.length) out += B64[b2 & 0x3f];
  }
  return out;
}

export function base64UrlToBytes(text: string): Uint8Array | null {
  const len = text.length;
  if (len % 4 === 1) return null;
  const bytes: number[] = [];
  for (let i = 0; i < len; i += 4) {
    const c0 = B64_INDEX.get(text[i] as string);
    const c1 = B64_INDEX.get(text[i + 1] as string);
    if (c0 === undefined || c1 === undefined) return null;
    bytes.push((c0 << 2) | (c1 >> 4));
    if (i + 2 < len) {
      const c2 = B64_INDEX.get(text[i + 2] as string);
      if (c2 === undefined) return null;
      bytes.push(((c1 & 0x0f) << 4) | (c2 >> 2));
      if (i + 3 < len) {
        const c3 = B64_INDEX.get(text[i + 3] as string);
        if (c3 === undefined) return null;
        bytes.push(((c2 & 0x03) << 6) | c3);
      }
    }
  }
  return Uint8Array.from(bytes);
}

/** 盤面を共有文字列へ。空でも往復できる */
export function encodeGrid(grid: PixelGrid): string {
  // 出現順のパレットを作る(透明は索引0として別枠)
  const palette: string[] = [];
  const indexOf = new Map<string, number>();
  for (const c of grid.cells) {
    if (c === null || indexOf.has(c)) continue;
    indexOf.set(c, palette.length + 1);
    palette.push(c);
  }
  const bytes: number[] = [grid.size, palette.length];
  for (const hex of palette) {
    bytes.push(
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    );
  }
  // ランレングス。1ランは最大255マスに区切る
  let i = 0;
  const cells = grid.cells;
  while (i < cells.length) {
    const cur = cells[i] ?? null;
    const idx = cur === null ? 0 : (indexOf.get(cur) as number);
    let run = 1;
    while (i + run < cells.length && (cells[i + run] ?? null) === cur && run < 255) run += 1;
    bytes.push(idx, run);
    i += run;
  }
  return bytesToBase64Url(Uint8Array.from(bytes));
}

/** 共有文字列から盤面へ。形が崩れていれば null */
export function decodeGrid(text: string): PixelGrid | null {
  const bytes = base64UrlToBytes(text);
  if (bytes === null || bytes.length < 2) return null;
  const size = bytes[0] as number;
  if (!GRID_SIZES.includes(size as (typeof GRID_SIZES)[number])) return null;
  const paletteLen = bytes[1] as number;
  let p = 2;
  const palette: string[] = [];
  for (let k = 0; k < paletteLen; k += 1) {
    if (p + 3 > bytes.length) return null;
    const hex =
      ((bytes[p] as number) << 16) | ((bytes[p + 1] as number) << 8) | (bytes[p + 2] as number);
    palette.push('#' + hex.toString(16).padStart(6, '0'));
    p += 3;
  }
  const grid = createGrid(size);
  let cell = 0;
  const total = size * size;
  while (cell < total) {
    if (p + 1 >= bytes.length) return null;
    const idx = bytes[p] as number;
    const run = bytes[p + 1] as number;
    p += 2;
    if (run === 0 || idx > paletteLen) return null;
    const color = idx === 0 ? null : (palette[idx - 1] as string);
    for (let r = 0; r < run; r += 1) {
      if (cell >= total) return null;
      grid.cells[cell] = color;
      cell += 1;
    }
  }
  // 余分なバイトが残っていれば壊れている
  if (p !== bytes.length) return null;
  return grid;
}
