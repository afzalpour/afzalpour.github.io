'use strict';

const bi = value => {
  try {
    return BigInt(
      String(value ?? '0')
        .replace(/[٬,\s]/g, '')
    );
  } catch {
    return 0n;
  }
};

function isoDay(value) {
  const text =
    String(value || '')
      .slice(0, 10);

  return /^\d{4}-\d{2}-\d{2}$/
    .test(text)
      ? text
      : null;
}

function dayDiff(a, b) {
  const da =
    new Date(
      `${a}T12:00:00Z`
    );

  const db =
    new Date(
      `${b}T12:00:00Z`
    );

  if (
    Number.isNaN(da.valueOf()) ||
    Number.isNaN(db.valueOf())
  ) {
    return null;
  }

  return Math.round(
    (db - da) /
    86400000
  );
}

function overdueTotal(side) {
  if (!side?.available) {
    return 0n;
  }

  return (
    bi(side.aging?.['1_30']) +
    bi(side.aging?.['31_60']) +
    bi(side.aging?.['61_90']) +
    bi(side.aging?.['90_plus'])
  );
}

function ninetPlus(side) {
  if (!side?.available) {
    return 0n;
  }

  return bi(
    side.aging?.['90_plus']
  );
}

function concentration(side) {
  if (
    !side?.available ||
    !side.parties?.length ||
    bi(side.total) <= 0n
  ) {
    return {
      percent: 0,
      party: null
    };
  }

  const top =
    side.parties[0];

  const percent =
    Number(
      (
        bi(top.total) *
        10000n
      ) /
      bi(side.total)
    ) / 100;

  return {
    percent,
    party: top
  };
}

function finding({
  id,
  severity,
  title,
  description,
  count = 1,
  value = null,
  entityType = null,
  entityId = null,
  confidence = 'rule'
}) {
  return {
    id,
    severity,
    title,
    description,
    count,
    value,
    entityType,
    entityId,
    confidence
  };
}

function groupDuplicates(
  rows,
  keyBuilder
) {
  const groups =
    new Map();

  for (const row of rows) {
    const key =
      keyBuilder(row);

    if (!key) {
      continue;
    }

    if (!groups.has(key)) {
      groups.set(
        key,
        []
      );
    }

    groups
      .get(key)
      .push(row);
  }

  return Array.from(
    groups.values()
  ).filter(
    group =>
      group.length > 1
  );
}

function documentDuplicateFindings(
  documents
) {
  const candidates =
    documents.filter(
      document =>
        document.file_hash &&
        document.status !==
          'rejected'
    );

  return groupDuplicates(
    candidates,
    document =>
      String(
        document.file_hash
      ).trim() || null
  )
    .slice(0, 3)
    .map(
      (group, index) =>
        finding({
          id:
            `duplicate_document_${index}`,

          severity:
            'high',

          title:
            'فایل سند تکراری',

          description:
            `${group.length} فایل با هش یکسان در اسناد هوشمند پیدا شد. قبل از ثبت حسابداری، تکراری بودن منبع بررسی شود.`,

          count:
            group.length,

          entityType:
            'document',

          entityId:
            group[0]?.id ||
            null,

          confidence:
            'exact_hash'
        })
    );
}

function invoiceDuplicateFindings(
  invoices
) {
  const candidates =
    invoices.filter(
      invoice =>
        invoice.status !==
          'reversed' &&
        invoice.party_id &&
        invoice.invoice_date &&
        bi(invoice.total_amount) >
          0n
    );

  return groupDuplicates(
    candidates,
    invoice => [
      invoice.invoice_type,
      invoice.party_id,
      isoDay(
        invoice.invoice_date
      ),
      bi(
        invoice.total_amount
      ).toString()
    ].join('|')
  )
    .slice(0, 3)
    .map(
      (group, index) =>
        finding({
          id:
            `duplicate_invoice_${index}`,

          severity:
            'medium',

          title:
            'فاکتورهای بسیار مشابه',

          description:
            `${group.length} فاکتور با نوع، طرف‌حساب، تاریخ و مبلغ یکسان پیدا شد. این الزاماً خطا نیست، اما نیازمند بررسی Duplicate است.`,

          count:
            group.length,

          value:
            bi(
              group[0]
                ?.total_amount
            ),

          entityType:
            'invoice',

          entityId:
            group[0]?.id ||
            null,

          confidence:
            'exact_fields'
        })
    );
}

