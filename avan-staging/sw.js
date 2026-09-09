const CACHE_PREFIX='avan-staging-rc1-';
const CACHE='avan-staging-rc1-v84-settings-einvoice-live-fix';
const ASSETS=[
'./','./index.html','./platform-admin.html','./support-viewer.html','./styles.css','./rc15-final-web-pwa.css','./platform-admin.css','./support-viewer.css','./rc11-money.css','./rc11-access.css','./rc11-refinements.css','./rc12-design-system.css','./rc12-polish.css','./rc12-documents.css','./rc12-print-export.css','./rc12-company-profile.css','./rc12-mobile-final.css','./rc12-mobile-navigation.css','./rc13-operational-audit.css','./rc13-company-context.css','./rc13-company-lifecycle.css','./rc13-support-access.css','./rc13-final-polish.css','./rc14-inventory-foundation.css','./rc14-inventory-operations.css','./rc14-inventory-live-refinements.css','./rc14-invoice-live-refinements.css','./rc14-account-four-level.css','./rc14-catalog-settlement-v60.css','./rc15-tax-ux.css','./rc15-c1.css','./rc15-c1-3-live-hotfix.css','./config.js','./app.js','./platform-admin.js','./platform-admin-users.js','./platform-tax-rules.js','./support-viewer.js','./rc11-user-preferences.js','./rc11-access.js','./rc13-company-boundary-guard.js','./rc11-refinements.js','./rc12-polish.js','./rc12-documents.js','./rc12-company-profile.js','./rc12-print-export.js','./rc12-mobile-navigation.js','./rc13-auth-recovery.js','./rc13-operational-audit.js','./rc13-company-context.js','./rc13-company-lifecycle.js','./rc13-support-access.js','./rc13-platform-admin-entry.js','./rc13-final-polish.js','./rc13-print-controls-recovery.js','./rc13-live-gate-polish.js','./rc13-session-security.js','./rc14-inventory-foundation.js','./rc14-inventory-operations.js','./rc14-inventory-form-stability.js','./rc14-invoice-inventory-ui.js','./rc14-invoice-live-refinements.js','./rc14-inventory-live-refinements.js','./rc14-account-four-level.js','./rc14-purchase-receipt-and-inventory-polish.js','./rc14-catalog-settlement-v61.js','./rc14-settlement-reversal-v60.js','./rc14-persian-ux-v62.js','./rc15-tax-ux-v3.js','./rc15-c1-bootstrap.js','./rc15-c1-4-mutation-stability.js','./manifest.webmanifest','./avan-icon-192.png','./avan-icon-512.png','./apple-touch-icon.png','./avan-favicon-32.png','./src/core/date/jalali.js','./src/core/runtime/operation-pipeline.js','./src/core/money/canonical-money.js','./src/core/reconciliation/transaction-journal-suggestion.js','./src/application/money/money-service.js','./src/ui/money/money-runtime.js','./src/ui/money/money-inputs.js','./src/ui/money/money-settings-card.js','./src/ui/money/money-output-contract.js','./src/ui/tax/tax-workspace-v2.js','./src/domains/tax/vat-calculator.js','./src/domains/settlement/settlement-plan-contract.js','./src/application/tax/tax-service.js','./src/domains/einvoice/einvoice-contract.js','./src/domains/einvoice/prevalidation.js','./src/domains/einvoice/adapter-contract.js','./src/application/einvoice/einvoice-service.js','./src/ui/einvoice/einvoice-preflight-ui.js','./src/ui/runtime/lifecycle.js','./src/ui/tax/tax-date-aware.js','./src/ui/money/invoice-money-workspace.js','./src/ui/settlement/settlement-save-boundary-v3.js','./src/ui/settlement/settlement-workspace-v2.js','./src/ui/settings/settings-layout-v2.js','./src/ui/health/core-health-drilldown.js','./src/ui/reports/reconciliation-workspace.js','./src/ui/localization/user-facing-fa.js','./src/ui/localization/persian-runtime-guard.js','./src/ui/reports/custom-report-builder.js','./src/ui/company/company-logo-file-control.js','./src/ui/date/jalali-picker.js','./src/ui/errors/error-messages-fa.js','./src/ui/feedback/toast.js','./src/ui/money/live-money-inputs.js','./src/ui/components/modal.js','./src/ui/shell/shell-view.js','./src/infrastructure/supabase/supabase-transport.js','./src/infrastructure/supabase/supabase-session.js','./src/infrastructure/supabase/supabase-auth.js','./src/infrastructure/supabase/supabase-rest.js','./src/infrastructure/supabase/supabase-storage.js','./src/infrastructure/supabase/supabase-functions.js','./src/infrastructure/supabase/supabase-client.js','./src/infrastructure/supabase/avan-cloud-bootstrap.js','./src/application/auth/auth-controller.js','./src/application/company/company-context.js','./src/application/company/company-boundary.js','./src/ui/auth/auth-view.js','./src/reports/why-number.js','./src/reports/party-aging.js','./src/reports/nl-report-intent.js','./src/reports/nl-report-executor.js','./src/ui/reports/nl-report-view.js','./src/ui/reports/party-aging-view.js','./src/ai/business-copilot.js','./src/ui/intelligence/business-copilot-view.js','./src/ai/risk-audit.js','./src/ui/intelligence/risk-audit-view.js','./src/ai/collection-close.js','./src/ui/intelligence/collection-close-view.js','./src/documents/document-service.js','./src/ui/documents/documents-view.js','./src/documents/document-proposal.js','./src/documents/local-ocr-runtime.js','./src/documents/local-ocr-runtime-v2.js','./src/documents/local-ocr-runtime-v3.js','./src/documents/local-ocr-runtime-v4.js','./src/documents/local-ocr-runtime-v5.js','./src/documents/local-ocr-runtime-v6.js','./src/documents/local-ocr-runtime-v7.js','./src/documents/local-ocr-runtime-v8.js','./src/documents/document-delete-ui.js','./src/documents/local-ocr-extraction.js','./src/ui/documents/document-review-view.js','./src/documents/document-viewer-v2.js'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys
          .filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE)
          .map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(request){
  try{
    const response=await fetch(request);
    if(response.ok){
      const cache=await caches.open(CACHE);
      await cache.put(request,response.clone());
    }
    return response;
  }catch(error){
    const cached=await caches.match(request);
    if(cached)return cached;

    if(request.mode==='navigate'){
      const shell=await caches.match('./index.html')||await caches.match('./');
      if(shell)return shell;
    }

    throw error;
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  event.respondWith(networkFirst(event.request));
});
