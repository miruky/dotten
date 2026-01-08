import './style.css';
import { createApp } from './app';
import { createStore } from './lib/grid';
import { decodeGrid } from './lib/encode';
import { loadSettings } from './lib/settings';
import { seedGrid } from './lib/seed';

const root = document.getElementById('app');
if (!root) throw new Error('#app が見つかりません');

const store = createStore(localStorage);
const settings = loadSettings(localStorage);

// 共有リンク(#g=...)で開かれたらその絵を初期値にし、保存したうえでハッシュを
// 消す。リロードで意図せず再読み込みされないようにするため。
function sharedFromHash(): ReturnType<typeof decodeGrid> {
  const match = /[#&]g=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!match) return null;
  return decodeGrid(match[1] as string);
}

// 初回起動だけ見本のドット絵を入れて保存する。一度でも保存があれば
// (全消去した場合も含めて)その状態を尊重する。
let grid = sharedFromHash();
if (grid !== null) {
  store.save(grid);
  history.replaceState(null, '', location.pathname + location.search);
} else {
  grid = store.load();
  if (grid === null) {
    grid = seedGrid();
    store.save(grid);
  }
}

createApp({
  root,
  store,
  settingsStorage: localStorage,
  initialGrid: grid,
  initialSettings: settings,
});