function transactionDuplicateFindings(
  transactions
) {
  const candidates =
    transactions.filter(
      transaction =>
        transaction.tx_date &&
        transaction.tx_type &&
        bi(
          transaction.amount
        ) > 0n
    );

  return groupDuplicates(
    candidates,
    transaction => [
      isoDay(
        transaction.tx_date
      ),
      transaction.tx_type,
      transaction.party_id ||
        '',
      bi(
        transaction.amount
      ).toString(),
      transaction
        .primary_account_id ||
        '',
      transaction
        .counterpart_account_id ||
        ''
    ].join('|')
  )
    .slice(0, 3)
    .map(
      (group, index) =>
        finding({
          id:
            `duplicate_transaction_${index}`,

          severity:
            'medium',

          title:
            'عملیات مالی مشابه',

          description:
            `${group.length} عملیات مالی با تاریخ، نوع، مبلغ و طرف‌های اصلی یکسان دیده شد. احتمال ثبت تکراری را بررسی کنید.`,

          count:
            group.length,

          value:
            bi(
              group[0]
                ?.amount
            ),

          confidence:
            'exact_fields'
        })
    );
}

function medianBigInt(values) {
  const sorted =
    values
      .filter(
        value =>
          value > 0n
      )
      .sort(
        (a, b) =>
          a === b
            ? 0
            : a < b
              ? -1
              : 1
      );

  if (!sorted.length) {
    return 0n;
  }

  return sorted[
    Math.floor(
      sorted.length / 2
    )
  ];
}

function unusualTransactionFindings(
  transactions
) {
  const rows =
    transactions
      .filter(
        transaction =>
          bi(
            transaction.amount
          ) > 0n
      );

  if (rows.length < 8) {
    return [];
  }

  const median =
    medianBigInt(
      rows.map(
        transaction =>
          bi(
            transaction.amount
          )
      )
    );

  if (median <= 0n) {
    return [];
  }

  return rows
    .filter(
      transaction =>
        bi(
          transaction.amount
        ) >=
        median * 4n
    )
    .sort(
      (a, b) =>
        bi(a.amount) ===
        bi(b.amount)
          ? 0
          : bi(a.amount) >
            bi(b.amount)
            ? -1
            : 1
    )
    .slice(0, 3)
    .map(
      (transaction, index) =>
        finding({
          id:
            `unusual_transaction_${index}`,

          severity:
            'medium',

          title:
            'مبلغ غیرعادی نسبت به الگوی اخیر',

          description:
            'مبلغ این عملیات حداقل چهار برابر میانه عملیات مالی موجود است. این یک هشدار آماری است و به معنی تخلف یا اشتباه قطعی نیست.',

          value:
            bi(
              transaction.amount
            ),

          confidence:
            'statistical_rule'
        })
    );
}

function newPartyPaymentFindings({
  parties,
  transactions
}) {
  const partyMap =
    new Map(
      parties
        .filter(
          party =>
            party.id &&
            party.created_at
        )
        .map(
          party => [
            party.id,
            party
          ]
        )
    );

  const payments =
    transactions.filter(
      transaction =>
        transaction.tx_type ===
          'payment' &&
        transaction.party_id &&
        bi(
          transaction.amount
        ) > 0n
    );

  if (payments.length < 4) {
    return [];
  }

  const median =
    medianBigInt(
      payments.map(
        transaction =>
          bi(
            transaction.amount
          )
      )
    );

  if (median <= 0n) {
    return [];
  }

  return payments
    .filter(
      transaction => {
        const party =
          partyMap.get(
            transaction.party_id
          );

        if (!party) {
          return false;
        }

        const created =
          isoDay(
            party.created_at
          );

        const paid =
          isoDay(
            transaction.tx_date ||
            transaction.created_at
          );

        if (
          !created ||
          !paid
        ) {
          return false;
        }

        const days =
          dayDiff(
            created,
            paid
          );

        return (
          days !== null &&
          days >= 0 &&
          days <= 7 &&
          bi(
            transaction.amount
          ) >= median * 2n
        );
      }
    )
    .slice(0, 2)
    .map(
      (transaction, index) => {
        const party =
          partyMap.get(
            transaction.party_id
          );

        return finding({
          id:
            `new_party_payment_${index}`,

          severity:
            'medium',

          title:
            'پرداخت نسبتاً بزرگ به طرف‌حساب جدید',

          description:
            `پرداختی به «${party?.name || 'طرف‌حساب جدید'}» در هفت روز اول ایجاد آن ثبت شده و مبلغ آن حداقل دو برابر میانه پرداخت‌هاست. بررسی کنترلی پیشنهاد می‌شود.`,

          value:
            bi(
              transaction.amount
            ),

          confidence:
            'behavioral_rule'
        });
      }
    );
}

