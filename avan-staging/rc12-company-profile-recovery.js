'use strict';

import { toast } from './src/ui/feedback/toast.js';

let scheduled = null;

function findPatchCard() {
  const card = document.querySelector('[data-avan-company-profile]');
  if (!card) return null;

  const error = card.querySelector('.error-box');
  if (!error) return null;

  const text = String(error.textContent || '');
  return /RC1_2_E_COMPANY_PROFILE_PATCH\.sql|Patch مرحله RC1\.2-E/.test(text)
    ? card
    : null;
}

function enhancePatchCard() {
  const card = findPatchCard();
  if (!card || card.querySelector('[data-avan-company-retry]')) return;

  const error = card.querySelector('.error-box');
  if (error) {
    error.innerHTML = `
      اتصال API به «هویت شرکت در چاپ» هنوز آماده نیست.
      اگر Patch اجرا شده است، ممکن است Schema Cache سرویس Supabase هنوز تازه نشده باشد.
    `;
  }

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const status = document.createElement('span');
  status.className = 'muted';
  status.dataset.avanCompanyRetryStatus = '1';

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'primary';
  retry.dataset.avanCompanyRetry = '1';
  retry.textContent = 'بررسی مجدد اتصال';

  retry.onclick = async () => {
    retry.disabled = true;
    status.textContent = 'در حال بررسی…';

    try {
      if (!window.AvanCompanyProfile?.refresh) {
        throw new Error('COMPANY_PROFILE_CLIENT_NOT_READY');
      }

      await window.AvanCompanyProfile.refresh();

      window.setTimeout(() => {
        const stillMissing = Boolean(findPatchCard());
        if (stillMissing) {
          status.textContent = 'RPC هنوز از API قابل مشاهده نیست؛ Recovery Patch را اعمال کنید.';
          retry.disabled = false;
          toast('اتصال هویت شرکت هنوز آماده نیست.');
        } else {
          toast('اتصال هویت شرکت برقرار شد.');
        }
      }, 220);
    } catch (error) {
      console.warn('[Avan company profile recovery] retry failed', error);
      status.textContent = 'بررسی اتصال انجام نشد.';
      retry.disabled = false;
    }
  };

  actions.append(status, retry);
  card.appendChild(actions);
}

function schedule() {
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(() => {
    scheduled = null;
    enhancePatchCard();
  }, 100);
}

function install() {
  enhancePatchCard();
  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
