'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';

function isSettings(documentObject) {
  return documentObject.getElementById('pageTitle')?.textContent?.trim() === 'تنظیمات';
}

function cardByHeading(root, heading) {
  return [...(root?.querySelectorAll?.('.card') || [])].find(card =>
    [...card.querySelectorAll('h2')].some(node => node.textContent?.trim() === heading)
  ) || null;
}

function installStyle(documentObject) {
  if (documentObject.getElementById('avanSettingsLayoutV2Style')) return;
  const style = documentObject.createElement('style');
  style.id = 'avanSettingsLayoutV2Style';
  style.textContent = `
    .avan-account-money-settings{margin-top:18px;padding-top:16px;border-top:1px solid var(--line);box-shadow:none!important;background:transparent!important;border-radius:0!important}
    .avan-account-money-settings .section-head{align-items:flex-start}
    .avan-account-money-settings h2{font-size:15px;margin:0}
    .avan-account-money-settings .info-box{margin-bottom:0}
  `;
  documentObject.head.append(style);
}

export function projectSettingsLayout(documentObject = document) {
  if (!isSettings(documentObject)) return false;
  const root = documentObject.getElementById('content');
  if (!root) return false;
  installStyle(documentObject);

  const accountCard = cardByHeading(root, 'حساب کاربری');
  const moneyCard = root.querySelector('#currencySettingsCard,[data-avan-money-settings]');
  if (accountCard && moneyCard && moneyCard.parentElement !== accountCard) accountCard.append(moneyCard);
  if (moneyCard?.parentElement === accountCard) {
    moneyCard.classList.remove('card', 'section');
    moneyCard.classList.add('avan-account-money-settings');
    moneyCard.dataset.avanSettingsSection = 'account-money';
  }

  const taxCard = root.querySelector('#rc15TaxSettingsCard,[data-rc15-tax-settings-singleton],[data-rc15-tax-settings]');
  const accessCard = root.querySelector('[data-rc11-access-card]');
  if (taxCard && accessCard && taxCard.nextElementSibling !== accessCard) accessCard.before(taxCard);
  if (taxCard) taxCard.dataset.avanSettingsOrder = 'before-access';

  return true;
}

function scheduleProjection(Lifecycle) {
  [0, 120, 420, 1000, 2400].forEach(delay => {
    window.setTimeout(() => Lifecycle.schedule(`settings-layout-v2-${delay}`), delay);
  });
}

export function installSettingsLayoutV2({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanSettingsLayoutV2?.installed) return globalObject.AvanSettingsLayoutV2;
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  Lifecycle.use('settings:layout-v2', () => projectSettingsLayout(documentObject), { priority: 980 });
  globalObject.addEventListener('avan:page-rendered', () => scheduleProjection(Lifecycle));
  documentObject.addEventListener('avan:ui-changed', () => Lifecycle.schedule('settings-layout-v2-ui'));
  globalObject.addEventListener('avan:company-context-changed', () => scheduleProjection(Lifecycle));
  const api = Object.freeze({ installed: true, project: () => projectSettingsLayout(documentObject) });
  globalObject.AvanSettingsLayoutV2 = api;
  Lifecycle.schedule('settings-layout-v2-ready');
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installSettingsLayoutV2();
