'use strict';

import {
  createSupabaseClient
} from './supabase-client.js';
import {
  createCompanyContext
} from '../../application/company/company-context.js';

const ACTIVE_WORKSPACE_KEY =
  'avan.active_workspace_id';

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
