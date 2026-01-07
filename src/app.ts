// 画面の描画。盤面のDOMはツール操作のたびに作り直さず、塗ったマスの
// 背景色だけを差し替える。描画ストロークの開始時に取り消し用の控えを取る。

import {
  createGrid,
  floodFill,
  getCell,
  GRID_SIZES,
  isBlank,
  resizeGrid,
  setCell,
  type GridStore,
  type PixelGrid,
} from './lib/grid';
import { gridToSvg, horizontalRuns } from './lib/svg';
import { icons } from './icons';

type Tool = 'pen' | 'eraser' | 'fill';

const TOOL_LABELS: Record<Tool, string> = {
  pen: 'ペン',
  eraser: '消しゴム',
  fill: '塗りつぶし',
};

/** 既定のパレット。低彩度寄りの14色 */
const PALETTE = [
  '#1a1a1a',
  '#ffffff',
  '#b9551c',
  '#e8a33d',
  '#f2d35c',
  '#4a7c3a',
  '#7cc278',
  '#2f6690',
  '#7fb3d8',
  '#6b4f9e',
  '#b0567a',
  '#a93226',
  '#8c7a66',
  '#d9cdbf',
];

const MAX_UNDO = 50;

export interface AppDeps {
  root: HTMLElement;
  store: GridStore;
  initialGrid: PixelGrid;
}

