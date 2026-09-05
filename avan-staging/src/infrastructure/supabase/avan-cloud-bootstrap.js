'use strict';

import {
  createSupabaseClient
} from './supabase-client.js';
import {
  createCompanyContext
} from '../../application/company/company-context.js';

const ACTIVE_WORKSPACE_KEY =
  'avan.active_workspace_id';

function isSingleWorkspaceQuery(query) {
  return String(query || '')
    .split('&')
    .some(part => part === 'limit=1');
}

function scopeWorkspaceQueryToId(query, workspaceId) {
  const parts = String(query || '')
    .split('&')
    .filter(Boolean)
    .filter(part => !part.startsWith('limit='))
    .filter(part => !part.startsWith('order='))
    .filter(part => !part.startsWith('id=eq.'));

  parts.push(`id=eq.${workspaceId}`);
  parts.push('limit=1');
  return parts.join('&');
}

export function installAvanCloud({
  globalObject = window,
  storage = localStorage
} = {}) {
  // MT-A: all modules in one browser page must share the same Cloud client and
  // the same CompanyContext. Creating parallel clients was tolerable in the
  // single-company prototype but is not an acceptable tenant boundary.
  if (
    globalObject.AvanCloud?.companyContext &&
    globalObject.AvanCloud?.select &&
    globalObject.AvanCloud?.rpc
  ) {
    return globalObject.AvanCloud;
  }

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

  const companyContext = createCompanyContext({
    client,
    globalObject,
    activeKey: ACTIVE_WORKSPACE_KEY,
    listWorkspaces: async () => {
      await claimInvitationsForCurrentUser();
      return baseSelect(
        'workspaces',
        'select=id,name,mode,base_currency,created_at&order=created_at.asc'
      );
    }
  });

  client.select = async (table, query = '') => {
    if (table !== 'workspaces') {
      return baseSelect(table, query);
    }

    await claimInvitationsForCurrentUser();

    // Company metadata used by legacy Company-scoped modules is no longer a
    // free-standing tenant selector. If a User has multiple Companies and has
    // not explicitly selected one, stop here. Only CompanyContext itself reads
    // the raw authorized portfolio via baseSelect.
    const contextState = await companyContext.ensure();
    if (contextState.selection_required) {
      throw new Error('COMPANY_SELECTION_REQUIRED');
    }

    // Some legacy modules historically asked for `workspaces&limit=1`.
    // Resolve that request through CompanyContext BEFORE the database limit is
    // applied, otherwise the oldest Company could win even when another
    // Company is active.
    if (isSingleWorkspaceQuery(query)) {
      const activeId = contextState.active_company?.id || null;
      if (activeId) {
        return baseSelect(
          table,
          scopeWorkspaceQueryToId(query, activeId)
        );
      }
    }

    // Compatibility facade: legacy modules may still ask for `workspaces` and
    // read row zero. They no longer choose the tenant themselves; the central
    // CompanyContext orders the authorized rows so the explicit active Company
    // is first. New code must use `client.companyContext` directly.
    const rows = await baseSelect(table, query);
    return companyContext.orderWorkspaces(rows);
  };

  client.ACTIVE_WORKSPACE_KEY =
    ACTIVE_WORKSPACE_KEY;
  client.ACTIVE_COMPANY_KEY =
    ACTIVE_WORKSPACE_KEY;
  client.companyContext =
    companyContext;

  globalObject.AvanCloud = client;
  globalObject.AvanCompanyContext = companyContext;

  return client;
}
