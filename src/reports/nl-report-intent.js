'use strict';

import {
  jalaliToIso,
  jalaliMonthDays,
  isoToJalali
} from '../core/date/jalali.js';


const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند'
];


function faToEn(value) {
  return String(
    value || ''
  )
    .replace(
      /[۰-۹]/g,
      digit =>
        String(
          '۰۱۲۳۴۵۶۷۸۹'
            .indexOf(digit)
        )
    )
    .replace(
      /[٠-٩]/g,
      digit =>
        String(
          '٠١٢٣٤٥٦٧٨٩'
            .indexOf(digit)
        )
    );
}


function normalizeQuery(
  value
) {
  return faToEn(
    value
  )
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/[،؛,!?؟]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}


function validGregorian(
  year,
  month,
  day
) {
  if (
    year < 1900 ||
    year > 2200 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    return null;
  }

  return (
    `${year}-` +
    `${String(month)
      .padStart(2, '0')}-` +
    `${String(day)
      .padStart(2, '0')}`
  );
}


function dateTokenToIso(
  token
) {
  const normalized =
    faToEn(
      token
    )
      .replace(/[.\-]/g, '/');

  const match =
    normalized.match(
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
    );

  if (!match) {
    return null;
  }

  const year =
    Number(
      match[1]
    );

  const month =
    Number(
      match[2]
    );

  const day =
    Number(
      match[3]
    );

  if (
    year >= 1300 &&
    year <= 1600
  ) {
    return jalaliToIso(
      `${year}/${month}/${day}`
    );
  }

  return validGregorian(
    year,
    month,
    day
  );
}


function jalaliMonthRange(
  year,
  month
) {
  const days =
    jalaliMonthDays(
      year,
      month
    );

  return {
    from:
      jalaliToIso(
        `${year}/${month}/1`
      ),

    to:
      jalaliToIso(
        `${year}/${month}/${days}`
      )
  };
}


function previousJalaliMonth(
  year,
  month
) {
  if (month > 1) {
    return {
      year,
      month:
        month - 1
    };
  }

  return {
    year:
      year - 1,

    month: 12
  };
}


function parseExplicitRange(
  query
) {
  const match =
    query.match(
      /از\s+(\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2})\s+تا\s+(\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2})/
    );

  if (!match) {
    return null;
  }

  const from =
    dateTokenToIso(
      match[1]
    );

  const to =
    dateTokenToIso(
      match[2]
    );

  if (
    !from ||
    !to ||
    from > to
  ) {
    return null;
  }

  return {
    kind:
      'custom',

    from,
    to
  };
}


function parsePeriod({
  query,
  todayIso,
  fiscalYearFrom,
  fiscalYearTo
}) {
  const todayJalali =
    isoToJalali(
      todayIso
    );

  const explicit =
    parseExplicitRange(
      query
    );

  if (explicit) {
    return explicit;
  }

  if (
    /امروز/.test(
      query
    )
  ) {
    return {
      kind:
        'today',

      from:
        todayIso,

      to:
        todayIso
    };
  }

  if (
    todayJalali &&
    /این\s*ماه|ماه\s*جاری/
      .test(query)
  ) {
    return {
      kind:
        'current_month',

      from:
        jalaliToIso(
          `${todayJalali.jy}/${todayJalali.jm}/1`
        ),

      to:
        todayIso
    };
  }

  if (
    todayJalali &&
    /ماه\s*(قبل|گذشته)/
      .test(query)
  ) {
    const previous =
      previousJalaliMonth(
        todayJalali.jy,
        todayJalali.jm
      );

    return {
      kind:
        'previous_month',

      ...jalaliMonthRange(
        previous.year,
        previous.month
      )
    };
  }

  if (todayJalali) {
    const monthIndex =
      JALALI_MONTHS
        .findIndex(
          name =>
            query.includes(
              name
            )
        );

    if (
      monthIndex >= 0
    ) {
      const month =
        monthIndex + 1;

      /*
        If user asks for a Jalali month
        that has not happened yet in the
        current year, use its latest
        completed occurrence.
      */
      const year =
        month >
        todayJalali.jm
          ? todayJalali.jy - 1
          : todayJalali.jy;

      return {
        kind:
          'named_month',

        jalali_month:
          month,

        jalali_year:
          year,

        ...jalaliMonthRange(
          year,
          month
        )
      };
    }
  }

  if (
    todayJalali &&
    /این\s*سال|سال\s*جاری/
      .test(query)
  ) {
    return {
      kind:
        'current_year',

      from:
        jalaliToIso(
          `${todayJalali.jy}/1/1`
        ),

      to:
        todayIso
    };
  }

  if (
    fiscalYearFrom
  ) {
    let to =
      todayIso;

    if (
      fiscalYearTo &&
      fiscalYearTo < to
    ) {
      to =
        fiscalYearTo;
    }

    return {
      kind:
        'fiscal_year',

      from:
        fiscalYearFrom,

      to
    };
  }

  return {
    kind:
      'as_of',

    from: null,

    to:
      todayIso
  };
}


function matchAccount(
  query,
  accounts
) {
  const candidates =
    (accounts || [])
      .filter(
        account =>
          account?.id &&
          account?.name
      )
      .map(
        account => ({
          account,

          name:
            normalizeQuery(
              account.name
            ),

          code:
            normalizeQuery(
              account.code || ''
            )
        })
      )
      .filter(
        item =>
          (
            item.name &&
            query.includes(
              item.name
            )
          ) ||
          (
            item.code &&
            query.includes(
              item.code
            )
          )
      )
      .sort(
        (a, b) =>
          b.name.length -
          a.name.length
      );

  const matched =
    candidates[0]
      ?.account;

  if (!matched) {
    return null;
  }

  return {
    id:
      matched.id,

    name:
      matched.name,

    code:
      matched.code || ''
  };
}


