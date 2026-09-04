'use strict';

export const SESSION_KEY =
  'avan_cloud_session_v1';

export function createSessionStore(
  storage,
  key = SESSION_KEY
) {
  function session() {
    try {
      return JSON.parse(
        storage.getItem(key) || 'null'
      );
    } catch {
      return null;
    }
  }

  function saveSession(value) {
    if (value) {
      storage.setItem(
        key,
        JSON.stringify(value)
      );
    } else {
      storage.removeItem(key);
    }
  }

  return {
    session,
    saveSession
  };
}
