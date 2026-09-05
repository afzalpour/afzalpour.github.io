'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const cloud = installAvanCloud();
let authorized = false;
let observer = null;

function openControlPlane() {
  location.href = './platform-admin.html';
}

function ensureEntry() {
  if (!authorized) return;

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

async function install() {
  try {
    const me = await cloud.rpc('platform_admin_me', {});
    authorized = Boolean(me?.authorized);
  } catch {
    authorized = false;
  }

  if (!authorized) return;
  ensureEntry();
  observer = new MutationObserver(ensureEntry);
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
