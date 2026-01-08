// テーマの選択値とその解決。メディアクエリ依存を持たない純粋関数にして、
// 起動前スクリプトでもアプリ本体でも同じ規則で配色を決められるようにする。

export const THEME_CHOICES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type ResolvedTheme = 'light' | 'dark';

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === 'string' && (THEME_CHOICES as readonly string[]).includes(value);
}

/** 選択値とOSの好みから実際に適用するテーマを決める */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ResolvedTheme {
  if (choice === 'system') return prefersDark ? 'dark' : 'light';
  return choice;
}

/** システム → ライト → ダーク → システム の順で切り替える */
export function nextThemeChoice(choice: ThemeChoice): ThemeChoice {
  const i = THEME_CHOICES.indexOf(choice);
  return THEME_CHOICES[(i + 1) % THEME_CHOICES.length] as ThemeChoice;
}

export const THEME_LABELS: Record<ThemeChoice, string> = {
  system: '端末に合わせる',
  light: 'ライト',
  dark: 'ダーク',
};
