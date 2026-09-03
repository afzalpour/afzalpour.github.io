'use strict';

import {
  buildPartyAging
} from './party-aging.js';


const ALLOWED_RPCS =
  new Set([
    'report_trial_balance',
    'report_journal',
    'report_profit_loss',
    'report_balance_sheet',
    'report_cash_bank_balances',
    'report_account_statement'
  ]);


function bi(value) {
  try {
    return BigInt(
      String(
        value ?? '0'
      ).replace(
        /[٬,\s]/g,
        ''
      )
    );
  } catch {
    return 0n;
  }
}


function plain(value) {
  if (
    typeof value ===
    'bigint'
  ) {
    return value.toString();
  }

  if (
    Array.isArray(value)
  ) {
    return value.map(
      plain
    );
  }

  if (
    value &&
    typeof value ===
      'object'
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .map(
          ([key, item]) => [
            key,
            plain(item)
          ]
        )
    );
  }

  return value;
}


async function trustedRpc(
  rpc,
  name,
  params
) {
  if (
    typeof rpc !==
      'function'
  ) {
    throw new Error(
      'REPORT_RPC_REQUIRED'
    );
  }

  if (
    !ALLOWED_RPCS.has(
      name
    )
  ) {
    throw new Error(
      'REPORT_RPC_NOT_ALLOWED'
    );
  }

  const rows =
    await rpc(
      name,
      params
    );

  return Array.isArray(
    rows
  )
    ? rows
    : [];
}


function categoryMap(
  rows
) {
  return Object.fromEntries(
    rows.map(
      row => [
        row.category,
        bi(row.amount)
      ]
    )
  );
}


function rangeOf(
  intent
) {
  const period =
    intent?.period || {};

  const to =
    period.to || null;

  const from =
    period.from || to;

  return {
    from,
    to
  };
}


function rpcSource(
  name,
  params
) {
  return {
    type:
      'trusted_rpc',

    name,

    params
  };
}


