// 道具まわりの設定の永続化。盤面(grid)とは別キーに保存し、復元時は
// 1項目ずつ検証して、壊れた値があっても既定へ落として全体は生かす。

import { isThemeChoice, type ThemeChoice } from './theme';
import { normalizeHex } from './palette';
import type { MergeMode } from './svg';
import type { StorageLike } from './grid';

export const EXPORT_SCALES = [8, 16, 24, 32] as const;
export type ExportScale = (typeof EXPORT_SCALES)[number];

export const DEFAULT_PALETTE = [
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

export interface Settings {
  theme: ThemeChoice;
  palette: string[];
  recent: string[];
  showGrid: boolean;
  mirror: boolean;
  merge: MergeMode;
  exportScale: ExportScale;
}

export function defaultSettings(): Settings {
  return {
    theme: 'system',
    palette: [...DEFAULT_PALETTE],
    recent: [],
    showGrid: true,
    mirror: false,
    merge: 'rect',
    exportScale: 16,
  };
}

function asHexArray(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const hex = normalizeHex(item);
    if (hex === null) return null;
    if (!out.includes(hex)) out.push(hex);
  }
  return out.slice(0, max);
}

const SETTINGS_KEY = 'dotten.settings.v1';

/** 保存済みの設定をマージして読む。無効な項目は既定で補う */
export function loadSettings(storage: StorageLike): Settings {
  const base = defaultSettings();
  const raw = storage.getItem(SETTINGS_KEY);
  if (raw === null) return base;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return base;
  const s = parsed as Record<string, unknown>;
  if (isThemeChoice(s.theme)) base.theme = s.theme;
  const palette = asHexArray(s.palette, 24);
  if (palette && palette.length > 0) base.palette = palette;
  const recent = asHexArray(s.recent, 8);
  if (recent) base.recent = recent;
  if (typeof s.showGrid === 'boolean') base.showGrid = s.showGrid;
  if (typeof s.mirror === 'boolean') base.mirror = s.mirror;
  if (s.merge === 'row' || s.merge === 'rect') base.merge = s.merge;
  if (
    typeof s.exportScale === 'number' &&
    (EXPORT_SCALES as readonly number[]).includes(s.exportScale)
  ) {
    base.exportScale = s.exportScale as ExportScale;
  }
  return base;
}

export function saveSettings(storage: StorageLike, settings: Settings): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
