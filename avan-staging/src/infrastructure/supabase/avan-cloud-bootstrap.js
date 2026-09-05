'use strict';

import {
  createSupabaseClient
} from './supabase-client.js';
import {
  createCompanyContext
} from '../../application/company/company-context.js';
import {
  createCompanyBoundary
} from '../../application/company/company-boundary.js';

const ACTIVE_WORKSPACE_KEY = 'avan.active_workspace_id';

function scopeWorkspaceQueryToId(query, workspaceId) {
  const parts = String(query || '').split('&').filter(Boolean)
    .filter(part => !part.startsWith('limit='))
    .filter(part => !part.startsWith('order='))
    .filter(part => !part.startsWith('id=eq.'));
  parts.push(`id=eq.${workspaceId}`);
  parts.push('limit=1');
  return parts.join('&');
}

export function installAvanCloud({ globalObject = window, storage = localStorage } = {}) {
  if (globalObject.AvanCloud?.companyContext && globalObject.AvanCloud?.companyBoundary && globalObject.AvanCloud?.select && globalObject.AvanCloud?.rpc) {
    return globalObject.AvanCloud;
  }

  const config = globalObject.AVAN_CONFIG || {};
  const client = createSupabaseClient({ config, storage });
  const baseSelect = client.select.bind(client);
  let claimedForUserId = null;

  async function claimInvitationsForCurrentUser() {
    let user = null;
    try { user = await client.user(); } catch { return; }
    if (!user?.id || claimedForUserId === user.id) return;
    claimedForUserId = user.id;
    try {
      await client.rpc('claim_workspace_invitations', {});
    } catch (error) {
      const message = String(error?.message || error || '');
      const expected = error?.status === 404 || message.includes('claim_workspace_invitations') || message.includes('TENANT_MEMBER_LIMIT_REACHED') || message.includes('TENANT_ACCESS_SUSPENDED');
      if (!expected) console.warn('[Avan access] invitation claim failed', error);
    }
  }

  const companyContext = createCompanyContext({
    client,
    globalObject,
    activeKey: ACTIVE_WORKSPACE_KEY,
    listWorkspaces: async () => {
      await claimInvitationsForCurrentUser();
      try {
        const rows = await client.rpc('my_company_portfolio', {});
        return Array.isArray(rows) ? rows : [];
      } catch (error) {
        const message = String(error?.message || error || '');
        if (!message.includes('my_company_portfolio') && error?.status !== 404) throw error;
        return baseSelect('workspaces', 'select=id,name,mode,base_currency,created_at&order=created_at.asc');
      }
    }
  });
  const companyBoundary = createCompanyBoundary(companyContext);

  // MT-C legacy projection: modules that still read `workspaces` can no longer
  // enumerate or choose a tenant. CompanyContext resolves the tenant first and
  // this compatibility path exposes only that already-authorized active Company.
  client.select = async (table, query = '') => {
    if (table !== 'workspaces') return baseSelect(table, query);
    await claimInvitationsForCurrentUser();
    const contextState = await companyContext.ensure();
    if (contextState.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
    const activeId = contextState.active_company?.id || null;
    if (!activeId) throw new Error('COMPANY_REQUIRED');
    return baseSelect(table, scopeWorkspaceQueryToId(query, activeId));
  };

  client.ACTIVE_WORKSPACE_KEY = ACTIVE_WORKSPACE_KEY;
  client.ACTIVE_COMPANY_KEY = ACTIVE_WORKSPACE_KEY;
  client.companyContext = companyContext;
  client.companyBoundary = companyBoundary;
  client.activeCompany = companyBoundary.requireActiveCompany;
  client.listCompanies = companyBoundary.listCompanies;
  client.workspaceProjectionMode = 'active-company-only';
  globalObject.AvanCloud = client;
  globalObject.AvanCompanyContext = companyContext;
  globalObject.AvanCompanyBoundary = companyBoundary;
  return client;
}
