'use strict';

const byId = id =>
  document.getElementById(id);

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
  }

  if (authStatus) {
    authStatus.textContent = '';
  }
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