export async function
executeReportIntent({
  intent,
  workspaceId,
  rpc,
  agingContext = {}
} = {}) {
  if (!intent) {
    throw new Error(
      'REPORT_INTENT_REQUIRED'
    );
  }

  if (!workspaceId) {
    throw new Error(
      'REPORT_WORKSPACE_REQUIRED'
    );
  }

  if (
    intent.read_only !==
      true ||
    intent.allow_raw_sql ===
      true
  ) {
    throw new Error(
      'REPORT_INTENT_UNSAFE'
    );
  }

  if (
    intent
      .requires_clarification
  ) {
    return {
      status:
        'clarification',

      code:
        intent
          .clarification_code ||
        'REPORT_CLARIFICATION_REQUIRED',

      intent:
        intent.intent,

      metric:
        intent.metric,

      read_only:
        true
    };
  }

  const {
    from,
    to
  } =
    rangeOf(
      intent
    );

  if (!to) {
    throw new Error(
      'REPORT_PERIOD_REQUIRED'
    );
  }

  const wid =
    workspaceId;


  if (
    intent.intent ===
      'trial_balance'
  ) {
    const params = {
      wid,
      dfrom: from,
      dto: to
    };

    const rows =
      await trustedRpc(
        rpc,
        'report_trial_balance',
        params
      );

    return plain({
      status: 'ok',
      kind: 'table',
      title:
        'تراز آزمایشی',
      rows,
      period:
        intent.period,
      source:
        rpcSource(
          'report_trial_balance',
          params
        ),
      read_only: true
    });
  }


  if (
    intent.intent ===
      'journal'
  ) {
    const params = {
      wid,
      dfrom: from,
      dto: to
    };

    const rows =
      await trustedRpc(
        rpc,
        'report_journal',
        params
      );

    return plain({
      status: 'ok',
      kind: 'table',
      title:
        'دفتر روزنامه',
      rows,
      period:
        intent.period,
      source:
        rpcSource(
          'report_journal',
          params
        ),
      read_only: true
    });
  }


  if (
    intent.intent ===
      'account_statement'
  ) {
    if (
      !intent.account?.id
    ) {
      return {
        status:
          'clarification',

        code:
          'REPORT_ACCOUNT_REQUIRED',

        read_only:
          true
      };
    }

    const params = {
      wid,
      aid:
        intent.account.id,
      dfrom: from,
      dto: to
    };

    const rows =
      await trustedRpc(
        rpc,
        'report_account_statement',
        params
      );

    return plain({
      status: 'ok',
      kind: 'table',
      title:
        `گردش حساب ${intent.account.name}`,
      account:
        intent.account,
      rows,
      period:
        intent.period,
      source:
        rpcSource(
          'report_account_statement',
          params
        ),
      read_only: true
    });
  }


  if (
    intent.intent ===
      'cash_balances'
  ) {
    const params = {
      wid,
      as_of: to
    };

    const rows =
      await trustedRpc(
        rpc,
        'report_cash_bank_balances',
        params
      );

    const total =
      rows.reduce(
        (sum, row) =>
          sum +
          bi(row.amount),
        0n
      );

    return plain({
      status: 'ok',
      kind: 'metric_table',
      title:
        'مانده بانک و صندوق',
      value:
        total,
      rows,
      period:
        intent.period,
      source:
        rpcSource(
          'report_cash_bank_balances',
          params
        ),
      read_only: true
    });
  }


  if (
    intent.intent ===
      'profit_loss' ||
    intent.intent ===
      'sales'
  ) {
    const params = {
      wid,
      dfrom: from,
      dto: to
    };

    const rows =
      await trustedRpc(
        rpc,
        'report_profit_loss',
        params
      );

    const values =
      categoryMap(
        rows
      );

    const income =
      values.income ||
      0n;

    const expense =
      values.expense ||
      0n;

    const profit =
      income -
      expense;

    let value =
      profit;

    let title =
      'سود / زیان';

    let approximate =
      false;

    let note =
      null;

    if (
      intent.metric ===
        'income'
    ) {
      value =
        income;

      title =
        'درآمد';
    }

    if (
      intent.metric ===
        'expense'
    ) {
      value =
        expense;

      title =
        'هزینه';
    }

    if (
      intent.intent ===
        'sales'
    ) {
      value =
        income;

      title =
        'درآمد ثبت‌شده';

      approximate =
        true;

      note =
        'فعلاً نزدیک‌ترین معیار معتبر Ledger به فروش است؛ گزارش فروش اختصاصی در لایه معنایی بعدی اضافه می‌شود.';
    }

    return plain({
      status: 'ok',
      kind: 'metric',
      title,
      value,
      rows,
      approximate,
      note,
      period:
        intent.period,
      source:
        rpcSource(
          'report_profit_loss',
          params
        ),
      read_only: true
    });
  }


  if (
    intent.intent ===
      'balance_sheet'
  ) {
    const params = {
      wid,
      as_of: to
    };

    const rows =
      await trustedRpc(
        rpc,
        'report_balance_sheet',
        params
      );

    const values =
      categoryMap(
        rows
      );

    const assets =
      values.asset ||
      0n;

    const liabilities =
      values.liability ||
      0n;

    const equity =
      (
        values.equity ||
        0n
      ) +
      (
        values.current_profit ||
        0n
      );

    let value =
      assets;

    let title =
      'دارایی';

    if (
      intent.metric ===
        'liabilities'
    ) {
      value =
        liabilities;

      title =
        'بدهی';
    }

    if (
      intent.metric ===
        'equity'
    ) {
      value =
        equity;

      title =
        'حقوق مالکانه + سود جاری';
    }

    return plain({
      status: 'ok',
      kind: 'metric',
      title,
      value,
      rows,
      period:
        intent.period,
      source:
        rpcSource(
          'report_balance_sheet',
          params
        ),
      read_only: true
    });
  }


  if (
    intent.intent ===
      'party_aging'
  ) {
    const aging =
      buildPartyAging({
        roles:
          agingContext.roles ||
          {},

        parties:
          agingContext.parties ||
          [],

        entries:
          agingContext.entries ||
          [],

        lines:
          agingContext.lines ||
          [],

        invoices:
          agingContext.invoices ||
          [],

        asOf:
          to
      });

    const side =
      intent.metric ===
        'payable'
        ? aging.payables
        : aging.receivables;

    return plain({
      status: 'ok',
      kind:
        'aging',

      title:
        intent.metric ===
          'payable'
          ? 'بدهی به طرف‌حساب‌ها'
          : 'مطالبات از طرف‌حساب‌ها',

      value:
        side.total,

      result:
        side,

      period:
        intent.period,

      source: {
        type:
          'trusted_derived_report',

        name:
          'party-aging'
      },

      read_only:
        true
    });
  }


  return {
    status:
      'clarification',

    code:
      'REPORT_INTENT_NOT_EXECUTABLE',

    intent:
      intent.intent,

    read_only:
      true
  };
}
