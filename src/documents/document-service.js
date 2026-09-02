'use strict';

const BUCKET =
  'avan-documents';

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

const ALLOWED_TYPES =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]);

function safeFileName(name) {
  const raw =
    String(
      name || 'document'
    ).trim();

  const clean =
    raw
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        '-'
      )
      .replace(
        /-+/g,
        '-'
      )
      .replace(
        /^[-.]+|[-.]+$/g,
        ''
      );

  return (
    clean ||
    'document'
  ).slice(0, 120);
}

function uuid() {
  if (
    globalThis.crypto
      ?.randomUUID
  ) {
    return globalThis
      .crypto
      .randomUUID();
  }

  return (
    Date.now().toString(36) +
    '-' +
    Math.random()
      .toString(36)
      .slice(2)
  );
}

function validateFile(file) {
  if (!file) {
    throw new Error(
      'DOCUMENT_FILE_REQUIRED'
    );
  }

  if (
    !ALLOWED_TYPES.has(
      file.type
    )
  ) {
    throw new Error(
      'DOCUMENT_FILE_TYPE_INVALID'
    );
  }

  if (
    !file.size ||
    file.size <= 0
  ) {
    throw new Error(
      'DOCUMENT_FILE_EMPTY'
    );
  }

  if (
    file.size >
    MAX_FILE_SIZE
  ) {
    throw new Error(
      'DOCUMENT_FILE_TOO_LARGE'
    );
  }
}

