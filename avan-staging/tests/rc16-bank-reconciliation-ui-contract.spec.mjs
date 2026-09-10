import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../src/ui/treasury/bank-reconciliation-workspace.js', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/application/treasury/bank-reconciliation-service.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(index, /src\/ui\/treasury\/bank-reconciliation-workspace\.js/, 'Staging shell must load the bank reconciliation workspace');
assert.match(ui, /مغایرت بانکی/, 'UI must be Persian-first and discoverable');
assert.match(ui, /پیشنهاد تطبیق است؛ هیچ سند حسابداری به‌صورت خودکار ثبت نمی‌شود/, 'Human-controlled warning must be explicit');
assert.match(ui, /حتی امتیاز ۱۰۰ فقط پیشنهاد است/, 'Score 100 must remain a suggestion');
assert.match(ui, /data-avan-bank-reconciliation-nav/, 'Desktop navigation entry must exist');
assert.match(ui, /data-bank-reconciliation-entry/, 'Reports/mobile discoverability entry must exist');
assert.match(ui, /data-bank-confirm-line/, 'Match confirmation must require an explicit user action');
assert.match(ui, /data-bank-void/, 'Confirmed matches must expose controlled void');
assert.match(ui, /data-bank-ignore/, 'Unresolved statement lines must expose controlled ignore');
assert.match(ui, /data-bank-finalize/, 'Import finalization must be explicit');
assert.match(ui, /واحد مبالغ داخل فایل/, 'Import must ask for source money unit');
assert.match(ui, /پیش‌نمایش و نگاشت ستون‌ها/, 'Import must preview and map locally before persistence');
assert.match(ui, /normalizeBankStatementRows/, 'UI must use the governed CSV normalization domain');
assert.match(ui, /attachStatementFingerprints/, 'UI must fingerprint normalized evidence');
assert.doesNotMatch(ui, /new\s+MutationObserver\b/, 'RC1.6-B feature must not create private MutationObservers');
assert.doesNotMatch(ui, /\.prototype\s*\.|window\.[A-Za-z0-9_$]+\s*=\s*function/, 'RC1.6-B must not monkey-patch shared runtime APIs');

assert.match(service, /avan_import_bank_statement/, 'Import must use the atomic backend RPC');
assert.match(service, /avan_bank_reconciliation_candidates/, 'Candidate discovery must use the read-only backend RPC');
assert.match(service, /bank_reconciliation_matches/, 'Explicit confirmation must persist reconciliation evidence');
assert.match(service, /voided_at/, 'Match correction must use void lifecycle');
assert.match(service, /ignore_reason/, 'Ignored bank evidence must retain a reason');
assert.doesNotMatch(service, /post_journal|post_financial_operation|save_draft_journal|journal_entries/, 'Reconciliation UI service must never create or post financial documents');

console.log('RC1.6-B bank reconciliation UI contract: PASS');
