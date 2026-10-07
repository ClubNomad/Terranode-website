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
