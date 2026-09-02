'use strict';

import {
  jalaliToIso
} from '../core/date/jalali.js';

function faToEn(value) {
  return String(value ?? '')
    .replace(
      /[۰-۹]/g,
      d =>
        '۰۱۲۳۴۵۶۷۸۹'
          .indexOf(d)
    )
    .replace(
      /[٠-٩]/g,
      d =>
        '٠١٢٣٤٥٦٧٨٩'
          .indexOf(d)
    );
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function comparable(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ');
}

function linesOf(text) {
  return cleanText(text)
    .split('\n')
    .map(cleanText)
    .filter(Boolean);
}

function rawNumber(value) {
  const cleaned =
    faToEn(value)
      .replace(/[٬,،\s]/g, '')
      .replace(/[^\d]/g, '');

  if (
    !cleaned ||
    !/^\d+$/.test(cleaned)
  ) {
    return null;
  }

  try {
    const value =
      BigInt(cleaned);

    if (value <= 0n) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

function unitOf(value) {
  const text =
    comparable(value);

  if (
    text.includes('تومان') ||
    /\btoman\b/i.test(text)
  ) {
    return 'toman';
  }

  if (
    text.includes('ریال') ||
    /\brial\b/i.test(text)
  ) {
    return 'rial';
  }

  return null;
}

function toToman(
  amount,
  unit
) {
  if (
    amount === null ||
    !unit
  ) {
    return null;
  }

  if (
    unit === 'toman'
  ) {
    return amount;
  }

  if (
    unit === 'rial'
  ) {
    if (
      amount % 10n !== 0n
    ) {
      return null;
    }

    return amount / 10n;
  }

  return null;
}

function numbersInLine(line) {
  const normalized =
    faToEn(line);

  const matches =
    normalized.match(
      /\d[\d\s٬,،]{1,24}\d|\d+/g
    ) || [];

  return matches
    .map(rawNumber)
    .filter(
      value =>
        value !== null
    );
}

function amountCandidate(
  lines,
  patterns
) {
  const scored = [];

  lines.forEach(
    (line, index) => {

      const normalized =
        comparable(line);

      const matchedPattern =
        patterns.find(
          item =>
            item.regex.test(
              normalized
            )
        );

      if (!matchedPattern) {
        return;
      }

      const windowText = [
        lines[index - 1] || '',
        line,
        lines[index + 1] || ''
      ].join(' ');

      const unit =
        unitOf(windowText);

      if (!unit) {
        return;
      }

      const numbers =
        numbersInLine(line);

      for (
        const number of
        numbers
      ) {
        const toman =
          toToman(
            number,
            unit
          );

        if (
          toman === null ||
          toman <= 0n
        ) {
          continue;
        }

        scored.push({
          value: toman,
          score:
            matchedPattern.score,
          line
        });
      }
    }
  );

  scored.sort(
    (a, b) => {

      if (
        b.score !== a.score
      ) {
        return (
          b.score -
          a.score
        );
      }

      if (
        a.value === b.value
      ) {
        return 0;
      }

      return (
        a.value > b.value
          ? -1
          : 1
      );
    }
  );

  return scored[0] || null;
}

function extractTotalAmount(
  lines
) {
  return amountCandidate(
    lines,
    [
      {
        regex:
          /مبلغ\s*قابل\s*پرداخت|قابل\s*پرداخت|grand\s*total/,
        score: 100
      },
      {
        regex:
          /جمع\s*کل|مبلغ\s*کل|total\s*amount|\btotal\b/,
        score: 90
      },
      {
        regex:
          /جمع\s*نهایی|مبلغ\s*نهایی/,
        score: 85
      },
      {
        regex:
          /\bمبلغ\b|\bamount\b/,
        score: 60
      }
    ]
  );
}

function extractTaxAmount(
  lines
) {
  return amountCandidate(
    lines,
    [
      {
        regex:
          /مالیات\s*بر\s*ارزش\s*افزوده|ارزش\s*افزوده/,
        score: 100
      },
      {
        regex:
          /\bمالیات\b|\bvat\b|\btax\b/,
        score: 90
      }
    ]
  );
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

function extractDate(
  text
) {
  const normalized =
    faToEn(text);

  const matches =
    normalized.matchAll(
      /(?:^|[^\d])(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[^\d]|$)/g
    );

  for (
    const match of matches
  ) {
    const year =
      Number(match[1]);

    const month =
      Number(match[2]);

    const day =
      Number(match[3]);

    if (
      year >= 1300 &&
      year <= 1600
    ) {
      const iso =
        jalaliToIso(
          `${year}/${month}/${day}`
        );

      if (iso) {
        return {
          value: iso,
          source:
            'jalali'
        };
      }
    }

    const iso =
      validGregorian(
        year,
        month,
        day
      );

    if (iso) {
      return {
        value: iso,
        source:
          'gregorian'
      };
    }
  }

  return null;
}

function extractDocumentNumber(
  lines
) {
  const patterns = [
    /(?:شماره\s*(?:فاکتور|رسید|سند)|شماره)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i,
    /(?:invoice\s*(?:no|number)|receipt\s*(?:no|number))\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i
  ];

  for (
    const line of lines
  ) {
    const normalized =
      faToEn(line);

    for (
      const pattern of patterns
    ) {
      const match =
        normalized.match(
          pattern
        );

      if (
        match?.[1]
      ) {
        return cleanText(
          match[1]
        );
      }
    }
  }

  return '';
}

function extractParty(
  text,
  parties
) {
  const normalized =
    comparable(text);

  const matches =
    (parties || [])
      .filter(
        party =>
          party?.is_active &&
          party?.name
      )
      .filter(
        party =>
          normalized.includes(
            comparable(
              party.name
            )
          )
      )
      .sort(
        (a, b) =>
          String(b.name)
            .length -
          String(a.name)
            .length
      );

  return (
    matches[0]?.name ||
    ''
  );
}

function extractAccountHint(
  text,
  accounts
) {
  const normalized =
    comparable(text);

  const matches =
    (accounts || [])
      .filter(
        account =>
          account?.is_active &&
          account?.is_postable &&
          account?.name
      )
      .filter(
        account => {

          const name =
            comparable(
              account.name
            );

          if (
            name.length < 3
          ) {
            return false;
          }

          return (
            normalized.includes(
              name
            )
          );
        }
      )
      .sort(
        (a, b) =>
          String(b.name)
            .length -
          String(a.name)
            .length
      );

  return (
    matches[0]?.name ||
    ''
  );
}

function descriptionFromLines(
  lines
) {
  const excluded =
    /جمع|مبلغ|مالیات|تومان|ریال|شماره|تاریخ|invoice|total|tax|vat/i;

  const useful =
    lines
      .filter(
        line =>
          line.length >= 5 &&
          line.length <= 160 &&
          !excluded.test(line)
      )
      .slice(0, 3);

  return cleanText(
    useful.join(' — ')
  ).slice(0, 300);
}

function confidence01(
  ocrConfidence
) {
  const raw =
    Number(
      ocrConfidence || 0
    );

  if (
    !Number.isFinite(raw)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      1,
      raw / 100
    )
  );
}

export function
buildLocalOcrExtraction({
  document,
  ocr,
  parties = [],
  accounts = []
} = {}) {
  if (!document?.id) {
    throw new Error(
      'DOCUMENT_REQUIRED'
    );
  }

  const text =
    cleanText(
      ocr?.text || ''
    );

  if (!text) {
    throw new Error(
      'LOCAL_OCR_TEXT_EMPTY'
    );
  }

  const lines =
    linesOf(text);

  const total =
    extractTotalAmount(
      lines
    );

  const tax =
    extractTaxAmount(
      lines
    );

  const date =
    extractDate(
      text
    );

  const partyName =
    extractParty(
      text,
      parties
    );

  const accountHint =
    extractAccountHint(
      text,
      accounts
    );

  const baseConfidence =
    confidence01(
      ocr?.confidence
    );

  return {
    document_type:
      document.document_type ||
      'other',

    party_name:
      partyName,

    document_number:
      extractDocumentNumber(
        lines
      ),

    document_date:
      date?.value ||
      '',

    total_amount:
      total
        ? total.value.toString()
        : '',

    tax_amount:
      tax
        ? tax.value.toString()
        : '',

    description:
      descriptionFromLines(
        lines
      ),

    account_hint:
      accountHint,

    local_ocr: {
      engine:
        String(
          ocr?.engine ||
          'tesseract-browser'
        ),

      languages:
        Array.isArray(
          ocr?.languages
        )
          ? ocr.languages
          : [
              'fas',
              'eng'
            ],

      confidence:
        baseConfidence,

      pages:
        Number(
          ocr?.pages || 1
        ),

      truncated:
        Boolean(
          ocr?.truncated
        ),

      extracted_at:
        new Date()
          .toISOString()
    },

    confidence: {
      overall:
        baseConfidence,

      amount:
        total
          ? Math.max(
              0.55,
              baseConfidence
            )
          : 0,

      date:
        date
          ? Math.max(
              0.6,
              baseConfidence
            )
          : 0,

      party:
        partyName
          ? Math.max(
              0.7,
              baseConfidence
            )
          : 0,

      account:
        accountHint
          ? Math.max(
              0.65,
              baseConfidence
            )
          : 0
    },

    ocr_text:
      text.slice(
        0,
        12000
      )
  };
}
