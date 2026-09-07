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
import {
  createOperationPipeline
} from '../../core/runtime/operation-pipeline.js';

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

function ensureOperationPipeline(client) {
  if (!client.operations) {
    client.operations = createOperationPipeline(client);
  }
  return client.operations;
}

export function installAvanCloud({ globalObject = window, storage = localStorage } = {}) {
  if (globalObject.AvanCloud?.companyContext && globalObject.AvanCloud?.companyBoundary && globalObject.AvanCloud?.select && globalObject.AvanCloud?.rpc) {
    ensureOperationPipeline(globalObject.AvanCloud);
    return globalObject.AvanCloud;
  }

  const config = globalObject.AVAN_CONFIG || {};
  const client = createSupabaseClient({ config, storage });
  const baseSelect = client.select.bind(client);
  const operations = ensureOperationPipeline(client);
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

  client.ACTIVE_WORKSPACE_KEY = ACTIVE_WORKSPACE_KEY;
  client.ACTIVE_COMPANY_KEY = ACTIVE_WORKSPACE_KEY;
  client.companyContext = companyContext;
  client.companyBoundary = companyBoundary;
  client.activeCompany = companyBoundary.requireActiveCompany;
  client.listCompanies = companyBoundary.listCompanies;
  client.workspaceProjectionMode = 'active-company-only';

  // MT-C compatibility projection expressed as named middleware instead of
  // replacing `client.select`. Legacy modules may ask for `workspaces`, but the
  // runtime exposes only the already-authorized active Company.
  if (!operations.has('select', 'company.active-workspace-projection')) {
    operations.use('select', 'company.active-workspace-projection', async ({ args, next }) => {
      const [table, query = '', ...rest] = args;
      if (table !== 'workspaces') return next(table, query, ...rest);

      await claimInvitationsForCurrentUser();
      const contextState = await companyContext.ensure();
      if (contextState.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
      const activeId = contextState.active_company?.id || null;
      if (!activeId) throw new Error('COMPANY_REQUIRED');
      return next(table, scopeWorkspaceQueryToId(query, activeId), ...rest);
    }, { priority: 10 });
  }

  globalObject.AvanCloud = client;
  globalObject.AvanCompanyContext = companyContext;
  globalObject.AvanCompanyBoundary = companyBoundary;
  return client;
}
