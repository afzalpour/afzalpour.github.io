'use strict';

function removeLegacyWorkspaceSwitcher() {
  document.getElementById('avanWorkspaceSwitcherHost')?.remove();
}

function publishBoundaryState() {
  const cloud = window.AvanCloud;
  const boundary = cloud?.companyBoundary;
  window.AvanCompanyBoundaryHealth = Object.freeze({
    ready: Boolean(boundary?.requireActiveCompany),
    projection: cloud?.workspaceProjectionMode || 'unknown',
    checked_at: new Date().toISOString()
  });
}

function install() {
  removeLegacyWorkspaceSwitcher();
  publishBoundaryState();

  const observer = new MutationObserver(() => removeLegacyWorkspaceSwitcher());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('avan:company-context-changed', () => {
    removeLegacyWorkspaceSwitcher();
    publishBoundaryState();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
