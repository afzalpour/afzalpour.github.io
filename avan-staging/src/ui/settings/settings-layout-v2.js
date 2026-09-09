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
    html[data-avan-settings-layout-active="1"] #content #currencySettingsCard:not(.avan-account-money-settings),
    html[data-avan-settings-layout-active="1"] #content #rc15TaxSettingsCard:not([data-avan-settings-order="before-access"]){
      visibility:hidden!important;
    }
    .avan-account-money-settings{
      visibility:visible!important;margin-top:18px;padding-top:16px;border-top:1px solid var(--line);
      box-shadow:none!important;background:transparent!important;border-radius:0!important;
    }
    .avan-account-money-settings .section-head{align-items:flex-start}
    .avan-account-money-settings h2{font-size:15px;margin:0}
    .avan-account-money-settings .info-box{margin-bottom:0}
    #rc15TaxSettingsCard[data-avan-settings-order="before-access"]{visibility:visible!important}
  `;
  documentObject.head.append(style);
}

export function projectSettingsLayout(documentObject = document) {
  installStyle(documentObject);
  const html = documentObject.documentElement;
  if (!isSettings(documentObject)) {
    if (html) delete html.dataset.avanSettingsLayoutActive;
    return false;
  }
  if (html) html.dataset.avanSettingsLayoutActive = '1';

  const root = documentObject.getElementById('content');
  if (!root) return false;

  const accountCard = cardByHeading(root, 'حساب کاربری');
  const moneyCard = root.querySelector('#currencySettingsCard,[data-avan-money-settings]');
  if (moneyCard && accountCard) {
    if (moneyCard.parentElement !== accountCard) accountCard.append(moneyCard);
    moneyCard.classList.remove('card', 'section');
    moneyCard.classList.add('avan-account-money-settings');
    moneyCard.dataset.avanSettingsSection = 'account-money';
  }

  const taxCard = root.querySelector('#rc15TaxSettingsCard,[data-rc15-tax-settings-singleton],[data-rc15-tax-settings]');
  const accessCard = root.querySelector('[data-rc11-access-card]');
  if (taxCard && accessCard) {
    if (taxCard.nextElementSibling !== accessCard) accessCard.before(taxCard);
    taxCard.dataset.avanSettingsOrder = 'before-access';
  }

  return Boolean((!moneyCard || accountCard) && (!taxCard || accessCard));
}

export function installSettingsLayoutV2({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanSettingsLayoutV2?.installed) return globalObject.AvanSettingsLayoutV2;
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  Lifecycle.use('settings:layout-v2', () => projectSettingsLayout(documentObject), { priority: 980 });
  globalObject.addEventListener('avan:page-rendered', () => Lifecycle.schedule('settings-layout-page'));
  documentObject.addEventListener('avan:ui-changed', () => Lifecycle.schedule('settings-layout-ui'));
  globalObject.addEventListener('avan:company-context-changed', () => Lifecycle.schedule('settings-layout-company'));
  const api = Object.freeze({ installed: true, project: () => projectSettingsLayout(documentObject) });
  globalObject.AvanSettingsLayoutV2 = api;
  Lifecycle.schedule('settings-layout-v2-ready');
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installSettingsLayoutV2();
