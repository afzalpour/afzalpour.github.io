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

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ');
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

function topExpenseAccounts({
  accounts = [],
  entries = [],
  lines = [],
  from = null,
  to = null
}) {
  const accountMap =
    new Map(
      accounts.map(
        account => [
          account.id,
          account
        ]
      )
    );

  const entryMap =
    new Map(
      entries.map(
        entry => [
          entry.id,
          entry
        ]
      )
    );

  const totals =
    new Map();

  for (const line of lines) {
    const entry =
      entryMap.get(
        line.journal_entry_id
      );

    if (
      !entry ||
      entry.status === 'draft'
    ) {
      continue;
    }

    if (
      from &&
      entry.entry_date < from
    ) {
      continue;
    }

    if (
      to &&
      entry.entry_date > to
    ) {
      continue;
    }

    const account =
      accountMap.get(
        line.account_id
      );

    if (
      !account ||
      account.category !==
        'expense'
    ) {
      continue;
    }

    const amount =
      bi(line.debit) -
      bi(line.credit);

    totals.set(
      account.id,
      (
        totals.get(
          account.id
        ) || 0n
      ) + amount
    );
  }

  return Array.from(
    totals.entries()
  )
    .map(
      ([accountId, amount]) => ({
        accountId,

        accountName:
          accountMap.get(
            accountId
          )?.name ||
          'حساب هزینه',

        amount
      })
    )
    .filter(
      item =>
        item.amount > 0n
    )
    .sort(
      (a, b) =>
        a.amount === b.amount
          ? 0
          : a.amount > b.amount
            ? -1
            : 1
    );
}

function makeInsight(
  id,
  level,
  title,
  description,
  value = null,
  unit = 'money'
) {
  return {
    id,
    level,
    title,
    description,
    value,
    unit
  };
}

export function
buildFinancialCopilotSnapshot({
  asOf,
  fiscalFrom = null,
  assets = 0,
  liabilities = 0,
  profit = 0,
  cash = 0,
  aging = null,
  accounts = [],
  entries = [],
  lines = [],
  documents = [],
  invoices = [],
  integrity = null
} = {}) {
  if (!asOf) {
    throw new Error(
      'COPILOT_AS_OF_REQUIRED'
    );
  }

  const ar =
    aging?.receivables ||
    null;

  const ap =
    aging?.payables ||
    null;

  const receivables =
    ar?.available
      ? bi(ar.total)
      : 0n;

  const payables =
    ap?.available
      ? bi(ap.total)
      : 0n;

  const overdueReceivables =
    overdueTotal(ar);

  const overduePayables =
    overdueTotal(ap);

  const topReceivable =
    ar?.available
      ? ar.parties?.[0] ||
        null
      : null;

  const topPayable =
    ap?.available
      ? ap.parties?.[0] ||
        null
      : null;

  const concentration =
    (
      topReceivable &&
      receivables > 0n
    )
      ? Number(
          (
            topReceivable.total *
            10000n
          ) /
          receivables
        ) / 100
      : 0;

  const expenseAccounts =
    topExpenseAccounts({
      accounts,
      entries,
      lines,
      from:
        fiscalFrom,
      to:
        asOf
    });

  const pendingDocuments =
    documents.filter(
      document =>
        document.status !==
          'linked' &&
        [
          'uploaded',
          'extracted',
          'reviewed'
        ].includes(
          document.status
        )
    ).length;

  const draftCount =
    entries.filter(
      entry =>
        entry.status ===
          'draft'
    ).length +
    invoices.filter(
      invoice =>
        invoice.status ===
          'draft'
    ).length;

  const unbalancedPosted =
    Number(
      integrity
        ?.unbalanced_journals ||
      0
    );

  const insights = [];

  if (unbalancedPosted > 0) {
    insights.push(
      makeInsight(
        'ledger_integrity',
        'critical',
        'کنترل یکپارچگی Ledger',
        'سند ثبت‌شده نامتوازن گزارش شده و باید فوراً بررسی شود.',
        unbalancedPosted,
        'count'
      )
    );
  }

  if (
    overduePayables > 0n &&
    overduePayables > bi(cash)
  ) {
    insights.push(
      makeInsight(
        'cash_pressure',
        'critical',
        'فشار نقدینگی کوتاه‌مدت',
        'بدهی تجاری سررسیدگذشته از نقدینگی فعلی بیشتر است.',
        overduePayables -
          bi(cash),
        'money'
      )
    );
  }

  if (bi(profit) < 0n) {
    insights.push(
      makeInsight(
        'loss',
        'critical',
        'زیان دوره',
        'عملکرد دوره تا این تاریخ منفی است و نیاز به بررسی درآمد و هزینه دارد.',
        -bi(profit),
        'money'
      )
    );
  }

  if (
    overdueReceivables > 0n
  ) {
    insights.push(
      makeInsight(
        'overdue_receivables',
        'warning',
        'مطالبات سررسیدگذشته',
        'بخشی از مطالبات از سررسید عبور کرده و نیاز به پیگیری وصول دارد.',
        overdueReceivables,
        'money'
      )
    );
  }

  if (concentration >= 50) {
    insights.push(
      makeInsight(
        'customer_concentration',
        'warning',
        'تمرکز مطالبات روی یک مشتری',
        'بخش بزرگی از مانده مطالبات به یک طرف‌حساب وابسته است.',
        concentration,
        'percent'
      )
    );
  }

  if (
    bi(profit) > 0n &&
    receivables > bi(cash) &&
    receivables > 0n
  ) {
    insights.push(
      makeInsight(
        'profit_cash_gap',
        'attention',
        'سود مثبت، نقد محدود',
        'سود مثبت است اما مانده مطالبات از نقدینگی بیشتر است؛ وصول مطالبات را بررسی کنید.',
        receivables,
        'money'
      )
    );
  }

  if (pendingDocuments > 0) {
    insights.push(
      makeInsight(
        'document_backlog',
        'attention',
        'اسناد هوشمند تکمیل‌نشده',
        'چند سند هنوز تا اتصال نهایی به Ledger فاصله دارند.',
        pendingDocuments,
        'count'
      )
    );
  }

  if (draftCount > 0) {
    insights.push(
      makeInsight(
        'draft_backlog',
        'info',
        'پیش‌نویس‌های باز',
        'پیش‌نویس فاکتور یا سند حسابداری برای تکمیل وجود دارد.',
        draftCount,
        'count'
      )
    );
  }

  if (!insights.length) {
    insights.push(
      makeInsight(
        'no_priority_alert',
        'healthy',
        'مورد بحرانی مشاهده نشد',
        'بر اساس کنترل‌های فعلی، هشدار اولویت‌بالایی برای نمایش وجود ندارد.',
        null,
        'none'
      )
    );
  }

  const order = {
    critical: 1,
    warning: 2,
    attention: 3,
    info: 4,
    healthy: 5
  };

  insights.sort(
    (a, b) =>
      order[a.level] -
      order[b.level]
  );

  return {
    asOf,
    fiscalFrom,

    metrics: {
      assets:
        bi(assets),

      liabilities:
        bi(liabilities),

      profit:
        bi(profit),

      cash:
        bi(cash),

      receivables,

      payables,

      overdueReceivables,

      overduePayables
    },

    topReceivable,
    topPayable,
    receivableConcentration:
      concentration,

    topExpenseAccounts:
      expenseAccounts.slice(
        0,
        5
      ),

    pendingDocuments,
    draftCount,

    insights:
      insights.slice(
        0,
        5
      )
  };
}

