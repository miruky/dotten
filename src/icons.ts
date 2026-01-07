// UIで使う線画アイコン。24pxグリッド・stroke=currentColorで統一し、
// 隣に必ずテキストラベルを置く前提ですべて装飾(aria-hidden)とする。

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  logo: svg(
    '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/>' +
      '<path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" stroke-width="1.2"/>' +
      '<rect x="9.2" y="9.2" width="5.6" height="5.6" fill="currentColor" stroke="none"/>',
  ),
  pen: svg('<path d="m16.9 3.8 3.3 3.3L8.6 18.7 4 20l1.3-4.6z"/><path d="m14.5 6.2 3.3 3.3"/>'),
  eraser: svg(
    '<path d="m9 19-4.5-4.5a1.5 1.5 0 0 1 0-2.1l8-8a1.5 1.5 0 0 1 2.1 0l4.9 4.9a1.5 1.5 0 0 1 0 2.1L12 19z"/>' +
      '<path d="M9 19h11"/><path d="m8.5 8.5 7 7"/>',
  ),
  fill: svg(
    '<path d="m10 2.5 8.5 8.5a1.5 1.5 0 0 1 0 2.1l-5.4 5.4a1.5 1.5 0 0 1-2.1 0L4.5 12a1.5 1.5 0 0 1 0-2.1L10 4.4"/>' +
      '<path d="M4.8 12.6h12.9"/>' +
      '<path d="M20.5 16.5c-.9 1.2-1.5 2.2-1.5 3a1.5 1.5 0 0 0 3 0c0-.8-.6-1.8-1.5-3z"/>',
  ),
  undo: svg('<path d="M4 10h10a5 5 0 0 1 0 10h-3"/><path d="m8 6-4 4 4 4"/>'),
  redo: svg('<path d="M20 10H10a5 5 0 0 0 0 10h3"/><path d="m16 6 4 4-4 4"/>'),
  trash: svg(
    '<path d="M4 7h16"/>' +
      '<path d="M9.5 7V5A1.5 1.5 0 0 1 11 3.5h2A1.5 1.5 0 0 1 14.5 5v2"/>' +
      '<path d="m6.5 7 .7 11.2a2 2 0 0 0 2 1.8h5.6a2 2 0 0 0 2-1.8L17.5 7"/>' +
      '<path d="M10 11v5.5"/><path d="M14 11v5.5"/>',
  ),
  copy: svg(
    '<rect x="9" y="9" width="11" height="11" rx="2"/>' + '<path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  ),
  check: svg('<path d="m5 13 4.5 4.5L19 7"/>'),
  download: svg('<path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>'),
} as const;
