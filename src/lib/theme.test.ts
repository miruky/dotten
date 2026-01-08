import { describe, expect, it } from 'vitest';
import { isThemeChoice, nextThemeChoice, resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('systemはOSの好みに従う', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('明示指定はOSの好みを無視する', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('nextThemeChoice', () => {
  it('system → light → dark → system と巡回する', () => {
    expect(nextThemeChoice('system')).toBe('light');
    expect(nextThemeChoice('light')).toBe('dark');
    expect(nextThemeChoice('dark')).toBe('system');
  });
});

describe('isThemeChoice', () => {
  it('正しい値だけ受け入れる', () => {
    expect(isThemeChoice('system')).toBe(true);
    expect(isThemeChoice('dark')).toBe(true);
    expect(isThemeChoice('sepia')).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });
});
