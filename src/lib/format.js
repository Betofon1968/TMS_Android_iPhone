// All dates and times are shown in New York time, which is where dispatch operates.
export const TIME_ZONE = 'America/New_York';

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const numberFmt = new Intl.NumberFormat('en-US');
const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const isoPartsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function money(n) {
  return currencyFmt.format(Number(n) || 0);
}

export function num(n) {
  return numberFmt.format(Number(n) || 0);
}

// Calendar date string (YYYY-MM-DD) rendered without time zone shifting.
export function date(value) {
  if (!value) return '';
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(value);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function dateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${dateTimeFmt.format(d)} ET`;
}

function nyParts(d) {
  const parts = Object.fromEntries(isoPartsFmt.formatToParts(d).map((p) => [p.type, p.value]));
  return parts;
}

// Today's calendar date in New York as YYYY-MM-DD.
export function todayISO(now = new Date()) {
  const p = nyParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

// Current New York wall clock time in the format used by datetime-local inputs.
export function nowLocalInput(now = new Date()) {
  const p = nyParts(now);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// Converts a New York wall clock value from a datetime-local input into an ISO timestamp.
export function localInputToISO(value) {
  if (!value) return new Date().toISOString();
  const [datePart, timePart = '00:00'] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Find the New York offset at that moment and correct the guess.
  const p = nyParts(new Date(guess));
  const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  const offset = asUTC - guess;
  return new Date(guess - offset).toISOString();
}

export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(days || 0)));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(fromISO, toISO) {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function cityState(stop) {
  if (!stop) return '';
  return [stop.city, stop.state].filter(Boolean).join(', ');
}
