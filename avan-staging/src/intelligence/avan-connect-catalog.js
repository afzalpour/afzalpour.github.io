'use strict';

const c=(key,title,state,capabilities=[])=>Object.freeze({key,title,state,capabilities:Object.freeze(capabilities)});

export const AVAN_CONNECT_CATALOG=Object.freeze([
  c('bank_statement_csv','ورود فایل صورت‌حساب بانکی','available',['ورود فایل','پیش‌نمایش','تطبیق بانکی']),
  c('smart_document_extract','استخراج هوشمند اسناد','available',['استخراج سند','بازبینی انسانی']),
  c('einvoice_preflight','پیش‌اعتبارسنجی صورتحساب الکترونیکی','limited',['پیش‌اعتبارسنجی','ساخت محتوای استاندارد']),
  c('pos_connector','اتصال پایانه فروش','not_connected',['دریافت تراکنش فروش']),
  c('store_connector','اتصال فروشگاه اینترنتی','not_connected',['دریافت سفارش','همگام‌سازی فروش']),
  c('generic_connector','اتصال عمومی داده','not_connected',['دریافت داده','ارسال کنترل‌شده داده'])
]);
