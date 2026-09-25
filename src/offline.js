// Shows a stop update saved on the phone (no signal) right away, before the server has it.
export function applyLocally(view, url, body) {
  if (!view) return view;
  const field = url.endsWith('/arrive') ? 'arrivedAt' : url.endsWith('/depart') ? 'departedAt' : null;
  if (!field) return view;
  return {
    ...view,
    dispatches: view.dispatches.map((d) => {
      if (d.id !== body.dispatchId) return d;
      const stops = d.stops.map((s) => (s.index === body.index ? { ...s, [field]: body.ts } : s));
      return { ...d, stops, nextIndex: stops.findIndex((s) => !s.departedAt), status: 'In Transit' };
    }),
  };
}
