'use strict';

const TYPE_FA = {
  receipt: 'رسید',
  invoice: 'فاکتور',
  purchase_invoice: 'فاکتور خرید',
  sales_invoice: 'فاکتور فروش',
  bank_slip: 'رسید بانکی',
  other: 'سایر'
};

const STATUS_FA = {
  uploaded: 'آپلود شده',
  ocr_processing: 'در حال پردازش',
  extracted: 'استخراج قبلی',
  reviewed: 'بازبینی شده',
  linked: 'متصل به سند',
  rejected: 'رد شده'
};

export function
documentsPageHtml({
  documents = [],
  parties = [],
  dateFa,
  money,
  esc
}) {
  const partyMap = new Map(
    parties.map(party => [party.id, party])
  );

  const rows = documents.map(document => {
    const draft =
      document?.extracted_data?.accounting_draft || null;

    return `
      <tr>
        <td>${esc(document.file_name)}</td>
        <td>${TYPE_FA[document.document_type] || esc(document.document_type)}</td>
        <td>${document.party_id ? esc(partyMap.get(document.party_id)?.name || '—') : '—'}</td>
        <td>${document.source_document_date ? dateFa(document.source_document_date) : '—'}</td>
        <td class="num">${document.total_amount ? money(document.total_amount) : '—'}</td>
        <td>
          <span class="badge ${document.status}">
            ${STATUS_FA[document.status] || esc(document.status)}
          </span>
        </td>
        <td>${dateFa(String(document.created_at || '').slice(0, 10))}</td>
        <td>
          <div class="row-actions">
            <button class="ghost small" data-view-document="${document.id}">
              مشاهده اصل سند
            </button>

            ${document.status !== 'linked' ? `
              <button class="primary small" data-review-document="${document.id}">
                بازبینی دستی
              </button>

              ${document.status === 'reviewed' && !draft ? `
                <button class="good-btn small" data-create-document-draft="${document.id}">
                  ساخت پیش‌نویس حسابداری
                </button>
              ` : ''}

              ${document.status === 'reviewed' && draft ? `
                <button class="ghost small" data-open-document-draft="${document.id}">
                  ادامه پیش‌نویس
                </button>
                <button class="good-btn small" data-link-document-ledger="${document.id}">
                  اتصال به Ledger
                </button>
              ` : ''}
            ` : ''}

            ${document.status === 'linked' && document.linked_journal_entry_id ? `
              <button class="ghost small" data-view-linked-journal="${document.linked_journal_entry_id}">
                مشاهده سند Ledger
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="section-head">
      <div>
        <h2>اسناد هوشمند</h2>
        <span class="muted">
          عکس یا PDF را ثبت کنید؛ اصل فایل محفوظ می‌ماند و اطلاعات سند در مرحله بازبینی تکمیل می‌شود.
        </span>
      </div>

      <button class="primary" id="uploadDocumentBtn">
        ＋ آپلود سند
      </button>
    </div>

    <div class="info-box avan-ocr-freeze-note">
      استخراج خودکار متن فعلاً غیرفعال است تا نسخه دقیق‌تر و قابل‌اعتمادتر جایگزین شود.
      مشاهده اصل فایل، بازبینی دستی و اتصال کنترل‌شده به حسابداری فعال هستند.
    </div>

    <div class="info-box">
      فایل‌های مجاز: JPG، PNG، WEBP و PDF — حداکثر ۱۰ مگابایت
    </div>

    ${rows ? `
      <table>
        <thead>
          <tr>
            <th>فایل</th>
            <th>نوع</th>
            <th>طرف‌حساب</th>
            <th>تاریخ سند</th>
            <th>مبلغ</th>
            <th>وضعیت</th>
            <th>آپلود</th>
            <th>اقدام</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    ` : `
      <div class="empty">هنوز سندی آپلود نشده است.</div>
    `}
  `;
}

export function
documentUploadModalHtml({
  parties = [],
  esc
}) {
  const partyOptions = parties
    .filter(party => party.is_active)
    .map(party => `
      <option value="${party.id}">${esc(party.name)}</option>
    `)
    .join('');

  return `
    <h2>آپلود سند</h2>

    <div class="info-box">
      تصویر رسید، فاکتور یا PDF را انتخاب کنید.
      فایل در فضای خصوصی آوان نگهداری می‌شود.
    </div>

    <form id="documentUploadForm">
      <div class="form-grid">
        <div class="field">
          <label>نوع سند</label>
          <select name="documentType">
            <option value="receipt">رسید</option>
            <option value="purchase_invoice">فاکتور خرید</option>
            <option value="sales_invoice">فاکتور فروش</option>
            <option value="bank_slip">رسید بانکی</option>
            <option value="invoice">فاکتور</option>
            <option value="other">سایر</option>
          </select>
        </div>

        <div class="field">
          <label>طرف‌حساب</label>
          <select name="partyId">
            <option value="">بدون طرف‌حساب</option>
            ${partyOptions}
          </select>
        </div>
      </div>

      <div class="field section">
        <label>تصویر یا PDF</label>
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          required
        >
        <small>حداکثر حجم فایل ۱۰ مگابایت</small>
      </div>

      <div id="documentUploadStatus" class="muted section"></div>

      <div class="form-actions">
        <button type="button" class="ghost" id="cancelModal">انصراف</button>
        <button class="primary" id="documentUploadSubmit">آپلود</button>
      </div>
    </form>
  `;
}
