import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal browser storage for the tests.
function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

const json = (status, body) => ({ ok: status < 400, status, headers: { get: () => 'application/json' }, json: async () => body });

beforeEach(() => {
  vi.resetModules();
  globalThis.localStorage = memoryStorage();
  globalThis.fetch = vi.fn();
});

describe('api', () => {
  it('sends the sign in token and never cookies', async () => {
    const { api, setToken } = await import('./lib/api.js');
    fetch.mockResolvedValue(json(200, { ok: true }));
    await api.get('/api/driver/me');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
    setToken('abc123');
    await api.post('/api/driver/arrive', { index: 0 });
    const [, opts] = fetch.mock.calls[1];
    expect(opts.headers).toMatchObject({ Authorization: 'Bearer abc123', 'x-tms': '1', 'Content-Type': 'application/json' });
    expect(opts.credentials).toBe('omit');
  });

  it('reports no signal as status 0 and server errors with their message', async () => {
    const { api, ApiError } = await import('./lib/api.js');
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.get('/api/driver/me')).rejects.toMatchObject({ status: 0 });
    fetch.mockResolvedValueOnce(json(409, { error: 'Arrival was already recorded.' }));
    const err = await api.post('/api/driver/arrive', {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Arrival was already recorded.');
  });
});

describe('offline queue', () => {
  it('sends waiting updates in order and stops at the first network failure', async () => {
    const { enqueue, flushQueue, readQueue } = await import('./queue.js');
    enqueue({ url: '/api/driver/arrive', body: { index: 1 } });
    enqueue({ url: '/api/driver/depart', body: { index: 1 } });
    enqueue({ url: '/api/driver/arrive', body: { index: 2 } });
    fetch.mockResolvedValueOnce(json(200, { dispatches: [], n: 1 })).mockRejectedValueOnce(new TypeError('offline'));
    const first = await flushQueue();
    expect(first.remaining).toBe(2);
    expect(readQueue().map((i) => i.url)).toEqual(['/api/driver/depart', '/api/driver/arrive']);
    fetch.mockResolvedValue(json(200, { dispatches: [], n: 2 }));
    const second = await flushQueue();
    expect(second.remaining).toBe(0);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['/api/driver/arrive', '/api/driver/depart', '/api/driver/depart', '/api/driver/arrive']);
  });

  it('drops an update the office already recorded and reports it', async () => {
    const { enqueue, flushQueue } = await import('./queue.js');
    enqueue({ url: '/api/driver/arrive', body: { index: 0 } });
    fetch.mockResolvedValueOnce(json(409, { error: 'Arrival was already recorded.', dispatches: [] }));
    const out = await flushQueue();
    expect(out.remaining).toBe(0);
    expect(out.rejected).toEqual(['Arrival was already recorded.']);
  });

  it('keeps an update when the office server has trouble, and gives up after 30 minutes', async () => {
    const { enqueue, flushQueue, readQueue } = await import('./queue.js');
    enqueue({ url: '/api/driver/arrive', body: { index: 0 } });
    enqueue({ url: '/api/driver/depart', body: { index: 0 } });
    fetch.mockResolvedValue(json(500, { error: 'Something went wrong on the server.' }));
    const down = await flushQueue();
    expect(down).toMatchObject({ remaining: 2, rejected: [] });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await flushQueue()).remaining).toBe(2);
    // The server is back: both go out, in order.
    fetch.mockReset().mockResolvedValue(json(200, { dispatches: [] }));
    expect((await flushQueue()).remaining).toBe(0);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['/api/driver/arrive', '/api/driver/depart']);

    // An update the server can never take does not hold the others back for good.
    enqueue({ url: '/api/driver/arrive', body: { index: 1 } });
    enqueue({ url: '/api/driver/checkcall', body: { note: 'behind it' } });
    fetch.mockReset().mockResolvedValueOnce(json(500, { error: 'Something went wrong on the server.' }));
    await flushQueue();
    vi.useFakeTimers({ now: Date.now() + 31 * 60 * 1000 });
    fetch.mockResolvedValueOnce(json(500, { error: 'Something went wrong on the server.' })).mockResolvedValueOnce(json(200, { dispatches: [] }));
    const late = await flushQueue();
    vi.useRealTimers();
    expect(late).toMatchObject({ remaining: 0, rejected: ['Something went wrong on the server.'] });
    expect(readQueue()).toEqual([]);
  });

  it('sends an update tapped while others are being sent', async () => {
    const { enqueue, flushQueue, readQueue } = await import('./queue.js');
    enqueue({ url: '/api/driver/checkcall', body: { note: 'saved with no signal' } });
    let answer;
    fetch.mockReturnValueOnce(new Promise((resolve) => (answer = resolve))).mockResolvedValue(json(200, { dispatches: [] }));
    const run = flushQueue();
    // The driver taps Arrived while the check call is on its way.
    enqueue({ url: '/api/driver/arrive', body: { index: 1 } });
    answer(json(200, { dispatches: [] }));
    expect((await run).remaining).toBe(0);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['/api/driver/checkcall', '/api/driver/arrive']);
    expect(readQueue()).toEqual([]);
  });

  it('sends each update once when two runs start together', async () => {
    const { enqueue, flushQueue } = await import('./queue.js');
    enqueue({ url: '/api/driver/checkcall', body: { note: 'once' } });
    fetch.mockResolvedValue(json(200, { dispatches: [] }));
    const [a, b] = await Promise.all([flushQueue(), flushQueue()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    // A later run starts fresh.
    enqueue({ url: '/api/driver/checkcall', body: { note: 'again' } });
    await flushQueue();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('shows a saved stop update on screen right away', async () => {
    const { applyLocally } = await import('./offline.js');
    const view = { dispatches: [{ id: 'd1', status: 'Dispatched', stops: [{ index: 0 }, { index: 1 }], nextIndex: 0 }] };
    const arrived = applyLocally(view, '/api/driver/arrive', { dispatchId: 'd1', index: 0, ts: 'T1' });
    expect(arrived.dispatches[0]).toMatchObject({ status: 'In Transit', nextIndex: 0 });
    const departed = applyLocally(arrived, '/api/driver/depart', { dispatchId: 'd1', index: 0, ts: 'T2' });
    expect(departed.dispatches[0].stops[0]).toMatchObject({ arrivedAt: 'T1', departedAt: 'T2' });
    expect(departed.dispatches[0].nextIndex).toBe(1);
    expect(applyLocally(view, '/api/driver/checkcall', { dispatchId: 'd1' })).toBe(view);
  });
});
