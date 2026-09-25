import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, fetchFileBlobUrl, setToken } from './lib/api.js';
import { fileToUploadDataUrl } from './lib/images.js';
import { date, dateTime } from './lib/format.js';
import { clearQueue, enqueue, flushQueue, readQueue } from './queue.js';
import { applyLocally } from './offline.js';

const REFRESH_MS = 30000;

// Best effort GPS: resolves with a position, or with nothing if it is off or slow.
function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    const timer = setTimeout(() => resolve({}), 8000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve({});
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 },
    );
  });
}

const fullAddress = (s) => [s.address, s.city, [s.state, s.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
const mapsUrl = (s) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress(s) || s.name)}`;
const telUrl = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;
const stopWord = (s) => (s.type === 'pickup' ? 'Pickup' : 'Delivery');

function Login({ onDone }) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await api.post('/api/driver/login', { phone, pin });
      setToken(token);
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="d-login" onSubmit={submit}>
      <div className="d-logo">🚚</div>
      <h1>TMS Driver</h1>
      <label>
        Phone number
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(973) 555 0101"
          required
        />
      </label>
      <label>
        PIN
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          maxLength={8}
          required
        />
      </label>
      {error && <div className="d-error">{error}</div>}
      {import.meta.env.PROD && !import.meta.env.VITE_TMS_API_URL && (
        <div className="d-error">This app is not connected to a TMS server yet. Set VITE_TMS_API_URL and publish again.</div>
      )}
      <button type="submit" className="d-btn d-btn-primary" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="d-muted">Your office gives you the PIN. Ask them if you forgot it.</p>
    </form>
  );
}

// A photo the driver took, loaded with the sign in token.
function DocThumb({ doc }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url = null;
    let alive = true;
    fetchFileBlobUrl(doc.fileId)
      .then((u) => {
        url = u;
        if (alive) setSrc(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc.fileId]);
  return (
    <a href={src || undefined} target="_blank" rel="noreferrer" className="d-doc">
      {src ? <img src={src} alt={doc.kind} /> : <span className="d-doc-wait" />}
      <span>{doc.kind}</span>
    </a>
  );
}

function Sheet({ title, children, onClose }) {
  return (
    <div className="d-sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="d-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="d-sheet-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

function PhotoButton({ label, onFile, disabled }) {
  return (
    <label className={`d-btn d-btn-outline ${disabled ? 'is-disabled' : ''}`}>
      📷 {label}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function StopCard({ stop, dispatch, busy, onArrive, onDepart, onPhoto }) {
  const canAct = ['Dispatched', 'In Transit'].includes(dispatch.status);
  const photoKind = stop.type === 'pickup' ? 'BOL' : 'POD';
  return (
    <section className={`d-card d-stop d-${stop.type}`}>
      <div className="d-stop-head">
        <span className={`d-tag d-tag-${stop.type}`}>{stopWord(stop).toUpperCase()}</span>
        <span className="d-muted">
          Stop {stop.index + 1} of {dispatch.stops.length}
        </span>
      </div>
      <h2>{stop.name || stop.city}</h2>
      <a className="d-address" href={mapsUrl(stop)} target="_blank" rel="noreferrer">
        {fullAddress(stop) || 'No address on file'}
      </a>
      <div className="d-row">
        <span>
          📅 {date(stop.date)} {stop.timeFrom && `${stop.timeFrom} to ${stop.timeTo || ''}`}
        </span>
        {stop.apptRequired && <span className="d-tag d-tag-warn">APPT REQUIRED</span>}
      </div>
      {stop.notes && <div className="d-note">{stop.notes}</div>}
      <div className="d-load">
        <strong>{stop.load.number}</strong>
        {stop.load.reference && <span> · Ref {stop.load.reference}</span>}
        {stop.load.commodity && <span> · {stop.load.commodity}</span>}
        <div className="d-muted">
          {[
            stop.load.pieces && `${stop.load.pieces} pcs`,
            stop.load.pallets && `${stop.load.pallets} pallets`,
            stop.load.weight && `${Number(stop.load.weight).toLocaleString()} lb`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
        {stop.load.notes && <div className="d-muted">{stop.load.notes}</div>}
      </div>
      <div className="d-actions-row">
        {stop.phone && (
          <a className="d-btn d-btn-outline" href={telUrl(stop.phone)}>
            📞 Call {stop.contact || ''}
          </a>
        )}
        <a className="d-btn d-btn-outline" href={mapsUrl(stop)} target="_blank" rel="noreferrer">
          🧭 Navigate
        </a>
      </div>
      {stop.arrivedAt && <div className="d-done">Arrived {dateTime(stop.arrivedAt)}</div>}
      {canAct && !stop.arrivedAt && (
        <button type="button" className="d-btn d-btn-primary d-btn-big" disabled={busy} onClick={onArrive}>
          Arrived
        </button>
      )}
      {canAct && stop.arrivedAt && !stop.departedAt && (
        <>
          <PhotoButton label={`${photoKind} photo`} onFile={(f) => onPhoto(f, photoKind)} disabled={busy} />
          <button type="button" className="d-btn d-btn-primary d-btn-big" disabled={busy} onClick={onDepart}>
            {stop.type === 'pickup' ? 'Loaded & departed' : 'Delivered & departed'}
          </button>
        </>
      )}
      {!canAct && dispatch.status === 'Planned' && <div className="d-note">Waiting for the office to dispatch this run.</div>}
      {stop.documents.length > 0 && (
        <div className="d-docs">
          {stop.documents.map((d) => (
            <DocThumb key={d.id} doc={d} />
          ))}
        </div>
      )}
    </section>
  );
}

function DispatchScreen({ dispatch, busy, onBack, showBack, onAction, onPhoto, onCheckCall }) {
  const [confirm, setConfirm] = useState(null);
  const next = dispatch.nextIndex >= 0 ? dispatch.stops[dispatch.nextIndex] : null;
  const done = dispatch.stops.filter((s) => s.departedAt).length;

  return (
    <>
      <div className="d-subhead">
        {showBack && (
          <button type="button" className="d-link" onClick={onBack}>
            ‹ All dispatches
          </button>
        )}
        <div className="d-title-row">
          <strong>{dispatch.number}</strong>
          <span className="d-muted">{[dispatch.truck, dispatch.trailer].filter(Boolean).join(' · ')}</span>
          <span className={`d-status d-status-${dispatch.status.replace(' ', '')}`}>{dispatch.status}</span>
        </div>
        <div className="d-progress">
          <span style={{ width: `${(done / Math.max(dispatch.stops.length, 1)) * 100}%` }} />
        </div>
        {dispatch.notes && <div className="d-note">{dispatch.notes}</div>}
      </div>

      {next ? (
        <StopCard
          stop={next}
          dispatch={dispatch}
          busy={busy}
          onArrive={() => setConfirm({ kind: 'arrive', stop: next })}
          onDepart={() => setConfirm({ kind: 'depart', stop: next })}
          onPhoto={(file, kind) => onPhoto(dispatch, next, file, kind)}
        />
      ) : (
        <section className="d-card d-center">
          <h2>All stops complete ✓</h2>
          <p className="d-muted">Nice work. The office has been updated.</p>
        </section>
      )}

      {['Dispatched', 'In Transit'].includes(dispatch.status) && (
        <button type="button" className="d-btn d-btn-outline d-wide" onClick={() => onCheckCall(dispatch)}>
          💬 Check call / note to office
        </button>
      )}

      <section className="d-card">
        <div className="d-section-title">Route</div>
        <ol className="d-route">
          {dispatch.stops.map((s) => (
            <li key={s.index} className={s.departedAt ? 'done' : s.index === dispatch.nextIndex ? 'current' : ''}>
              <span className="d-dot">{s.departedAt ? '✓' : s.index + 1}</span>
              <div>
                <div>
                  <strong>{stopWord(s)}</strong> · {s.name || s.city}
                </div>
                <div className="d-muted">
                  {[s.city, s.state].filter(Boolean).join(', ')} · {date(s.date)} {s.timeFrom}
                </div>
                {s.departedAt && <div className="d-muted">Departed {dateTime(s.departedAt)}</div>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {dispatch.recent.length > 0 && (
        <section className="d-card">
          <div className="d-section-title">Recent activity</div>
          <ul className="d-activity">
            {dispatch.recent.map((e) => (
              <li key={e.id}>
                {e.text}
                <div className="d-muted">{dateTime(e.ts)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {confirm && (
        <Sheet title={confirm.kind === 'arrive' ? 'Confirm arrival' : 'Confirm departure'} onClose={() => setConfirm(null)}>
          <p>
            {confirm.kind === 'arrive' ? 'Arrived at ' : confirm.stop.type === 'pickup' ? 'Loaded and leaving ' : 'Delivered and leaving '}
            <strong>{confirm.stop.name || confirm.stop.city}</strong>?
          </p>
          <p className="d-muted">The time and your location are sent to the office.</p>
          <button
            type="button"
            className="d-btn d-btn-primary d-btn-big"
            onClick={() => {
              const { kind, stop } = confirm;
              setConfirm(null);
              onAction(kind, dispatch, stop);
            }}
          >
            Yes, confirm
          </button>
          <button type="button" className="d-btn d-btn-outline" onClick={() => setConfirm(null)}>
            Cancel
          </button>
        </Sheet>
      )}
    </>
  );
}

export default function DriverApp() {
  const [phase, setPhase] = useState('loading');
  const [view, setView] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [queued, setQueued] = useState(readQueue().length);
  const [online, setOnline] = useState(navigator.onLine);
  const [checkCall, setCheckCall] = useState(null);
  const viewRef = useRef(null);

  const say = useCallback((text, kind = 'ok') => {
    setMessage({ text, kind, id: Date.now() });
    setTimeout(() => setMessage((m) => (m?.text === text ? null : m)), kind === 'error' ? 7000 : 3500);
  }, []);

  // The office reset the PIN, turned the app off, or the sign in expired.
  const signedOut = useCallback(() => {
    setToken('');
    setPhase('login');
  }, []);

  const show = useCallback((v) => {
    viewRef.current = v;
    setView(v);
  }, []);

  const load = useCallback(async () => {
    try {
      show(await api.get('/api/driver/me'));
      setPhase('ready');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) signedOut();
      else if (viewRef.current) setPhase('ready');
      else setPhase('offline');
    }
  }, [show, signedOut]);

  const flush = useCallback(async () => {
    if (!readQueue().length) return;
    try {
      const { remaining, view: v, rejected } = await flushQueue();
      setQueued(remaining);
      if (v?.dispatches) show(v);
      if (!remaining) say('Offline updates sent to the office');
      for (const r of rejected) say(r, 'error');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) signedOut();
    }
  }, [show, say, signedOut]);

  useEffect(() => {
    load().then(flush);
    const goOnline = () => {
      setOnline(true);
      flush().then(load);
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (readQueue().length) flush();
      else load();
    }, REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [load, flush]);

  // Sends a stop update or check call. With no signal it is saved on the phone and sent later.
  const send = async (url, body, success) => {
    setBusy(true);
    const position = await getPosition();
    const payload = { ...body, ...position, ts: new Date().toISOString() };
    try {
      if (readQueue().length) throw new ApiError(0, null); // keep the order of waiting updates
      show(await api.post(url, payload));
      say(success);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setQueued(enqueue({ url, body: payload }).length);
        show(applyLocally(viewRef.current, url, payload));
        say('No signal. Saved on your phone and will send automatically.', 'warn');
      } else if (err instanceof ApiError && err.status === 401) signedOut();
      else {
        if (err.body?.dispatches) show(err.body);
        say(err.message, 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const onAction = (kind, dispatch, stop) =>
    send(
      `/api/driver/${kind}`,
      { dispatchId: dispatch.id, index: stop.index },
      kind === 'arrive' ? `Arrival at ${stop.name || stop.city} sent` : `Departure from ${stop.name || stop.city} sent`,
    );

  const onPhoto = async (dispatch, stop, file, kind) => {
    setBusy(true);
    try {
      const dataUrl = await fileToUploadDataUrl(file);
      const { fileId } = await api.post('/api/files', { dataUrl });
      show(await api.post('/api/driver/document', { dispatchId: dispatch.id, shipmentId: stop.load.id, stopId: stop.stopId, kind, fileId }));
      say(`${kind} photo sent to the office`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) say('Photos need a signal. Try again when you have service.', 'error');
      else if (err instanceof ApiError && err.status === 401) signedOut();
      else say(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (readQueue().length && !window.confirm('Some updates have not been sent yet. Sign out anyway? They will be lost.')) return;
    clearQueue();
    setQueued(0);
    await api.post('/api/driver/logout').catch(() => {});
    setToken('');
    show(null);
    setSelected(null);
    signedOut();
  };

  if (phase === 'loading') return <div className="d-splash">Loading…</div>;
  if (phase === 'login') return <Login onDone={load} />;
  if (phase === 'offline')
    return (
      <div className="d-splash">
        <p>No connection to the office.</p>
        <button type="button" className="d-btn d-btn-primary" onClick={load}>
          Try again
        </button>
      </div>
    );

  const dispatches = view?.dispatches || [];
  const actionable = dispatches.filter((d) => ['Dispatched', 'In Transit'].includes(d.status));
  const current = dispatches.find((d) => d.id === selected) || (actionable.length === 1 && !selected ? actionable[0] : null);

  return (
    <div className="d-app">
      <header className="d-header">
        <div>
          <div className="d-company">{view?.company || 'TMS Driver'}</div>
          <div className="d-driver">{view?.driver?.name}</div>
        </div>
        <div className="d-header-actions">
          <button type="button" className="d-icon" onClick={() => flush().then(load)} aria-label="Refresh">
            ↻
          </button>
          <button type="button" className="d-icon d-small" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      {(!online || queued > 0) && (
        <div className="d-banner">
          {!online ? 'Offline. ' : ''}
          {queued > 0 ? `${queued} update${queued > 1 ? 's' : ''} waiting to send.` : 'Updates will be saved on your phone.'}
        </div>
      )}

      <main className="d-main">
        {current ? (
          <DispatchScreen
            dispatch={current}
            busy={busy}
            showBack={dispatches.length > 1}
            onBack={() => setSelected('list')}
            onAction={onAction}
            onPhoto={onPhoto}
            onCheckCall={(d) => setCheckCall({ dispatch: d, note: '', location: '' })}
          />
        ) : dispatches.length === 0 ? (
          <section className="d-card d-center">
            <h2>No dispatches right now</h2>
            <p className="d-muted">When the office assigns you a run, it shows up here.</p>
            <button type="button" className="d-btn d-btn-outline" onClick={load}>
              Check again
            </button>
          </section>
        ) : (
          <>
            <div className="d-section-title d-pad">Your dispatches</div>
            {dispatches.map((d) => {
              const first = d.stops[0];
              const last = d.stops[d.stops.length - 1];
              return (
                <button key={d.id} type="button" className="d-card d-list-item" onClick={() => setSelected(d.id)}>
                  <div className="d-title-row">
                    <strong>{d.number}</strong>
                    <span className={`d-status d-status-${d.status.replace(' ', '')}`}>{d.status}</span>
                  </div>
                  <div>
                    {[first?.city, first?.state].filter(Boolean).join(', ')} → {[last?.city, last?.state].filter(Boolean).join(', ')}
                  </div>
                  <div className="d-muted">
                    {[`${d.stops.length} stops`, d.truck, d.trailer, `starts ${date(first?.date)}`].filter(Boolean).join(' · ')}
                  </div>
                </button>
              );
            })}
          </>
        )}
      </main>

      {checkCall && (
        <Sheet title="Check call" onClose={() => setCheckCall(null)}>
          <label>
            Note to the office
            <textarea
              rows="3"
              value={checkCall.note}
              onChange={(e) => setCheckCall((c) => ({ ...c, note: e.target.value }))}
              placeholder="Traffic, delay, ETA, reefer temp…"
            />
          </label>
          <label>
            Where are you? (optional)
            <input
              value={checkCall.location}
              onChange={(e) => setCheckCall((c) => ({ ...c, location: e.target.value }))}
              placeholder="City or mile marker"
            />
          </label>
          <p className="d-muted">Your GPS location is added automatically when the phone allows it.</p>
          <button
            type="button"
            className="d-btn d-btn-primary d-btn-big"
            disabled={busy}
            onClick={() => {
              const { dispatch, note, location } = checkCall;
              setCheckCall(null);
              send('/api/driver/checkcall', { dispatchId: dispatch.id, note, location }, 'Check call sent');
            }}
          >
            Send
          </button>
          <button type="button" className="d-btn d-btn-outline" onClick={() => setCheckCall(null)}>
            Cancel
          </button>
        </Sheet>
      )}

      {busy && <div className="d-busy">Sending…</div>}
      {message && <div className={`d-toast d-toast-${message.kind}`}>{message.text}</div>}
    </div>
  );
}
