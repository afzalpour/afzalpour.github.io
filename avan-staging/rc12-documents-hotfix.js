'use strict';

const RETURN_KEY = 'avan.rc12c.return_page';

function setReturnToDocuments() {
  try {
    window.sessionStorage?.setItem(RETURN_KEY, 'documents');
  } catch {
    // Navigation recovery is optional and must not block OCR persistence.
  }
}

function consumeReturnTarget() {
  try {
    const value = window.sessionStorage?.getItem(RETURN_KEY) || '';
    if (value === 'documents') {
      window.sessionStorage?.removeItem(RETURN_KEY);
      return value;
    }
  } catch {
    // Ignore unavailable session storage.
  }
  return '';
}

function restoreDocumentsPage() {
  const target = consumeReturnTarget();
  if (target !== 'documents') return;

  let attempts = 0;
  const maxAttempts = 80;

  const timer = window.setInterval(() => {
    attempts += 1;

    const shell = document.getElementById('appShell');
    const button = document.querySelector('[data-page="documents"]');

    if (shell && !shell.hidden && button) {
      window.clearInterval(timer);
      window.setTimeout(() => button.click(), 60);
      return;
    }

    if (attempts >= maxAttempts) {
      window.clearInterval(timer);
    }
  }, 100);
}

window.AvanRc12DocumentNavigation = {
  setReturnToDocuments
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', restoreDocumentsPage, { once: true });
} else {
  restoreDocumentsPage();
}
