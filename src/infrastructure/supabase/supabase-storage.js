'use strict';

function storageError(
  payload,
  status
) {
  const error =
    new Error(
      payload?.message ||
      payload?.error ||
      `STORAGE_HTTP_${status}`
    );

  error.status =
    status;

  error.payload =
    payload;

  return error;
}

function safePath(path) {
  return String(path || '')
    .split('/')
    .filter(Boolean)
    .map(
      part =>
        encodeURIComponent(part)
    )
    .join('/');
}

export function createSupabaseStorage({
  config = {},
  auth
} = {}) {
  const baseUrl =
    String(
      config.supabaseUrl || ''
    ).replace(/\/$/, '');

  const publishableKey =
    config.supabasePublishableKey ||
    '';

  function required() {
    if (
      !baseUrl ||
      !publishableKey
    ) {
      throw new Error(
        'CLOUD_CONFIG_MISSING'
      );
    }
  }

  async function request(
    path,
    {
      method = 'GET',
      body = null,
      contentType = null
    } = {}
  ) {
    required();

    const token =
      await auth?.token?.();

    if (!token) {
      throw new Error(
        'AUTH_REQUIRED'
      );
    }

    const headers = {
      apikey:
        publishableKey,

      Authorization:
        `Bearer ${token}`
    };

    if (contentType) {
      headers['Content-Type'] =
        contentType;
    }

    const response =
      await fetch(
        baseUrl + path,
        {
          method,
          headers,
          body
        }
      );

    const responseText =
      await response.text();

    let data = null;

    if (responseText) {
      try {
        data =
          JSON.parse(
            responseText
          );
      } catch {
        data =
          responseText;
      }
    }

    if (!response.ok) {
      throw storageError(
        data,
        response.status
      );
    }

    return data;
  }

  async function upload(
    bucket,
    path,
    file
  ) {
    if (
      !bucket ||
      !path ||
      !file
    ) {
      throw new Error(
        'STORAGE_UPLOAD_INVALID'
      );
    }

    return request(
      `/storage/v1/object/${
        encodeURIComponent(bucket)
      }/${safePath(path)}`,
      {
        method: 'POST',

        body: file,

        contentType:
          file.type ||
          'application/octet-stream'
      }
    );
  }

  async function signedUrl(
    bucket,
    path,
    expiresIn = 300
  ) {
    const payload =
      await request(
        `/storage/v1/object/sign/${
          encodeURIComponent(bucket)
        }/${safePath(path)}`,
        {
          method: 'POST',

          body:
            JSON.stringify({
              expiresIn
            }),

          contentType:
            'application/json'
        }
      );

    const signed =
      payload?.signedURL ||
      payload?.signedUrl;

    if (!signed) {
      throw new Error(
        'STORAGE_SIGNED_URL_MISSING'
      );
    }

    return signed.startsWith(
      'http'
    )
      ? signed
      : baseUrl + signed;
  }

  async function remove(
    bucket,
    paths
  ) {
    const prefixes =
      Array.isArray(paths)
        ? paths
        : [paths];

    return request(
      `/storage/v1/object/${
        encodeURIComponent(bucket)
      }`,
      {
        method: 'DELETE',

        body:
          JSON.stringify({
            prefixes
          }),

        contentType:
          'application/json'
      }
    );
  }

  return {
    upload,
    signedUrl,
    remove
  };
}
