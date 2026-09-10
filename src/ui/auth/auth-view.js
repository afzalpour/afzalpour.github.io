'use strict';

const byId = id =>
  document.getElementById(id);

function installPasswordToggleStyle(documentObject) {
  if (documentObject.getElementById('avanPasswordToggleStyle')) return;
  const style = documentObject.createElement('style');
  style.id = 'avanPasswordToggleStyle';
  style.textContent = `
    .avan-password-wrap{position:relative;display:block}
    .avan-password-wrap>input{width:100%;padding-left:48px!important}
    .auth-password-toggle{
      position:absolute;left:7px;top:50%;transform:translateY(-50%);
      width:38px;height:38px;display:grid;place-items:center;padding:0;
      border:0!important;background:transparent!important;box-shadow:none!important;
      color:var(--muted,#667085);font-size:19px;line-height:1;cursor:pointer;
      border-radius:10px;z-index:2
    }
    .auth-password-toggle:hover,.auth-password-toggle:focus-visible{
      background:var(--surface2,#f3f4f6)!important;color:var(--text,#111827);outline:none
    }
  `;
  documentObject.head.append(style);
}

export function installPasswordVisibilityToggle(documentObject = document) {
  const input = documentObject.getElementById('authPassword');
  if (!input) return false;
  installPasswordToggleStyle(documentObject);

  let wrapper = input.closest('.avan-password-wrap');
  let button = wrapper?.querySelector('[data-auth-password-toggle]') || null;

  if (!wrapper) {
    wrapper = documentObject.createElement('div');
    wrapper.className = 'avan-password-wrap';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.append(input);
  }

  if (!button) {
    button = documentObject.createElement('button');
    button.type = 'button';
    button.className = 'auth-password-toggle';
    button.dataset.authPasswordToggle = '1';
    button.textContent = '👁';
    button.setAttribute('aria-label', 'نمایش رمز عبور');
    button.setAttribute('title', 'نمایش رمز عبور');
    button.setAttribute('aria-pressed', 'false');
    wrapper.append(button);
  }

  if (button.dataset.bound !== '1') {
    button.dataset.bound = '1';
    button.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      button.setAttribute('aria-pressed', showing ? 'false' : 'true');
      button.setAttribute('aria-label', showing ? 'نمایش رمز عبور' : 'مخفی کردن رمز عبور');
      button.setAttribute('title', showing ? 'نمایش رمز عبور' : 'مخفی کردن رمز عبور');
      input.focus({ preventScroll: true });
      try {
        const end = input.value.length;
        input.setSelectionRange(end, end);
      } catch {}
    });
  }

  return true;
}

export function showAuth() {
  const authShell = byId('authShell');
  const appShell = byId('appShell');
  const bottomNav = byId('bottomNav');

  if (authShell) {
    authShell.hidden = false;
  }

  if (appShell) {
    appShell.hidden = true;
  }

  if (bottomNav) {
    bottomNav.hidden = true;
  }

  installPasswordVisibilityToggle();
}

export function setAuthMode(mode) {
  const loginTab = byId('loginTab');
  const signupTab = byId('signupTab');
  const authSubmit = byId('authSubmit');
  const authPassword = byId('authPassword');
  const authStatus = byId('authStatus');

  if (loginTab) {
    loginTab.classList.toggle(
      'active',
      mode === 'login'
    );
  }

  if (signupTab) {
    signupTab.classList.toggle(
      'active',
      mode === 'signup'
    );
  }

  if (authSubmit) {
    authSubmit.textContent =
      mode === 'login'
        ? 'ورود'
        : 'ساخت حساب';
  }

  if (authPassword) {
    authPassword.autocomplete =
      mode === 'login'
        ? 'current-password'
        : 'new-password';

    // Keep historical logins compatible while enforcing the
    // stronger minimum for newly created accounts.
    authPassword.minLength =
      mode === 'login'
        ? 6
        : 8;
  }

  if (authStatus) {
    authStatus.textContent = '';
  }

  installPasswordVisibilityToggle();
}

export function bindAuthModeTabs(
  onModeChange
) {
  const loginTab = byId('loginTab');
  const signupTab = byId('signupTab');

  if (loginTab) {
    loginTab.onclick = () => {
      onModeChange('login');
    };
  }

  if (signupTab) {
    signupTab.onclick = () => {
      onModeChange('signup');
    };
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installPasswordVisibilityToggle(document), { once: true });
  } else {
    installPasswordVisibilityToggle(document);
  }
}
