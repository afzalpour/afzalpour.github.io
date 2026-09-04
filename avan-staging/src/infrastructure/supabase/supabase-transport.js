'use strict';

function apiError(payload, status) {
  const error = new Error(
    payload?.message ||
    payload?.msg ||
    payload?.error_description ||
    payload?.error ||
    `HTTP_${status}`
  );

  error.status = status;
  error.payload = payload;

  return error;
}

export function createSupabaseTransport(config = {}) {
  const baseUrl =
    String(config.supabaseUrl || '')
      .replace(/\/$/, '');

  const publishableKey =
    config.supabasePublishableKey || '';

  function required() {
    if (!baseUrl || !publishableKey) {
      throw new Error('CLOUD_CONFIG_MISSING');
    }
  }

  async function raw(
    path,
    {
      method = 'GET',
      body = null,
      token = null,
      prefer = null,
      headers = {}
    } = {}
  ) {
    required();

    const requestHeaders = {
      apikey: publishableKey,
      ...headers
    };

    if (token) {
      requestHeaders.Authorization =
        `Bearer ${token}`;
    }

    let requestBody = body;

    if (body !== null) {
      requestHeaders['Content-Type'] =
        'application/json';

      requestBody =
        JSON.stringify(body);
    }

    if (prefer) {
      requestHeaders.Prefer = prefer;
    }

    const response = await fetch(
      baseUrl + path,
      {
        method,
        headers: requestHeaders,
        body: requestBody
      }
    );

    const responseText =
      await response.text();

    let data = null;

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = responseText;
      }
    }

    if (!response.ok) {
      throw apiError(
        data,
        response.status
      );
    }

    return data;
  }

  return {
    raw
  };
}
