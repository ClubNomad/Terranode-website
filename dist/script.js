'use strict';
document.documentElement.classList.add('js');
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#main-nav');
function closeMenu() {
  menu.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}
menu.addEventListener('click', () => {
  const expanded = menu.getAttribute('aria-expanded') === 'true';
  menu.setAttribute('aria-expanded', String(!expanded));
  navigation.classList.toggle('is-open', !expanded);
});
navigation.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menu.focus();
  }
});
document.querySelector('#year').textContent = new Date().getFullYear();

const dialog = document.querySelector('#enquiry-dialog');
const frame = dialog.querySelector('iframe');
const loading = dialog.querySelector('.form-loading');
const formCopy = {
  enquiry: ['Tell us what you’re imagining.', 'A few details help us make our first conversation useful.', 'Terranode project enquiry'],
  change: ['Let’s make the change clear.', 'Share a proposed change to your existing project for the team to review. A request is not an approval to proceed.', 'Terranode project change request'],
  vendor: ['Good work starts with good people.', 'Tell us about your trade, your services and where you work.', 'Terranode trade partner registration']
};
if (typeof dialog.showModal === 'function') {
  document.querySelectorAll('.form-link').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      const copy = formCopy[link.dataset.form];
      const url = new URL(link.href);
      url.searchParams.set('embedded', 'true');
      dialog.querySelector('#dialog-title').textContent = copy[0];
      dialog.querySelector('#dialog-description').textContent = copy[1];
      dialog.querySelector('#form-fallback').href = link.href;
      frame.title = copy[2];
      if (frame.src !== url.href) {
        loading.hidden = false;
        frame.src = url.href;
      }
      dialog.showModal();
      document.body.classList.add('modal-open');
      dialog.querySelector('.close-dialog').focus();
    });
  });
  frame.addEventListener('load', () => { loading.hidden = true; });
  dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
}

// Progressive reveal: content remains visible if scripting or observation fails.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('[data-reveal]').forEach(element => {
    if (element.getBoundingClientRect().top > window.innerHeight) {
      element.classList.add('reveal-ready');
      observer.observe(element);
    }
  });
}

// Full photographs, without a gallery library or a hosting service dependency.
const photoDialog = document.querySelector('#photo-dialog');
const photoLinks = [...document.querySelectorAll('[data-gallery]')];
if (photoDialog && typeof photoDialog.showModal === 'function') {
  let photoIndex = 0;
  const displayPhoto = index => {
    photoIndex = (index + photoLinks.length) % photoLinks.length;
    const link = photoLinks[photoIndex];
    const original = link.querySelector('img');
    const full = photoDialog.querySelector('#photo-full');
    full.src = link.href;
    full.alt = original.alt;
    photoDialog.querySelector('#photo-counter').textContent = `${photoIndex + 1} / ${photoLinks.length}`;
    photoDialog.querySelector('#photo-caption').textContent = link.closest('figure').querySelector('figcaption')?.textContent || original.alt;
  };
  photoLinks.forEach((link, index) => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      displayPhoto(index);
      photoDialog.showModal();
      document.body.classList.add('modal-open');
      photoDialog.querySelector('.close-photo').focus();
    });
  });
  photoDialog.querySelector('.close-photo').addEventListener('click', () => photoDialog.close());
  photoDialog.querySelector('#photo-prev').addEventListener('click', () => displayPhoto(photoIndex - 1));
  photoDialog.querySelector('#photo-next').addEventListener('click', () => displayPhoto(photoIndex + 1));
  photoDialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      displayPhoto(photoIndex + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  photoDialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
}
