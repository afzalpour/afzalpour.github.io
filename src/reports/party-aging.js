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

function daysBetween(
  olderDate,
  newerDate
) {
  const a =
    new Date(
      `${olderDate}T12:00:00Z`
    );

  const b =
    new Date(
      `${newerDate}T12:00:00Z`
    );

  return Math.max(
    0,
    Math.floor(
      (b - a) /
      86400000
    )
  );
}

function bucketForDays(days) {
  if (days <= 0)
    return 'current';

  if (days <= 30)
    return '1_30';

  if (days <= 60)
    return '31_60';

  if (days <= 90)
    return '61_90';

  return '90_plus';
}

function allocateFifo(
  increases,
  reductions
) {
  const open =
    increases.map(item => ({
      ...item,
      remaining:
        item.amount
    }));

  let reduceIndex = 0;
  let reductionRemaining =
    reductions[0]?.amount ||
    0n;

  for (
    const item of open
  ) {
    while (
      item.remaining > 0n &&
      reduceIndex <
        reductions.length
    ) {
      if (
        reductionRemaining <= 0n
      ) {
        reduceIndex += 1;

        reductionRemaining =
          reductions[
            reduceIndex
          ]?.amount ||
          0n;

        continue;
      }

      const used =
        item.remaining <
        reductionRemaining
          ? item.remaining
          : reductionRemaining;

      item.remaining -= used;
      reductionRemaining -= used;
    }
  }

  return open.filter(
    item =>
      item.remaining > 0n
  );
}

function buildSide({
  accountId,
  direction,
  parties,
  entries,
  lines,
  invoices,
  asOf
}) {
  if (!accountId) {
    return {
      available: false,
      total: 0n,
      parties: [],
      aging: {
        current: 0n,
        '1_30': 0n,
        '31_60': 0n,
        '61_90': 0n,
        '90_plus': 0n
      }
    };
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

  const partyMap =
    new Map(
      parties.map(
        party => [
          party.id,
          party
        ]
      )
    );

  const invoiceMap =
    new Map(
      invoices.map(
        invoice => [
          invoice.id,
          invoice
        ]
      )
    );

  const byParty =
    new Map();

  lines
    .filter(
      line =>
        line.account_id ===
        accountId
    )
    .forEach(line => {
      const entry =
        entryMap.get(
          line.journal_entry_id
        );

      if (
        !entry ||
        entry.status === 'draft' ||
        !line.party_id ||
        (
          asOf &&
          entry.entry_date > asOf
        )
      ) {
        return;
      }

      const debit =
        bi(line.debit);

      const credit =
        bi(line.credit);

      const increase =
        direction ===
        'debit'
          ? debit - credit
          : credit - debit;

      if (increase === 0n) {
        return;
      }

      if (
        !byParty.has(
          line.party_id
        )
      ) {
        byParty.set(
          line.party_id,
          {
            increases: [],
            reductions: []
          }
        );
      }

      const group =
        byParty.get(
          line.party_id
        );

      const invoice =
        invoiceMap.get(
          entry.source_id
        );

      const item = {
        journalEntryId:
          entry.id,

        journalNo:
          entry.journal_no,

        entryDate:
          entry.entry_date,

        dueDate:
          invoice?.due_date ||
          entry.entry_date,

        sourceType:
          entry.source_type,

        sourceId:
          entry.source_id,

        amount:
          increase > 0n
            ? increase
            : -increase
      };

      if (increase > 0n) {
        group.increases.push(
          item
        );
      } else {
        group.reductions.push(
          item
        );
      }
    });

  const aging = {
    current: 0n,
    '1_30': 0n,
    '31_60': 0n,
    '61_90': 0n,
    '90_plus': 0n
  };

  const resultParties = [];

  for (
    const [
      partyId,
      group
    ] of byParty
  ) {
    group.increases.sort(
      (a, b) =>
        a.entryDate.localeCompare(
          b.entryDate
        )
    );

    group.reductions.sort(
      (a, b) =>
        a.entryDate.localeCompare(
          b.entryDate
        )
    );

    const openItems =
      allocateFifo(
        group.increases,
        group.reductions
      );

    const total =
      openItems.reduce(
        (sum, item) =>
          sum +
          item.remaining,
        0n
      );

    if (total <= 0n) {
      continue;
    }

    openItems.forEach(
      item => {
        const days =
          item.dueDate > asOf
            ? 0
            :daysBetween(
              item.dueDate,
              asOf
            );

        const bucket =
          bucketForDays(
            days
          );

        aging[bucket] +=
          item.remaining;
      }
    );

    resultParties.push({
      partyId,
      partyName:
        partyMap.get(
          partyId
        )?.name ||
        'طرف‌حساب نامشخص',

      total,
      openItems
    });
  }

  resultParties.sort(
    (a, b) =>
      a.total === b.total
        ?0
        :a.total > b.total
          ?-1
          :1
  );

  return {
    available: true,

    total:
      resultParties.reduce(
        (sum, party) =>
          sum +
          party.total,
        0n
      ),

    parties:
      resultParties,

    aging
  };
}

export function buildPartyAging({
  roles = {},
  parties = [],
  entries = [],
  lines = [],
  invoices = [],
  asOf
} = {}) {
  if (!asOf) {
    throw new Error(
      'AGING_AS_OF_REQUIRED'
    );
  }

  return {
    asOf,

    receivables:
      buildSide({
        accountId:
          roles.receivable,

        direction:
          'debit',

        parties,
        entries,
        lines,
        invoices,
        asOf
      }),

    payables:
      buildSide({
        accountId:
          roles.payable,

        direction:
          'credit',

        parties,
        entries,
        lines,
        invoices,
        asOf
      })
  };
}
