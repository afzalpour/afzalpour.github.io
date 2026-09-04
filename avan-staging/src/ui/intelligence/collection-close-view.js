'use strict';

const PRIORITY_FA = {
  high:
    'اولویت بالا',

  medium:
    'اولویت متوسط',

  low:
    'اولویت عادی'
};

const CLOSE_STATUS_FA = {
  blocked:
    'مسدود',

  attention:
    'نیازمند تکمیل',

  ready:
    'آماده'
};

function collectionMessage(
  item,
  money
) {
  const overdueText =
    item.overdue > 0n
      ?` مانده سررسیدگذشته ${money(item.overdue)} است.`
      :'';

  return (
    `سلام ${item.partyName}، ` +
    `طبق حساب‌های آوان مانده باز شما ${money(item.total)} است.` +
    overdueText +
    ' لطفاً زمان پرداخت را اعلام فرمایید. سپاس.'
  );
}

function collectionRows(
  collection,
  {
    money,
    esc
  }
) {
  if (
    !collection.available
  ) {
    return `
      <div class="empty">
        حساب مطالبات در Workspace
        تعریف نشده است.
      </div>
    `;
  }

  if (
    !collection
      .priorities
      .length
  ) {
    return `
      <div class="success-box">
        مانده مطالبات بازی برای پیگیری وجود ندارد.
      </div>
    `;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>اولویت</th>
          <th>مشتری</th>
          <th>مانده</th>
          <th>سررسیدگذشته</th>
          <th>قدیمی‌ترین</th>
          <th>پیشنهاد آوان</th>
          <th>اقدام</th>
        </tr>
      </thead>

      <tbody>
        ${
          collection
            .priorities
            .slice(0, 6)
            .map(
              item => {
                const message =
                  collectionMessage(
                    item,
                    money
                  );

                return `
                  <tr>

                    <td>
                      <span class="badge">
                        ${
                          esc(
                            PRIORITY_FA[
                              item.level
                            ] ||
                            item.level
                          )
                        }
                      </span>

                      <small class="muted">
                        امتیاز
                        ${
                          Number(
                            item.score
                          ).toLocaleString(
                            'fa-IR'
                          )
                        }
                      </small>
                    </td>

                    <td>
                      <b>
                        ${
                          esc(
                            item.partyName
                          )
                        }
                      </b>
                    </td>

                    <td class="num">
                      ${money(
                        item.total
                      )}
                    </td>

                    <td class="num">
                      ${money(
                        item.overdue
                      )}
                    </td>

                    <td>
                      ${
                        item.maxDays > 0
                          ?`${Number(
                              item.maxDays
                            ).toLocaleString(
                              'fa-IR'
                            )} روز`
                          :'جاری'
                      }
                    </td>

                    <td>
                      <b>
                        ${
                          esc(
                            item.action
                              .title
                          )
                        }
                      </b>

                      <div class="muted">
                        ${
                          esc(
                            item.action
                              .suggestion
                          )
                        }
                      </div>
                    </td>

                    <td>
                      <div class="row-actions">

                        <button
                          type="button"
                          class="ghost small"
                          data-collection-party="${
                            esc(
                              item.partyId
                            )
                          }"
                        >
                          ریز مطالبات
                        </button>

                        <button
                          type="button"
                          class="primary small"
                          data-copy-collection-message="${
                            esc(
                              message
                            )
                          }"
                        >
                          کپی متن پیگیری
                        </button>

                      </div>
                    </td>

                  </tr>
                `;
              }
            )
            .join('')
        }
      </tbody>
    </table>
  `;
}

function monthEndRows(
  monthEnd,
  esc
) {
  return `
    <table>
      <thead>
        <tr>
          <th>وضعیت</th>
          <th>کنترل</th>
          <th>توضیح</th>
          <th>تعداد</th>
          <th>اقدام</th>
        </tr>
      </thead>

      <tbody>
        ${
          monthEnd
            .items
            .map(
              item => `
                <tr>

                  <td>
                    <span class="badge">
                      ${
                        item.level ===
                          'blocked'
                          ?'مسدود'
                          :item.level ===
                              'attention'
                            ?'نیازمند تکمیل'
                            :'آماده'
                      }
                    </span>
                  </td>

                  <td>
                    <b>
                      ${esc(
                        item.title
                      )}
                    </b>
                  </td>

                  <td>
                    ${esc(
                      item.description
                    )}
                  </td>

                  <td>
                    ${
                      Number(
                        item.count || 0
                      ).toLocaleString(
                        'fa-IR'
                      )
                    }
                  </td>

                  <td>
                    ${
                      item.page
                        ?`
                          <button
                            type="button"
                            class="ghost small"
                            data-monthend-page="${
                              esc(
                                item.page
                              )
                            }"
                          >
                            بررسی
                          </button>
                        `
                        :'—'
                    }
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

export function
collectionCloseSectionHtml(
  snapshot,
  {
    money,
    dateFa,
    esc
  }
) {
  const collection =
    snapshot.collection;

  const monthEnd =
    snapshot.monthEnd;

  return `
    <div class="section card">

      <div class="section-head">

        <div>
          <h2>
            🎯 Smart Collection Agent
          </h2>

          <span class="muted">
            اولویت‌بندی وصول بر پایه Aging و اثر نقدی
            تا ${dateFa(snapshot.asOf)}
          </span>
        </div>

        <span class="cloud-badge">
          Human-Controlled
        </span>

      </div>

      <div class="grid4 section">

        <div class="card">
          <div class="kpi-label">
            مطالبات باز
          </div>

          <div class="kpi-value small-kpi">
            ${
              collection.available
                ?money(
                  collection.total
                )
                :'تعریف نشده'
            }
          </div>
        </div>

        <div class="card">
          <div class="kpi-label">
            سررسیدگذشته
          </div>

          <div class="kpi-value small-kpi">
            ${
              collection.available
                ?money(
                  collection.overdue
                )
                :'—'
            }
          </div>
        </div>

        <div class="card">
          <div class="kpi-label">
            فرصت وصول Top 3
          </div>

          <div class="kpi-value small-kpi">
            ${
              collection.available
                ?money(
                  collection
                    .top3CashOpportunity
                )
                :'—'
            }
          </div>
        </div>

        <div class="card">
          <div class="kpi-label">
            مشتریان اولویت‌دار
          </div>

          <div class="kpi-value small-kpi">
            ${
              Number(
                collection
                  .priorities
                  ?.filter(
                    item =>
                      item.level ===
                        'high'
                  ).length ||
                0
              ).toLocaleString(
                'fa-IR'
              )
            }
          </div>
        </div>

      </div>

      <div class="section">
        ${
          collectionRows(
            collection,
            {
              money,
              esc
            }
          )
        }
      </div>

      <div class="info-box section">
        آوان فقط اولویت و متن پیشنهادی می‌سازد؛
        هیچ پیام یا پیگیری‌ای بدون اقدام صریح کاربر ارسال نمی‌شود.
      </div>


      <div class="section-head section">

        <div>
          <h2>
            ✓ Month-End Autopilot
          </h2>

          <span class="muted">
            آمادگی بستن دوره تا
            ${dateFa(monthEnd.asOf)}
          </span>
        </div>

        <span class="cloud-badge">
          ${
            esc(
              CLOSE_STATUS_FA[
                monthEnd.status
              ] ||
              monthEnd.status
            )
          }
          —
          ${
            Number(
              monthEnd.readiness
            ).toLocaleString(
              'fa-IR'
            )
          }٪
        </span>

      </div>

      ${
        monthEnd.alreadyClosed
          ?`
            <div class="info-box section">
              بازه‌ای شامل این تاریخ قبلاً
              به‌عنوان دوره بسته ثبت شده است.
            </div>
          `
          :''
      }

      <div class="section">
        ${
          monthEndRows(
            monthEnd,
            esc
          )
        }
      </div>

      <div class="info-box section">
        این نسخه، Close Assistant است:
        پیش‌نویس‌ها، اسناد هوشمند و Integrity را کنترل می‌کند.
        ثبت تعدیلات نهایی و بستن دوره همچنان با تأیید حسابدار/کاربر انجام می‌شود.
      </div>

    </div>
  `;
}