export function createApp({ root, store, initialGrid }: AppDeps): void {
  let grid = initialGrid;
  let tool: Tool = 'pen';
  let color = PALETTE[0] ?? '#1a1a1a';
  let painting = false;
  let confirmingClear = false;
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;
  let copied = false;
  const undoStack: PixelGrid[] = [];
  const redoStack: PixelGrid[] = [];

  const snapshot = (g: PixelGrid): PixelGrid => ({ size: g.size, cells: [...g.cells] });

  function pushUndo(): void {
    undoStack.push(snapshot(grid));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
  }

  function save(): void {
    store.save(grid);
  }

  // ---- 盤面DOMの差分更新 ----

  function cellEl(i: number): HTMLElement | null {
    return root.querySelector<HTMLElement>(`[data-cell="${i}"]`);
  }

  function paintCellEl(i: number): void {
    const el = cellEl(i);
    if (!el) return;
    const c = grid.cells[i] ?? null;
    if (c === null) {
      el.style.removeProperty('background-color');
      el.classList.remove('filled');
    } else {
      el.style.backgroundColor = c;
      el.classList.add('filled');
    }
  }

  function repaintAll(): void {
    for (let i = 0; i < grid.cells.length; i += 1) paintCellEl(i);
    updatePreview();
    updateUndoButtons();
  }

  function updatePreview(): void {
    const preview = root.querySelector<HTMLElement>('#preview');
    if (preview) {
      preview.innerHTML = isBlank(grid)
        ? '<p class="hint">まだ何も描かれていません。</p>'
        : gridToSvg(grid, 'プレビュー');
    }
    const stat = root.querySelector<HTMLElement>('#svg-stat');
    if (stat) {
      const runs = horizontalRuns(grid).length;
      stat.textContent = `rect ${runs}個 / 塗り ${grid.cells.filter((c) => c !== null).length}マス`;
    }
  }

  function updateUndoButtons(): void {
    const undoBtn = root.querySelector<HTMLButtonElement>('#undo');
    const redoBtn = root.querySelector<HTMLButtonElement>('#redo');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  }

  // ---- 描画操作 ----

  function cellIndexFromEvent(e: PointerEvent): number | null {
    const canvas = root.querySelector<HTMLElement>('#canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * grid.size);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * grid.size);
    if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) return null;
    return y * grid.size + x;
  }

  function applyAt(i: number): void {
    const x = i % grid.size;
    const y = Math.floor(i / grid.size);
    if (tool === 'fill') {
      floodFill(grid, x, y, color);
      repaintAll();
      return;
    }
    const next = tool === 'pen' ? color : null;
    if (getCell(grid, x, y) === next) return;
    setCell(grid, x, y, next);
    paintCellEl(i);
  }

  function bindCanvas(): void {
    const canvas = root.querySelector<HTMLElement>('#canvas');
    if (!canvas) return;
    canvas.addEventListener('pointerdown', (e) => {
      const i = cellIndexFromEvent(e);
      if (i === null) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      pushUndo();
      painting = tool !== 'fill';
      applyAt(i);
      updateUndoButtons();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!painting) return;
      const i = cellIndexFromEvent(e);
      if (i !== null) applyAt(i);
    });
    const finish = (): void => {
      if (!painting && tool !== 'fill') return;
      painting = false;
      save();
      updatePreview();
    };
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
  }

  // ---- 画面 ----

  function toolbarHtml(): string {
    const tools = (Object.keys(TOOL_LABELS) as Tool[])
      .map(
        (t) => `
          <button type="button" class="tool ${t === tool ? 'active' : ''}" data-tool="${t}"
            aria-pressed="${t === tool}">${icons[t]}<span>${TOOL_LABELS[t]}</span></button>`,
      )
      .join('');
    const swatches = PALETTE.map(
      (c) => `
        <button type="button" class="swatch ${c === color ? 'active' : ''}" data-color="${c}"
          style="--swatch:${c}" aria-label="色 ${c}" aria-pressed="${c === color}"></button>`,
    ).join('');
    const sizes = GRID_SIZES.map(
      (s) => `<option value="${s}" ${s === grid.size ? 'selected' : ''}>${s}×${s}</option>`,
    ).join('');
    return `
      <div class="toolbar">
        <div class="tool-group" role="group" aria-label="道具">${tools}</div>
        <div class="palette" role="group" aria-label="パレット">
          ${swatches}
          <label class="custom-color" title="自由な色">
            <input type="color" id="custom-color" value="${color}" aria-label="自由な色を選ぶ" />
          </label>
        </div>
        <div class="tool-group">
          <button type="button" class="tool" id="undo" disabled aria-label="取り消す">${icons.undo}<span>取り消す</span></button>
          <button type="button" class="tool" id="redo" disabled aria-label="やり直す">${icons.redo}<span>やり直す</span></button>
        </div>
        <select id="size" aria-label="盤面の大きさ">${sizes}</select>
        <button type="button" class="tool danger ${confirmingClear ? 'confirming' : ''}" id="clear">
          ${icons.trash}<span>${confirmingClear ? 'もう一度で全消去' : '全消去'}</span></button>
      </div>`;
  }

  function canvasHtml(): string {
    const cells = grid.cells
      .map(
        (c, i) =>
          `<div data-cell="${i}" class="${c === null ? '' : 'filled'}"${c === null ? '' : ` style="background-color:${c}"`}></div>`,
      )
      .join('');
    return `
      <div class="canvas-wrap">
        <div id="canvas" class="canvas" style="--n:${grid.size}" role="img"
          aria-label="${grid.size}×${grid.size}のドット絵キャンバス">${cells}</div>
      </div>`;
  }

  function render(): void {
    root.innerHTML = `
      <header class="site-header">
        <div class="site-header-inner">
          <span class="brand">${icons.logo}<span>dotten</span></span>
          <div class="export-actions">
            <button type="button" class="button" id="copy-svg">
              ${copied ? icons.check : icons.copy}<span>${copied ? 'コピーしました' : 'SVGをコピー'}</span></button>
            <button type="button" class="button primary" id="download-svg">
              ${icons.download}<span>SVGを保存</span></button>
          </div>
        </div>
      </header>
      <main class="site-main">
        ${toolbarHtml()}
        <div class="workspace">
          ${canvasHtml()}
          <aside class="side">
            <h2>書き出しプレビュー</h2>
            <div id="preview" class="preview"></div>
            <p id="svg-stat" class="hint"></p>
            <p class="hint">同じ行の連続した同色は1つのrectにまとめて書き出します。</p>
          </aside>
        </div>
      </main>
      <footer class="site-footer">
        <p>dotten — ドット絵エディタ。作品はこの端末のブラウザにだけ保存されます。</p>
      </footer>`;
    bindEvents();
    bindCanvas();
    updatePreview();
    updateUndoButtons();
  }

  function bindEvents(): void {
    for (const el of root.querySelectorAll<HTMLElement>('[data-tool]')) {
      el.addEventListener('click', () => {
        tool = el.dataset.tool as Tool;
        render();
      });
    }
    for (const el of root.querySelectorAll<HTMLElement>('[data-color]')) {
      el.addEventListener('click', () => {
        color = el.dataset.color ?? color;
        if (tool === 'eraser') tool = 'pen';
        render();
      });
    }
    root.querySelector<HTMLInputElement>('#custom-color')?.addEventListener('change', (e) => {
      color = (e.target as HTMLInputElement).value;
      if (tool === 'eraser') tool = 'pen';
      render();
    });

    root.querySelector('#undo')?.addEventListener('click', () => {
      const prev = undoStack.pop();
      if (!prev) return;
      redoStack.push(snapshot(grid));
      grid = prev;
      save();
      render();
    });
    root.querySelector('#redo')?.addEventListener('click', () => {
      const next = redoStack.pop();
      if (!next) return;
      undoStack.push(snapshot(grid));
      grid = next;
      save();
      render();
    });

    root.querySelector<HTMLSelectElement>('#size')?.addEventListener('change', (e) => {
      const size = Number((e.target as HTMLSelectElement).value);
      pushUndo();
      grid = resizeGrid(grid, size);
      save();
      render();
    });

    root.querySelector('#clear')?.addEventListener('click', () => {
      if (!confirmingClear) {
        confirmingClear = true;
        if (confirmTimer) clearTimeout(confirmTimer);
        confirmTimer = setTimeout(() => {
          confirmingClear = false;
          render();
        }, 4000);
        render();
        return;
      }
      confirmingClear = false;
      if (confirmTimer) clearTimeout(confirmTimer);
      pushUndo();
      grid = createGrid(grid.size);
      save();
      render();
    });

    root.querySelector('#copy-svg')?.addEventListener('click', () => {
      void navigator.clipboard.writeText(gridToSvg(grid, 'dot art')).then(() => {
        copied = true;
        render();
        setTimeout(() => {
          copied = false;
          render();
        }, 2000);
      });
    });
    root.querySelector('#download-svg')?.addEventListener('click', () => {
      const url = URL.createObjectURL(
        new Blob([gridToSvg(grid, 'dot art')], { type: 'image/svg+xml' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dotten.svg';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  render();
}
