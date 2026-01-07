import { describe, expect, it } from 'vitest';
import {
  countFilled,
  createGrid,
  createStore,
  deserializeGrid,
  floodFill,
  getCell,
  isBlank,
  resizeGrid,
  serializeGrid,
  setCell,
  symmetricPoints,
} from './grid';

describe('createGrid / setCell / getCell', () => {
  it('透明で初期化され、塗って読み戻せる', () => {
    const grid = createGrid(8);
    expect(grid.cells).toHaveLength(64);
    expect(isBlank(grid)).toBe(true);
    setCell(grid, 3, 2, '#ff0000');
    expect(getCell(grid, 3, 2)).toBe('#ff0000');
    expect(isBlank(grid)).toBe(false);
  });

  it('範囲外への書き込みは無視される', () => {
    const grid = createGrid(8);
    setCell(grid, -1, 0, '#ff0000');
    setCell(grid, 8, 0, '#ff0000');
    expect(isBlank(grid)).toBe(true);
  });
});

describe('floodFill', () => {
  it('同色の連結領域だけを塗りつぶす', () => {
    const grid = createGrid(8);
    // 縦の壁で左右を分ける
    for (let y = 0; y < 8; y += 1) setCell(grid, 4, y, '#000000');
    floodFill(grid, 0, 0, '#00ff00');
    expect(getCell(grid, 3, 7)).toBe('#00ff00');
    expect(getCell(grid, 4, 0)).toBe('#000000');
    expect(getCell(grid, 5, 0)).toBeNull();
  });

  it('同じ色での塗りつぶしは何もしない', () => {
    const grid = createGrid(8);
    floodFill(grid, 0, 0, null);
    expect(isBlank(grid)).toBe(true);
  });
});

describe('resizeGrid', () => {
  it('広げると左上が保たれ、狭めると切り落とされる', () => {
    const grid = createGrid(8);
    setCell(grid, 1, 1, '#ff0000');
    setCell(grid, 7, 7, '#0000ff');
    const bigger = resizeGrid(grid, 16);
    expect(getCell(bigger, 1, 1)).toBe('#ff0000');
    expect(getCell(bigger, 7, 7)).toBe('#0000ff');
    expect(getCell(bigger, 15, 15)).toBeNull();
    const smaller = resizeGrid(bigger, 8);
    expect(getCell(smaller, 1, 1)).toBe('#ff0000');
    expect(smaller.cells).toHaveLength(64);
  });
});

describe('symmetricPoints', () => {
  it('鏡像off では対象マスのみ', () => {
    expect(symmetricPoints(8, 2, 3, false)).toEqual([[2, 3]]);
  });

  it('鏡像on では左右の2点を返す', () => {
    expect(symmetricPoints(8, 1, 3, true)).toEqual([
      [1, 3],
      [6, 3],
    ]);
  });

  it('中央列(偶数サイズに中心はないが鏡像が一致する場合)は1点に畳む', () => {
    // 16マスでは x=7 と x=8 が対。x=7 の鏡像は 8 なので2点
    expect(symmetricPoints(15, 7, 0, true)).toEqual([[7, 0]]); // 奇数サイズの中央
  });
});

describe('countFilled', () => {
  it('塗られたマス数を数える', () => {
    const grid = createGrid(8);
    expect(countFilled(grid)).toBe(0);
    setCell(grid, 0, 0, '#000000');
    setCell(grid, 1, 0, '#000000');
    expect(countFilled(grid)).toBe(2);
  });
});

describe('deserializeGrid', () => {
  it('serializeGridと往復できる', () => {
    const grid = createGrid(16);
    setCell(grid, 0, 0, '#abcdef');
    expect(deserializeGrid(serializeGrid(grid))).toEqual(grid);
  });

  it('壊れたJSON・形の崩れたものはnull', () => {
    expect(deserializeGrid('{')).toBeNull();
    expect(deserializeGrid('[]')).toBeNull();
    expect(deserializeGrid(JSON.stringify({ size: 9, cells: Array(81).fill(null) }))).toBeNull();
    expect(deserializeGrid(JSON.stringify({ size: 8, cells: Array(63).fill(null) }))).toBeNull();
    expect(deserializeGrid(JSON.stringify({ size: 8, cells: Array(64).fill('red') }))).toBeNull();
  });
});

describe('createStore', () => {
  it('保存して読み戻せる', () => {
    const map = new Map<string, string>();
    const store = createStore({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
    });
    expect(store.load()).toBeNull();
    const grid = createGrid(8);
    setCell(grid, 2, 2, '#112233');
    store.save(grid);
    expect(store.load()).toEqual(grid);
  });
});
