'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';

const Lifecycle = installUiLifecycle();

function enhanceLogoFileInput() {
  const input = document.getElementById('avanCompanyLogoFile');
  if (!input || input.dataset.avanPersianFile === '1') return;

  input.dataset.avanPersianFile = '1';
  input.style.position = 'absolute';
  input.style.inlineSize = '1px';
  input.style.blockSize = '1px';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';

  const control = document.createElement('div');
  control.className = 'avan-persian-file-control';
  control.style.display = 'flex';
  control.style.alignItems = 'center';
  control.style.gap = '10px';
  control.style.flexWrap = 'wrap';
  control.style.marginTop = '6px';
  control.innerHTML = `
    <label for="avanCompanyLogoFile" class="ghost small" style="cursor:pointer">انتخاب فایل</label>
    <span class="muted" data-avan-file-name>فایلی انتخاب نشده است</span>
  `;

  input.insertAdjacentElement('afterend', control);
  const name = control.querySelector('[data-avan-file-name]');
  input.addEventListener('change', () => {
    name.textContent = input.files?.[0]?.name || 'فایلی انتخاب نشده است';
  });
}

Lifecycle.use('company:persian-logo-file-control', enhanceLogoFileInput, { priority: 940 });
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Lifecycle.schedule('company-logo-file-ready'), { once: true });
} else {
  Lifecycle.schedule('company-logo-file-ready');
}
