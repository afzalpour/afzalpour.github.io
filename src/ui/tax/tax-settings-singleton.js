'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';

export function collapseTaxSettingsCards(documentObject = document) {
  const title = documentObject.getElementById?.('pageTitle')?.textContent?.trim();
  const root = documentObject.getElementById?.('content');
  if (title !== 'تنظیمات' || !root?.querySelectorAll) return 0;

  const cards = [...root.querySelectorAll('[data-rc15-tax-settings]')]
    .filter(card => card?.isConnected !== false);
  if (cards.length <= 1) return 0;

  // Keep the newest render. A save can race with the generic UI lifecycle:
  // both renders are valid, but only the last one contains the freshest state.
  const keep = cards[cards.length - 1];
  let removed = 0;
  for (const card of cards) {
    if (card === keep) continue;
    card.remove();
    removed += 1;
  }
  return removed;
}

export function installTaxSettingsSingleton({
  globalObject = window,
  documentObject = document
} = {}) {
  if (globalObject.AvanTaxSettingsSingleton?.installed) {
    return globalObject.AvanTaxSettingsSingleton;
  }

  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  const collapse = () => collapseTaxSettingsCards(documentObject);

  Lifecycle.use('tax:settings-singleton', collapse, { priority: 990 });
  documentObject.addEventListener('submit', event => {
    if (event.target?.id !== 'rc15TaxSettingsForm') return;
    // The actual save is async. The central lifecycle catches the eventual DOM
    // append; these passes also clean any pre-existing duplicate immediately.
    collapse();
    globalObject.queueMicrotask?.(collapse);
  }, true);

  const api = Object.freeze({ installed: true, collapse });
  globalObject.AvanTaxSettingsSingleton = api;
  return api;
}
