import { describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, saveSettings } from './settings';
import type { StorageLike } from './grid';

function memStorage(initial?: string): StorageLike & { value: string | null } {
  let value: string | null = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_k, v) => void (value = v),
    get value() {
      return value;
    },
  };
}

describe('settings', () => {
  it('未保存なら既定を返す', () => {
    expect(loadSettings(memStorage())).toEqual(defaultSettings());
  });

  it('保存して読み戻せる', () => {
    const store = memStorage();
    const s = defaultSettings();
    s.theme = 'dark';
    s.showGrid = false;
    s.merge = 'row';
    s.exportScale = 32;
    s.recent = ['#112233'];
    saveSettings(store, s);
    expect(loadSettings(store)).toEqual(s);
  });

  it('壊れた項目は既定で補い、有効な項目は生かす', () => {
    const store = memStorage(
      JSON.stringify({
        theme: 'banana',
        showGrid: 'yes',
        merge: 'rect',
        exportScale: 999,
        palette: ['#abc', 'notacolor'],
        recent: ['#000000'],
      }),
    );
    const loaded = loadSettings(store);
    expect(loaded.theme).toBe('system'); // 無効→既定
    expect(loaded.showGrid).toBe(true); // 無効→既定
    expect(loaded.merge).toBe('rect'); // 有効
    expect(loaded.exportScale).toBe(16); // 無効→既定
    expect(loaded.palette).toEqual(defaultSettings().palette); // 配列に無効値→既定
    expect(loaded.recent).toEqual(['#000000']); // 有効
  });

  it('壊れたJSONは既定', () => {
    expect(loadSettings(memStorage('{not json'))).toEqual(defaultSettings());
  });
});
