'use strict';

function clone(value) {
  return value ? { ...value } : null;
}

export function createCompanyBoundary(companyContext) {
  if (!companyContext?.ensure || !companyContext?.active || !companyContext?.list) {
    throw new Error('COMPANY_BOUNDARY_DEPENDENCY_MISSING');
  }

  async function state() {
    return companyContext.ensure();
  }

  async function requireActiveCompany() {
    const snapshot = await state();
    if (snapshot.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
    const company = snapshot.active_company || companyContext.active();
    if (!company?.id) throw new Error('COMPANY_REQUIRED');
    if (company.access_allowed === false) {
      throw new Error(company.status === 'archived' ? 'COMPANY_ARCHIVED' : 'COMPANY_SUSPENDED');
    }
    return clone(company);
  }

  async function activeCompany() {
    const snapshot = await state();
    if (snapshot.selection_required) return null;
    return clone(snapshot.active_company || companyContext.active());
  }

  async function listCompanies() {
    const snapshot = await state();
    return (snapshot.companies || companyContext.list()).map(company => ({ ...company }));
  }

  return Object.freeze({
    state,
    requireActiveCompany,
    activeCompany,
    listCompanies
  });
}
