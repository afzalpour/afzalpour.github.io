'use strict';

export function createSupabaseRest({
  transport,
  auth
}) {
  if (!transport?.raw) {
    throw new Error(
      'SUPABASE_TRANSPORT_REQUIRED'
    );
  }

  if (!auth?.token) {
    throw new Error(
      'SUPABASE_AUTH_REQUIRED'
    );
  }

  const {
    raw
  } = transport;

  async function authed(
    path,
    options = {}
  ) {
    const accessToken =
      await auth.token();

    if (!accessToken) {
      throw new Error('AUTH_REQUIRED');
    }

    return raw(
      path,
      {
        ...options,
        token: accessToken
      }
    );
  }

  const encodeValue =
    value => encodeURIComponent(value);

  async function select(
    table,
    query = ''
  ) {
    return authed(
      `/rest/v1/${table}${
        query ? `?${query}` : ''
      }`
    );
  }

  async function insert(
    table,
    rows,
    selectFields = '*'
  ) {
    return authed(
      `/rest/v1/${table}?select=${
        encodeValue(selectFields)
      }`,
      {
        method: 'POST',
        body: rows,
        prefer: 'return=representation'
      }
    );
  }

  async function update(
    table,
    patch,
    query,
    selectFields = '*'
  ) {
    return authed(
      `/rest/v1/${table}?${query}&select=${
        encodeValue(selectFields)
      }`,
      {
        method: 'PATCH',
        body: patch,
        prefer: 'return=representation'
      }
    );
  }

  async function remove(
    table,
    query
  ) {
    return authed(
      `/rest/v1/${table}?${query}`,
      {
        method: 'DELETE',
        prefer: 'return=representation'
      }
    );
  }

  async function rpc(
    name,
    args = {}
  ) {
    return authed(
      `/rest/v1/rpc/${name}`,
      {
        method: 'POST',
        body: args
      }
    );
  }

  return {
    select,
    insert,
    update,
    remove,
    rpc
  };
}
