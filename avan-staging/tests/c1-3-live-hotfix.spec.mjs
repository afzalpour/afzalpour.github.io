import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const invoiceSource = await readFile(new URL('../rc14-invoice-live-refinements.js', import.meta.url), 'utf8');
const adminUsersSource = await readFile(new URL('../platform-admin-users.js', import.meta.url), 'utf8');
const journalCss = await readFile(new URL('../rc15-c1-3-live-hotfix.css', import.meta.url), 'utf8');

assert.match(invoiceSource, /function mutationAddsInvoiceLine\(mutations\)/);
assert.match(invoiceSource, /if \(!mutationAddsInvoiceLine\(mutations\)\) return;/);
assert.doesNotMatch(invoiceSource, /if \(!mutations\.some\(m => m\.addedNodes\.length\)\) return;/);

assert.match(adminUsersSource, /invokeFunction\('platform-admin-users'/);
assert.doesNotMatch(adminUsersSource, /SERVICE_ROLE|service_role|SUPABASE_SERVICE_ROLE_KEY/);

assert.match(journalCss, /\.modal:has\(#journalForm\)/);
assert.match(journalCss, /#journalForm \.journal-line/);
assert.doesNotMatch(journalCss, /^\.modal\s*\{/m);

console.log('C1.3 live hotfix regression guards passed.');
