import assert from 'node:assert/strict';
import { translateUserFacingText, safeUserFacingFa } from '../src/ui/localization/user-facing-fa.js';

assert.equal(
  translateUserFacingText('Company member added as accountant'),
  'کاربر با نقش حسابدار به شرکت افزوده شد'
);
assert.equal(
  translateUserFacingText('شرکت member added as accountant'),
  'کاربر با نقش حسابدار به شرکت افزوده شد'
);
assert.equal(
  translateUserFacingText('Inventory document posted with financial bridge'),
  'سند انبار ثبت قطعی شد و سند حسابداری مرتبط ایجاد شد'
);
assert.equal(
  translateUserFacingText('Document uploaded'),
  'سند بارگذاری شد'
);
assert.equal(
  safeUserFacingFa('Totally unknown backend message', 'رویداد سامانه'),
  'رویداد سامانه'
);
assert.equal(/[A-Za-z]/.test(safeUserFacingFa('Company member added as accountant')), false);

console.log('user-facing-fa.spec.mjs: PASS');
