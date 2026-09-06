'use strict';

import {
  jalalizeDateInputs
} from '../date/jalali-picker.js';

const byId = id =>
  document.getElementById(id);

export function openModal(html) {

  const modal =
    byId('modal');

  const backdrop =
    byId('modalBackdrop');

  if (!modal || !backdrop) {
    return;
  }

  modal.innerHTML = html;

  jalalizeDateInputs(modal);

  backdrop.hidden = false;

  document.body.classList.add(
    'mobile-scroll-lock'
  );

  window.dispatchEvent(
    new CustomEvent('avan:modal-opened', {
      detail: {
        heading:
          modal.querySelector('h2')?.textContent || ''
      }
    })
  );
}

export function closeModal() {

  const modal =
    byId('modal');

  const backdrop =
    byId('modalBackdrop');

  if (!modal || !backdrop) {
    return;
  }

  backdrop.hidden = true;
  modal.innerHTML = '';

  document.body.classList.remove(
    'mobile-scroll-lock'
  );
}

export function bindModalBackdrop() {

  const backdrop =
    byId('modalBackdrop');

  if (!backdrop) {
    return;
  }

  if (
    backdrop.dataset.modalBound === '1'
  ) {
    return;
  }

  backdrop.dataset.modalBound = '1';

  backdrop.addEventListener(
    'click',
    event => {

      if (event.target === backdrop) {
        closeModal();
      }
    }
  );
}
