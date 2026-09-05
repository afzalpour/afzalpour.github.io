'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const cloud = installAvanCloud();
let authorized = false;
let observer = null;
let checkTimer = null;
let checking = false;
let lastSessionUserId = null;

function openControlPlane() {
  location.href = './platform-admin.html';
}

function removeEntries() {
  document.getElementById('avanPlatformAdminEntry')?.remove();
  document.getElementById('avanPlatformAdminPortfolioEntry')?.remove();
}

function ensureEntry() {
  if (!authorized) {
    removeEntries();
    return;
  }

  const topbar = document.querySelector('.topbar');
  if (topbar && !document.getElementById('avanPlatformAdminEntry')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'avanPlatformAdminEntry';
    button.className = 'ghost small avan-platform-admin-entry';
    button.textContent = 'مدیریت کل آوان';
    button.onclick = openControlPlane;
    topbar.append(button);
  }

  const portfolio = document.getElementById('avanCompanyPortfolio');
  const foot = portfolio?.querySelector('.avan-company-portfolio-foot');
  if (foot && !foot.querySelector('#avanPlatformAdminPortfolioEntry')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'avanPlatformAdminPortfolioEntry';
    button.className = 'ghost avan-platform-admin-portfolio-entry';
    button.textContent = 'کنترل‌پنل ادمین آوان';
    button.onclick = openControlPlane;
    foot.append(button);
  }
}

async function readSessionUserId() {
  try {
    const user = await cloud.user();
    return user?.id || null;
  } catch {
    return null;
  }
}

async function revalidateAuthorization({ force = false } = {}) {
  if (checking) return;
  checking = true;

  try {
    const sessionUserId = await readSessionUserId();
    if (!force && sessionUserId === lastSessionUserId) {
      ensureEntry();
      return;
    }

    lastSessionUserId = sessionUserId;

    if (!sessionUserId) {
      authorized = false;
      removeEntries();
      return;
    }

    try {
      const me = await cloud.rpc('platform_admin_me', {});
      authorized = Boolean(me?.authorized);
    } catch {
      authorized = false;
    }

    ensureEntry();
  } finally {
    checking = false;
  }
}

function scheduleRevalidate(force = false) {
  if (checkTimer) clearTimeout(checkTimer);
  checkTimer = setTimeout(() => {
    checkTimer = null;
    void revalidateAuthorization({ force });
  }, 40);
}

function install() {
  observer = new MutationObserver(mutations => {
    let authShellChanged = false;
    let shouldEnsure = false;

    for (const mutation of mutations) {
      if (
        mutation.type === 'attributes' &&
        mutation.attributeName === 'hidden' &&
        (mutation.target?.id === 'appShell' || mutation.target?.id === 'authShell')
      ) {
        authShellChanged = true;
      }

      if (mutation.type === 'childList') {
        shouldEnsure = true;
      }
    }

    if (authShellChanged) {
      scheduleRevalidate(true);
    } else if (shouldEnsure) {
      ensureEntry();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden']
  });

  window.addEventListener('pageshow', () => scheduleRevalidate(true));
  window.addEventListener('focus', () => scheduleRevalidate(false));

  void revalidateAuthorization({ force: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
