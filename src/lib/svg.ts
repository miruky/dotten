// 盤面をSVGに書き出す。塗りマスを矩形にまとめてrect数を減らし、viewBoxで
// 大きさに依存しないスケーラブルな出力にする。まとめ方は2通り用意する。
//   row : 同じ行の連続した同色をまとめる(高さ1)
//   rect: さらに上下に揃った同形の帯を1つの矩形に貪欲に結合する

import type { PixelGrid } from './grid';

export type MergeMode = 'row' | 'rect';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

/** 行ごとに同色の連続を見つけてまとめる(高さ1) */
export function horizontalRuns(grid: PixelGrid): Rect[] {
  const runs: Rect[] = [];
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
      runs.push({ x, y, width, height: 1, color });
      x += width;
    }
  }
  return runs;
}

/**
 * 行ランをもとに、x・幅・色が一致する直下の行を貪欲に結合して矩形にする。
 * 各行ランは高々1つの矩形に属し、結果の矩形は元のマスを過不足なく覆う。
 */
export function rectMerge(grid: PixelGrid): Rect[] {
  const size = grid.size;
  // 行ごとに「ランの開始x → ラン」を引けるようにする
  const rowRuns: Array<Map<number, Rect>> = [];
  for (let y = 0; y < size; y += 1) rowRuns.push(new Map());
  for (const run of horizontalRuns(grid)) {
    (rowRuns[run.y] as Map<number, Rect>).set(run.x, run);
  }
  const used: Array<Set<number>> = rowRuns.map(() => new Set<number>());
  const rects: Rect[] = [];
  for (let y = 0; y < size; y += 1) {
    const row = rowRuns[y] as Map<number, Rect>;
    const usedRow = used[y] as Set<number>;
    for (const run of row.values()) {
      if (usedRow.has(run.x)) continue;
      let height = 1;
      while (y + height < size) {
        const below = (rowRuns[y + height] as Map<number, Rect>).get(run.x);
        const belowUsed = used[y + height] as Set<number>;
        if (
          below === undefined ||
          belowUsed.has(run.x) ||
          below.width !== run.width ||
          below.color !== run.color
        ) {
          break;
        }
        belowUsed.add(run.x);
        height += 1;
      }
      rects.push({ x: run.x, y, width: run.width, height, color: run.color });
    }
  }
  return rects;
}

export function mergeCells(grid: PixelGrid, mode: MergeMode = 'rect'): Rect[] {
  return mode === 'rect' ? rectMerge(grid) : horizontalRuns(grid);
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface SvgOptions {
  title?: string;
  merge?: MergeMode;
}

/**
 * SVG文字列にする。1マス=1単位のviewBoxを持ち、widthやheightは付けない。
 * shape-renderingでマスの境界のにじみを防ぐ。
 */
export function gridToSvg(grid: PixelGrid, options: SvgOptions = {}): string {
  const { title = 'dot art', merge = 'rect' } = options;
  const rects = mergeCells(grid, merge)
    .map(
      (r) =>
        `  <rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${r.color}"/>`,
    )
    .join('\n');
  const safeTitle = escapeXml(title);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${grid.size} ${grid.size}" shape-rendering="crispEdges" role="img" aria-label="${safeTitle}">`,
    `  <title>${safeTitle}</title>`,
    rects,
    `</svg>`,
  ]
    .filter((part) => part !== '')
    .join('\n');
}