async function sha256(file) {
  if (
    !globalThis.crypto
      ?.subtle
  ) {
    return null;
  }

  const bytes =
    await file.arrayBuffer();

  const digest =
    await crypto.subtle.digest(
      'SHA-256',
      bytes
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map(
      value =>
        value
          .toString(16)
          .padStart(2, '0')
    )
    .join('');
}

function normalizeDocumentType(
  value
) {
  const allowed =
    new Set([
      'receipt',
      'invoice',
      'purchase_invoice',
      'sales_invoice',
      'bank_slip',
      'other'
    ]);

  return allowed.has(value)
    ? value
    : 'other';
}

export function
createDocumentService(cloud) {
  if (
  !cloud?.uploadFile ||
  !cloud?.insert ||
  !cloud?.invokeFunction
) {
    throw new Error(
      'DOCUMENT_CLOUD_REQUIRED'
    );
  }

  async function upload({
    workspaceId,
    userId,
    file,
    documentType = 'other',
    partyId = null
  }) {
    if (
      !workspaceId ||
      !userId
    ) {
      throw new Error(
        'DOCUMENT_CONTEXT_REQUIRED'
      );
    }

    validateFile(file);

    const fileHash =
      await sha256(file);

    const filePath = [
      workspaceId,
      userId,
      `${uuid()}-${
        safeFileName(
          file.name
        )
      }`
    ].join('/');

    await cloud.uploadFile(
      BUCKET,
      filePath,
      file
    );

    try {
      const rows =
        await cloud.insert(
          'documents',
          {
            workspace_id:
              workspaceId,

            party_id:
              partyId || null,

            document_type:
              normalizeDocumentType(
                documentType
              ),

            status:
              'uploaded',

            file_name:
              file.name ||
              'document',

            file_path:
              filePath,

            mime_type:
              file.type,

            size_bytes:
              file.size,

            file_hash:
              fileHash
          }
        );

      const document =
        rows?.[0];

      if (!document?.id) {
        throw new Error(
          'DOCUMENT_METADATA_MISSING'
        );
      }

      return document;

    } catch (error) {

      try {
        await cloud.removeFiles(
          BUCKET,
          [filePath]
        );
      } catch (
        cleanupError
      ) {
        console.error(
          'DOCUMENT_ROLLBACK_FAILED',
          cleanupError
        );
      }

      throw error;
    }
  }

  async function signedUrl(
    document,
    expiresIn = 300
  ) {
    if (
      !document?.file_path
    ) {
      throw new Error(
        'DOCUMENT_PATH_REQUIRED'
      );
    }

    return cloud.signedFileUrl(
      BUCKET,
      document.file_path,
      expiresIn
    );
  }

  async function saveReview({
  document,
  review,
  userId = null
}) {
  if (
    !document?.id ||
    !document?.workspace_id
  ) {
    throw new Error(
      'DOCUMENT_REQUIRED'
    );
  }

  if (
    document.status === 'linked' ||
    document.linked_journal_entry_id
  ) {
    throw new Error(
      'LINKED_DOCUMENT_IMMUTABLE'
    );
  }

  const action =
    String(
      review?.action || ''
    );

  const allowedActions =
    new Set([
      'purchase_invoice',
      'sales_invoice',
      'journal',
      'review_required'
    ]);

  if (
    !allowedActions.has(action)
  ) {
    throw new Error(
      'DOCUMENT_REVIEW_ACTION_INVALID'
    );
  }

  const totalAmount =
    String(
      review?.totalAmount ?? ''
    )
      .replace(/[۰-۹]/g, d =>
        '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)
      )
      .replace(/[٠-٩]/g, d =>
        '٠١٢٣٤٥٦٧٨٩'.indexOf(d)
      )
      .replace(/[٬,\s]/g, '')
      .trim();

  if (
    totalAmount &&
    !/^\d+$/.test(totalAmount)
  ) {
    throw new Error(
      'DOCUMENT_REVIEW_AMOUNT_INVALID'
    );
  }

  const taxAmount =
    String(
      review?.taxAmount ?? ''
    )
      .replace(/[۰-۹]/g, d =>
        '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)
      )
      .replace(/[٠-٩]/g, d =>
        '٠١٢٣٤٥٦٧٨٩'.indexOf(d)
      )
      .replace(/[٬,\s]/g, '')
      .trim();

  if (
    taxAmount &&
    !/^\d+$/.test(taxAmount)
  ) {
    throw new Error(
      'DOCUMENT_REVIEW_TAX_INVALID'
    );
  }

  const documentType =
    action === 'purchase_invoice'
      ? 'purchase_invoice'
      : action === 'sales_invoice'
        ? 'sales_invoice'
        : document.document_type;

  const existingExtraction =
    (
      document.extracted_data &&
      typeof document.extracted_data ===
        'object'
    )
      ? document.extracted_data
      : {};

  const reviewedData = {
    ...existingExtraction,

    document_type:
      documentType,

    document_number:
      String(
        review?.documentNumber ||
        ''
      ).trim(),

    document_date:
      review?.documentDate ||
      null,

    total_amount:
      totalAmount || null,

    tax_amount:
      taxAmount || null,

    description:
      String(
        review?.description ||
        ''
      ).trim(),

    review: {
      action,

      party_id:
        review?.partyId ||
        null,

      account_id:
        review?.accountId ||
        null,

      reviewed_by:
        userId,

      reviewed_at:
        new Date()
          .toISOString()
    }
  };

  const rows =
    await cloud.update(
      'documents',

      {
        document_type:
          documentType,

        status:
          'reviewed',

        party_id:
          review?.partyId ||
          null,

        source_document_date:
          review?.documentDate ||
          null,

        total_amount:
          totalAmount ||
          null,

        extracted_data:
          reviewedData
      },

      `id=eq.${document.id}` +
      `&workspace_id=eq.${document.workspace_id}`
    );

  const updated =
    rows?.[0];

  if (!updated?.id) {
    throw new Error(
      'DOCUMENT_REVIEW_SAVE_FAILED'
    );
  }

  return updated;
}

async function extract(
  document
) {
  if (!document?.id) {
    throw new Error(
      'DOCUMENT_REQUIRED'
    );
  }

  if (
    document.status !==
      'uploaded'
  ) {
    throw new Error(
      'DOCUMENT_STATUS_NOT_EXTRACTABLE'
    );
  }

  const result =
    await cloud.invokeFunction(
      'avan-document-extract',
      {
        documentId:
          document.id
      }
    );

  if (
    !result?.ok ||
    !result?.document?.id
  ) {
    throw new Error(
      'DOCUMENT_EXTRACTION_FAILED'
    );
  }

  return result.document;
}

async function
saveLocalExtraction({
  document,
  extraction
}) {
  if (
    !document?.id ||
    !document?.workspace_id
  ) {
    throw new Error(
      'DOCUMENT_REQUIRED'
    );
  }

  if (
    document.status !==
      'uploaded'
  ) {
    throw new Error(
      'DOCUMENT_STATUS_NOT_EXTRACTABLE'
    );
  }

  if (
    !extraction ||
    typeof extraction !==
      'object'
  ) {
    throw new Error(
      'LOCAL_OCR_EXTRACTION_REQUIRED'
    );
  }

  const existing =
    (
      document.extracted_data &&
      typeof document
        .extracted_data ===
        'object'
    )
      ? document.extracted_data
      : {};

  const {
    ocr_text,
    confidence,
    ...data
  } = extraction;

  const rows =
    await cloud.update(
      'documents',

      {
        status:
          'extracted',

        ocr_text:
          String(
            ocr_text || ''
          ).slice(
            0,
            12000
          ),

        extracted_data: {
          ...existing,
          ...data
        },

        confidence:
          (
            confidence &&
            typeof confidence ===
              'object'
          )
            ? confidence
            : {}
      },

      `id=eq.${document.id}` +
      `&workspace_id=eq.${document.workspace_id}`
    );

  const updated =
    rows?.[0];

  if (!updated?.id) {
    throw new Error(
      'LOCAL_OCR_SAVE_FAILED'
    );
  }

  return updated;
}
  
 return {
  bucket: BUCKET,

  maxFileSize:
    MAX_FILE_SIZE,

  upload,
  signedUrl,
  saveReview,
  extract,
  saveLocalExtraction
};
}
