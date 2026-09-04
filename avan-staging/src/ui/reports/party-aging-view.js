'use strict';

function overdueTotal(side) {
  return (
    side.aging['1_30'] +
    side.aging['31_60'] +
    side.aging['61_90'] +
    side.aging['90_plus']
  );
}

function sideLabel(side) {
  return side === 'receivables'
    ? 'مطالبات'
    : 'بدهی تجاری';
}

function agingTable(
  side,
  money
) {
  if (!side.available) {
    return `
      <div class="empty">
        حساب کنترلی این بخش در Workspace
        تعریف نشده است.
      </div>
    `;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>سررسید</th>
          <th>مبلغ</th>
        </tr>
      </thead>

      <tbody>
        <tr>
          <td>جاری / سررسیدنشده</td>
          <td class="num">
            ${money(
              side.aging.current
            )}
          </td>
        </tr>

        <tr>
          <td>۱ تا ۳۰ روز</td>
          <td class="num">
            ${money(
              side.aging['1_30']
            )}
          </td>
        </tr>

        <tr>
          <td>۳۱ تا ۶۰ روز</td>
          <td class="num">
            ${money(
              side.aging['31_60']
            )}
          </td>
        </tr>

        <tr>
          <td>۶۱ تا ۹۰ روز</td>
          <td class="num">
            ${money(
              side.aging['61_90']
            )}
          </td>
        </tr>

        <tr>
          <td>بیش از ۹۰ روز</td>
          <td class="num">
            ${money(
              side.aging['90_plus']
            )}
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

function partyRows(
  sideName,
  side,
  money,
  esc
) {
  if (
    !side.available ||
    !side.parties.length
  ) {
    return `
      <div class="empty">
        مانده بازی برای نمایش وجود ندارد.
      </div>
    `;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>طرف‌حساب</th>
          <th>مانده باز</th>
          <th>جزئیات</th>
        </tr>
      </thead>

      <tbody>
        ${
          side.parties
            .slice(0, 10)
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

                  <td>
                    <button
                      class="ghost small"
                      data-aging-side="${sideName}"
                      data-aging-party="${party.partyId}"
                    >
                      ریز مانده
                    </button>
                  </td>
                </tr>
              `
            )
            .join('')
        }
      </tbody>
    </table>
  `;
}

export function partyAgingSection(
  aging,
  {
    money,
    dateFa,
    esc
  }
) {
  const ar =
    aging.receivables;

  const ap =
    aging.payables;

  return `
    <div class="section card">

      <div class="section-head">
        <div>
          <h2>
            مطالبات و بدهی تجاری
          </h2>

          <span class="muted">
            Aging مبتنی بر Ledger
            تا ${dateFa(aging.asOf)}
          </span>
        </div>

        <span class="cloud-badge">
          AR / AP
        </span>
      </div>

      <div class="grid4">

        <div class="card">
          <div class="kpi-label">
            مطالبات باز
          </div>

          <div class="kpi-value">
            ${
              ar.available
                ?money(ar.total)
                :'تعریف نشده'
            }
          </div>
        </div>

        <div class="card">
          <div class="kpi-label">
            مطالبات سررسیدگذشته
          </div>

          <div class="kpi-value ${
            ar.available &&
            overdueTotal(ar) > 0n
              ?'neg'
              :''
          }">
            ${
              ar.available
                ?money(
                  overdueTotal(ar)
                )
                :'—'
            }
          </div>
        </div>

        <div class="card">
          <div class="kpi-label">
            بدهی تجاری باز
          </div>

          <div class="kpi-value">
            ${
              ap.available
                ?money(ap.total)
                :'تعریف نشده'
            }
          </div>
        </div>

        <div class="card">
          <div class="kpi-label">
            بدهی سررسیدگذشته
          </div>

          <div class="kpi-value ${
            ap.available &&
            overdueTotal(ap) > 0n
              ?'neg'
              :''
          }">
            ${
              ap.available
                ?money(
                  overdueTotal(ap)
                )
                :'—'
            }
          </div>
        </div>

      </div>

      <div class="grid2 section">

        <div class="card">
          <h3>
            Aging مطالبات
          </h3>

          ${
            agingTable(
              ar,
              money
            )
          }
        </div>

        <div class="card">
          <h3>
            Aging بدهی تجاری
          </h3>

          ${
            agingTable(
              ap,
              money
            )
          }
        </div>

      </div>

      <div class="grid2 section">

        <div class="card">
          <h3>
            بیشترین مطالبات
          </h3>

          ${
            partyRows(
              'receivables',
              ar,
              money,
              esc
            )
          }
        </div>

        <div class="card">
          <h3>
            بیشترین بدهی‌ها
          </h3>

          ${
            partyRows(
              'payables',
              ap,
              money,
              esc
            )
          }
        </div>

      </div>

    </div>
  `;
}

export function partyAgingDetailHtml({
  aging,
  sideName,
  partyId,
  money,
  dateFa,
  esc
}) {
  const side =
    aging[sideName];

  if (
    !side ||
    !side.available
  ) {
    return `
      <div class="empty">
        این بخش در دسترس نیست.
      </div>
    `;
  }

  const party =
    side.parties.find(
      item =>
        item.partyId ===
        partyId
    );

  if (!party) {
    return `
      <div class="empty">
        مانده بازی برای این طرف‌حساب وجود ندارد.
      </div>
    `;
  }

  const rows =
    party.openItems
      .map(
        item => `
          <tr>
            <td>
              ${
                item.journalNo ??
                '—'
              }
            </td>

            <td>
              ${dateFa(
                item.entryDate
              )}
            </td>

            <td>
              ${dateFa(
                item.dueDate
              )}
            </td>

            <td class="num">
              ${money(
                item.remaining
              )}
            </td>

            <td>
              <button
                class="ghost small"
                data-aging-journal="${item.journalEntryId}"
              >
                مشاهده سند
              </button>
            </td>
          </tr>
        `
      )
      .join('');

  return `
    <div class="section-head">

      <div>
        <h2>
          ${sideLabel(sideName)}
          —
          ${esc(party.partyName)}
        </h2>

        <span class="muted">
          ریز مانده باز تا
          ${dateFa(aging.asOf)}
        </span>
      </div>

      <span class="cloud-badge">
        Ledger Aging
      </span>

    </div>

    <div class="card">
      <div class="kpi-label">
        مانده باز
      </div>

      <div class="kpi-value">
        ${money(
          party.total
        )}
      </div>
    </div>

    <div class="section">
      ${
        rows
          ?`
            <table>
              <thead>
                <tr>
                  <th>سند</th>
                  <th>تاریخ ثبت</th>
                  <th>سررسید</th>
                  <th>مانده</th>
                  <th>Drill-down</th>
                </tr>
              </thead>

              <tbody>
                ${rows}
              </tbody>
            </table>
          `
          :`
            <div class="empty">
              ردیف بازی وجود ندارد.
            </div>
          `
      }
    </div>

    <div class="form-actions">
      <button
        class="ghost"
        id="cancelModal"
      >
        بستن
      </button>
    </div>
  `;
}
