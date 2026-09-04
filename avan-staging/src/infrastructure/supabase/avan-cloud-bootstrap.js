'use strict';

import {
  createSupabaseClient
} from './supabase-client.js';

export function installAvanCloud({
  globalObject = window,
  storage = localStorage
} = {}) {
  const config =
    globalObject.AVAN_CONFIG || {};

  const client =
    createSupabaseClient({
      config,
      storage
    });

  globalObject.AvanCloud = client;

  return client;
}
