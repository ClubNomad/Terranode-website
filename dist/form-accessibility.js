'use strict';
// Native validation and form posting remain in place; this makes errors persistent.
document.querySelectorAll('.contact-form').forEach(form => {
  const summary = document.createElement('div');
  summary.className = 'form-error-summary';
  summary.tabIndex = -1;
  summary.hidden = true;
  summary.setAttribute('role', 'region');
  summary.setAttribute('aria-labelledby', 'form-error-title');
  form.prepend(summary);
  const status = document.createElement('p');
  status.className = 'form-status';
  status.setAttribute('role', 'status');
  form.append(status);
  let attempted = false;
  let pending = false;
  const fields = [...form.elements].filter(field => field.matches('input, select, textarea') && field.willValidate);
  fields.forEach((field, index) => { if (!field.id) field.id = `form-control-${index}`; });
  const labelFor = field => (field.labels?.[0]?.textContent || 'This field').replace(/\s*(Required|Optional)\s*$/, '').trim();
  const messageFor = field => {
    if (field.validity.valueMissing) {
      if (field.type === 'checkbox') return 'Please confirm your agreement.';
      if (field.tagName === 'SELECT') return 'Choose an option.';
      return 'Please complete this field.';
    }
    if (field.validity.typeMismatch && field.type === 'email') return 'Enter an email address such as name@example.com.';
    if (field.validity.typeMismatch && field.type === 'url') return 'Enter a full website address, starting with https://.';
    return field.validationMessage;
  };
  function updateField(field) {
    const errorId = `${field.id}-error`;
    let error = document.getElementById(errorId);
    if (field.validity.valid) {
      field.removeAttribute('aria-invalid');
      const remaining = (field.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== errorId);
      if (remaining.length) field.setAttribute('aria-describedby', remaining.join(' '));
      else field.removeAttribute('aria-describedby');
      error?.remove();
      return;
    }
    if (!error) {
      error = document.createElement('p');
      error.id = errorId;
      error.className = 'field-error';
      const container = field.closest('.field');
      if (container) container.append(error);
      else field.closest('.consent').after(error);
    }
    error.textContent = `Error: ${messageFor(field)}`;
    field.setAttribute('aria-invalid', 'true');
    const descriptions = new Set((field.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
    descriptions.add(errorId);
    field.setAttribute('aria-describedby', [...descriptions].join(' '));
  }
  function updateSummary() {
    const invalid = fields.filter(field => !field.validity.valid);
    summary.replaceChildren();
    summary.hidden = !invalid.length;
    if (!invalid.length) return;
    const heading = document.createElement('h2');
    heading.id = 'form-error-title';
    heading.textContent = `Please check ${invalid.length} ${invalid.length === 1 ? 'field' : 'fields'}`;
    const list = document.createElement('ul');
    invalid.forEach(field => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${field.id}`;
      link.textContent = `${labelFor(field)}: ${messageFor(field)}`;
      link.addEventListener('click', event => {
        event.preventDefault();
        const details = field.closest('details');
        if (details) details.open = true;
        field.focus({ preventScroll: true });
        (field.closest('.field') || field.closest('.consent')).scrollIntoView({ block: 'start' });
      });
      item.append(link);
      list.append(item);
    });
    summary.append(heading, list);
  }
  form.addEventListener('invalid', event => {
    event.preventDefault();
    attempted = true;
    status.textContent = "";
    updateField(event.target);
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      updateSummary();
      summary.focus({ preventScroll: true });
      summary.scrollIntoView({ block: 'start' });
    }, 0);
  }, true);
  ['input', 'change'].forEach(type => form.addEventListener(type, event => {
    if (!attempted || !fields.includes(event.target)) return;
    updateField(event.target);
    updateSummary();
  }));
  form.addEventListener('submit', () => {
    status.textContent = 'The confirmation opens in a new tab. Check that tab to confirm your submission was accepted.';
  });
});
