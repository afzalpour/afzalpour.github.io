'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';

const Lifecycle = installUiLifecycle();

const EXACT = new Map([
  ['Document uploaded', 'سند بارگذاری شد'],
  ['Journal posted', 'سند حسابداری ثبت قطعی شد'],
  ['Journal reversed', 'سند حسابداری برگشت داده شد'],
  ['Inventory document posted with financial bridge', 'سند انبار ثبت قطعی شد و سند حسابداری مرتبط ایجاد شد'],
  ['Inventory document and financial journal reversed', 'سند انبار و سند حسابداری مرتبط برگشت داده شدند'],
  ['Avan Core standard workspace initialized', 'شرکت با ساختار استاندارد آوان ایجاد شد'],
  ['Workspace company identity and operational print settings updated', 'مشخصات شرکت و تنظیمات چاپ به‌روزرسانی شد'],
  ['Workspace print identity updated', 'مشخصات چاپ شرکت به‌روزرسانی شد'],
  ['Company display identity renamed', 'نام نمایشی شرکت تغییر کرد'],
  ['Draft journal saved without lines', 'پیش‌نویس سند حسابداری بدون ردیف ذخیره شد']
]);

const ROLE_FA = Object.freeze({ owner:'مالک', manager:'مدیر', accountant:'حسابدار', viewer:'مشاهده‌گر' });
const REPLACERS = [
  [/Invoice draft saved with (\d+) line\(s\)/gi, 'پیش‌نویس فاکتور با $1 ردیف ذخیره شد'],
  [/Draft journal saved with (\d+) line\(s\)/gi, 'پیش‌نویس سند حسابداری با $1 ردیف ذخیره شد'],
  [/Invoice posted as journal (\d+)/gi, 'فاکتور ثبت قطعی شد و سند حسابداری شماره $1 ایجاد شد'],
  [/Fiscal period closed:\s*(.+)/gi, 'دوره مالی بسته شد: $1'],
  [/Fiscal period reopened:\s*(.+)/gi, 'دوره مالی بازگشایی شد: $1'],
  [/Document status:\s*uploaded\s*->\s*extracted/gi, 'سند بارگذاری‌شده پردازش شد'],
  [/Document status:\s*ocr_processing\s*->\s*uploaded/gi, 'پردازش متن سند متوقف و سند به حالت بارگذاری‌شده بازگشت'],
  [/Document status:\s*uploaded\s*->\s*ocr_processing/gi, 'پردازش متن سند آغاز شد'],
  [/Document status:\s*extracted\s*->\s*reviewed/gi, 'اطلاعات استخراج‌شده سند بررسی شد'],
  [/Document status:\s*reviewed\s*->\s*linked/gi, 'سند بررسی‌شده به رکورد حسابداری مرتبط شد'],
  [/Document status:\s*uploaded\s*->\s*reviewed/gi, 'سند بارگذاری‌شده بررسی شد'],
  [/Money display\/input unit changed to rial/gi, 'واحد نمایش و ورود مبلغ به ریال تغییر کرد'],
  [/Money display\/input unit changed to toman/gi, 'واحد نمایش و ورود مبلغ به تومان تغییر کرد'],
  [/(?:Workspace|Company|شرکت)\s+member added as (owner|manager|accountant|viewer)/gi, (_, role) => `کاربر با نقش ${ROLE_FA[String(role).toLowerCase()] || 'مجاز'} به شرکت افزوده شد`],
  [/(?:Pending\s+)?(?:workspace|company|شرکت)\s+invitation for .* as (owner|manager|accountant|viewer)/gi, (_, role) => `دعوت کاربر برای نقش ${ROLE_FA[String(role).toLowerCase()] || 'مجاز'} در انتظار پذیرش است`],
  [/member added as accountant/gi, 'کاربر با نقش حسابدار به شرکت افزوده شد'],
  [/member added as manager/gi, 'کاربر با نقش مدیر به شرکت افزوده شد'],
  [/member added as viewer/gi, 'کاربر با نقش مشاهده‌گر به شرکت افزوده شد'],
  [/Platform Admin/gi, 'مدیر سامانه'], [/SaaS Control Plane/gi, 'مرکز مدیریت سامانه'], [/Control Plane/gi, 'مرکز مدیریت سامانه'],
  [/Support Session/gi, 'دسترسی پشتیبانی'], [/Support/gi, 'پشتیبانی'], [/Session/gi, 'نشست'],
  [/Read-only/gi, 'فقط‌خواندنی'], [/Read only/gi, 'فقط‌خواندنی'], [/Viewer/gi, 'مشاهده‌گر'],
  [/Tenant/gi, 'شرکت'], [/Workspace/gi, 'شرکت'], [/Company/gi, 'شرکت'], [/Onboarding/gi, 'راه‌اندازی'], [/Registry/gi, 'ثبت سامانه'],
  [/Ledger/gi, 'دفتر حسابداری'], [/Posted\/Reversed/gi, 'ثبت‌قطعی/برگشتی'], [/Posted/gi, 'ثبت‌قطعی'], [/Reversed/gi, 'برگشتی'], [/Posting/gi, 'ثبت قطعی'],
  [/Immutable/gi, 'غیرقابل‌تغییر'], [/Database/gi, 'پایگاه داده'], [/LocalStorage/gi, 'حافظه محلی مرورگر'], [/Dashboard/gi, 'داشبورد'],
  [/Supabase/gi, 'زیرساخت ابری'], [/Core/gi, 'هسته'], [/Enterprise/gi, 'سازمانی'], [/Pro/gi, 'حرفه‌ای'], [/accountant/gi, 'حسابدار'], [/manager/gi, 'مدیر'], [/owner/gi, 'مالک']
];

function translate(value) {
  let text = String(value ?? '');
  if (EXACT.has(text.trim())) return EXACT.get(text.trim());
  for (const [pattern, replacement] of REPLACERS) text = text.replace(pattern, replacement);
  return text;
}

function translateNode(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT','STYLE','CODE','PRE'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return /[A-Za-z]/.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) { const next = translate(node.nodeValue); if (next !== node.nodeValue) node.nodeValue = next; }
  root.querySelectorAll?.('[placeholder],[title],[aria-label]').forEach(element => {
    for (const attr of ['placeholder','title','aria-label']) {
      if (!element.hasAttribute(attr)) continue;
      const value = element.getAttribute(attr); const next = translate(value); if (next !== value) element.setAttribute(attr, next);
    }
  });
}

Lifecycle.use('localization:persian-runtime-guard', () => translateNode(document.body), { priority:1000 });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Lifecycle.schedule('persian-ready'), { once:true });
else Lifecycle.schedule('persian-ready');

export { translate as translateUserFacingText, translateNode };
