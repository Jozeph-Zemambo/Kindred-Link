// View toggle: 'Map lab' (default) vs 'Phone preview'. Only swaps a body class
// and the ?view= query param - the same map instance, circles, and state are
// shared by both modes. onChange is where callers refit the resized map.
export function setupViewMode({ onChange }) {
  const labBtn = document.getElementById('viewLab');
  const phoneBtn = document.getElementById('viewPhone');

  function apply(mode, { updateUrl = true } = {}) {
    const phone = mode === 'phone';
    document.body.classList.toggle('phone-preview', phone);
    labBtn.setAttribute('aria-pressed', String(!phone));
    phoneBtn.setAttribute('aria-pressed', String(phone));
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (phone) {
        url.searchParams.set('view', 'phone');
      } else {
        url.searchParams.delete('view');
      }
      window.history.replaceState(null, '', url);
    }
    onChange(phone);
  }

  labBtn.addEventListener('click', () => apply('lab'));
  phoneBtn.addEventListener('click', () => apply('phone'));

  apply(new URLSearchParams(window.location.search).get('view') === 'phone'
    ? 'phone' : 'lab', { updateUrl: false });

  return { apply };
}
