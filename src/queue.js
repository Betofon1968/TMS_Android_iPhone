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

// How long an update is kept when the office server answers with an error of its own (a
// database restart, a deploy). After that it is dropped and reported, so one update the
// server can never take does not hold back the ones behind it for good.
const GIVE_UP_MS = 30 * 60 * 1000;

// A request that hangs on a weak signal is given up, like no signal, and tried again later.
const SEND_TIMEOUT_MS = 45 * 1000;

const serverTrouble = (err) => err instanceof ApiError && (err.status >= 500 || err.status === 408 || err.status === 429);

let running = null;

// Sends waiting items in order, one run at a time: a run asked for during another gets
// that run's answer, so nothing is ever sent twice. Stops at the first network failure or
// server error and keeps the item for the next run. Items the server refuses (for example,
// the office already recorded that stop) are dropped and reported. The list on the phone is
// read again for every item, so an update tapped while a run is going is sent too, in order.
export function flushQueue() {
  if (!running) {
    running = send().finally(() => {
      running = null;
    });
  }
  return running;
}

async function send() {
  let last = null;
  const rejected = [];
  for (;;) {
    const item = readQueue()[0];
    if (!item) break;
    try {
      last = await api.post(item.url, item.body, { timeoutMs: SEND_TIMEOUT_MS });
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) break;
      if (err instanceof ApiError && err.status === 401) throw err;
      if (serverTrouble(err) && Date.now() - (item.failedSince || Date.now()) < GIVE_UP_MS) {
        if (!item.failedSince) writeQueue(readQueue().map((i) => (i.id === item.id ? { ...i, failedSince: Date.now() } : i)));
        break;
      }
      rejected.push(err.message);
      last = err.body?.dispatches ? err.body : last;
    }
    // Only this item is taken off: the list may have grown while it was being sent.
    writeQueue(readQueue().filter((i) => i.id !== item.id));
    // The phone could not save the shorter list: stop, so the same item is not sent in a loop.
    if (readQueue()[0]?.id === item.id) break;
  }
  return { remaining: readQueue().length, view: last, rejected };
}
