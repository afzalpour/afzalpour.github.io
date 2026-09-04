'use strict';

import {
  createSupabaseClient
} from './supabase-client.js';

const ACTIVE_WORKSPACE_KEY =
  'avan.active_workspace_id';

const DEFAULT_PERSONAL_WORKSPACE_NAME =
  'فضای مالی من';

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

function isDefaultPersonalWorkspace(workspace) {
  return (
    workspace?.mode === 'personal' &&
    String(workspace?.name || '').trim() ===
      DEFAULT_PERSONAL_WORKSPACE_NAME
  );
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

  async function filterAutoPersonalWorkspace(rows) {
    if (!Array.isArray(rows) || rows.length <= 1) {
      return rows;
    }

    // Filtering is intentionally conservative. It only applies when the
    // workspace query contains enough metadata to identify the bootstrap
    // personal workspace safely.
    if (!rows.every(row =>
      Object.prototype.hasOwnProperty.call(row || {}, 'name') &&
      Object.prototype.hasOwnProperty.call(row || {}, 'mode')
    )) {
      return rows;
    }

    let roles;
    try {
      roles = await Promise.all(
        rows.map(async workspace => ({
          id: workspace.id,
          role: await client.rpc(
            'workspace_role',
            { wid: workspace.id }
          )
        }))
      );
    } catch {
      return rows;
    }

    const roleById = new Map(
      roles.map(item => [item.id, item.role || ''])
    );

    const hasWorkMembership = rows.some(workspace => {
      const role = roleById.get(workspace.id);
      return role && role !== 'owner';
    });

    if (!hasWorkMembership) return rows;

    const filtered = rows.filter(workspace => {
      const role = roleById.get(workspace.id);
      return !(
        role === 'owner' &&
        isDefaultPersonalWorkspace(workspace)
      );
    });

    return filtered.length ? filtered : rows;
  }

  client.select = async (table, query = '') => {
    if (table !== 'workspaces') {
      return baseSelect(table, query);
    }

    await claimInvitationsForCurrentUser();

    const rawRows =
      await baseSelect(table, query);

    const rows =
      await filterAutoPersonalWorkspace(rawRows);

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