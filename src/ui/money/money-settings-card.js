'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';
import { MoneyRuntime } from './money-runtime.js';
import { toast, showError } from '../feedback/toast.js';

function settingsHost(documentObject) {
  const title = documentObject.getElementById('pageTitle')?.textContent?.trim();
  return title === 'تنظیمات' ? documentObject.getElementById('content') : null;
}

function settingsMount(documentObject, host) {
  return documentObject.querySelector('[data-avan-account-money-slot]') || host;
}

function cardHtml(state) {
  const unit = state.unit;
  return `<section class="section card currency-settings-card" id="currencySettingsCard" data-avan-money-settings="1">
    <div class="section-head">
      <div>
        <h2>واحد پول</h2>
        <span class="muted">واحد انتخابی برای ورود، نمایش، گزارش و چاپ شرکت فعال استفاده می‌شود. هسته حسابداری تومان با دقت یک ریال است.</span>
      </div>
      <span class="badge">هسته: تومان</span>
    </div>
    <div class="currency-choice" role="group" aria-label="واحد نمایش و ورود">
      <button type="button" class="${unit === 'toman' ? 'active' : ''}" data-avan-money-unit-choice="toman">تومان</button>
      <button type="button" class="${unit === 'rial' ? 'active' : ''}" data-avan-money-unit-choice="rial">ریال</button>
    </div>
    <p class="muted currency-status">این تنظیم برای شرکت فعال در Cloud ذخیره می‌شود.</p>
    <div class="info-box currency-note">ورودی ریالی با دقت یک ریال و ورودی تومانی تا یک رقم اعشار، بدون بازنویسی مبالغ تاریخی، به مبلغ Canonical تبدیل می‌شود.</div>
  </section>`;
}

function mountReadyCard(state, documentObject = document) {
  const host = settingsHost(documentObject);
  if (!host || !state?.ready) return false;
  const mount = settingsMount(documentObject, host);
  const existing = host.querySelector('#currencySettingsCard');
  const signature = `${state.workspaceId}|${state.unit}|${state.revision}`;
  if (existing?.dataset.signature === signature) return true;

  const template = documentObject.createElement('template');
  template.innerHTML = cardHtml(state).trim();
  const card = template.content.firstElementChild;
  card.dataset.signature = signature;

  if (mount !== host) {
    card.classList.remove('card', 'section');
    card.classList.add('avan-account-money-settings');
    card.dataset.avanSettingsSection = 'account-money';
    card.dataset.avanSettingsMounted = 'account';
    mount.querySelector(':scope > [data-avan-settings-placeholder="money"]')?.remove();
  }

  if (existing) existing.replaceWith(card);
  else if (mount !== host) mount.append(card);
  else host.prepend(card);

  card.querySelectorAll('[data-avan-money-unit-choice]').forEach(button => {
    button.addEventListener('click', async () => {
      const next = button.dataset.avanMoneyUnitChoice;
      if (!next || next === MoneyRuntime.unit()) return;
      card.querySelectorAll('button').forEach(node => { node.disabled = true; });
      try {
        await MoneyRuntime.setUnit(next, { reload: false });
        toast(`واحد پول روی ${next === 'rial' ? 'ریال' : 'تومان'} ذخیره شد. صفحه از داده‌های اصلی بازخوانی می‌شود.`);
        window.setTimeout(() => window.location.reload(), 40);
      } catch (error) {
        showError(error, 'money preference save');
        card.querySelectorAll('button').forEach(node => { node.disabled = false; });
      }
    });
  });
  return true;
}

function render(documentObject = document) {
  if (!settingsHost(documentObject)) return false;
  if (MoneyRuntime.isReady()) return mountReadyCard(MoneyRuntime.snapshot(), documentObject);
  void MoneyRuntime.ready()
    .then(state => mountReadyCard(state, documentObject))
    .catch(error => console.warn('[Money settings]', error));
  return false;
}

export function installMoneySettingsCard({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanMoneySettings?.installed) return globalObject.AvanMoneySettings;
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  Lifecycle.use('money:settings-card', () => render(documentObject), { priority: 40 });

  globalObject.addEventListener('avan:page-rendered', () => {
    // settings-layout-v2 creates the final slot synchronously in the same event.
    // A microtask mounts this ready-state card before the browser paints, avoiding
    // the previous visible prepend -> move cycle.
    globalObject.queueMicrotask?.(() => render(documentObject));
  });

  const api = Object.freeze({ installed: true, render: () => render(documentObject) });
  globalObject.AvanMoneySettings = api;
  if (MoneyRuntime.isReady()) render(documentObject);
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installMoneySettingsCard();
