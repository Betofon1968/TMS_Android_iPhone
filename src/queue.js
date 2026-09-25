// Stop updates and check calls tapped with no signal wait here and are sent, in order,
// with the time they were tapped, once the phone is back online.
import { api, ApiError } from './lib/api.js';

const KEY = 'tms-driver-queue';

export function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable: the item stays only in memory for this session.
  }
}

export function enqueue(item) {
  const items = [...readQueue(), { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }];
  writeQueue(items);
  return items;
}

export function clearQueue() {
  writeQueue([]);
}

// Sends waiting items in order. Stops at the first network failure. Items the server
// rejects (for example, the office already recorded that stop) are dropped and reported.
export async function flushQueue() {
  let items = readQueue();
  let last = null;
  const rejected = [];
  while (items.length) {
    const [item, ...rest] = items;
    try {
      last = await api.post(item.url, item.body);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) break;
      if (err instanceof ApiError && err.status === 401) throw err;
      rejected.push(err.message);
      last = err.body?.dispatches ? err.body : last;
    }
    items = rest;
    writeQueue(items);
  }
  return { remaining: items.length, view: last, rejected };
}
