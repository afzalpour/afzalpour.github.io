'use strict';

import {
  createAuthController
} from './src/application/auth/auth-controller.js';

import {
  errorMessageFa
} from './src/ui/errors/error-messages-fa.js';

const COOLDOWN_KEY =
  'avan.auth_recovery_cooldown_until';
const COOLDOWN_MS = 60 * 1000;

const byId = id => document.getElementById(id);

function esc(value) {
  return String(value ?? '').replace(
    /[&<>'"]/g,
    ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[ch])
  );
}

function authStatus(html) {
  const target = byId('authStatus');
  if (target) target.innerHTML = html;
}

function showAuthShell() {
  const authShell = byId('authShell');
  const appShell = byId('appShell');
  const bottomNav = byId('bottomNav');

  if (authShell) authShell.hidden = false;
  if (appShell) appShell.hidden = true;
  if (bottomNav) bottomNav.hidden = true;
}

function parseAuthError() {
  const hash = new URLSearchParams(
    String(location.hash || '').replace(/^#/, '')
  );
  const query = new URLSearchParams(location.search || '');

  const pick = key => hash.get(key) || query.get(key) || '';
  const error = pick('error');
  const code = pick('error_code');
  const description = pick('error_description');

  if (!error && !code && !description) return null;

  return {
    error,
    code,
    description
  };
}

function recoveryErrorMessage(callbackError) {
  const code = String(callbackError?.code || '').toLowerCase();
  const description = String(
    callbackError?.description || ''
  ).toLowerCase();

  if (
    code.includes('otp_expired') ||
    code.includes('expired') ||
    description.includes('expired')
  ) {
    return 'لینک بازیابی منقضی شده است. دوباره «فراموشی رمز عبور» را بزنید تا لینک جدید ارسال شود.';
  }

  return 'لینک بازیابی معتبر نیست یا قبلاً استفاده شده است. یک لینک بازیابی جدید درخواست کنید.';
}

function cleanAuthCallbackUrl() {
  const url = new URL(location.href);
  const authKeys = [
    'error',
    'error_code',
    'error_description',
    'access_token',
    'refresh_token',
    'expires_in',
    'expires_at',
    'token_type',
    'type'
  ];

  authKeys.forEach(key => url.searchParams.delete(key));
  url.hash = '';

  history.replaceState(
    null,
    document.title,
    url.pathname +
      (url.searchParams.toString()
        ? `?${url.searchParams.toString()}`
        : '')
  );
}

function handleAuthCallbackError() {
  const callbackError = parseAuthError();
  if (!callbackError) return false;

  cleanAuthCallbackUrl();
  showAuthShell();
  authStatus(
    `<span class="error-box" style="display:block">${
      esc(recoveryErrorMessage(callbackError))
    }</span>`
  );

  window.setTimeout(
    () => byId('authEmail')?.focus({ preventScroll: true }),
    0
  );

  return true;
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function readCooldownUntil() {
  try {
    return Number(
      sessionStorage.getItem(COOLDOWN_KEY) || 0
    );
  } catch {
    return 0;
  }
}

function writeCooldownUntil(value) {
  try {
    sessionStorage.setItem(COOLDOWN_KEY, String(value));
  } catch {
    // Cooldown is a UI guard only; never block recovery if storage is unavailable.
  }
}

function errorText(error) {
  if (Number(error?.status) === 429) {
    return 'درخواست بازیابی خیلی زود تکرار شده است. کمی صبر کنید و دوباره تلاش کنید.';
  }

  const code = String(
    error?.payload?.code ||
    error?.payload?.error_code ||
    ''
  ).toLowerCase();

  if (code.includes('rate_limit')) {
    return 'تعداد درخواست‌های بازیابی بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.';
  }

  return errorMessageFa(error);
}

function installRecoveryRequest() {
  const button = byId('forgotPasswordBtn');
  const emailInput = byId('authEmail');
  const cloud = window.AvanCloud;

  if (!button || !emailInput || !cloud) return;

  const auth = createAuthController(cloud);
  let timer = null;

  function stopTimer() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function renderCooldown() {
    const remainingMs = readCooldownUntil() - Date.now();

    if (remainingMs <= 0) {
      stopTimer();
      button.disabled = false;
      button.textContent = 'فراموشی رمز عبور';
      return;
    }

    const seconds = Math.ceil(remainingMs / 1000);
    button.disabled = true;
    button.textContent = `ارسال دوباره تا ${seconds} ثانیه`;
  }

  function beginCooldown() {
    writeCooldownUntil(Date.now() + COOLDOWN_MS);
    renderCooldown();
    stopTimer();
    timer = window.setInterval(renderCooldown, 1000);
  }

  button.onclick = async () => {
    const email = String(emailInput.value || '').trim();

    if (!email) {
      authStatus(
        '<span class="error-box" style="display:block">ابتدا ایمیل خود را وارد کنید.</span>'
      );
      emailInput.focus();
      return;
    }

    if (!validEmail(email)) {
      authStatus(
        '<span class="error-box" style="display:block">فرمت ایمیل صحیح نیست.</span>'
      );
      emailInput.focus();
      return;
    }

    if (readCooldownUntil() > Date.now()) {
      renderCooldown();
      return;
    }

    button.disabled = true;
    button.textContent = 'در حال ارسال…';
    authStatus(
      '<span class="muted">در حال ثبت درخواست بازیابی…</span>'
    );

    try {
      await auth.requestPasswordReset(email);

      authStatus(
        '<span class="success-box" style="display:block">اگر این ایمیل در آوان ثبت شده باشد، لینک بازیابی ارسال می‌شود. پوشه Spam/Junk را هم بررسی کنید.</span>'
      );
      beginCooldown();
    } catch (error) {
      button.disabled = false;
      button.textContent = 'فراموشی رمز عبور';
      authStatus(
        `<span class="error-box" style="display:block">${
          esc(errorText(error))
        }</span>`
      );
    }
  };

  renderCooldown();
  if (readCooldownUntil() > Date.now()) {
    timer = window.setInterval(renderCooldown, 1000);
  }
}

handleAuthCallbackError();
installRecoveryRequest();
