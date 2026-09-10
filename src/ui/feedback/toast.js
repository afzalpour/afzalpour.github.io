'use strict';

import {
  errorMessageFa
} from '../errors/error-messages-fa.js';

let toastTimer = null;

export function toast(message) {

  const el =
    document.getElementById('toast');

  if (!el) {
    return;
  }

  el.textContent = message;
  el.classList.add('show');

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer =
    setTimeout(
      () => {
        el.classList.remove('show');
      },
      2800
    );
}

export function showError(
  error,
  where = ''
) {

  console.error(
    where,
    error
  );

  toast(
    errorMessageFa(error)
  );
}
