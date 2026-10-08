'use strict';
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#main-nav');
const header = document.querySelector('.site-header');
const compactNavigation = matchMedia('(max-width: 1280px)');
const background = [document.querySelector('.skip-link'), document.querySelector('main'), document.querySelector('footer')].filter(Boolean);
const menuLabel = menu.querySelector('.menu-label');

function positionMenu() {
  navigation.style.setProperty('--menu-top', `${Math.max(0, header.getBoundingClientRect().bottom)}px`);
}

function closeMenu({ restoreFocus = false } = {}) {
  const wasOpen = menu.getAttribute('aria-expanded') === 'true';
  menu.setAttribute('aria-expanded', 'false');
  menuLabel.textContent = 'Menu';
  navigation.classList.remove('is-open');
  navigation.inert = compactNavigation.matches;
  document.documentElement.classList.remove('menu-open');
  background.forEach(element => { element.inert = false; });
  if (wasOpen && restoreFocus && compactNavigation.matches) menu.focus({ preventScroll: true });
}

function openMenu() {
  if (!compactNavigation.matches) return;
  positionMenu();
  navigation.inert = false;
  navigation.classList.add('is-open');
  menu.setAttribute('aria-expanded', 'true');
  menuLabel.textContent = 'Close';
  background.forEach(element => { element.inert = true; });
  document.documentElement.classList.add('menu-open');
  navigation.querySelector('a').focus({ preventScroll: true });
}

function syncNavigation() {
  if (menu.getAttribute('aria-expanded') === 'true') closeMenu({ restoreFocus: compactNavigation.matches });
  navigation.inert = compactNavigation.matches;
}

syncNavigation();
compactNavigation.addEventListener('change', syncNavigation);
window.addEventListener('resize', () => {
  if (menu.getAttribute('aria-expanded') === 'true') positionMenu();
});
window.addEventListener('pageshow', syncNavigation);
menu.addEventListener('click', () => {
  if (menu.getAttribute('aria-expanded') === 'true') closeMenu({ restoreFocus: true });
  else openMenu();
});
navigation.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || menu.getAttribute('aria-expanded') !== 'true') return;
  const destination = new URL(link.href);
  const samePageSection = destination.pathname === location.pathname && destination.hash;
  closeMenu();
  if (samePageSection) {
    requestAnimationFrame(() => {
      const target = document.getElementById(decodeURIComponent(destination.hash.slice(1)));
      if (target) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    });
  }
});
header.querySelector('.brand').addEventListener('click', () => {
  if (menu.getAttribute('aria-expanded') === 'true') closeMenu();
});
document.addEventListener('keydown', event => {
  if (menu.getAttribute('aria-expanded') !== 'true') return;
  if (event.key === 'Escape') return closeMenu({ restoreFocus: true });
  if (event.key !== 'Tab') return;
  const focusable = [header.querySelector('.brand'), menu, ...navigation.querySelectorAll('a[href], select:not(:disabled)')];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
});
window.addEventListener('hashchange', () => {
  if (menu.getAttribute('aria-expanded') === 'true') closeMenu({ restoreFocus: true });
});
document.querySelector('#year').textContent = new Date().getFullYear();

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


// If a visitor prefers a call, make sure we have a number to use.
const contactMethod = document.querySelector('#contact-method');
const contactPhone = document.querySelector('#contact-phone');
if (contactMethod && contactPhone) {
  const updatePhoneRequirement = () => {
    contactPhone.required = contactMethod.value === 'Phone';
    contactPhone.closest('.field').querySelector('label span').textContent =
      contactPhone.required ? 'Required for a call' : 'Optional';
  };
  contactMethod.addEventListener('change', updatePhoneRequirement);
  updatePhoneRequirement();
}
