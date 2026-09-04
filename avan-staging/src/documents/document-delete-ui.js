'use strict';

import {
  installAvanCloud
} from '../infrastructure/supabase/avan-cloud-bootstrap.js';
import {
  openModal,
  closeModal
} from '../ui/components/modal.js';
import {
  toast
} from '../ui/feedback/toast.js';

const cloud = installAvanCloud();
const BUCKET = 'avan-documents';
const deletedIds = new Set();
let decorating = false;

function esc(value) {
  return String(value ?? '')
    .replace(/[&<>'"]/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[char]);
}

async function documentById(id) {
  const rows = await cloud.select(
    'documents',
    `select=*&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows?.[0] || null;
}

function hasAccountingDraft(item) {
  return Boolean(
    item?.extracted_data &&
    typeof item.extracted_data === 'object' &&
    item.extracted_data?.accounting_draft?.entity_id
  );
}

function isProtected(item) {
  return Boolean(
    !item ||
    item.status === 'linked' ||
    item.linked_journal_entry_id ||
    hasAccountingDraft(item)
  );
}

function removeVisibleRow(id) {
  deletedIds.add(String(id));
  document
    .querySelectorAll(`[data-view-document="${CSS.escape(String(id))}"]`)
    .forEach(button => button.closest('tr')?.remove());
}

async function performDelete(item, button) {
  if (isProtected(item)) {
    throw new Error('DOCUMENT_DELETE_PROTECTED');
  }

  button.disabled = true;
  button.textContent = 'در حال حذف…';

  const deleted = await cloud.rpc(
    'delete_unlinked_smart_document',
    { p_document_id: item.id }
  );

  if (!deleted?.id || !deleted?.deleted) {
    throw new Error('DOCUMENT_DELETE_NOT_ALLOWED');
  }

  let fileCleanupOk = true;
  if (deleted.file_path) {
    try {
      await cloud.removeFiles(BUCKET, [deleted.file_path]);
    } catch (error) {
      fileCleanupOk = false;
      console.error('AVAN_DOCUMENT_FILE_CLEANUP_FAILED', error);
    }
  }

  closeModal();
  removeVisibleRow(item.id);

  toast(
    fileCleanupOk
      ? 'سند حذف شد.'
      : 'سند حذف شد؛ پاکسازی فایل ذخیره‌شده با خطا مواجه شد.'
  );
}

async function openDeleteConfirm(id) {
  const item = await documentById(id);

  if (!item) {
    toast('سند پیدا نشد.');
    return;
  }

  if (isProtected(item)) {
    toast('سندی که به پیش‌نویس یا Ledger متصل است قابل حذف نیست.');
    return;
  }

  openModal(`
    <h2>حذف سند هوشمند</h2>

    <div class="error-box">
      این عملیات برگشت‌پذیر نیست. فقط سندی حذف می‌شود که هنوز به پیش‌نویس حسابداری یا Ledger متصل نشده باشد.
    </div>

    <div class="section">
      <b>${esc(item.file_name || 'سند')}</b>
    </div>

    <div class="form-actions">
      <button type="button" class="ghost" id="cancelSmartDocumentDelete">
        انصراف
      </button>
      <button type="button" class="danger" id="confirmSmartDocumentDelete">
        حذف قطعی
      </button>
    </div>
  `);

  const cancel = document.getElementById('cancelSmartDocumentDelete');
  const confirm = document.getElementById('confirmSmartDocumentDelete');

  if (cancel) cancel.onclick = closeModal;
  if (confirm) {
    confirm.onclick = async () => {
      try {
        const fresh = await documentById(id);
        if (!fresh) {
          closeModal();
          removeVisibleRow(id);
          toast('سند قبلاً حذف شده است.');
          return;
        }
        await performDelete(fresh, confirm);
      } catch (error) {
        console.error('AVAN_DOCUMENT_DELETE_FAILED', error);
        confirm.disabled = false;
        confirm.textContent = 'حذف قطعی';

        const message = String(error?.message || error || '');
        if (
          message.includes('LINKED_DOCUMENT_IMMUTABLE') ||
          message.includes('DOCUMENT_HAS_ACCOUNTING_DRAFT') ||
          message.includes('DOCUMENT_DELETE_PROTECTED')
        ) {
          toast('سند به پیش‌نویس یا Ledger متصل شده و قابل حذف نیست.');
        } else if (
          message.includes('delete_unlinked_smart_document') &&
          (Number(error?.status) === 404 || message.includes('Could not find'))
        ) {
          toast('Patch حذف امن اسناد هنوز روی دیتابیس نصب نشده است.');
        } else if (
          message.includes('DOCUMENT_DELETE_ROLE_DENIED') ||
          message.includes('WORKSPACE_ACCESS_DENIED') ||
          message.includes('DOCUMENT_DELETE_NOT_ALLOWED') ||
          Number(error?.status) === 401 ||
          Number(error?.status) === 403
        ) {
          toast('مجوز حذف این سند وجود ندارد.');
        } else {
          toast('حذف سند انجام نشد.');
        }
      }
    };
  }
}

function rowMayBeDeleted(row) {
  if (!row) return false;
  if (row.querySelector('[data-view-linked-journal]')) return false;
  if (row.querySelector('[data-open-document-draft]')) return false;
  if (row.querySelector('[data-link-document-ledger]')) return false;
  return true;
}

function decorateDeleteButtons() {
  if (decorating) return;
  decorating = true;

  try {
    document.querySelectorAll('[data-view-document]').forEach(view => {
      const id = String(view.dataset.viewDocument || '');
      const row = view.closest('tr');

      if (!id || !row) return;
      if (deletedIds.has(id)) {
        row.remove();
        return;
      }
      if (!rowMayBeDeleted(row)) return;

      const actions = view.closest('.row-actions');
      if (!actions) return;
      if (actions.querySelector(`[data-delete-smart-document="${CSS.escape(id)}"]`)) {
        return;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'danger small';
      button.dataset.deleteSmartDocument = id;
      button.textContent = 'حذف';
      button.title = 'حذف سند بدون اتصال';
      actions.appendChild(button);
    });
  } finally {
    decorating = false;
  }
}

function interceptDelete(event) {
  const button = event.target.closest?.('[data-delete-smart-document]');
  if (!button?.dataset.deleteSmartDocument) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  openDeleteConfirm(button.dataset.deleteSmartDocument).catch(error => {
    console.error('AVAN_DOCUMENT_DELETE_PREPARE_FAILED', error);
    toast('آماده‌سازی حذف سند انجام نشد.');
  });
}

document.addEventListener('click', interceptDelete, true);

const observer = new MutationObserver(() => {
  queueMicrotask(decorateDeleteButtons);
});

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      decorateDeleteButtons();
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    },
    { once: true }
  );
} else {
  decorateDeleteButtons();
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
