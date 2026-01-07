import { describe, expect, it } from 'vitest';
import { createGrid, setCell } from './grid';
import { base64UrlToBytes, bytesToBase64Url, decodeGrid, encodeGrid } from './encode';
import { seedGrid } from './seed';

describe('base64url', () => {
  it('任意のバイト列を往復できる', () => {
    for (const len of [0, 1, 2, 3, 4, 5, 17, 64]) {
      const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37 + 11) % 256);
      const round = base64UrlToBytes(bytesToBase64Url(bytes));
      expect(round && Array.from(round)).toEqual(Array.from(bytes));
    }
  });

  it('URLに使えない文字を含まない', () => {
    const s = bytesToBase64Url(Uint8Array.from([255, 254, 253, 0, 1, 2]));
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('不正な文字列はnull', () => {
    expect(base64UrlToBytes('!!!!')).toBeNull();
    expect(base64UrlToBytes('A')).toBeNull(); // 長さ余り1は不正
  });
});

describe('encodeGrid / decodeGrid', () => {
  it('見本の盤面を往復できる', () => {
    const grid = seedGrid();
    const round = decodeGrid(encodeGrid(grid));
    expect(round).toEqual(grid);
  });

  it('空の盤面を往復できる', () => {
    const grid = createGrid(32);
    const round = decodeGrid(encodeGrid(grid));
    expect(round).toEqual(grid);
  });

  it('全面塗り(255マス超のラン)を往復できる', () => {
    const grid = createGrid(32);
    grid.cells.fill('#112233');
    const round = decodeGrid(encodeGrid(grid));
    expect(round).toEqual(grid);
  });

  it('全サイズで往復できる', () => {
    for (const size of [8, 16, 32]) {
      const grid = createGrid(size);
      setCell(grid, 0, 0, '#ff0000');
      setCell(grid, size - 1, size - 1, '#00ff00');
      expect(decodeGrid(encodeGrid(grid))).toEqual(grid);
    }
  });

  it('壊れた文字列はnull', () => {
    expect(decodeGrid('')).toBeNull();
    expect(decodeGrid('@@@@')).toBeNull();
    expect(decodeGrid(bytesToBase64Url(Uint8Array.from([9, 0])))).toBeNull(); // 不正なsize
    expect(decodeGrid(bytesToBase64Url(Uint8Array.from([8, 0, 0, 1])))).toBeNull(); // マス不足
  });
});
