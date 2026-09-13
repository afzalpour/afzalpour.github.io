'use strict';

import { buildAvanConnectMarketplace, buildAutomationPreview } from '../../intelligence/avan-connect-foundation.js';

export function createAvanConnectService({cloud,buildMarketplace=buildAvanConnectMarketplace,buildPreview=buildAutomationPreview}={}){
  if(!cloud?.companyContext?.ensure)throw new Error('CONNECT_DEPENDENCY_MISSING');

  async function activeWorkspace(){
    const state=await cloud.companyContext.ensure();
    if(state?.selection_required)throw new Error('COMPANY_SELECTION_REQUIRED');
    const workspace=state?.active_company;
    if(!workspace?.id)throw new Error('COMPANY_REQUIRED');
    return workspace;
  }

  async function load(){
    const workspace=await activeWorkspace();
    const marketplace=buildMarketplace({workspace});
    return Object.freeze({
      workspace,
      marketplace,
      contracts:Object.freeze({
        companyScoped:true,
        sourceOfTruth:'postgresql-supabase',
        writeOperations:0,
        workflowExecution:false,
        connectionMutation:false,
        humanControlled:true
      })
    });
  }

  async function preview(recipeKey){
    const workspace=await activeWorkspace();
    return buildPreview({workspace,recipeKey});
  }

  return Object.freeze({activeWorkspace,load,preview});
}
