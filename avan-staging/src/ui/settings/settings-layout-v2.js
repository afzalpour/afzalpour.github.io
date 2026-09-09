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
    html[data-avan-settings-layout-active="1"] #content > #currencySettingsCard,
    html[data-avan-settings-layout-active="1"] #content > #rc15TaxSettingsCard,
    html[data-avan-settings-layout-active="1"] #content > #workspaceAccessCard,
    html[data-avan-settings-layout-active="1"] #content > #avanSupportAccessCard{
      visibility:hidden!important;position:absolute!important;pointer-events:none!important;
    }
    .avan-settings-extension-stack{display:flex;flex-direction:column;gap:18px;margin-top:18px}
    .avan-settings-extension-slot{display:block;position:relative;box-sizing:border-box}
    .avan-settings-extension-slot>.section{margin-top:0!important}
    .avan-account-money-slot{display:block;position:relative;min-height:188px;margin-top:14px}
    .avan-settings-extension-slot[data-avan-tax-slot]{min-height:300px}
    .avan-settings-extension-slot[data-avan-access-slot]{min-height:410px}
    .avan-settings-extension-slot[data-avan-support-slot]{min-height:190px}
    .avan-settings-slot-placeholder{
      width:100%;min-height:100%;box-sizing:border-box;border:1px dashed var(--line);border-radius:12px;
      background:var(--surface2);color:var(--faint);display:flex;align-items:center;justify-content:center;
      padding:16px;font-size:12px;text-align:center;
    }
    .avan-account-money-slot>.avan-settings-slot-placeholder{min-height:188px}
    .avan-settings-extension-slot[data-avan-tax-slot]>.avan-settings-slot-placeholder{min-height:300px}
    .avan-settings-extension-slot[data-avan-access-slot]>.avan-settings-slot-placeholder{min-height:410px}
    .avan-settings-extension-slot[data-avan-support-slot]>.avan-settings-slot-placeholder{min-height:190px}
    .avan-account-money-slot>#currencySettingsCard,
    .avan-settings-extension-slot[data-avan-tax-slot]>#rc15TaxSettingsCard,
    .avan-settings-extension-slot[data-avan-access-slot]>#workspaceAccessCard,
    .avan-settings-extension-slot[data-avan-support-slot]>#avanSupportAccessCard{
      visibility:visible!important;position:static!important;pointer-events:auto!important;
    }
    .avan-account-money-settings{
      margin-top:0;padding-top:16px;border-top:1px solid var(--line);
      box-shadow:none!important;background:transparent!important;border-radius:0!important;
    }
    .avan-account-money-settings .section-head{align-items:flex-start}
    .avan-account-money-settings h2{font-size:15px;margin:0}
    .avan-account-money-settings .info-box{margin-bottom:0}
    .avan-access-stable-shell{min-height:410px}
    .avan-access-stable-body{min-height:310px}
    .avan-support-stable-shell{min-height:190px}
    .avan-support-stable-shell [data-avan-support-list]{min-height:72px}
  `;
  documentObject.head.append(style);
}

function ensurePlaceholder(slot, key, label, selector, documentObject) {
  if (slot.querySelector(`:scope > ${selector}`)) return null;
  let placeholder = slot.querySelector(`:scope > [data-avan-settings-placeholder="${key}"]`);
  if (!placeholder) {
    placeholder = documentObject.createElement('div');
    placeholder.className = 'avan-settings-slot-placeholder';
    placeholder.dataset.avanSettingsPlaceholder = key;
    placeholder.textContent = `در حال آماده‌سازی ${label}…`;
    slot.append(placeholder);
  }
  return placeholder;
}

function clearPlaceholder(slot, key) {
  slot.querySelector(`:scope > [data-avan-settings-placeholder="${key}"]`)?.remove();
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
  ensurePlaceholder(moneySlot, 'money', 'واحد پول', '#currencySettingsCard', documentObject);

  let stack = root.querySelector(':scope > [data-avan-settings-extension-stack]');
  if (!stack) {
    stack = documentObject.createElement('div');
    stack.className = 'avan-settings-extension-stack';
    stack.dataset.avanSettingsExtensionStack = '1';
    accountCard.after(stack);
  }

  let taxSlot = stack.querySelector(':scope > [data-avan-tax-slot]');
  if (!taxSlot) {
    taxSlot = documentObject.createElement('div');
    taxSlot.className = 'avan-settings-extension-slot';
    taxSlot.dataset.avanTaxSlot = '1';
    stack.append(taxSlot);
  }
  ensurePlaceholder(taxSlot, 'tax', 'مالیات و ارزش افزوده', '#rc15TaxSettingsCard', documentObject);

  let accessSlot = stack.querySelector(':scope > [data-avan-access-slot]');
  if (!accessSlot) {
    accessSlot = documentObject.createElement('div');
    accessSlot.className = 'avan-settings-extension-slot';
    accessSlot.dataset.avanAccessSlot = '1';
    stack.append(accessSlot);
  }
  ensurePlaceholder(accessSlot, 'access', 'کاربران و دسترسی‌ها', '#workspaceAccessCard', documentObject);

  let supportSlot = stack.querySelector(':scope > [data-avan-support-slot]');
  if (!supportSlot) {
    supportSlot = documentObject.createElement('div');
    supportSlot.className = 'avan-settings-extension-slot';
    supportSlot.dataset.avanSupportSlot = '1';
    stack.append(supportSlot);
  }
  ensurePlaceholder(supportSlot, 'support', 'دسترسی پشتیبانی آوان', '#avanSupportAccessCard', documentObject);

  return { moneySlot, taxSlot, accessSlot, supportSlot };
}

export function prepareSettingsLayout(documentObject = document) {
  installStyle(documentObject);
  const html = documentObject.documentElement;
  if (!isSettings(documentObject)) {
    if (html) delete html.dataset.avanSettingsLayoutActive;
    return null;
  }
  if (html) html.dataset.avanSettingsLayoutActive = '1';

  const root = documentObject.getElementById('content');
  if (!root) return null;
  const accountCard = cardByHeading(root, 'حساب کاربری');
  if (!accountCard) return null;
  return { root, accountCard, ...ensureStableSlots(root, accountCard, documentObject) };
}

export function projectSettingsLayout(documentObject = document) {
  const layout = prepareSettingsLayout(documentObject);
  if (!layout) return false;
  const { root, moneySlot, taxSlot, accessSlot, supportSlot } = layout;

  const moneyCard = root.querySelector('#currencySettingsCard,[data-avan-money-settings]');
  if (moneyCard) {
    if (moneyCard.parentElement !== moneySlot) moneySlot.append(moneyCard);
    moneyCard.classList.remove('card', 'section');
    moneyCard.classList.add('avan-account-money-settings');
    moneyCard.dataset.avanSettingsSection = 'account-money';
    moneyCard.dataset.avanSettingsMounted = 'account';
    clearPlaceholder(moneySlot, 'money');
  }

  const taxCard = root.querySelector('#rc15TaxSettingsCard,[data-rc15-tax-settings-singleton],[data-rc15-tax-settings]');
  if (taxCard) {
    if (taxCard.parentElement !== taxSlot) taxSlot.append(taxCard);
    taxCard.dataset.avanSettingsOrder = 'before-access';
    taxCard.dataset.avanSettingsMounted = 'tax';
    clearPlaceholder(taxSlot, 'tax');
  }

  const accessCard = root.querySelector('#workspaceAccessCard,[data-rc11-access-card]');
  if (accessCard) {
    if (accessCard.parentElement !== accessSlot) accessSlot.append(accessCard);
    accessCard.dataset.avanSettingsMounted = 'access';
    clearPlaceholder(accessSlot, 'access');
  }

  const supportCard = root.querySelector('#avanSupportAccessCard');
  if (supportCard) {
    if (supportCard.parentElement !== supportSlot) supportSlot.append(supportCard);
    supportCard.dataset.avanSettingsMounted = 'support';
    clearPlaceholder(supportSlot, 'support');
  }

  return true;
}

export function installSettingsLayoutV2({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanSettingsLayoutV2?.installed) return globalObject.AvanSettingsLayoutV2;
  installStyle(documentObject);
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });

  Lifecycle.use('settings:layout-prepare', () => prepareSettingsLayout(documentObject), { priority: 5 });
  Lifecycle.use('settings:layout-v2', () => projectSettingsLayout(documentObject), { priority: 980 });

  globalObject.addEventListener('avan:page-rendered', () => {
    prepareSettingsLayout(documentObject);
    Lifecycle.schedule('settings-layout-page');
  });
  globalObject.addEventListener('avan:company-context-changed', () => Lifecycle.schedule('settings-layout-company'));

  const api = Object.freeze({
    installed: true,
    prepare: () => prepareSettingsLayout(documentObject),
    project: () => projectSettingsLayout(documentObject),
    mountTarget(key) {
      const layout = prepareSettingsLayout(documentObject);
      if (!layout) return null;
      if (key === 'money') return layout.moneySlot;
      if (key === 'tax') return layout.taxSlot;
      if (key === 'access') return layout.accessSlot;
      if (key === 'support') return layout.supportSlot;
      return null;
    }
  });
  globalObject.AvanSettingsLayoutV2 = api;
  Lifecycle.schedule('settings-layout-v2-ready');
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installSettingsLayoutV2();
