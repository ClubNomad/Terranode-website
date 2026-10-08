/* Shared appearance controls. The small inline head bootstrap handles first paint. */
(() => {
  'use strict';
  const key = 'terranode.appearance';
  const root = document.documentElement;
  const device = window.matchMedia('(prefers-color-scheme: dark)');
  const validChoice = value => value === 'light' || value === 'dark' ? value : 'system';
  let choice = 'system';
  try { choice = validChoice(localStorage.getItem(key)); } catch (_) { /* Storage can be disabled. */ }

  function apply() {
    const theme = choice === 'system' ? (device.matches ? 'dark' : 'light') : choice;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    // Browser chrome follows the same surface colours as the shared CSS tokens.
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      meta.content = theme === 'dark' ? '#18251f' : '#f5f2e9';
    });
    document.querySelectorAll('[data-appearance]').forEach(select => { select.value = choice; });
  }

  apply();
  device.addEventListener('change', () => { if (choice === 'system') apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      choice = validChoice(event.newValue);
      apply();
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-appearance]').forEach(select => {
      select.value = choice;
      select.disabled = false;
      select.addEventListener('change', () => {
        choice = validChoice(select.value);
        try {
          if (choice === 'system') localStorage.removeItem(key);
          else localStorage.setItem(key, choice);
        } catch (_) { /* The selected theme still works for this page. */ }
        apply();
      });
    });
  });
})();
