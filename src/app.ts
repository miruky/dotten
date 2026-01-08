// 画面の描画とイベント処理。盤面のDOMはツール操作のたびに作り直さず、塗った
// マスの背景色だけを差し替える。描画ストロークの開始時に取り消し用の控えを取る。

import {
  countFilled,
  createGrid,
  floodFill,
  getCell,
  GRID_SIZES,
  isBlank,
  resizeGrid,
  setCell,
  symmetricPoints,
  type GridStore,
  type PixelGrid,
  type StorageLike,
} from './lib/grid';
import { gridToSvg, mergeCells, type MergeMode } from './lib/svg';
import { encodeGrid } from './lib/encode';
import { normalizeHex, pushRecent } from './lib/palette';
import { EXPORT_SCALES, saveSettings, type ExportScale, type Settings } from './lib/settings';
import { nextThemeChoice, resolveTheme, THEME_LABELS, type ThemeChoice } from './lib/theme';
import { icons } from './icons';

type Tool = 'pen' | 'eraser' | 'fill' | 'eyedropper';

const TOOL_LABELS: Record<Tool, string> = {
  pen: 'ペン',
  eraser: '消しゴム',
  fill: '塗りつぶし',
  eyedropper: 'スポイト',
};

const TOOL_KEYS: Record<string, Tool> = { p: 'pen', e: 'eraser', f: 'fill', i: 'eyedropper' };

const THEME_ICON: Record<ThemeChoice, string> = {
  system: icons.system,
  light: icons.sun,
  dark: icons.moon,
};

const MAX_UNDO: number = 60;

export interface AppDeps {
  root: HTMLElement;
  store: GridStore;
  settingsStorage: StorageLike;
  initialGrid: PixelGrid;
  initialSettings: Settings;
}

