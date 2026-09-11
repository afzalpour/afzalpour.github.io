'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const Lifecycle = HAS_BROWSER ? installUiLifecycle() : null;
let installed = false;

function isPartiesPage() {
  return String(document.getElementById('pageTitle')?.textContent || '').trim() === 'طرف‌حساب‌ها';
}

function purgeLegacyInjectedButtons() {
  document.querySelectorAll('.avan-counterparty-360-button,[data-counterparty-360]').forEach(node => node.remove());
}

function partyIdFromActionCell(target) {
  const cell = target?.closest?.('tr[data-party-master-row] > td:last-child');
  if (!cell || !isPartiesPage()) return null;
  if (target?.closest?.('[data-party-master-edit]')) return null;
  const row = cell.closest('tr[data-party-master-row]');
  const partyId = String(row?.dataset?.partyMasterRow || '').trim();
  return partyId || null;
}

function onClick(event) {
  const partyId = partyIdFromActionCell(event.target);
  if (!partyId) return;
  event.preventDefault();
  event.stopPropagation();
  window.AvanCounterparty360?.open?.(partyId);
}

function onKeydown(event) {
  if (!['Enter', ' '].includes(event.key)) return;
  const partyId = partyIdFromActionCell(event.target);
  if (!partyId) return;
  event.preventDefault();
  window.AvanCounterparty360?.open?.(partyId);
}

function stabilize() {
  purgeLegacyInjectedButtons();
}

export function installCounterparty360StaticActionV2() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;

  Lifecycle?.remove?.('parties:counterparty-360-actions');
  purgeLegacyInjectedButtons();
  Lifecycle?.use?.('parties:counterparty-360-static-v2', stabilize, { priority: 245 });
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeydown, true);

  window.AvanCounterparty360StaticV2 = Object.freeze({
    installed: true,
    mutationFree: true,
    staticActionCell: true
  });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installCounterparty360StaticActionV2, { once: true });
  } else {
    installCounterparty360StaticActionV2();
  }
}
