// 盤面をSVGに書き出す。同じ行の連続した同色マスを1つのrectにまとめ、
// viewBoxで大きさに依存しないスケーラブルな出力にする。

import type { PixelGrid } from './grid';

interface Run {
  x: number;
  y: number;
  width: number;
  color: string;
}

/** 行ごとに同色の連続を見つけてまとめる */
export function horizontalRuns(grid: PixelGrid): Run[] {
  const runs: Run[] = [];
  for (let y = 0; y < grid.size; y += 1) {
    let x = 0;
    while (x < grid.size) {
      const color = grid.cells[y * grid.size + x] ?? null;
      if (color === null) {
        x += 1;
        continue;
      }
      let width = 1;
      while (x + width < grid.size && grid.cells[y * grid.size + x + width] === color) {
        width += 1;
      }
      runs.push({ x, y, width, color });
      x += width;
    }
  }
  return runs;
}

/**
 * SVG文字列にする。1マス=1単位のviewBoxを持ち、widthやheightは付けない。
 * shape-renderingでマスの境界のにじみを防ぐ。
 */
export function gridToSvg(grid: PixelGrid, title = 'dot art'): string {
  const rects = horizontalRuns(grid)
    .map((r) => `  <rect x="${r.x}" y="${r.y}" width="${r.width}" height="1" fill="${r.color}"/>`)
    .join('\n');
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${grid.size} ${grid.size}" shape-rendering="crispEdges" role="img" aria-label="${safeTitle}">`,
    `  <title>${safeTitle}</title>`,
    rects,
    `</svg>`,
  ]
    .filter((part) => part !== '')
    .join('\n');
}
