'use strict';

export function createSupabaseAuth({
  transport,
  sessionStore,
  config = {}
}) {
  if (!transport?.raw) {
    throw new Error('SUPABASE_TRANSPORT_REQUIRED');
  }

  if (
    !sessionStore?.session ||
    !sessionStore?.saveSession
  ) {
    throw new Error('SUPABASE_SESSION_STORE_REQUIRED');
  }

  const {
    raw
  } = transport;

  const {
    session,
    saveSession
  } = sessionStore;

  function invalidServerSession(error) {
    const status = Number(error?.status || 0);
    const message = String(
      error?.message ||
      error?.payload?.message ||
      error ||
      ''
    ).toLowerCase();

    if (status !== 401 && status !== 403) {
      return false;
    }

    return (
      message.includes('session from session_id claim') ||
      message.includes('session does not exist') ||
      message.includes('session not found') ||
      message.includes('invalid jwt') ||
      message.includes('jwt expired') ||
      message.includes('token has expired') ||
      message.includes('invalid claim')
    );
  }

  function invalidateLocalSession(reason = 'server_session_invalid') {
    saveSession(null);

    try {
      window.localStorage.removeItem(
        'avan.active_workspace_id'
      );
    } catch {
      // Storage cleanup is best effort only.
    }

    try {
      window.dispatchEvent(
        new CustomEvent(
          'avan:auth-session-invalidated',
          {
            detail: {
              reason
            }
          }
        )
      );
    } catch {
      // Non-browser/test runtime.
    }
  }

  async function refreshIfNeeded() {
    let currentSession = session();

    if (!currentSession) {
      return null;
    }

    const expiresAt =
      Number(
        currentSession.expires_at || 0
      ) * 1000;

    if (
      expiresAt &&
      Date.now() < expiresAt - 60000
    ) {
      return currentSession;
    }

    if (!currentSession.refresh_token) {
      return currentSession;
    }

    try {
      const data = await raw(
        '/auth/v1/token?grant_type=refresh_token',
        {
          method: 'POST',
          body: {
            refresh_token:
              currentSession.refresh_token
          }
        }
      );

      saveSession(data);

      return data;
    } catch (error) {
      invalidateLocalSession('refresh_failed');
      throw error;
    }
  }

  async function token() {
    const currentSession =
      await refreshIfNeeded();

    return (
      currentSession?.access_token ||
      null
    );
  }

  async function signup(
    email,
    password
  ) {
    const data = await raw(
      '/auth/v1/signup',
      {
        method: 'POST',
        body: {
          email,
          password,
          data: {
            app: 'avan'
          }
        }
      }
    );

    if (data?.access_token) {
      saveSession(data);
    }

    return data;
  }

  async function login(
    email,
    password
  ) {
    // Password sign-in creates a fresh Supabase session. Never carry a
    // previously revoked local session across this boundary.
    saveSession(null);

    const data = await raw(
      '/auth/v1/token?grant_type=password',
      {
        method: 'POST',
        body: {
          email,
          password
        }
      }
    );

    saveSession(data);

    return data;
  }

  async function logout() {
    try {
      const accessToken =
        await token();

      if (accessToken) {
        await raw(
          '/auth/v1/logout',
          {
            method: 'POST',
            token: accessToken
          }
        );
      }
    } finally {
      saveSession(null);
    }
  }

  async function user() {
    const accessToken =
      await token();

    if (!accessToken) {
      return null;
    }

    try {
      return await raw(
        '/auth/v1/user',
        {
          token: accessToken
        }
      );
    } catch (error) {
      if (invalidServerSession(error)) {
        invalidateLocalSession(
          'server_session_missing'
        );
        return null;
      }

      throw error;
    }
  }

  function consumeAuthCallback() {
    const rawHash =
      String(location.hash || '')
        .replace(/^#/, '');

    if (!rawHash) {
      return null;
    }

    const params =
      new URLSearchParams(rawHash);

    const accessToken =
      params.get('access_token');

    const refreshToken =
      params.get('refresh_token');

    if (!accessToken) {
      return null;
    }

    const expiresIn =
      Number(
        params.get('expires_in') || 0
      );

    const expiresAt =
      Number(
        params.get('expires_at') || 0
      ) ||
      Math.floor(Date.now() / 1000) +
        expiresIn;

    const currentSession = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      expires_at: expiresAt,
      token_type:
        params.get('token_type') ||
        'bearer'
    };

    saveSession(currentSession);

    const type =
      params.get('type') || '';

    history.replaceState(
      null,
      document.title,
      location.pathname +
        location.search
    );

    return {
      type,
      session: currentSession
    };
  }

  async function requestPasswordReset(
    email,
    redirectTo
  ) {
    const target =
      redirectTo ||
      config.authRedirectUrl ||
      location.origin + location.pathname;

    return raw(
      `/auth/v1/recover?redirect_to=${
        encodeURIComponent(target)
      }`,
      {
        method: 'POST',
        body: {
          email
        }
      }
    );
  }

  async function updatePassword(
    password
  ) {
    const accessToken =
      await token();

    if (!accessToken) {
      throw new Error('AUTH_REQUIRED');
    }

    return raw(
      '/auth/v1/user',
      {
        method: 'PUT',
        token: accessToken,
        body: {
          password
        }
      }
    );
  }

  return {
    refreshIfNeeded,
    token,
    consumeAuthCallback,
    signup,
    login,
    logout,
    user,
    requestPasswordReset,
    updatePassword
  };
}
