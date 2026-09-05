'use strict';

const DEFAULT_ACTIVE_KEY = 'avan.active_workspace_id';
function cloneCompany(company){return company?{...company}:null;}
function cloneState(state){return Object.freeze({ready:state.ready,loading:state.loading,user_id:state.userId,active_company_id:state.activeId,selection_required:state.selectionRequired,companies:state.companies.map(cloneCompany),active_company:cloneCompany(state.companies.find(company=>company.id===state.activeId)||null)});}

export function createCompanyContext({client,listWorkspaces,globalObject=window,activeKey=DEFAULT_ACTIVE_KEY}={}){
  if(!client?.user||!client?.rpc||typeof listWorkspaces!=='function')throw new Error('COMPANY_CONTEXT_DEPENDENCY_MISSING');
  const state={ready:false,loading:false,userId:null,activeId:null,selectionRequired:false,companies:[]};
  let refreshPromise=null;
  function sessionStore(){try{return globalObject.sessionStorage||null}catch{return null}}
  function storedId(){try{return sessionStore()?.getItem(activeKey)||null}catch{return null}}
  function persistId(id){try{if(id)sessionStore()?.setItem(activeKey,id);else sessionStore()?.removeItem(activeKey)}catch{}}
  function normalizeRows(rows){return Array.isArray(rows)?rows.filter(row=>row?.id):[]}
  function allowedRows(rows){return normalizeRows(rows).filter(row=>row.access_allowed!==false)}
  function reorderById(rows,activeId){const items=normalizeRows(rows);if(!activeId)return items;const index=items.findIndex(item=>item.id===activeId);if(index<=0)return items;return[items[index],...items.slice(0,index),...items.slice(index+1)]}
  function resolveFullActiveId(rows){const items=allowedRows(rows);const preferred=storedId();if(preferred&&items.some(item=>item.id===preferred))return preferred;if(preferred)persistId(null);if(items.length===1){persistId(items[0].id);return items[0].id}return null}
  function orderWorkspaces(rows){return reorderById(rows,storedId())}
  async function enrich(workspace){let role=workspace.role||'';let profile=null;if(!role&&workspace.access_allowed!==false){try{role=await client.rpc('workspace_role',{wid:workspace.id})||''}catch{}}if(!workspace.display_name&&workspace.access_allowed!==false){try{profile=await client.rpc('get_workspace_print_profile',{wid:workspace.id})}catch{}}return Object.freeze({...workspace,role,status:workspace.status||'active',access_allowed:workspace.access_allowed!==false,display_name:String(workspace.display_name||profile?.display_name||workspace.name||'شرکت بدون نام').trim(),legal_name:String(workspace.legal_name||profile?.legal_name||'').trim()})}
  async function refresh({force=false}={}){if(refreshPromise&&!force)return refreshPromise;if(refreshPromise&&force){try{await refreshPromise}catch{}}refreshPromise=(async()=>{state.loading=true;try{const user=await client.user();if(!user?.id){Object.assign(state,{ready:true,userId:null,activeId:null,selectionRequired:false,companies:[]});return cloneState(state)}const rawRows=normalizeRows(await listWorkspaces());const activeId=resolveFullActiveId(rawRows);const orderedRows=reorderById(rawRows,activeId);const companies=await Promise.all(orderedRows.map(enrich));Object.assign(state,{userId:user.id,companies,activeId,selectionRequired:companies.length>0&&!activeId,ready:true});return cloneState(state)}finally{state.loading=false}})();try{return await refreshPromise}finally{refreshPromise=null}}
  function active(){return cloneCompany(state.companies.find(c=>c.id===state.activeId)||null)}
  function list(){return state.companies.map(cloneCompany)}
  function snapshot(){return cloneState(state)}
  async function ensure(){const user=await client.user();const uid=user?.id||null;if(!state.ready||uid!==state.userId)await refresh({force:true});return snapshot()}
  async function selectCompany(companyId,{emit=true}={}){const id=String(companyId||'').trim();if(!id)throw new Error('COMPANY_REQUIRED');await ensure();const target=state.companies.find(c=>c.id===id);if(!target){persistId(null);state.activeId=null;state.selectionRequired=state.companies.length>0;throw new Error('COMPANY_ACCESS_REQUIRED')}if(target.access_allowed===false){if(storedId()===id)persistId(null);state.activeId=null;state.selectionRequired=true;throw new Error(target.status==='archived'?'COMPANY_ARCHIVED':'COMPANY_SUSPENDED')}persistId(id);state.activeId=id;state.selectionRequired=false;state.companies=[target,...state.companies.filter(c=>c.id!==id)];if(emit){const detail={company:cloneCompany(target),company_id:id};globalObject.dispatchEvent(new CustomEvent('avan:company-context-changed',{detail}));globalObject.dispatchEvent(new CustomEvent('avan:workspace-changed',{detail:{workspace_id:id}}))}return cloneCompany(target)}
  function clearSelection({emit=true}={}){persistId(null);state.activeId=null;state.selectionRequired=state.companies.length>0;if(emit)globalObject.dispatchEvent(new CustomEvent('avan:company-context-cleared'))}
  return Object.freeze({activeKey,orderWorkspaces,refresh,ensure,snapshot,active,list,selectCompany,clearSelection,needsSelection:()=>Boolean(state.selectionRequired),hasSelection:()=>Boolean(state.activeId)});
}
