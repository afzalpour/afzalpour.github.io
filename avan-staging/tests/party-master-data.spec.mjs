import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const ui = read('src/ui/parties/party-master-data.js');
const css = read('rc17-party-master-data.css');
const index = read('index.html');
const sw = read('sw.js');
const migration = read('APPLIED_RC1_7_PARTY_MASTER_DATA.sql');

// Data model separates business role from legal form and preserves legacy records safely.
assert.match(migration, /add column if not exists entity_type text not null default 'unspecified'/);
assert.match(migration, /individual/);
assert.match(migration, /legal/);
assert.match(migration, /registration_no/);
assert.match(migration, /economic_code/);
assert.match(migration, /tax_id/);
assert.match(migration, /postal_code|public\.parties/);
assert.match(migration, /address/);
assert.doesNotMatch(migration, /drop table|drop column|disable row level security/i);

// UI exposes Persian, report-ready identity fields.
for (const label of [
  'نقش تجاری', 'ماهیت', 'شخص حقیقی', 'شخص حقوقی',
  'نام رسمی/حقوقی', 'کد ملی / شناسه ملی', 'شماره ثبت',
  'کد اقتصادی', 'شناسه/شماره مالیاتی', 'کدپستی', 'استان', 'شهر',
  'آدرس کامل', 'مسئول تماس', 'وب‌سایت'
]) {
  assert.match(ui, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
assert.match(ui, /KIND_FA/);
assert.match(ui, /ENTITY_FA/);
assert.match(ui, /entity_type === 'unspecified'/);
assert.match(ui, /PARTY_ENTITY_TYPE_REQUIRED/);

// Company/RLS boundary: every read/write is tied to the active workspace.
assert.match(ui, /cloud\.companyContext\.ensure\(\)/);
assert.match(ui, /workspace_id=eq\.\$\{workspaceId\}/);
assert.match(ui, /id=eq\.\$\{partyId\}&workspace_id=eq\.\$\{state\.workspaceId\}/);
assert.match(ui, /workspace_id:\s*state\.workspaceId/);
assert.doesNotMatch(ui, /localStorage|sessionStorage|service_role|SUPABASE_SERVICE_ROLE/i);

// Legacy app.js is not rewritten; the feature is an isolated extension.
assert.match(index, /rc17-party-master-data\.css/);
assert.match(index, /src\/ui\/parties\/party-master-data\.js/);
assert.match(css, /overflow-x:auto/);
assert.match(css, /@media\(max-width:760px\)/);

// PWA must ship the new runtime assets in a distinct cache identity.
assert.match(sw, /avan-staging-rc1-v109-party-master-data/);
assert.match(sw, /rc17-party-master-data\.css/);
assert.match(sw, /src\/ui\/parties\/party-master-data\.js/);
assert.match(sw, /cache:'reload'/);

console.log('party-master-data.spec.mjs: PASS');