function integrityFindings({
  integrity,
  invoiceIntegrity
}) {
  const result = [];

  const unbalanced =
    Number(
      integrity
        ?.unbalanced_journals ||
      0
    );

  if (unbalanced > 0) {
    result.push(
      finding({
        id:
          'unbalanced_posted',

        severity:
          'critical',

        title:
          'سند ثبت‌شده نامتوازن',

        description:
          'کنترل یکپارچگی، سند Posted نامتوازن گزارش کرده است. این مورد باید فوراً بررسی شود.',

        count:
          unbalanced,

        confidence:
          'database_integrity'
      })
    );
  }

  const orphanLines =
    Number(
      integrity
        ?.orphan_lines ||
      0
    );

  if (orphanLines > 0) {
    result.push(
      finding({
        id:
          'orphan_lines',

        severity:
          'critical',

        title:
          'ردیف Ledger یتیم',

        description:
          'ردیف حسابداری بدون سند والد گزارش شده است.',

        count:
          orphanLines,

        confidence:
          'database_integrity'
      })
    );
  }

  const withoutJournal =
    Number(
      invoiceIntegrity
        ?.posted_without_journal ||
      0
    );

  if (withoutJournal > 0) {
    result.push(
      finding({
        id:
          'posted_invoice_without_journal',

        severity:
          'critical',

        title:
          'فاکتور ثبت‌شده بدون سند حسابداری',

        description:
          'یک یا چند فاکتور Posted فاقد اتصال معتبر به Journal هستند.',

        count:
          withoutJournal,

        confidence:
          'database_integrity'
      })
    );
  }

  const mismatch =
    Number(
      invoiceIntegrity
        ?.total_mismatch ||
      0
    );

  if (mismatch > 0) {
    result.push(
      finding({
        id:
          'invoice_total_mismatch',

        severity:
          'high',

        title:
          'اختلاف جمع فاکتور',

        description:
          'کنترل یکپارچگی، اختلاف بین جمع فاکتور و ردیف‌های آن را گزارش کرده است.',

        count:
          mismatch,

        confidence:
          'database_integrity'
      })
    );
  }

  return result;
}

function riskFactor({
  id,
  severity,
  title,
  description,
  value = null,
  unit = 'money'
}) {
  return {
    id,
    severity,
    title,
    description,
    value,
    unit
  };
}

function riskLevel(score) {
  if (score >= 70) {
    return 'critical';
  }

  if (score >= 45) {
    return 'high';
  }

  if (score >= 20) {
    return 'medium';
  }

  return 'low';
}

