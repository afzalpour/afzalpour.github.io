'use strict';

const METRICS = Object.freeze({
  assets: {
    title: 'دارایی',
    sourceReport: 'report_balance_sheet',
    categories: ['asset'],
    scope: 'as_of'
  },

  liabilities: {
    title: 'بدهی',
    sourceReport: 'report_balance_sheet',
    categories: ['liability'],
    scope: 'as_of'
  },

  cash: {
    title: 'بانک و صندوق',
    sourceReport: 'report_cash_bank_balances',
    categories: [],
    scope: 'as_of'
  },

  profit: {
    title: 'سود/زیان سال',
    sourceReport: 'report_profit_loss',
    categories: [
      'income',
      'expense'
    ],
    scope: 'range'
  }
});

function entryInScope(
  entry,
  meta,
  from,
  to
) {
  const date =
    String(entry?.entry_date || '');

  if (!date) {
    return false;
  }

  if (
    to &&
    date > to
  ) {
    return false;
  }

  if (
    meta.scope === 'range' &&
    from &&
    date < from
  ) {
    return false;
  }

  return entry.status !== 'draft';
}

export function buildWhyNumberEvidence({
  metric,
  accounts = [],
  financialAccounts = [],
  entries = [],
  lines = [],
  from = null,
  to = null
} = {}) {
  const meta =
    METRICS[metric];

  if (!meta) {
    throw new Error(
      'WHY_NUMBER_METRIC_INVALID'
    );
  }

  const accountIds =
    new Set();

  if (metric === 'cash') {
    financialAccounts
      .filter(
        item =>
          item?.is_active !== false
      )
      .forEach(item => {
        if (
          item?.ledger_account_id
        ) {
          accountIds.add(
            item.ledger_account_id
          );
        }
      });
  } else {
    const categories =
      new Set(
        meta.categories
      );

    accounts.forEach(
      account => {
        if (
          categories.has(
            account?.category
          )
        ) {
          accountIds.add(
            account.id
          );
        }
      }
    );
  }

  const entryMap =
    new Map(
      entries.map(
        entry => [
          entry.id,
          entry
        ]
      )
    );

  const evidenceLines =
    lines.filter(line => {
      if (
        !accountIds.has(
          line.account_id
        )
      ) {
        return false;
      }

      const entry =
        entryMap.get(
          line.journal_entry_id
        );

      return entryInScope(
        entry,
        meta,
        from,
        to
      );
    });

  const journalIds =
    new Set(
      evidenceLines.map(
        line =>
          line.journal_entry_id
      )
    );

  const journals =
    entries
      .filter(
        entry =>
          journalIds.has(
            entry.id
          )
      )
      .sort((a, b) => {
        const ad =
          String(
            a.entry_date || ''
          );

        const bd =
          String(
            b.entry_date || ''
          );

        if (ad !== bd) {
          return bd.localeCompare(
            ad
          );
        }

        return String(
          b.journal_no ?? ''
        ).localeCompare(
          String(
            a.journal_no ?? ''
          )
        );
      });

  const evidenceAccounts =
    accounts
      .filter(
        account =>
          accountIds.has(
            account.id
          )
      )
      .sort(
        (a, b) =>
          String(
            a.code || ''
          ).localeCompare(
            String(
              b.code || ''
            )
          )
      );

  return {
    metric,
    title: meta.title,
    sourceReport:
      meta.sourceReport,
    scope: meta.scope,
    from,
    to,
    accountCount:
      evidenceAccounts.length,
    journalCount:
      journals.length,
    lineCount:
      evidenceLines.length,
    accounts:
      evidenceAccounts,
    journals
  };
}
