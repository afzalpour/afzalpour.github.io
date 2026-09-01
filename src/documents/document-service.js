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
    !cloud?.insert
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

  return {
    bucket: BUCKET,
    maxFileSize:
      MAX_FILE_SIZE,

    upload,
    signedUrl
  };
}
