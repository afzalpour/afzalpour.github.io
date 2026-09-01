'use strict';

export function createAuthController(
  authClient
) {
  if (!authClient) {
    throw new Error(
      'AUTH_CLIENT_REQUIRED'
    );
  }

  async function login(
    email,
    password
  ) {
    await authClient.login(
      email,
      password
    );

    return {
      status: 'authenticated'
    };
  }

  async function signup(
    email,
    password
  ) {
    const response =
      await authClient.signup(
        email,
        password
      );

    if (response?.access_token) {
      return {
        status: 'authenticated',
        response
      };
    }

    return {
      status: 'confirmation_required',
      response
    };
  }

  async function logout() {
    await authClient.logout();

    return {
      status: 'signed_out'
    };
  }

  async function user() {
  return authClient.user();
}
  async function requestPasswordReset(
    email
  ) {
    await authClient.requestPasswordReset(
      email,
      authClient.cfg?.authRedirectUrl
    );

    return {
      status: 'reset_requested'
    };
  }

  async function updatePassword(
    password
  ) {
    await authClient.updatePassword(
      password
    );

    return {
      status: 'password_updated'
    };
  }

  function session() {
    return authClient.session();
  }

  function consumeAuthCallback() {
    return authClient
      .consumeAuthCallback?.() || null;
  }

  return {
    login,
    signup,
    logout,
    user,
    requestPasswordReset,
    updatePassword,
    session,
    consumeAuthCallback
  };
}
