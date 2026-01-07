import './style.css';
import { createApp } from './app';
import { createStore } from './lib/grid';
import { seedGrid } from './lib/seed';

const root = document.getElementById('app');
if (!root) throw new Error('#app が見つかりません');

const store = createStore(localStorage);

// 初回起動だけ見本のドット絵を入れて保存する。一度でも保存があれば
// (全消去した場合も含めて)その状態を尊重する。
let grid = store.load();
if (grid === null) {
  grid = seedGrid();
  store.save(grid);
}

createApp({ root, store, initialGrid: grid });
