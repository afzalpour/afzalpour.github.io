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
    html[data-avan-settings-layout-active="1"] #content #currencySettingsCard:not([data-avan-settings-mounted="account"]),
    html[data-avan-settings-layout-active="1"] #content #rc15TaxSettingsCard:not([data-avan-settings-mounted="tax"]),
    html[data-avan-settings-layout-active="1"] #content #workspaceAccessCard:not([data-avan-settings-mounted="access"]){
      visibility:hidden!important;
    }
    .avan-settings-extension-stack{display:flex;flex-direction:column;gap:18px;margin-top:18px}
    .avan-settings-extension-slot{display:block}
    .avan-settings-extension-slot>.section{margin-top:0!important}
    .avan-account-money-slot{display:block}
    .avan-account-money-settings{
      visibility:visible!important;margin-top:18px;padding-top:16px;border-top:1px solid var(--line);
      box-shadow:none!important;background:transparent!important;border-radius:0!important;
    }
    .avan-account-money-settings .section-head{align-items:flex-start}
    .avan-account-money-settings h2{font-size:15px;margin:0}
    .avan-account-money-settings .info-box{margin-bottom:0}
    #rc15TaxSettingsCard[data-avan-settings-mounted="tax"],
    #workspaceAccessCard[data-avan-settings-mounted="access"]{visibility:visible!important}
  `;
  documentObject.head.append(style);
}

function ensureStableSlots(root, accountCard, documentObject) {
  let moneySlot = accountCard.querySelector(':scope > [data-avan-account-money-slot]');
  if (!moneySlot) {
    moneySlot = documentObject.createElement('div');
    moneySlot.className = 'avan-account-money-slot';
    moneySlot.dataset.avanAccountMoneySlot = '1';
    const logout = accountCard.querySelector('#logoutBtn');
    if (logout) accountCard.insertBefore(moneySlot, logout);
    else accountCard.append(moneySlot);
  }

  let stack = root.querySelector(':scope > [data-avan-settings-extension-stack]');
  if (!stack) {
    stack = documentObject.createElement('div');
    stack.className = 'avan-settings-extension-stack';
    stack.dataset.avanSettingsExtensionStack = '1';
    accountCard.before(stack);
  }

  let taxSlot = stack.querySelector(':scope > [data-avan-tax-slot]');
  if (!taxSlot) {
    taxSlot = documentObject.createElement('div');
    taxSlot.className = 'avan-settings-extension-slot';
    taxSlot.dataset.avanTaxSlot = '1';
    stack.append(taxSlot);
  }

  let accessSlot = stack.querySelector(':scope > [data-avan-access-slot]');
  if (!accessSlot) {
    accessSlot = documentObject.createElement('div');
    accessSlot.className = 'avan-settings-extension-slot';
    accessSlot.dataset.avanAccessSlot = '1';
    stack.append(accessSlot);
  }

  return { moneySlot, taxSlot, accessSlot };
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
  if (!accountCard) return false;

  const { moneySlot, taxSlot, accessSlot } = ensureStableSlots(root, accountCard, documentObject);

  const moneyCard = root.querySelector('#currencySettingsCard,[data-avan-money-settings]');
  if (moneyCard) {
    if (moneyCard.parentElement !== moneySlot) moneySlot.append(moneyCard);
    moneyCard.classList.remove('card', 'section');
    moneyCard.classList.add('avan-account-money-settings');
    moneyCard.dataset.avanSettingsSection = 'account-money';
    moneyCard.dataset.avanSettingsMounted = 'account';
  }

  const taxCard = root.querySelector('#rc15TaxSettingsCard,[data-rc15-tax-settings-singleton],[data-rc15-tax-settings]');
  if (taxCard) {
    if (taxCard.parentElement !== taxSlot) taxSlot.append(taxCard);
    taxCard.dataset.avanSettingsOrder = 'before-access';
    taxCard.dataset.avanSettingsMounted = 'tax';
  }

  const accessCard = root.querySelector('#workspaceAccessCard,[data-rc11-access-card]');
  if (accessCard) {
    if (accessCard.parentElement !== accessSlot) accessSlot.append(accessCard);
    accessCard.dataset.avanSettingsMounted = 'access';
  }

  return true;
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