function classifyIntent(
  query
) {
  if (
    /تراز\s*آزمایشی/
      .test(query)
  ) {
    return {
      intent:
        'trial_balance',

      metric:
        null,

      confidence:
        0.98
    };
  }

  if (
    /دفتر\s*روزنامه|روزنامه|اسناد|سندها/
      .test(query)
  ) {
    return {
      intent:
        'journal',

      metric:
        'entries',

      confidence:
        0.92
    };
  }

  if (
    /گردش\s*حساب|صورتحساب|صورت\s*حساب/
      .test(query)
  ) {
    return {
      intent:
        'account_statement',

      metric:
        'turnover',

      confidence:
        0.96
    };
  }

  if (
    /(مانده|موجودی).*(بانک|صندوق|نقد)|(بانک|صندوق|نقد).*(مانده|موجودی)/
      .test(
        query.replace(
          /\n/g,
          ' '
        )
      )
  ) {
    return {
      intent:
        'cash_balances',

      metric:
        'cash',

      confidence:
        0.96
    };
  }

  if (
    /بدهکارترین\s*طرف|مطالبات|حسابهای\s*دریافتنی|حساب\s*دریافتنی/
      .test(query)
  ) {
    return {
      intent:
        'party_aging',

      metric:
        'receivable',

      confidence:
        0.92
    };
  }

  if (
    /بستانکارترین\s*طرف|پرداختنی|حسابهای\s*پرداختنی|حساب\s*پرداختنی/
      .test(query)
  ) {
    return {
      intent:
        'party_aging',

      metric:
        'payable',

      confidence:
        0.92
    };
  }

  if (
    /فروش/
      .test(query)
  ) {
    return {
      intent:
        'sales',

      metric:
        'sales',

      confidence:
        0.9
    };
  }

  if (
    /هزینه/
      .test(query)
  ) {
    return {
      intent:
        'profit_loss',

      metric:
        'expense',

      confidence:
        0.95
    };
  }

  if (
    /درآمد/
      .test(query)
  ) {
    return {
      intent:
        'profit_loss',

      metric:
        'income',

      confidence:
        0.95
    };
  }

  if (
    /سود|زیان/
      .test(query)
  ) {
    return {
      intent:
        'profit_loss',

      metric:
        'profit',

      confidence:
        0.95
    };
  }

  if (
    /دارایی/
      .test(query)
  ) {
    return {
      intent:
        'balance_sheet',

      metric:
        'assets',

      confidence:
        0.94
    };
  }

  if (
    /بدهی/
      .test(query)
  ) {
    return {
      intent:
        'balance_sheet',

      metric:
        'liabilities',

      confidence:
        0.94
    };
  }

  if (
    /حقوق\s*مالکانه|سرمایه/
      .test(query)
  ) {
    return {
      intent:
        'balance_sheet',

      metric:
        'equity',

      confidence:
        0.9
    };
  }

  return {
    intent:
      'unknown',

    metric:
      null,

    confidence:
      0
  };
}


export function
parsePersianReportIntent({
  query,
  todayIso,
  fiscalYearFrom = null,
  fiscalYearTo = null,
  accounts = []
} = {}) {
  const rawQuery =
    String(
      query || ''
    ).trim();

  const normalizedQuery =
    normalizeQuery(
      rawQuery
    );

  if (
    !normalizedQuery
  ) {
    return {
      version: 1,

      raw_query:
        rawQuery,

      normalized_query:
        '',

      intent:
        'unknown',

      metric:
        null,

      period:
        null,

      account:
        null,

      confidence:
        0,

      requires_clarification:
        true,

      clarification_code:
        'REPORT_QUERY_REQUIRED',

      read_only:
        true,

      allow_raw_sql:
        false
    };
  }

  if (
    !todayIso ||
    !/^\d{4}-\d{2}-\d{2}$/
      .test(todayIso)
  ) {
    throw new Error(
      'REPORT_TODAY_REQUIRED'
    );
  }

  const classified =
    classifyIntent(
      normalizedQuery
    );

  const period =
    parsePeriod({
      query:
        normalizedQuery,

      todayIso,

      fiscalYearFrom,

      fiscalYearTo
    });

  const account =
    classified.intent ===
      'account_statement'
      ? matchAccount(
          normalizedQuery,
          accounts
        )
      : null;

  let requiresClarification =
    classified.intent ===
      'unknown';

  let clarificationCode =
    requiresClarification
      ? 'REPORT_INTENT_UNKNOWN'
      : null;

  if (
    classified.intent ===
      'account_statement' &&
    !account
  ) {
    requiresClarification =
      true;

    clarificationCode =
      'REPORT_ACCOUNT_REQUIRED';
  }

  return {
    version: 1,

    raw_query:
      rawQuery,

    normalized_query:
      normalizedQuery,

    intent:
      classified.intent,

    metric:
      classified.metric,

    period,

    account,

    confidence:
      classified.confidence,

    requires_clarification:
      requiresClarification,

    clarification_code:
      clarificationCode,

    read_only:
      true,

    allow_raw_sql:
      false,

    source_policy:
      'trusted-report-layer-only'
  };
}
