'use strict';

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
    .trim()
    .replace(/\s+/g, ' ');
}

function comparable(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک');
}

function amount(value) {
  const raw =
    faToEn(value)
      .replace(/[٬,\s]/g, '')
      .replace(/[^\d.-]/g, '');

  if (!raw) {
    return null;
  }

  const number =
    Number(raw);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return null;
  }

  return number;
}

function isoDate(value) {
  const raw =
    faToEn(value).trim();

  if (
    /^\d{4}-\d{2}-\d{2}$/
      .test(raw)
  ) {
    return raw;
  }

  return null;
}

export function
normalizeDocumentExtraction(
  input = {}
) {
  return {
    documentType:
      cleanText(
        input.document_type ||
        input.documentType
      ),

    partyName:
      cleanText(
        input.party_name ||
        input.partyName ||
        input.vendor_name ||
        input.customer_name
      ),

    documentNumber:
      cleanText(
        input.document_number ||
        input.invoice_number ||
        input.documentNumber
      ),

    documentDate:
      isoDate(
        input.document_date ||
        input.invoice_date ||
        input.documentDate
      ),

    totalAmount:
      amount(
        input.total_amount ??
        input.amount ??
        input.totalAmount
      ),

    taxAmount:
      amount(
        input.tax_amount ??
        input.tax ??
        input.taxAmount
      ),

    description:
      cleanText(
        input.description ||
        input.summary
      ),

    accountHint:
      cleanText(
        input.account_hint ||
        input.accountHint
      ),

    raw:
      input
  };
}

function findParty(
  parties,
  partyName
) {
  if (!partyName) {
    return null;
  }

  const wanted =
    comparable(partyName);

  return (
    parties.find(
      party =>
        comparable(
          party.name
        ) === wanted
    ) ||
    null
  );
}

function findAccount(
  accounts,
  hint
) {
  if (!hint) {
    return null;
  }

  const wanted =
    comparable(hint);

  return (
    accounts.find(
      account =>
        account.is_active &&
        account.is_postable &&
        (
          comparable(
            account.name
          ) === wanted ||
          comparable(
            account.code
          ) === wanted
        )
    ) ||
    null
  );
}

function actionForType(
  type
) {
  switch (type) {
    case 'purchase_invoice':
      return 'purchase_invoice';

    case 'sales_invoice':
      return 'sales_invoice';

    case 'receipt':
    case 'bank_slip':
      return 'journal';

    default:
      return 'review_required';
  }
}

export function
buildDocumentDraftProposal({
  document,
  extraction,
  accounts = [],
  parties = []
} = {}) {
  if (!document?.id) {
    throw new Error(
      'DOCUMENT_REQUIRED'
    );
  }

  const normalized =
    normalizeDocumentExtraction(
      extraction || {}
    );

  const documentType =
    normalized.documentType ||
    document.document_type ||
    'other';

  const savedReview =
  (
    extraction?.review &&
    typeof extraction.review ===
      'object'
  )
    ? extraction.review
    : {};

const savedPartyId =
  savedReview.party_id ||
  document.party_id ||
  null;

const savedAccountId =
  savedReview.account_id ||
  null;

const suggestedParty =
  (
    savedPartyId
      ? parties.find(
          party =>
            party.id ===
            savedPartyId
        )
      : null
  ) ||
  findParty(
    parties,
    normalized.partyName
  );

const suggestedAccount =
  (
    savedAccountId
      ? accounts.find(
          account =>
            account.id ===
              savedAccountId &&
            account.is_active &&
            account.is_postable
        )
      : null
  ) ||
  findAccount(
    accounts,
    normalized.accountHint
  );

const savedAction =
  String(
    savedReview.action ||
    ''
  );

const allowedActions =
  new Set([
    'purchase_invoice',
    'sales_invoice',
    'journal',
    'review_required'
  ]);

const action =
  allowedActions.has(
    savedAction
  )
    ? savedAction
    : actionForType(
        documentType
      );

  const warnings = [];

  if (
    !normalized.totalAmount ||
    normalized.totalAmount <= 0
  ) {
    warnings.push(
      'AMOUNT_REVIEW_REQUIRED'
    );
  }

  if (
    !normalized.documentDate
  ) {
    warnings.push(
      'DATE_REVIEW_REQUIRED'
    );
  }

  if (
    normalized.partyName &&
    !suggestedParty
  ) {
    warnings.push(
      'PARTY_MATCH_REQUIRED'
    );
  }

  if (
    normalized.accountHint &&
    !suggestedAccount
  ) {
    warnings.push(
      'ACCOUNT_MATCH_REQUIRED'
    );
  }

  if (
    action ===
    'review_required'
  ) {
    warnings.push(
      'ACTION_REVIEW_REQUIRED'
    );
  }

  return {
    documentId:
      document.id,

    action,

    documentType,

    documentNumber:
      normalized.documentNumber,

    documentDate:
      normalized.documentDate,

    totalAmount:
      normalized.totalAmount,

    taxAmount:
      normalized.taxAmount,

    description:
      normalized.description,

    party: {
      extractedName:
        normalized.partyName,

      suggestedId:
        suggestedParty?.id ||
        null,

      suggestedName:
        suggestedParty?.name ||
        null
    },

    account: {
      extractedHint:
        normalized.accountHint,

      suggestedId:
        suggestedAccount?.id ||
        null,

      suggestedName:
        suggestedAccount?.name ||
        null
    },

    warnings,

    readyForReview:
      warnings.length === 0,

    requiresHumanApproval:
      true,

    source:
      'document_extraction'
  };
}
