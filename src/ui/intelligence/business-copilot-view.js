'use strict';

const LEVEL_FA = {
  critical: 'فوری',
  warning: 'هشدار',
  attention: 'نیازمند توجه',
  info: 'اطلاع',
  healthy: 'عادی'
};

function insightValue(
  insight,
  money
) {
  if (
    insight.value ===
      null ||
    insight.value ===
      undefined
  ) {
    return '';
  }

  if (
    insight.unit ===
      'percent'
  ) {
    return `${
      Number(
        insight.value
      ).toLocaleString(
        'fa-IR',
        {
          maximumFractionDigits: 1
        }
      )
    }٪`;
  }

  if (
    insight.unit ===
      'count'
  ) {
    return `${
      Number(
        insight.value
      ).toLocaleString(
        'fa-IR'
      )
    } مورد`;
  }

  return money(
    insight.value
  );
}

function insightCard(
  insight,
  {
    money,
    esc
  }
) {
  return `
    <div class="card">

      <div class="section-head">
        <div>
          <div class="kpi-label">
            ${
              esc(
                LEVEL_FA[
                  insight.level
                ] ||
                insight.level
              )
            }
          </div>

          <h3>
            ${
              esc(
                insight.title
              )
            }
          </h3>
        </div>

        ${
          insight.value !==
            null &&
          insight.value !==
            undefined
            ?`
              <span class="summary-pill">
                ${
                  esc(
                    insightValue(
                      insight,
                      money
                    )
                  )
                }
              </span>
            `
            :''
        }

      </div>

      <p class="muted">
        ${
          esc(
            insight.description
          )
        }
      </p>

    </div>
  `;
}

export function
financialCopilotSectionHtml(
  snapshot,
  {
    money,
    esc,
    dateFa
  }
) {
  const insights =
    snapshot
      .insights
      .slice(0, 4);

  return `
    <div class="section card">

      <div class="section-head">

        <div>
          <h2>
            ✦ Avan Intelligence
          </h2>

          <span class="muted">
            CFO Autopilot —
            تحلیل کنترل‌شده بر پایه Ledger
            تا ${dateFa(snapshot.asOf)}
          </span>
        </div>

        <span class="cloud-badge">
          Explainable AI
        </span>

      </div>

      <div class="grid4 section">
        ${
          insights
            .map(
              insight =>
                insightCard(
                  insight,
                  {
                    money,
                    esc
                  }
                )
            )
            .join('')
        }
      </div>

      <div class="section card">

        <div class="section-head">
          <div>
            <h3>
              از آوان درباره کسب‌وکار بپرس
            </h3>

            <span class="muted">
              پاسخ از داده‌های واقعی Workspace؛
              بدون SQL آزاد و بدون ثبت حسابداری.
            </span>
          </div>
        </div>

        <form id="businessAskForm">

          <div class="form-grid">

            <div class="field">
              <label>
                سؤال مدیریتی
              </label>

              <input
                id="businessAskQuery"
                autocomplete="off"
                placeholder="مثلاً چرا با اینکه سود دارم پول ندارم؟"
                required
              >
            </div>

            <div class="field">
              <label>
                &nbsp;
              </label>

              <button
                class="primary"
                type="submit"
              >
                ✦ تحلیل کن
              </button>
            </div>

          </div>

        </form>

        <div class="row-actions section">

          <button
            type="button"
            class="ghost small"
            data-business-example="چرا با اینکه سود دارم پول ندارم؟"
          >
            چرا پول ندارم؟
          </button>

          <button
            type="button"
            class="ghost small"
            data-business-example="بدهکارترین مشتری کیست؟"
          >
            بدهکارترین مشتری
          </button>

          <button
            type="button"
            class="ghost small"
            data-business-example="بزرگترین هزینه من چیست؟"
          >
            بزرگ‌ترین هزینه
          </button>

          <button
            type="button"
            class="ghost small"
            data-business-example="چه چیزهایی نیاز به توجه دارد؟"
          >
            اولویت‌های امروز
          </button>

        </div>

        <div
          id="businessAskAnswer"
          class="section"
        >
          <div class="info-box">
            سؤال بالا را بنویسید؛
            آوان پاسخ را با منبع محاسبه نمایش می‌دهد.
          </div>
        </div>

      </div>

    </div>
  `;
}

function whyButton(
  answer,
  esc
) {
  if (
    !answer
      ?.evidenceMetric ||
    answer.evidenceAmount ===
      undefined ||
    answer.evidenceAmount ===
      null
  ) {
    return '';
  }

  return `
    <button
      type="button"
      class="ghost small"
      data-business-why="${
        esc(
          answer
            .evidenceMetric
        )
      }"
      data-business-amount="${
        esc(
          answer
            .evidenceAmount
        )
      }"
    >
      چرا این عدد؟
    </button>
  `;
}

