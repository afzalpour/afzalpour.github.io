'use strict';

const ACTION_FA = {
  purchase_invoice:
    'پیشنهاد فاکتور خرید',

  sales_invoice:
    'پیشنهاد فاکتور فروش',

  journal:
    'پیشنهاد سند حسابداری',

  review_required:
    'نیازمند تصمیم کاربر'
};

const WARNING_FA = {
  AMOUNT_REVIEW_REQUIRED:
    'مبلغ نیاز به بررسی دارد',

  DATE_REVIEW_REQUIRED:
    'تاریخ سند نیاز به بررسی دارد',

  PARTY_MATCH_REQUIRED:
    'طرف‌حساب تطبیق داده نشد',

  ACCOUNT_MATCH_REQUIRED:
    'حساب پیشنهادی تطبیق داده نشد',

  ACTION_REVIEW_REQUIRED:
    'نوع عملیات باید توسط کاربر تعیین شود'
};

function option(
  value,
  label,
  selected
) {
  return `
    <option
      value="${value}"
      ${
        value === selected
          ? 'selected'
          : ''
      }
    >
      ${label}
    </option>
  `;
}

export function
documentReviewModalHtml({
  document,
  proposal,
  parties = [],
  accounts = [],
  dateFa,
  money,
  esc
}) {
  const warnings =
    proposal?.warnings || [];

  const activeParties =
    parties.filter(
      item => item.is_active
    );

  const postableAccounts =
    accounts.filter(
      item =>
        item.is_active &&
        item.is_postable
    );

const savedReview =
  (
    document
      ?.extracted_data
      ?.review &&
    typeof document
      .extracted_data
      .review === 'object'
  )
    ? document
        .extracted_data
        .review
    : {};

const selectedPartyId =
  savedReview.party_id ||
  document?.party_id ||
  proposal
    ?.party
    ?.suggestedId ||
  '';

const selectedAccountId =
  savedReview.account_id ||
  proposal
    ?.account
    ?.suggestedId ||
  '';

const selectedAction =
  savedReview.action ||
  proposal?.action ||
  'review_required';
  
  return `
    <h2>
      بازبینی سند هوشمند
    </h2>

    <div class="info-box">
      این صفحه فقط یک پیشنهاد حسابداری است.
      هیچ ثبت قطعی بدون تأیید کاربر انجام نمی‌شود.
    </div>

    <div class="summary-strip">

      <span class="summary-pill">
        ${
          esc(
            document?.file_name ||
            '—'
          )
        }
      </span>

      <span class="summary-pill">
        ${
          ACTION_FA[
            selectedAction
          ] ||
          'نیازمند بررسی'
        }
      </span>

      ${
        proposal?.totalAmount
          ?`
            <span class="summary-pill">
              ${
                money(
                  proposal.totalAmount
                )
              }
            </span>
          `
          :''
      }

    </div>

    ${
      warnings.length
        ?`
          <div
            class="error-box section"
          >
            <b>
              موارد نیازمند بررسی:
            </b>

            <ul>
              ${
                warnings
                  .map(
                    warning => `
                      <li>
                        ${
                          WARNING_FA[
                            warning
                          ] ||
                          esc(warning)
                        }
                      </li>
                    `
                  )
                  .join('')
              }
            </ul>
          </div>
        `
        :`
          <div
            class="info-box section"
          >
            داده‌های استخراج‌شده
            برای بازبینی آماده‌اند.
          </div>
        `
    }

    <form id="documentReviewForm">

      <div class="form-grid">

        <div class="field">

          <label>
            نوع عملیات پیشنهادی
          </label>

          <select
            name="action"
          >
            ${
              option(
                'purchase_invoice',
                'فاکتور خرید',
                selectedAction
              )
            }

            ${
              option(
                'sales_invoice',
                'فاکتور فروش',
                selectedAction
              )
            }

            ${
              option(
                'journal',
                'سند حسابداری',
                selectedAction
              )
            }

            ${
              option(
                'review_required',
                'فعلاً فقط بازبینی',
                selectedAction
              )
            }
          </select>

        </div>

        <div class="field">

          <label>
            تاریخ سند
          </label>

          <input
            type="date"
            name="documentDate"
            value="${
              esc(
                proposal
                  ?.documentDate ||
                ''
              )
            }"
          >

          ${
            proposal?.documentDate
              ?`
                <small>
                  جلالی:
                  ${
                    dateFa(
                      proposal.documentDate
                    )
                  }
                </small>
              `
              :''
          }

        </div>

        <div class="field">

          <label>
            شماره سند / فاکتور
          </label>

          <input
            name="documentNumber"
            value="${
              esc(
                proposal
                  ?.documentNumber ||
                ''
              )
            }"
          >

        </div>

        <div class="field">

          <label>
            مبلغ کل
          </label>

          <input
            name="totalAmount"
            inputmode="numeric"
            value="${
              esc(
                proposal
                  ?.totalAmount ??
                ''
              )
            }"
          >

        </div>

        <div class="field">

          <label>
            مالیات
          </label>

          <input
            name="taxAmount"
            inputmode="numeric"
            value="${
              esc(
                proposal
                  ?.taxAmount ??
                ''
              )
            }"
          >

        </div>

        <div class="field">

          <label>
            طرف‌حساب
          </label>

          <select
            name="partyId"
          >

            <option value="">
              انتخاب نشده
            </option>

            ${
              activeParties
                .map(
                  party =>
                    option(
                      party.id,
                      esc(
                        party.name
                      ),
                      selectedPartyId
                    )
                )
                .join('')
            }

          </select>

          ${
            proposal
              ?.party
              ?.extractedName
              ?`
                <small>
                  استخراج‌شده:
                  ${
                    esc(
                      proposal
                        .party
                        .extractedName
                    )
                  }
                </small>
              `
              :''
          }

        </div>

        <div class="field">

          <label>
            حساب پیشنهادی
          </label>

          <select
            name="accountId"
          >

            <option value="">
              انتخاب نشده
            </option>

            ${
              postableAccounts
                .map(
                  account =>
                    option(
                      account.id,
                      esc(
                        `${account.code} — ${account.name}`
                      ),
                      selectedAccountId
                    )
                )
                .join('')
            }

          </select>

          ${
            proposal
              ?.account
              ?.extractedHint
              ?`
                <small>
                  پیشنهاد استخراج:
                  ${
                    esc(
                      proposal
                        .account
                        .extractedHint
                    )
                  }
                </small>
              `
              :''
          }

        </div>

      </div>

      <div class="field section">

        <label>
          شرح
        </label>

        <textarea
          name="description"
          rows="3"
        >${
          esc(
            proposal
              ?.description ||
            ''
          )
        }</textarea>

      </div>

      <div class="form-actions">

        <button
          type="button"
          class="ghost"
          id="cancelModal"
        >
          انصراف
        </button>

        <button
          type="button"
          class="ghost"
          id="viewSourceDocumentBtn"
        >
          مشاهده فایل اصلی
        </button>

        <button
          class="primary"
          id="saveDocumentReviewBtn"
        >
          تأیید بازبینی
        </button>

      </div>

    </form>
  `;
}
