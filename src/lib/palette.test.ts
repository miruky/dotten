import { describe, expect, it } from 'vitest';
import { normalizeHex, pushRecent } from './palette';

describe('normalizeHex', () => {
  it('6桁を小文字の#rrggbbにする', () => {
    expect(normalizeHex('#AABBCC')).toBe('#aabbcc');
    expect(normalizeHex('aabbcc')).toBe('#aabbcc');
    expect(normalizeHex('  #A1B2C3  ')).toBe('#a1b2c3');
  });

  it('3桁を6桁へ展開する', () => {
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('f0a')).toBe('#ff00aa');
  });

  it('無効な入力はnull', () => {
    expect(normalizeHex('')).toBeNull();
    expect(normalizeHex('#12')).toBeNull();
    expect(normalizeHex('#gggggg')).toBeNull();
    expect(normalizeHex('rgb(0,0,0)')).toBeNull();
  });
});

describe('pushRecent', () => {
  it('先頭へ積み、重複を畳み込む', () => {
    let list = pushRecent([], '#111111');
    list = pushRecent(list, '#222222');
    list = pushRecent(list, '#111111');
    expect(list).toEqual(['#111111', '#222222']);
  });

  it('最大件数で打ち切る', () => {
    let list: string[] = [];
    for (let i = 0; i < 12; i += 1)
      list = pushRecent(list, `#0000${i.toString(16).padStart(2, '0')}`, 8);
    expect(list).toHaveLength(8);
    expect(list[0]).toBe('#00000b');
  });
});
