// 色入力の正規化と「最近使った色」の管理。どちらもUIから切り離した純粋関数で、
// 入力は寛容に受けつつ保存形は厳密な #rrggbb に揃える。

const SHORT_RE = /^#?([0-9a-fA-F]{3})$/;
const LONG_RE = /^#?([0-9a-fA-F]{6})$/;

/** '#abc' / 'aabbcc' / '#AABBCC' などを小文字の #rrggbb に。無効なら null */
export function normalizeHex(input: string): string | null {
  const value = input.trim();
  const short = SHORT_RE.exec(value);
  if (short) {
    const s = (short[1] as string).toLowerCase();
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
  }
  const long = LONG_RE.exec(value);
  if (long) return `#${(long[1] as string).toLowerCase()}`;
  return null;
}

/** 直近に使った色を先頭へ。重複は畳み込み、最大 max 件で打ち切る */
export function pushRecent(list: readonly string[], color: string, max = 8): string[] {
  const next = [color, ...list.filter((c) => c !== color)];
  return next.slice(0, max);
}
