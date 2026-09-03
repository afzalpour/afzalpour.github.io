'use strict';


function clarificationFa(
  code
) {
  const map = {
    REPORT_QUERY_REQUIRED:
      'درخواست گزارش را بنویسید.',

    REPORT_INTENT_UNKNOWN:
      'منظور گزارش مشخص نشد. نمونه: «هزینه این ماه».',

    REPORT_ACCOUNT_REQUIRED:
      'برای گردش حساب، نام حساب را هم وارد کنید.',

    REPORT_INTENT_NOT_EXECUTABLE:
      'این نوع گزارش هنوز در نسخه فعلی قابل اجرا نیست.',

    REPORT_CLARIFICATION_REQUIRED:
      'برای اجرای گزارش اطلاعات بیشتری لازم است.'
  };

  return (
    map[code] ||
    'برای اجرای این گزارش اطلاعات بیشتری لازم است.'
  );
}


function periodHtml(
  period,
  dateFa,
  esc
) {
  if (!period?.to) {
    return '';
  }

  if (
    period.from &&
    period.from ===
      period.to
  ) {
    return `
      <span class="muted">
        تاریخ:
        ${esc(
          dateFa(
            period.to
          )
        )}
      </span>
    `;
  }

  if (
    period.from &&
    period.to
  ) {
    return `
      <span class="muted">
        از
        ${esc(
          dateFa(
            period.from
          )
        )}
        تا
        ${esc(
          dateFa(
            period.to
          )
        )}
      </span>
    `;
  }

  return `
    <span class="muted">
      تا
      ${esc(
        dateFa(
          period.to
        )
      )}
    </span>
  `;
}


function sourceHtml(
  source,
  esc
) {
  if (!source?.name) {
    return '';
  }

  return `
    <div class="section">
      <small class="muted">
        منبع معتبر:
        ${esc(source.name)}
      </small>
    </div>
  `;
}


function tableResultHtml({
  result,
  money,
  dateFa,
  esc
}) {
  const rows =
    Array.isArray(
      result.rows
    )
      ? result.rows
      : [];

  if (!rows.length) {
    return `
      <div class="empty">
        در این بازه داده‌ای وجود ندارد.
      </div>
    `;
  }

  const source =
    result.source
      ?.name;


  if (
    source ===
      'report_trial_balance'
  ) {
    return `
      <table>
        <thead>
          <tr>
            <th>حساب</th>
            <th>بدهکار</th>
            <th>بستانکار</th>
            <th>مانده</th>
          </tr>
        </thead>

        <tbody>
          ${rows.map(
            row => `
              <tr>
                <td>
                  ${esc(
                    row.account_code ||
                    ''
                  )}
                  —
                  ${esc(
                    row.account_name ||
                    ''
                  )}
                </td>

                <td class="num">
                  ${money(
                    row.debit_turnover
                  )}
                </td>

                <td class="num">
                  ${money(
                    row.credit_turnover
                  )}
                </td>

                <td class="num">
                  ${money(
                    row.net
                  )}
                </td>
              </tr>
            `
          ).join('')}
        </tbody>
      </table>
    `;
  }


  if (
    source ===
      'report_journal'
  ) {
    return `
      <table>
        <thead>
          <tr>
            <th>سند</th>
            <th>تاریخ</th>
            <th>حساب</th>
            <th>شرح</th>
            <th>طرف‌حساب</th>
            <th>بدهکار</th>
            <th>بستانکار</th>
          </tr>
        </thead>

        <tbody>
          ${rows.slice(0, 100)
            .map(
              row => `
                <tr>
                  <td>
                    ${esc(
                      row.journal_no ||
                      ''
                    )}
                  </td>

                  <td>
                    ${esc(
                      dateFa(
                        row.entry_date
                      )
                    )}
                  </td>

                  <td>
                    ${esc(
                      row.account_code ||
                      ''
                    )}
                    —
                    ${esc(
                      row.account_name ||
                      ''
                    )}
                  </td>

                  <td>
                    ${esc(
                      row.line_description ||
                      row.entry_description ||
                      ''
                    )}
                  </td>

                  <td>
                    ${esc(
                      row.party_name ||
                      '—'
                    )}
                  </td>

                  <td class="num">
                    ${money(
                      row.debit
                    )}
                  </td>

                  <td class="num">
                    ${money(
                      row.credit
                    )}
                  </td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }


  if (
    source ===
      'report_account_statement'
  ) {
    return `
      <table>
        <thead>
          <tr>
            <th>سند</th>
            <th>تاریخ</th>
            <th>شرح</th>
            <th>بدهکار</th>
            <th>بستانکار</th>
            <th>مانده</th>
          </tr>
        </thead>

        <tbody>
          ${rows.map(
            row => `
              <tr>
                <td>
                  ${esc(
                    row.journal_no ||
                    ''
                  )}
                </td>

                <td>
                  ${esc(
                    dateFa(
                      row.entry_date
                    )
                  )}
                </td>

                <td>
                  ${esc(
                    row.description ||
                    ''
                  )}
                </td>

                <td class="num">
                  ${money(
                    row.debit
                  )}
                </td>

                <td class="num">
                  ${money(
                    row.credit
                  )}
                </td>

                <td class="num">
                  ${money(
                    row.running_net
                  )}
                </td>
              </tr>
            `
          ).join('')}
        </tbody>
      </table>
    `;
  }


  return `
    <div class="empty">
      گزارش اجرا شد.
      ${rows.length}
      ردیف دریافت شد.
    </div>
  `;
}


