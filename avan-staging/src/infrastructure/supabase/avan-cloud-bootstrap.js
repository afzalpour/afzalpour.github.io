'use strict';

import {
  createSupabaseClient
} from './supabase-client.js';

const ACTIVE_WORKSPACE_KEY =
  'avan.active_workspace_id';

function preferredWorkspaceId(globalObject) {
  try {
    return globalObject.sessionStorage
      ?.getItem(ACTIVE_WORKSPACE_KEY) || null;
  } catch {
    return null;
  }
}

function clearPreferredWorkspace(globalObject) {
  try {
    globalObject.sessionStorage
      ?.removeItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    // Session preference is optional; never block app startup.
  }
}

function orderWorkspaces(rows, preferredId) {
  if (!Array.isArray(rows) || !rows.length || !preferredId) {
    return rows;
  }

  const index = rows.findIndex(
    workspace => workspace?.id === preferredId
  );

  if (index <= 0) return rows;

  return [
    rows[index],
    ...rows.slice(0, index),
    ...rows.slice(index + 1)
  ];
}

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

  const baseSelect =
    client.select.bind(client);

  let claimedForUserId = null;

  async function claimInvitationsForCurrentUser() {
    let user = null;

    try {
      user = await client.user();
    } catch {
      return;
    }

    if (!user?.id || claimedForUserId === user.id) {
      return;
    }

    // Mark attempted for this authenticated user even when RC1.1-D
    // migration is not installed yet, so missing-RPC fallback stays quiet.
    claimedForUserId = user.id;

    try {
      await client.rpc(
        'claim_workspace_invitations',
        {}
      );
    } catch (error) {
      const message = String(
        error?.message || error || ''
      );

      const expectedBeforeMigration =
        error?.status === 404 ||
        message.includes('claim_workspace_invitations');

      if (!expectedBeforeMigration) {
        console.warn(
          '[Avan access] invitation claim failed',
          error
        );
      }
    }
  }

  client.select = async (table, query = '') => {
    if (table !== 'workspaces') {
      return baseSelect(table, query);
    }

    await claimInvitationsForCurrentUser();

    const rows =
      await baseSelect(table, query);

    const preferredId =
      preferredWorkspaceId(globalObject);

    if (
      preferredId &&
      Array.isArray(rows) &&
      !rows.some(workspace => workspace?.id === preferredId)
    ) {
      clearPreferredWorkspace(globalObject);
      return rows;
    }

    return orderWorkspaces(
      rows,
      preferredId
    );
  };

  client.ACTIVE_WORKSPACE_KEY =
    ACTIVE_WORKSPACE_KEY;

  globalObject.AvanCloud = client;

  return client;
}
