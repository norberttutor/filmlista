// Értesítősáv („toast”): rövid üzenet alul középen, opcionális gombbal (pl. „Visszavonás”) és
// alul fogyó csíkkal; magától eltűnik (rámutatáskor / fókusznál megáll). A <Toaster /> egyszer
// van a lapon (a Watchlistben); bárhonnan: toast({ ... }) → azonosító.

const MAX_SHOWN = 3; // ennél több egyszerre nem látszik: a legrégebbi lejártként eltűnik

let toasts = [];
const listeners = new Set();
let nextId = 1;

function emit() {
  for (const l of listeners) l();
}

export function subscribeToasts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts() {
  return toasts;
}

// text: szöveg vagy elem; image: kis borító URL-je; content: elem a szöveg után (pl. csillagsor);
// action: { label, onClick } – kattintásra lefut, és a sáv eltűnik; hideClose: nincs × gomb
// (ha az action maga a bezárás, pl. „Később”); duration: ezredmásodperc;
// onExpire: lejáratkor vagy a × gombra fut le (az action-re nem)
export function toast({ duration = 8000, ...rest }) {
  const id = nextId++;
  const all = [...toasts, { id, duration, ...rest }];
  const dropped = all.slice(0, Math.max(0, all.length - MAX_SHOWN));
  toasts = all.slice(-MAX_SHOWN);
  emit();
  for (const t of dropped) t.onExpire?.();
  return id;
}

// how: 'expire' (lejárt) | 'close' (×) – ezekre fut az onExpire; 'action' | 'silent' – nem
export function dismissToast(id, how = 'silent') {
  const t = toasts.find((x) => x.id === id);
  if (!t) return;
  toasts = toasts.filter((x) => x.id !== id);
  emit();
  if (how === 'expire' || how === 'close') t.onExpire?.();
}
