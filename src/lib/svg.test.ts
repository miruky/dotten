import { describe, expect, it } from 'vitest';
import { createGrid, setCell } from './grid';
import { gridToSvg, horizontalRuns, mergeCells, rectMerge } from './svg';

describe('horizontalRuns', () => {
  it('同じ行の連続した同色を高さ1の矩形にまとめる', () => {
    const grid = createGrid(8);
    setCell(grid, 1, 0, '#ff0000');
    setCell(grid, 2, 0, '#ff0000');
    setCell(grid, 3, 0, '#ff0000');
    setCell(grid, 5, 0, '#ff0000');
    expect(horizontalRuns(grid)).toEqual([
      { x: 1, y: 0, width: 3, height: 1, color: '#ff0000' },
      { x: 5, y: 0, width: 1, height: 1, color: '#ff0000' },
    ]);
  });

  it('色が変わるとまとめない', () => {
    const grid = createGrid(8);
    setCell(grid, 0, 0, '#ff0000');
    setCell(grid, 1, 0, '#00ff00');
    expect(horizontalRuns(grid)).toHaveLength(2);
  });

  it('空の盤面は空', () => {
    expect(horizontalRuns(createGrid(8))).toEqual([]);
  });
});

describe('rectMerge', () => {
  it('上下に揃った同形の行ランを1つの矩形に結合する', () => {
    const grid = createGrid(8);
    // 2x3 の塊
    for (let y = 0; y < 3; y += 1) {
      setCell(grid, 1, y, '#123456');
      setCell(grid, 2, y, '#123456');
    }
    expect(rectMerge(grid)).toEqual([{ x: 1, y: 0, width: 2, height: 3, color: '#123456' }]);
  });

  it('幅が揃わない行は結合しない', () => {
    const grid = createGrid(8);
    setCell(grid, 0, 0, '#000000');
    setCell(grid, 1, 0, '#000000');
    setCell(grid, 0, 1, '#000000');
    const rects = rectMerge(grid);
    expect(rects).toHaveLength(2);
    expect(rects).toContainEqual({ x: 0, y: 0, width: 2, height: 1, color: '#000000' });
    expect(rects).toContainEqual({ x: 0, y: 1, width: 1, height: 1, color: '#000000' });
  });

  it('rect結合はrow結合より矩形数が少ない', () => {
    const grid = createGrid(16);
    for (let y = 2; y < 12; y += 1) {
      for (let x = 3; x < 13; x += 1) setCell(grid, x, y, '#7cc278');
    }
    expect(rectMerge(grid)).toHaveLength(1);
    expect(horizontalRuns(grid).length).toBeGreaterThan(rectMerge(grid).length);
  });

  it('元のマスを過不足なく覆う', () => {
    const grid = createGrid(8);
    setCell(grid, 1, 1, '#ff0000');
    setCell(grid, 2, 1, '#ff0000');
    setCell(grid, 1, 2, '#ff0000');
    setCell(grid, 3, 4, '#00ff00');
    let covered = 0;
    for (const r of rectMerge(grid)) covered += r.width * r.height;
    expect(covered).toBe(4);
  });
});

describe('gridToSvg', () => {
  it('viewBoxとcrispEdgesを持ち、widthやheightを付けない', () => {
    const grid = createGrid(16);
    setCell(grid, 0, 0, '#336699');
    const svg = gridToSvg(grid);
    expect(svg).toContain('viewBox="0 0 16 16"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('<rect x="0" y="0" width="1" height="1" fill="#336699"/>');
    expect(svg).not.toMatch(/<svg[^>]* width=/);
  });

  it('題名をエスケープしてtitleに入れる', () => {
    const svg = gridToSvg(createGrid(8), { title: 'A & B <art>' });
    expect(svg).toContain('<title>A &amp; B &lt;art&gt;</title>');
  });

  it('mergeモードでrect数が変わる', () => {
    const grid = createGrid(8);
    for (let y = 0; y < 4; y += 1) {
      setCell(grid, 0, y, '#abcdef');
      setCell(grid, 1, y, '#abcdef');
    }
    expect(mergeCells(grid, 'rect')).toHaveLength(1);
    expect(mergeCells(grid, 'row')).toHaveLength(4);
    expect((gridToSvg(grid, { merge: 'row' }).match(/<rect/g) ?? []).length).toBe(4);
    expect((gridToSvg(grid, { merge: 'rect' }).match(/<rect/g) ?? []).length).toBe(1);
  });
});
