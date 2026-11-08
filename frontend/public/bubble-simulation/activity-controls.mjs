// Activity simulation panel: a manual clock that ages each business's last
// contribution, driving circle color vibrancy. Pure presentation - the counts,
// radii, and fixture data model are untouched by real history.
import { businessAppearance } from './business-recency.mjs';

const MAX_AGE_HOURS = 8760;

export function createActivityControls({ root, onAdvance, onAgeSet, onKindness }) {
  const heading = document.createElement('h2');
  heading.textContent = 'Activity simulation';

  const clockReadout = document.createElement('p');
  clockReadout.className = 'readout';
  clockReadout.id = 'clockReadout';
  clockReadout.setAttribute('aria-live', 'polite');

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  btnRow.setAttribute('aria-label', 'Advance simulated time');
  for (const [hours, label] of [[1, '+1 hour'], [24, '+24 hours'], [168, '+7 days']]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', () => onAdvance(hours));
    btnRow.append(btn);
  }

  const field = document.createElement('div');
  field.className = 'field';
  const label = document.createElement('label');
  label.htmlFor = 'lastAgeInput';
  label.textContent = 'Last act of kindness (hours ago)';
  const ageInput = document.createElement('input');
  ageInput.id = 'lastAgeInput';
  ageInput.type = 'number';
  ageInput.min = '0';
  ageInput.max = String(MAX_AGE_HOURS);
  ageInput.step = '0.25';
  ageInput.inputMode = 'decimal';
  ageInput.setAttribute('aria-describedby', 'lastAgeError');
  const ageError = document.createElement('p');
  ageError.id = 'lastAgeError';
  ageError.className = 'error';
  ageError.setAttribute('role', 'alert');
  ageError.hidden = true;
  field.append(label, ageInput, ageError);

  const kindnessBtn = document.createElement('button');
  kindnessBtn.type = 'button';
  kindnessBtn.id = 'recordKindness';
  kindnessBtn.textContent = 'Record kindness (simulation)';
  kindnessBtn.disabled = true;
  kindnessBtn.addEventListener('click', () => onKindness());

  const stageEl = document.createElement('p');
  stageEl.className = 'readout';
  stageEl.id = 'recencyStage';

  const legend = document.createElement('ul');
  legend.className = 'legend';
  legend.setAttribute('aria-label', 'Recency legend');
  for (const [cls, text] of [
    ['fresh', 'Fresh - within 1 hour - 100% opacity'],
    ['recent', 'Recent - within 24 hours - 80% opacity'],
    ['cooling', 'Cooling - within 7 days - 50% opacity'],
    ['quiet', 'Quiet / no act recorded - 25% opacity'],
  ]) {
    const li = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = `swatch ${cls}`;
    swatch.setAttribute('aria-hidden', 'true');
    const txt = document.createElement('span');
    txt.textContent = text;
    li.append(swatch, txt);
    legend.append(li);
  }

  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent = 'Simulated activity, not live history. ' +
    'Ordinary scans do not refresh kindness recency.';

  root.append(heading, clockReadout, btnRow, field, kindnessBtn,
    stageEl, legend, note);

  function clearError() {
    ageError.hidden = true;
    ageError.textContent = '';
    ageInput.classList.remove('invalid');
    ageInput.removeAttribute('aria-invalid');
  }

  ageInput.addEventListener('input', () => {
    const raw = ageInput.value.trim();
    const age = raw === '' ? NaN : Number(raw);
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_HOURS) {
      ageError.textContent = 'Enter 0 to 8,760 hours.';
      ageError.hidden = false;
      ageInput.classList.add('invalid');
      ageInput.setAttribute('aria-invalid', 'true');
      return; // last valid render stays on the map
    }
    clearError();
    onAgeSet(age);
  });

  let lastBusinessId = null;

  // forceAgeField rewrites the input even while focused (clock advances, reset,
  // and business switches always show the last valid value).
  function refresh(b, clockHours, forceAgeField = false) {
    clockReadout.textContent = `Time advanced: ${clockHours} h`;
    kindnessBtn.disabled = !b;
    if (!b) {
      lastBusinessId = null;
      clearError();
      ageInput.disabled = true;
      ageInput.value = '';
      stageEl.textContent = 'Load and select a business first.';
      return;
    }
    if (b.id !== lastBusinessId) {
      lastBusinessId = b.id;
      clearError();
    }
    // Any selected business can simulate a kindness age - even one at zero
    // visitors, since kindness recency is independent of the scan count.
    ageInput.disabled = false;
    const app = businessAppearance(b, clockHours);
    if (app.ageHours === null) {
      if (forceAgeField || document.activeElement !== ageInput) {
        ageInput.value = '';
      }
      stageEl.textContent = app.label;
      return;
    }
    if (forceAgeField || document.activeElement !== ageInput) {
      ageInput.value = String(Math.round(app.ageHours * 100) / 100);
    }
    stageEl.textContent = `Recency: ${app.label}`;
  }

  return { refresh, clearError };
}