export function
buildRiskAuditSnapshot({
  asOf,
  cash = 0,
  aging = null,
  parties = [],
  invoices = [],
  transactions = [],
  documents = [],
  integrity = null,
  invoiceIntegrity = null
} = {}) {
  if (!asOf) {
    throw new Error(
      'RISK_AUDIT_AS_OF_REQUIRED'
    );
  }

  const ar =
    aging?.receivables ||
    null;

  const ap =
    aging?.payables ||
    null;

  const overdueAr =
    overdueTotal(ar);

  const overdueAp =
    overdueTotal(ap);

  const ar90 =
    ninetPlus(ar);

  const arConcentration =
    concentration(ar);

  const apConcentration =
    concentration(ap);

  const factors = [];

  if (
    overdueAp > 0n &&
    overdueAp > bi(cash)
  ) {
    factors.push(
      riskFactor({
        id:
          'liquidity_coverage',

        severity:
          'high',

        title:
          'پوشش ناکافی بدهی سررسیدگذشته',

        description:
          'بدهی تجاری سررسیدگذشته از مانده فعلی بانک و صندوق بیشتر است.',

        value:
          overdueAp -
          bi(cash)
      })
    );
  }

  if (ar90 > 0n) {
    factors.push(
      riskFactor({
        id:
          'aged_receivables',

        severity:
          'high',

        title:
          'مطالبات بیش از ۹۰ روز',

        description:
          'بخشی از مطالبات بیش از ۹۰ روز از سررسید عبور کرده و ریسک وصول بالاتری دارد.',

        value:
          ar90
      })
    );
  }

  if (
    arConcentration.percent >=
      50
  ) {
    factors.push(
      riskFactor({
        id:
          'customer_concentration',

        severity:
          'medium',

        title:
          'تمرکز بالای مطالبات',

        description:
          `حدود ${arConcentration.percent.toLocaleString('fa-IR', {maximumFractionDigits: 1})}٪ مطالبات روی یک طرف‌حساب متمرکز است.`,

        value:
          arConcentration.percent,

        unit:
          'percent'
      })
    );
  }

  if (
    apConcentration.percent >=
      60
  ) {
    factors.push(
      riskFactor({
        id:
          'supplier_concentration',

        severity:
          'medium',

        title:
          'تمرکز بدهی تجاری',

        description:
          `حدود ${apConcentration.percent.toLocaleString('fa-IR', {maximumFractionDigits: 1})}٪ بدهی تجاری روی یک طرف‌حساب متمرکز است.`,

        value:
          apConcentration.percent,

        unit:
          'percent'
      })
    );
  }

  if (
    overdueAr > 0n &&
    bi(cash) > 0n &&
    overdueAr >
      bi(cash) * 2n
  ) {
    factors.push(
      riskFactor({
        id:
          'cash_locked_in_ar',

        severity:
          'medium',

        title:
          'وابستگی نقدینگی به وصول مطالبات',

        description:
          'مطالبات سررسیدگذشته بیش از دو برابر نقدینگی فعلی است؛ وصول آن می‌تواند اثر معنی‌داری بر وضعیت نقد داشته باشد.',

        value:
          overdueAr
      })
    );
  }

  const auditFindings = [
    ...integrityFindings({
      integrity,
      invoiceIntegrity
    }),

    ...documentDuplicateFindings(
      documents
    ),

    ...invoiceDuplicateFindings(
      invoices
    ),

    ...transactionDuplicateFindings(
      transactions
    ),

    ...unusualTransactionFindings(
      transactions
    ),

    ...newPartyPaymentFindings({
      parties,
      transactions
    })
  ];

  const severityWeight = {
    critical: 35,
    high: 20,
    medium: 10,
    low: 4
  };

  let score = 0;

  for (const factor of factors) {
    score +=
      factor.severity ===
        'high'
        ? 18
        : factor.severity ===
            'medium'
          ? 9
          : 4;
  }

  for (
    const item of
    auditFindings
  ) {
    score +=
      severityWeight[
        item.severity
      ] || 0;
  }

  score =
    Math.min(
      100,
      score
    );

  const auditOrder = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4
  };

  auditFindings.sort(
    (a, b) =>
      auditOrder[
        a.severity
      ] -
      auditOrder[
        b.severity
      ]
  );

  return {
    asOf,

    score,

    level:
      riskLevel(
        score
      ),

    factors:
      factors.slice(
        0,
        5
      ),

    auditFindings:
      auditFindings.slice(
        0,
        8
      ),

    stats: {
      overdueReceivables:
        overdueAr,

      overduePayables:
        overdueAp,

      receivables90Plus:
        ar90,

      customerConcentration:
        arConcentration
          .percent,

      supplierConcentration:
        apConcentration
          .percent,

      auditFindingCount:
        auditFindings.length
    }
  };
}