export function
businessAnswerHtml(
  answer,
  {
    money,
    esc
  }
) {
  const data =
    answer?.data ||
    {};

  let title =
    'پاسخ آوان';

  let body =
    '';

  if (
    answer.kind ===
      'cash_explanation'
  ) {
    title =
      'سود با نقدینگی یکی نیست';

    const profit =
      data.profit || 0n;

    const cash =
      data.cash || 0n;

    const receivables =
      data.receivables || 0n;

    const overdue =
      data.overdueReceivables ||
      0n;

    body = `
      <p>
        سود/زیان دوره:
        <b>${money(profit)}</b>
        —
        نقدینگی فعلی:
        <b>${money(cash)}</b>.
      </p>

      <p>
        مطالبات باز:
        <b>${money(receivables)}</b>
        که
        <b>${money(overdue)}</b>
        آن سررسیدگذشته است.
      </p>

      ${
        profit > 0n &&
        receivables > cash
          ?`
            <div class="info-box">
              بر اساس داده‌های فعلی،
              یکی از عوامل مهم فاصله سود و پول نقد
              می‌تواند باقی‌ماندن منابع در مطالبات باشد.
              این پاسخ علت قطعی جریان نقد نیست؛
              بلکه تحلیل داده‌های موجود در Ledger و Aging است.
            </div>
          `
          :`
            <div class="info-box">
              برای توضیح کامل جریان نقد،
              باید تغییرات مطالبات، بدهی‌ها،
              سرمایه‌گذاری و سایر جریان‌های نقدی
              در کنار سود بررسی شوند.
            </div>
          `
      }
    `;
  }

  else if (
    answer.kind ===
      'top_receivable'
  ) {
    title =
      'بدهکارترین مشتری';

    body =
      data.party
        ?`
          <p>
            <b>
              ${
                esc(
                  data.party
                    .partyName
                )
              }
            </b>
            با مانده باز
            <b>
              ${
                money(
                  data.party
                    .total
                )
              }
            </b>
            در حال حاضر بیشترین مانده مطالبات را دارد.
          </p>
        `
        :`
          <div class="empty">
            مانده مطالبات قابل نمایش وجود ندارد.
          </div>
        `;
  }

  else if (
    answer.kind ===
      'receivables'
  ) {
    title =
      'وضعیت مطالبات';

    body = `
      <p>
        مطالبات باز:
        <b>${money(data.total)}</b>
      </p>

      <p>
        سررسیدگذشته:
        <b>${money(data.overdue)}</b>
      </p>
    `;
  }

  else if (
    answer.kind ===
      'top_payable'
  ) {
    title =
      'بیشترین بدهی تجاری';

    body =
      data.party
        ?`
          <p>
            <b>
              ${
                esc(
                  data.party
                    .partyName
                )
              }
            </b>
            با مانده
            <b>
              ${
                money(
                  data.party
                    .total
                )
              }
            </b>
            در صدر بدهی‌های تجاری قرار دارد.
          </p>
        `
        :`
          <div class="empty">
            بدهی تجاری قابل نمایش وجود ندارد.
          </div>
        `;
  }

  else if (
    answer.kind ===
      'payables'
  ) {
    title =
      'وضعیت بدهی تجاری';

    body = `
      <p>
        بدهی تجاری باز:
        <b>${money(data.total)}</b>
      </p>

      <p>
        سررسیدگذشته:
        <b>${money(data.overdue)}</b>
      </p>
    `;
  }

  else if (
    answer.kind ===
      'top_expense'
  ) {
    title =
      'بزرگ‌ترین حساب هزینه';

    body =
      data.account
        ?`
          <p>
            <b>
              ${
                esc(
                  data.account
                    .accountName
                )
              }
            </b>
            با خالص گردش
            <b>
              ${
                money(
                  data.account
                    .amount
                )
              }
            </b>
            در بازه مالی فعلی،
            بزرگ‌ترین حساب هزینه ثبت‌شده است.
          </p>
        `
        :`
          <div class="empty">
            گردش هزینه قابل نمایش وجود ندارد.
          </div>
        `;
  }

  else if (
    answer.kind ===
      'profit'
  ) {
    title =
      'سود/زیان دوره';

    body = `
      <p>
        نتیجه دوره تا امروز:
        <b>${money(data.profit)}</b>
      </p>
    `;
  }

  else if (
    answer.kind ===
      'cash'
  ) {
    title =
      'نقدینگی فعلی';

    body = `
      <p>
        مجموع مانده بانک و صندوق:
        <b>${money(data.cash)}</b>
      </p>
    `;
  }

  else if (
    answer.kind ===
      'priorities'
  ) {
    title =
      'اولویت‌های CFO Autopilot';

    body =
      data.insights
        ?.length
        ?`
          <ol>
            ${
              data.insights
                .map(
                  insight => `
                    <li>
                      <b>
                        ${
                          esc(
                            insight.title
                          )
                        }
                      </b>
                      —
                      ${
                        esc(
                          insight.description
                        )
                      }
                    </li>
                  `
                )
                .join('')
            }
          </ol>
        `
        :`
          <div class="empty">
            اولویت خاصی پیدا نشد.
          </div>
        `;
  }

  else {
    title =
      'این سؤال هنوز در نسخه 1.0 پشتیبانی نمی‌شود';

    body = `
      <div class="info-box">
        فعلاً سؤال‌هایی درباره
        نقدینگی، سود، مطالبات، بدهی تجاری،
        بزرگ‌ترین هزینه و اولویت‌های مالی را بپرسید.
      </div>
    `;
  }

  return `
    <div class="card">

      <div class="section-head">
        <div>
          <h3>
            ${esc(title)}
          </h3>

          <span class="muted">
            منبع:
            ${esc(
              answer.source ||
              'Ledger'
            )}
          </span>
        </div>

        ${
          whyButton(
            answer,
            esc
          )
        }
      </div>

      ${body}

    </div>
  `;
}
