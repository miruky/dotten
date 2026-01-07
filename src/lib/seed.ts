// 初回起動時に入れる見本のドット絵(16×16の双葉)。
// 一度でも保存があれば使わない。

import { createGrid, setCell, type PixelGrid } from './grid';

const GREEN = '#4a7c3a';
const LIGHT = '#7cc278';
const SOIL = '#8c7a66';

export function seedGrid(): PixelGrid {
  const grid = createGrid(16);
  const paint = (color: string, points: Array<[number, number]>): void => {
    for (const [x, y] of points) setCell(grid, x, y, color);
  };
  // 茎
  paint(GREEN, [
    [8, 9],
    [8, 10],
    [8, 11],
    [8, 12],
  ]);
  // 左の葉
  paint(LIGHT, [
    [5, 6],
    [4, 7],
    [5, 7],
    [6, 7],
    [5, 8],
    [6, 8],
    [7, 8],
    [7, 9],
  ]);
  // 右の葉
  paint(GREEN, [
    [11, 5],
    [10, 6],
    [11, 6],
    [12, 6],
    [9, 7],
    [10, 7],
    [11, 7],
    [9, 8],
    [10, 8],
    [8, 8],
  ]);
  // 土
  paint(SOIL, [
    [5, 13],
    [6, 13],
    [7, 13],
    [8, 13],
    [9, 13],
    [10, 13],
    [6, 14],
    [7, 14],
    [8, 14],
    [9, 14],
  ]);
  return grid;
}