export function createApp({
  root,
  store,
  settingsStorage,
  initialGrid,
  initialSettings,
}: AppDeps): void {
  let grid = initialGrid;
  const settings = initialSettings;
  let tool: Tool = 'pen';
  let color = settings.palette[0] ?? '#1a1a1a';
  let painting = false;
  let confirmingClear = false;
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;
  let flash: { id: string; until: number } | null = null;
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

  function persistSettings(): void {
    saveSettings(settingsStorage, settings);
  }

  // ---- テーマ ----

  function prefersDark(): boolean {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }

  function applyTheme(): void {
    document.documentElement.dataset.theme = resolveTheme(settings.theme, prefersDark());
  }

  // ---- 盤面DOMの差分更新 ----

  function paintCellEl(i: number): void {
    const el = root.querySelector<HTMLElement>(`[data-cell="${i}"]`);
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
        ? '<p class="empty">まだ何も描かれていません</p>'
        : gridToSvg(grid, { title: 'プレビュー', merge: settings.merge });
    }
    const rectEl = root.querySelector<HTMLElement>('#stat-rect');
    const cellEl = root.querySelector<HTMLElement>('#stat-cell');
    if (rectEl) rectEl.textContent = String(mergeCells(grid, settings.merge).length);
    if (cellEl) cellEl.textContent = String(countFilled(grid));
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

  function setColor(next: string, remember: boolean): void {
    color = next;
    if (remember) {
      settings.recent = pushRecent(settings.recent, next);
      persistSettings();
    }
  }

  /** 描画系ツール(ペン・消しゴム)を1マスへ適用。鏡像も同時に塗る */
  function paintAt(x: number, y: number): boolean {
    const next = tool === 'eraser' ? null : color;
    let changed = false;
    for (const [px, py] of symmetricPoints(grid.size, x, y, settings.mirror)) {
      if (getCell(grid, px, py) === next) continue;
      setCell(grid, px, py, next);
      paintCellEl(py * grid.size + px);
      changed = true;
    }
    return changed;
  }

  function applyAt(i: number): void {
    const x = i % grid.size;
    const y = Math.floor(i / grid.size);
    if (tool === 'eyedropper') {
      const picked = getCell(grid, x, y);
      if (picked !== null) {
        setColor(picked, true);
        tool = 'pen';
        render();
      }
      return;
    }
    if (tool === 'fill') {
      floodFill(grid, x, y, color);
      repaintAll();
      return;
    }
    paintAt(x, y);
  }

  function bindCanvas(): void {
    const canvas = root.querySelector<HTMLElement>('#canvas');
    if (!canvas) return;
    canvas.addEventListener('pointerdown', (e) => {
      const i = cellIndexFromEvent(e);
      if (i === null) return;
      e.preventDefault();
      if (tool === 'eyedropper') {
        applyAt(i);
        return;
      }
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

  // ---- 書き出し ----

  function download(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function flashButton(id: string): void {
    flash = { id, until: Date.now() + 1600 };
    render();
    setTimeout(() => {
      if (flash && flash.until <= Date.now()) {
        flash = null;
        render();
      }
    }, 1700);
  }

  async function copyText(text: string, id: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(text);
      flashButton(id);
    } catch {
      // クリップボードが使えない環境では何もしない
    }
  }

  function exportSvg(): void {
    const svg = gridToSvg(grid, { title: 'dot art', merge: settings.merge });
    download(new Blob([svg], { type: 'image/svg+xml' }), 'dotten.svg');
  }

  function exportPng(scale: ExportScale): void {
    const canvas = document.createElement('canvas');
    canvas.width = grid.size * scale;
    canvas.height = grid.size * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    for (const r of mergeCells(grid, 'rect')) {
      ctx.fillStyle = r.color;
      ctx.fillRect(r.x * scale, r.y * scale, r.width * scale, r.height * scale);
    }
    canvas.toBlob((blob) => {
      if (blob) download(blob, `dotten@${scale}x.png`);
    }, 'image/png');
  }

  function shareUrl(): string {
    return `${location.origin}${location.pathname}#g=${encodeGrid(grid)}`;
  }

  // ---- 画面 ----

  function toolButtonsHtml(): string {
    return (Object.keys(TOOL_LABELS) as Tool[])
      .map(
        (t) => `
          <button type="button" class="seg ${t === tool ? 'active' : ''}" data-tool="${t}"
            aria-pressed="${t === tool}" title="${TOOL_LABELS[t]}">${icons[t]}<span>${TOOL_LABELS[t]}</span></button>`,
      )
      .join('');
  }

  function swatchesHtml(): string {
    return settings.palette
      .map(
        (c, n) => `
        <button type="button" class="swatch ${c === color ? 'active' : ''}" data-color="${c}"
          style="--swatch:${c}" aria-label="色 ${c}${n < 10 ? `(${(n + 1) % 10})` : ''}"
          aria-pressed="${c === color}"></button>`,
      )
      .join('');
  }

  function recentHtml(): string {
    if (settings.recent.length === 0) return '';
    const chips = settings.recent
      .map(
        (c) => `
        <button type="button" class="swatch small ${c === color ? 'active' : ''}" data-color="${c}"
          style="--swatch:${c}" aria-label="最近使った色 ${c}" aria-pressed="${c === color}"></button>`,
      )
      .join('');
    return `
      <div class="recent">
        <span class="kicker">最近の色</span>
        <div class="swatch-row">${chips}</div>
      </div>`;
  }

  function toolbarHtml(): string {
    const sizes = GRID_SIZES.map(
      (s) => `<option value="${s}" ${s === grid.size ? 'selected' : ''}>${s} × ${s}</option>`,
    ).join('');
    const inPalette = settings.palette.includes(color);
    return `
      <div class="toolbar">
        <div class="seg-group" role="group" aria-label="道具">${toolButtonsHtml()}</div>
        <div class="seg-group" role="group" aria-label="描画オプション">
          <button type="button" class="seg ${settings.mirror ? 'active' : ''}" id="mirror"
            aria-pressed="${settings.mirror}" title="左右対称(m)">${icons.mirror}<span>対称</span></button>
          <button type="button" class="seg ${settings.showGrid ? 'active' : ''}" id="toggle-grid"
            aria-pressed="${settings.showGrid}" title="格子の表示(g)">${icons.grid}<span>格子</span></button>
        </div>
        <div class="seg-group">
          <button type="button" class="seg" id="undo" disabled title="取り消す">${icons.undo}<span>取り消す</span></button>
          <button type="button" class="seg" id="redo" disabled title="やり直す">${icons.redo}<span>やり直す</span></button>
        </div>
        <label class="select-field">
          <span class="kicker">大きさ</span>
          <select id="size" aria-label="盤面の大きさ">${sizes}</select>
        </label>
        <button type="button" class="seg danger ${confirmingClear ? 'confirming' : ''}" id="clear" title="全消去">
          ${icons.trash}<span>${confirmingClear ? 'もう一度で消去' : '全消去'}</span></button>
      </div>
      <div class="palette-bar">
        <div class="palette" role="group" aria-label="パレット">${swatchesHtml()}</div>
        <div class="palette-tools">
          <label class="custom-color" title="自由な色">
            ${icons.eyedropperPlus}
            <input type="color" id="custom-color" value="${color}" aria-label="自由な色を選ぶ" />
          </label>
          <button type="button" class="ghost" id="add-swatch" ${inPalette ? 'disabled' : ''}
            title="この色をパレットに追加">${icons.plus}<span>追加</span></button>
        </div>
      </div>
      ${recentHtml()}`;
  }

  function canvasHtml(): string {
    const cells = grid.cells
      .map(
        (c, i) =>
          `<div data-cell="${i}" class="${c === null ? '' : 'filled'}"${c === null ? '' : ` style="background-color:${c}"`}></div>`,
      )
      .join('');
    const cls = ['canvas', settings.showGrid ? 'grid-on' : '', settings.mirror ? 'mirror-on' : '']
      .filter(Boolean)
      .join(' ');
    return `
      <div class="canvas-stage">
        <div id="canvas" class="${cls}" style="--n:${grid.size}" role="img"
          aria-label="${grid.size}×${grid.size}のドット絵キャンバス">${cells}</div>
      </div>`;
  }

  function sidebarHtml(): string {
    const mergeBtn = (mode: MergeMode, label: string, hint: string): string => `
      <button type="button" class="pill ${settings.merge === mode ? 'active' : ''}" data-merge="${mode}"
        aria-pressed="${settings.merge === mode}" title="${hint}">${label}</button>`;
    const scales = EXPORT_SCALES.map(
      (s) => `<option value="${s}" ${s === settings.exportScale ? 'selected' : ''}>${s}倍</option>`,
    ).join('');
    const fl = (id: string, ok: string, base: string): string => (flash?.id === id ? ok : base);
    return `
      <aside class="side">
        <section class="panel">
          <header class="panel-head">
            <span class="kicker">書き出し</span>
            <div class="merge-toggle" role="group" aria-label="まとめ方">
              ${mergeBtn('rect', '矩形', '上下も結合してrectを最小化')}
              ${mergeBtn('row', '行', '同じ行だけをまとめる')}
            </div>
          </header>
          <div id="preview" class="preview"></div>
          <dl class="stats">
            <div><dt>rect</dt><dd id="stat-rect" class="num">0</dd></div>
            <div><dt>塗りマス</dt><dd id="stat-cell" class="num">0</dd></div>
          </dl>
          <div class="export-grid">
            <button type="button" class="button" id="copy-svg">
              ${flash?.id === 'copy-svg' ? icons.check : icons.copy}<span>${fl('copy-svg', 'コピー済み', 'SVGをコピー')}</span></button>
            <button type="button" class="button" id="save-svg">${icons.download}<span>SVGを保存</span></button>
            <label class="select-field inline">
              <span class="kicker">PNG倍率</span>
              <select id="png-scale" aria-label="PNGの倍率">${scales}</select>
            </label>
            <button type="button" class="button" id="save-png">${icons.image}<span>PNGを保存</span></button>
            <button type="button" class="button wide" id="share">
              ${flash?.id === 'share' ? icons.check : icons.link}<span>${fl('share', 'リンクをコピー済み', '共有リンクをコピー')}</span></button>
          </div>
        </section>
        <section class="panel notes">
          <span class="kicker">使い方のヒント</span>
          <p>同じ行の連続した同色は1つの<code>rect</code>にまとめ、矩形モードではさらに上下に揃った帯を結合してSVGを軽くします。</p>
          <p>キーボード: <kbd>P</kbd> ペン / <kbd>E</kbd> 消しゴム / <kbd>F</kbd> 塗りつぶし / <kbd>I</kbd> スポイト / <kbd>M</kbd> 対称 / <kbd>Ctrl</kbd>+<kbd>Z</kbd> 取り消し。</p>
        </section>
      </aside>`;
  }

  function render(): void {
    root.innerHTML = `
      <header class="site-header">
        <div class="bar">
          <a class="brand" href="./" aria-label="dotten">
            ${icons.logo}<span class="wordmark">dotten</span>
          </a>
          <p class="tagline">ドット絵を描いて、軽いSVGで持ち出す</p>
          <button type="button" class="theme-toggle" id="theme" title="テーマ(t)"
            aria-label="テーマ: ${THEME_LABELS[settings.theme]}">${THEME_ICON[settings.theme]}<span>${THEME_LABELS[settings.theme]}</span></button>
        </div>
      </header>
      <main class="site-main">
        ${toolbarHtml()}
        <div class="workspace">
          ${canvasHtml()}
          ${sidebarHtml()}
        </div>
      </main>
      <footer class="site-footer">
        <div class="bar">
          <span>dotten</span>
          <span>作品はこの端末のブラウザにだけ保存されます</span>
        </div>
      </footer>`;
    bindEvents();
    bindCanvas();
    updatePreview();
    updateUndoButtons();
  }

  function undo(): void {
    const prev = undoStack.pop();
    if (!prev) return;
    redoStack.push(snapshot(grid));
    grid = prev;
    save();
    render();
  }

  function redo(): void {
    const next = redoStack.pop();
    if (!next) return;
    undoStack.push(snapshot(grid));
    grid = next;
    save();
    render();
  }

  function changeSize(size: number): void {
    if (size === grid.size) return;
    pushUndo();
    grid = resizeGrid(grid, size);
    save();
    render();
  }

  function clearBoard(): void {
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
        setColor(el.dataset.color ?? color, false);
        if (tool === 'eraser' || tool === 'eyedropper') tool = 'pen';
        render();
      });
    }
    for (const el of root.querySelectorAll<HTMLElement>('[data-merge]')) {
      el.addEventListener('click', () => {
        settings.merge = el.dataset.merge as MergeMode;
        persistSettings();
        render();
      });
    }
    root.querySelector<HTMLInputElement>('#custom-color')?.addEventListener('input', (e) => {
      const hex = normalizeHex((e.target as HTMLInputElement).value);
      if (hex) setColor(hex, true);
      if (tool === 'eraser' || tool === 'eyedropper') tool = 'pen';
      render();
    });
    root.querySelector('#add-swatch')?.addEventListener('click', () => {
      if (!settings.palette.includes(color)) {
        settings.palette = [...settings.palette, color].slice(0, 24);
        persistSettings();
        render();
      }
    });
    root.querySelector('#mirror')?.addEventListener('click', () => {
      settings.mirror = !settings.mirror;
      persistSettings();
      render();
    });
    root.querySelector('#toggle-grid')?.addEventListener('click', () => {
      settings.showGrid = !settings.showGrid;
      persistSettings();
      render();
    });
    root.querySelector('#undo')?.addEventListener('click', undo);
    root.querySelector('#redo')?.addEventListener('click', redo);
    root.querySelector<HTMLSelectElement>('#size')?.addEventListener('change', (e) => {
      changeSize(Number((e.target as HTMLSelectElement).value));
    });
    root.querySelector('#clear')?.addEventListener('click', clearBoard);

    root.querySelector('#copy-svg')?.addEventListener('click', () => {
      void copyText(gridToSvg(grid, { title: 'dot art', merge: settings.merge }), 'copy-svg');
    });
    root.querySelector('#save-svg')?.addEventListener('click', exportSvg);
    root
      .querySelector('#save-png')
      ?.addEventListener('click', () => exportPng(settings.exportScale));
    root.querySelector<HTMLSelectElement>('#png-scale')?.addEventListener('change', (e) => {
      settings.exportScale = Number((e.target as HTMLSelectElement).value) as ExportScale;
      persistSettings();
    });
    root.querySelector('#share')?.addEventListener('click', () => {
      void copyText(shareUrl(), 'share');
    });

    root.querySelector('#theme')?.addEventListener('click', () => {
      settings.theme = nextThemeChoice(settings.theme);
      persistSettings();
      applyTheme();
      render();
    });
  }

  function onKeydown(e: KeyboardEvent): void {
    const t = e.target;
    if (
      t instanceof HTMLElement &&
      (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)
    ) {
      return;
    }
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (TOOL_KEYS[key]) {
      tool = TOOL_KEYS[key] as Tool;
      render();
      return;
    }
    if (key === 'm') {
      settings.mirror = !settings.mirror;
      persistSettings();
      render();
      return;
    }
    if (key === 'g') {
      settings.showGrid = !settings.showGrid;
      persistSettings();
      render();
      return;
    }
    if (key === 't') {
      settings.theme = nextThemeChoice(settings.theme);
      persistSettings();
      applyTheme();
      render();
      return;
    }
    if (key === '[' || key === ']') {
      const idx = GRID_SIZES.indexOf(grid.size as (typeof GRID_SIZES)[number]);
      const nextIdx = key === '[' ? idx - 1 : idx + 1;
      const nextSize = GRID_SIZES[nextIdx];
      if (nextSize) changeSize(nextSize);
      return;
    }
    if (/^[0-9]$/.test(key)) {
      const idx = key === '0' ? 9 : Number(key) - 1;
      const swatch = settings.palette[idx];
      if (swatch) {
        setColor(swatch, false);
        if (tool === 'eraser' || tool === 'eyedropper') tool = 'pen';
        render();
      }
    }
  }

  // ---- 起動 ----

  document.addEventListener('keydown', onKeydown);
  if (typeof window.matchMedia === 'function') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (settings.theme === 'system') applyTheme();
    });
  }
  applyTheme();
  render();
}