function cashResultHtml({
  result,
  money,
  esc
}) {
  const rows =
    result.rows || [];

  return `
    <div class="grid4">
      <div class="card">
        <div class="kpi-label">
          مانده کل
        </div>

        <div class="kpi-value">
          ${money(
            result.value
          )}
        </div>
      </div>
    </div>

    ${
      rows.length
        ? `
          <table class="section">
            <thead>
              <tr>
                <th>نوع</th>
                <th>حساب</th>
                <th>مانده</th>
              </tr>
            </thead>

            <tbody>
              ${rows.map(
                row => `
                  <tr>
                    <td>
                      ${
                        row.kind ===
                          'bank'
                          ? 'بانک'
                          : 'صندوق'
                      }
                    </td>

                    <td>
                      ${esc(
                        row.account_code ||
                        ''
                      )}
                      —
                      ${esc(
                        row.account_name ||
                        ''
                      )}
                    </td>

                    <td class="num">
                      ${money(
                        row.amount
                      )}
                    </td>
                  </tr>
                `
              ).join('')}
            </tbody>
          </table>
        `
        : ''
    }
  `;
}


function agingResultHtml({
  result,
  money,
  esc
}) {
  const parties =
    result.result
      ?.parties ||
    [];

  return `
    <div class="grid4">

      <div class="card">
        <div class="kpi-label">
          مانده کل
        </div>

        <div class="kpi-value">
          ${money(
            result.value
          )}
        </div>
      </div>

    </div>

    ${
      parties.length
        ? `
          <table class="section">
            <thead>
              <tr>
                <th>طرف‌حساب</th>
                <th>مانده</th>
              </tr>
            </thead>

            <tbody>
              ${parties
                .slice(0, 20)
                .map(
                  party => `
                    <tr>
                      <td>
                        ${esc(
                          party.partyName
                        )}
                      </td>

                      <td class="num">
                        ${money(
                          party.total
                        )}
                      </td>
                    </tr>
                  `
                )
                .join('')}
            </tbody>
          </table>
        `
        : `
          <div class="empty section">
            مانده بازی برای طرف‌حساب‌ها وجود ندارد.
          </div>
        `
    }
  `;
}


export function
naturalReportBoxHtml({
  query = '',
  esc
} = {}) {
  return `
    <div class="card section">

      <div class="section-head">

        <div>
          <h2>
            ✦ از آوان بپرس
          </h2>

          <span class="muted">
            گزارش فارسی از داده‌های معتبر Ledger
          </span>
        </div>

      </div>

      <form
        id="nlReportForm"
      >
        <div class="form-grid">

          <div class="field">
            <label>
              چه گزارشی می‌خواهید؟
            </label>

            <input
              id="nlReportQuery"
              type="text"
              value="${esc(query)}"
              placeholder="مثلاً: هزینه این ماه"
              autocomplete="off"
            >
          </div>

          <div class="field">
            <label>
              &nbsp;
            </label>

            <button
              class="primary"
              type="submit"
              id="nlReportSubmit"
            >
              اجرای گزارش
            </button>
          </div>

        </div>
      </form>

      <div class="row-actions section">

        <button
          type="button"
          class="ghost small"
          data-nl-example="هزینه این ماه"
        >
          هزینه این ماه
        </button>

        <button
          type="button"
          class="ghost small"
          data-nl-example="مانده بانک‌ها"
        >
          مانده بانک‌ها
        </button>

        <button
          type="button"
          class="ghost small"
          data-nl-example="تراز آزمایشی این ماه"
        >
          تراز آزمایشی
        </button>

        <button
          type="button"
          class="ghost small"
          data-nl-example="مطالبات"
        >
          مطالبات
        </button>

      </div>

      <small class="muted">
        آوان SQL آزاد اجرا نمی‌کند؛
        درخواست فقط به گزارش‌های کنترل‌شده تبدیل می‌شود.
      </small>

    </div>
  `;
}


export function
naturalReportResultHtml({
  payload,
  money,
  dateFa,
  esc
} = {}) {
  if (!payload?.result) {
    return '';
  }

  const result =
    payload.result;

  if (
    result.status ===
      'clarification'
  ) {
    return `
      <div class="card section">
        <div class="error-box">
          ${esc(
            clarificationFa(
              result.code
            )
          )}
        </div>
      </div>
    `;
  }

  if (
    result.status !==
      'ok'
  ) {
    return '';
  }

  let body = '';


  if (
    result.kind ===
      'metric'
  ) {
    body = `
      <div class="grid4">

        <div class="card">
          <div class="kpi-label">
            ${esc(
              result.title
            )}
          </div>

          <div class="kpi-value">
            ${money(
              result.value
            )}
          </div>
        </div>

      </div>
    `;
  } else if (
    result.kind ===
      'metric_table'
  ) {
    body =
      cashResultHtml({
        result,
        money,
        esc
      });
  } else if (
    result.kind ===
      'aging'
  ) {
    body =
      agingResultHtml({
        result,
        money,
        esc
      });
  } else if (
    result.kind ===
      'table'
  ) {
    body =
      tableResultHtml({
        result,
        money,
        dateFa,
        esc
      });
  }


  return `
    <div class="card section">

      <div class="section-head">

        <div>
          <h2>
            ${esc(
              result.title ||
              'نتیجه گزارش'
            )}
          </h2>

          ${periodHtml(
            result.period,
            dateFa,
            esc
          )}
        </div>

      </div>

      ${body}

      ${
        result.note
          ? `
            <div class="info-box section">
              ${esc(
                result.note
              )}
            </div>
          `
          : ''
      }

      ${sourceHtml(
        result.source,
        esc
      )}

    </div>
  `;
}
