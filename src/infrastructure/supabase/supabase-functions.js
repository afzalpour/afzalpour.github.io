'use strict';

export function
createSupabaseFunctions({
  transport,
  auth
}) {
  if (
    !transport?.raw ||
    !auth?.token
  ) {
    throw new Error(
      'SUPABASE_FUNCTIONS_REQUIRED'
    );
  }

  const {
    raw
  } = transport;

  async function invoke(
    name,
    body = {}
  ) {
    const functionName =
      String(
        name || ''
      ).trim();

    if (
      !/^[a-z0-9-]+$/
        .test(functionName)
    ) {
      throw new Error(
        'SUPABASE_FUNCTION_NAME_INVALID'
      );
    }

    const accessToken =
      await auth.token();

    if (!accessToken) {
      throw new Error(
        'AUTH_REQUIRED'
      );
    }

    return raw(
      `/functions/v1/${
        functionName
      }`,
      {
        method: 'POST',

        token:
          accessToken,

        body
      }
    );
  }

  return {
    invoke
  };
}
