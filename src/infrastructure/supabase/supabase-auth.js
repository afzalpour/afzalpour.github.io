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
      saveSession(null);
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

    return raw(
      '/auth/v1/user',
      {
        token: accessToken
      }
    );
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
    signup,
    login,
    logout,
    user,
    requestPasswordReset,
    updatePassword
  };
}
