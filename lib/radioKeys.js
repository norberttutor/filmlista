// Azonnal mentő rádiógomb-csoport billentyűzettel (átnézés B15): a natív rádiógomb nyilazáskor minden lépést
// kiválaszt – nálunk minden kiválasztás ment (a „Megnézve”-n átlépve a „Letöltve” is törlődött, az évadsorban a
// korábbi évadok megnézettek lettek). Mint a csillagsornál (components/StarRating.js): a nyilak (Home / End) csak
// a fókuszt viszik, az Enter / Szóköz választ (a Szóköz natívan, az Enter itt kattint).
// Használat: <div role="radiogroup" onKeyDown={radioKeys}> … <input type="radio" /> …

const STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export function radioKeys(e) {
  if (e.target.type !== 'radio' || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    e.target.click();
    return;
  }
  const radios = [...e.currentTarget.querySelectorAll('input[type="radio"]:not(:disabled)')];
  const i = radios.indexOf(e.target);
  if (i < 0) return;
  let to;
  if (e.key in STEP) to = (i + STEP[e.key] + radios.length) % radios.length;
  else if (e.key === 'Home') to = 0;
  else if (e.key === 'End') to = radios.length - 1;
  else return;
  e.preventDefault();
  radios[to].focus();
}