export function
answerBusinessQuestion({
  query,
  snapshot
} = {}) {
  if (!snapshot) {
    throw new Error(
      'COPILOT_SNAPSHOT_REQUIRED'
    );
  }

  const q =
    normalize(query);

  if (!q) {
    return {
      kind: 'unknown',
      source:
        'Avan Intelligence',
      data: {}
    };
  }

  if (
    /چرا.*(پول|نقد)/.test(q) ||
    /سود.*(پول|نقد)/.test(q) ||
    /(پول|نقد).*(کجاست|ندار)/.test(q)
  ) {
    return {
      kind:
        'cash_explanation',

      source:
        'Profit & Loss + Cash + AR/AP Aging',

      data: {
        ...snapshot.metrics
      }
    };
  }

  if (
    /بدهکارترین مشتری/.test(q) ||
    /بیشترین مطالبات/.test(q) ||
    /بزرگترین.*طلب/.test(q)
  ) {
    return {
      kind:
        'top_receivable',

      source:
        'AR Aging / Ledger',

      data: {
        party:
          snapshot
            .topReceivable ||
          null,

        total:
          snapshot.metrics
            .receivables
      }
    };
  }

  if (
    /مطالبات/.test(q) ||
    /طلب/.test(q) ||
    /دریافتنی/.test(q)
  ) {
    return {
      kind:
        'receivables',

      source:
        'AR Aging / Ledger',

      data: {
        total:
          snapshot.metrics
            .receivables,

        overdue:
          snapshot.metrics
            .overdueReceivables
      }
    };
  }

  if (
    /بستانکارترین/.test(q) ||
    /بیشترین بدهی.*(تامین|فروشنده|طرف)/.test(q)
  ) {
    return {
      kind:
        'top_payable',

      source:
        'AP Aging / Ledger',

      data: {
        party:
          snapshot
            .topPayable ||
          null,

        total:
          snapshot.metrics
            .payables
      }
    };
  }

  if (
    /بدهی تجاری/.test(q) ||
    /پرداختنی/.test(q)
  ) {
    return {
      kind:
        'payables',

      source:
        'AP Aging / Ledger',

      data: {
        total:
          snapshot.metrics
            .payables,

        overdue:
          snapshot.metrics
            .overduePayables
      }
    };
  }

  if (
    /بزرگترین هزینه/.test(q) ||
    /بیشترین هزینه/.test(q) ||
    /هزینه.*بیشتر/.test(q)
  ) {
    return {
      kind:
        'top_expense',

      source:
        'Journal Lines / Ledger',

      data: {
        account:
          snapshot
            .topExpenseAccounts
            ?.[0] ||
          null
      }
    };
  }

  if (
    /سود/.test(q) ||
    /زیان/.test(q)
  ) {
    return {
      kind:
        'profit',

      source:
        'report_profit_loss',

      evidenceMetric:
        'profit',

      evidenceAmount:
        snapshot.metrics
          .profit,

      data: {
        profit:
          snapshot.metrics
            .profit
      }
    };
  }

  if (
    /نقدینگی/.test(q) ||
    /بانک/.test(q) ||
    /صندوق/.test(q) ||
    /چقدر پول/.test(q)
  ) {
    return {
      kind:
        'cash',

      source:
        'report_cash_bank_balances',

      evidenceMetric:
        'cash',

      evidenceAmount:
        snapshot.metrics
          .cash,

      data: {
        cash:
          snapshot.metrics
            .cash
      }
    };
  }

  if (
    /ریسک/.test(q) ||
    /مشکل/.test(q) ||
    /توجه/.test(q) ||
    /اوضاع/.test(q) ||
    /چه خبر/.test(q)
  ) {
    return {
      kind:
        'priorities',

      source:
        'Avan CFO Autopilot',

      data: {
        insights:
          snapshot.insights
            .slice(0, 3)
      }
    };
  }

  return {
    kind:
      'unknown',

    source:
      'Avan Intelligence',

    data: {}
  };
}
