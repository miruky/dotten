import { describe, expect, it } from 'vitest';
import { createGrid, setCell } from './grid';
import { gridToSvg, horizontalRuns } from './svg';

describe('horizontalRuns', () => {
  it('同じ行の連続した同色を1つにまとめる', () => {
    const grid = createGrid(8);
    setCell(grid, 1, 0, '#ff0000');
    setCell(grid, 2, 0, '#ff0000');
    setCell(grid, 3, 0, '#ff0000');
    setCell(grid, 5, 0, '#ff0000');
    expect(horizontalRuns(grid)).toEqual([
      { x: 1, y: 0, width: 3, color: '#ff0000' },
      { x: 5, y: 0, width: 1, color: '#ff0000' },
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
    const svg = gridToSvg(createGrid(8), 'A & B <art>');
    expect(svg).toContain('<title>A &amp; B &lt;art&gt;</title>');
  });
});
