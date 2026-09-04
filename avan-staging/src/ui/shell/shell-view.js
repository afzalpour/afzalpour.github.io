'use strict';

import {
  jalalizeDateInputs
} from '../date/jalali-picker.js';

const byId = id =>
  document.getElementById(id);

export function setTitle(title) {

  const pageTitle =
    byId('pageTitle');

  const breadcrumb =
    byId('breadcrumb');

  if (pageTitle) {
    pageTitle.textContent = title;
  }

  if (breadcrumb) {
    breadcrumb.textContent =
      `آوان › ${title}`;
  }
}

export function setNav(pageName) {

  document
    .querySelectorAll('[data-page]')
    .forEach(item => {

      item.classList.toggle(
        'active',
        item.dataset.page === pageName
      );
    });
}

export function page(html) {

  const content =
    byId('content');

  if (!content) {
    return;
  }

  content.innerHTML = html;

  jalalizeDateInputs(content);
}
