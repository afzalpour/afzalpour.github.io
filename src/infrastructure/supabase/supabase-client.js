'use strict';

import {
  createSupabaseTransport
} from './supabase-transport.js';

import {
  SESSION_KEY,
  createSessionStore
} from './supabase-session.js';

import {
  createSupabaseAuth
} from './supabase-auth.js';

import {
  createSupabaseRest
} from './supabase-rest.js';

import {
  createSupabaseStorage
} from './supabase-storage.js';

import {
  createSupabaseFunctions
} from './supabase-functions.js';

export function createSupabaseClient({
  config = {},
  storage
}) {
  if (!storage) {
    throw new Error(
      'SUPABASE_STORAGE_REQUIRED'
    );
  }

  const transport =
    createSupabaseTransport(config);

  const sessionStore =
    createSessionStore(
      storage,
      SESSION_KEY
    );

  const auth =
    createSupabaseAuth({
      transport,
      sessionStore,
      config
    });

  const rest =
    createSupabaseRest({
      transport,
      auth
    });
  const objectStorage =
  createSupabaseStorage({
    config,
    auth
  });

  const edgeFunctions =
  createSupabaseFunctions({
    transport,
    auth
  });

  return {
    cfg: config,
    SESSION_KEY,

    session:
      sessionStore.session,

    saveSession:
      sessionStore.saveSession,

    consumeAuthCallback:
      auth.consumeAuthCallback,

    requestPasswordReset:
      auth.requestPasswordReset,

    updatePassword:
      auth.updatePassword,

    signup:
      auth.signup,

    login:
      auth.login,

    logout:
      auth.logout,

    user:
      auth.user,

    select:
      rest.select,

    insert:
      rest.insert,

    update:
      rest.update,

    remove:
      rest.remove,

    rpc:
  rest.rpc,

uploadFile:
  objectStorage.upload,

signedFileUrl:
  objectStorage.signedUrl,

removeFiles:
  objectStorage.remove,
invokeFunction:
  edgeFunctions.invoke,

token:
  auth.token
  };
}
