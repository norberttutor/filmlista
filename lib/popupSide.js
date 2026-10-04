// Felugró lista (harang, ⋮ menü) igazítása a gombjához, hogy ne lógjon ki a képernyőből:
// 'left' = a gomb bal széléhez igazítva jobbra nyílik, 'right' = a jobb széléhez igazítva balra.
// A fejléc gombjai a szélességtől függően máshová kerülnek, ezért nyitáskor mérjük.
// width: a lista szélessége képpontban; prefer: melyik oldal, ha mindkettő elfér.
export function popupSide(button, width, prefer = 'left', margin = 16) {
  const r = button.getBoundingClientRect();
  const fitsLeft = r.left + width <= window.innerWidth - margin;
  const fitsRight = r.right - width >= margin;
  if (prefer === 'left') return fitsLeft || !fitsRight ? 'left' : 'right';
  return fitsRight || !fitsLeft ? 'right' : 'left';
}
