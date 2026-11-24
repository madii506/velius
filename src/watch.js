// The watchlist: markets you starred, kept in this browser only.
import { store } from './fmt.js';
const KEY = 'velius:watch';
let list = store.get(KEY, null);
if (!Array.isArray(list)) list = ['BTC', 'ETH', 'SOL', 'HYPE'];
const subs = new Set();
export const watch = {
  all: () => list.slice(),
  has: c => list.includes(c),
  toggle(c) { list = list.includes(c) ? list.filter(x => x !== c) : list.concat(c); store.set(KEY, list); subs.forEach(f => f(list)); return list.includes(c); },
  on(f) { subs.add(f); return () => subs.delete(f); },
};
export const STAR = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" stroke-linejoin="round"/></svg>';
