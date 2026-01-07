// ドット絵の盤面。1次元配列で持ち、塗りは#rrggbb、透明はnullで表す。

export interface PixelGrid {
  /** 一辺のマス数 */
  size: number;
  /** 長さ size*size。行優先 */
  cells: (string | null)[];
}

export const GRID_SIZES = [8, 16, 32] as const;

const COLOR_RE = /^#[0-9a-f]{6}$/;

export function createGrid(size: number): PixelGrid {
  return { size, cells: Array<string | null>(size * size).fill(null) };
}

export function getCell(grid: PixelGrid, x: number, y: number): string | null {
  return grid.cells[y * grid.size + x] ?? null;
}

export function setCell(grid: PixelGrid, x: number, y: number, color: string | null): void {
  if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) return;
  grid.cells[y * grid.size + x] = color;
}

/** 同色の連結領域を塗りつぶす(4方向) */
export function floodFill(grid: PixelGrid, x: number, y: number, color: string | null): void {
  if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) return;
  const target = getCell(grid, x, y);
  if (target === color) return;
  const stack: Array<[number, number]> = [[x, y]];
  while (stack.length > 0) {
    const [cx, cy] = stack.pop() as [number, number];
    if (cx < 0 || cy < 0 || cx >= grid.size || cy >= grid.size) continue;
    if (getCell(grid, cx, cy) !== target) continue;
    setCell(grid, cx, cy, color);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}

/**
 * 盤面の大きさを変える。左上を基準に、広げた分は透明、
 * 狭めた分は切り落とす。
 */
export function resizeGrid(grid: PixelGrid, size: number): PixelGrid {
  const next = createGrid(size);
  const keep = Math.min(size, grid.size);
  for (let y = 0; y < keep; y += 1) {
    for (let x = 0; x < keep; x += 1) {
      setCell(next, x, y, getCell(grid, x, y));
    }
  }
  return next;
}

export function isBlank(grid: PixelGrid): boolean {
  return grid.cells.every((c) => c === null);
}

/** JSON文字列から復元する。形が崩れていればnull */
export function deserializeGrid(json: string): PixelGrid | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const g = parsed as Record<string, unknown>;
  if (
    typeof g.size !== 'number' ||
    !GRID_SIZES.includes(g.size as (typeof GRID_SIZES)[number]) ||
    !Array.isArray(g.cells) ||
    g.cells.length !== g.size * g.size ||
    !g.cells.every((c) => c === null || (typeof c === 'string' && COLOR_RE.test(c)))
  ) {
    return null;
  }
  return { size: g.size, cells: g.cells as (string | null)[] };
}

export function serializeGrid(grid: PixelGrid): string {
  return JSON.stringify(grid);
}

export interface GridStore {
  load(): PixelGrid | null;
  save(grid: PixelGrid): void;
}

const STORAGE_KEY = 'dotten.grid.v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createStore(storage: StorageLike): GridStore {
  return {
    load() {
      const raw = storage.getItem(STORAGE_KEY);
      return raw === null ? null : deserializeGrid(raw);
    },
    save(grid) {
      storage.setItem(STORAGE_KEY, serializeGrid(grid));
    },
  };
}
