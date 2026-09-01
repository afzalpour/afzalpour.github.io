const corsHeaders = {
  'Access-Control-Allow-Origin': '*',

  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type',

  'Access-Control-Allow-Methods':
    'POST, OPTIONS'
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json'
};

function reply(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: jsonHeaders
    }
  );
}

function publishableKey() {
  const raw =
    Deno.env.get(
      'SUPABASE_PUBLISHABLE_KEYS'
    );

  if (raw) {
    try {
      const keys =
        JSON.parse(raw);

      if (keys?.default) {
        return keys.default;
      }
    } catch {
      // fallback below
    }
  }

  return (
    Deno.env.get(
      'SUPABASE_ANON_KEY'
    ) || ''
  );
}

function signedUrl(
  supabaseUrl: string,
  value: string
) {
  if (
    value.startsWith('http')
  ) {
    return value;
  }

  return (
    supabaseUrl +
    (
      value.startsWith(
        '/storage/v1/'
      )
        ? value
        : '/storage/v1' +
          (
            value.startsWith('/')
              ? value
              : '/' + value
          )
    )
  );
}

function outputText(
  response: any
) {
  if (
    typeof response?.output_text ===
      'string'
  ) {
    return response.output_text;
  }

  for (
    const item of
    response?.output || []
  ) {
    for (
      const content of
      item?.content || []
    ) {
      if (
        content?.type ===
          'output_text' &&
        typeof content.text ===
          'string'
      ) {
        return content.text;
      }
    }
  }

  return '';
}

Deno.serve(
  async req => {

    if (
      req.method === 'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          headers:
            corsHeaders
        }
      );
    }

    if (
      req.method !== 'POST'
    ) {
      return reply(
        {
          error:
            'METHOD_NOT_ALLOWED'
        },
        405
      );
    }

    const supabaseUrl =
      Deno.env.get(
        'SUPABASE_URL'
      ) || '';

    const apiKey =
      publishableKey();

    const openAiKey =
      Deno.env.get(
        'OPENAI_API_KEY'
      ) || '';

    if (
      !supabaseUrl ||
      !apiKey
    ) {
      return reply(
        {
          error:
            'SUPABASE_CONFIG_MISSING'
        },
        500
      );
    }

    if (!openAiKey) {
      return reply(
        {
          error:
            'OPENAI_API_KEY_MISSING'
        },
        500
      );
    }

    const authorization =
      req.headers.get(
        'Authorization'
      ) || '';

    if (
      !authorization
        .startsWith(
          'Bearer '
        )
    ) {
      return reply(
        {
          error:
            'AUTH_REQUIRED'
        },
        401
      );
    }

    try {

      // ---------------------------------
      // 1) Validate caller
      // ---------------------------------

      const userResponse =
        await fetch(
          `${supabaseUrl}/auth/v1/user`,
          {
            headers: {
              apikey:
                apiKey,

              Authorization:
                authorization
            }
          }
        );

      if (
        !userResponse.ok
      ) {
        return reply(
          {
            error:
              'AUTH_REQUIRED'
          },
          401
        );
      }

      const user =
        await userResponse
          .json();

      // ---------------------------------
      // 2) Request payload
      // ---------------------------------

      const payload =
        await req.json();

      const documentId =
        String(
          payload
            ?.documentId ||
          ''
        ).trim();

      if (!documentId) {
        return reply(
          {
            error:
              'DOCUMENT_REQUIRED'
          },
          400
        );
      }

      // ---------------------------------
      // 3) Load document through RLS
      // ---------------------------------

      const documentResponse =
        await fetch(
          `${supabaseUrl}` +
          `/rest/v1/documents` +
          `?select=*` +
          `&id=eq.${
            encodeURIComponent(
              documentId
            )
          }` +
          `&limit=1`,
          {
            headers: {
              apikey:
                apiKey,

              Authorization:
                authorization
            }
          }
        );

      if (
        !documentResponse.ok
      ) {
        throw new Error(
          'DOCUMENT_LOAD_FAILED'
        );
      }

      const documents =
        await documentResponse
          .json();

      const document =
        documents?.[0];

      if (!document) {
        return reply(
          {
            error:
              'DOCUMENT_NOT_FOUND'
          },
          404
        );
      }

      if (
        document.status ===
          'linked' ||
        document
          .linked_journal_entry_id
      ) {
        return reply(
          {
            error:
              'LINKED_DOCUMENT_IMMUTABLE'
          },
          409
        );
      }

      if (
  document.status !==
    'uploaded'
) {
  return reply(
    {
      error:
        'DOCUMENT_STATUS_NOT_EXTRACTABLE'
    },
    409
  );
}

      const previousStatus =
        document.status;

      // ---------------------------------
      // 4) Set processing state
      // ---------------------------------

      const processingResponse =
  await fetch(
    `${supabaseUrl}` +
    `/rest/v1/documents` +
    `?id=eq.${
      encodeURIComponent(
        document.id
      )
    }` +
    `&workspace_id=eq.${
      encodeURIComponent(
        document.workspace_id
      )
    }`,
    {
      method: 'PATCH',

      headers: {
        apikey:
          apiKey,

        Authorization:
          authorization,

        'Content-Type':
          'application/json'
      },

      body:
        JSON.stringify({
          status:
            'ocr_processing'
        })
    }
  );

if (
  !processingResponse.ok
) {
  console.error(
    'DOCUMENT_PROCESSING_STATE_FAILED',
    processingResponse.status
  );

  throw new Error(
    'DOCUMENT_PROCESSING_STATE_FAILED'
  );
}

      try {

        // -------------------------------
        // 5) Private signed source URL
        // -------------------------------

        const path =
          String(
            document.file_path
          )
            .split('/')
            .filter(Boolean)
            .map(
              part =>
                encodeURIComponent(
                  part
                )
            )
            .join('/');

        const storageResponse =
          await fetch(
            `${supabaseUrl}` +
            `/storage/v1/object/sign/` +
            `avan-documents/${path}`,
            {
              method: 'POST',

              headers: {
                apikey:
                  apiKey,

                Authorization:
                  authorization,

                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({
                  expiresIn: 300
                })
            }
          );

        if (
          !storageResponse.ok
        ) {
          throw new Error(
            'DOCUMENT_SIGN_FAILED'
          );
        }

        const storageData =
          await storageResponse
            .json();

        const rawSigned =
          storageData
            ?.signedURL ||
          storageData
            ?.signedUrl;

        if (!rawSigned) {
          throw new Error(
            'DOCUMENT_SIGN_FAILED'
          );
        }

        const sourceUrl =
          signedUrl(
            supabaseUrl,
            rawSigned
          );

        // -------------------------------
        // 6) OpenAI input
        // -------------------------------

        const sourceInput =
          document.mime_type ===
            'application/pdf'
            ? {
                type:
                  'input_file',

                file_url:
                  sourceUrl
              }
            : {
                type:
                  'input_image',

                image_url:
                  sourceUrl,

                detail:
                  'high'
              };

        const prompt = `
You extract bookkeeping source documents for Avan accounting.

The document may be Persian or English.

Extract only information clearly supported by the source.
Never invent missing values.

Rules:
- document_type must be one of:
  receipt, invoice, purchase_invoice,
  sales_invoice, bank_slip, other
- document_date must be Gregorian YYYY-MM-DD.
- If the source date is Persian/Jalali,
  convert it to Gregorian only when the
  source date is clearly determinable.
  Otherwise return an empty string.
- Avan stores monetary amounts in Toman.
- If the source explicitly states Toman,
  extract the amount as-is.
- If the source explicitly states Rial,
  convert it exactly to Toman by dividing
  the Rial amount by 10.
- If the monetary unit is ambiguous,
  return an empty string for the affected
  amount and lower the amount confidence.
- monetary values must contain digits only,
  with no currency symbol or separators.
- account_hint is only a short accounting
  category/name suggestion, never a journal posting.
- ocr_text should contain the important visible
  text, concise and useful for human review.
- Confidence values are from 0 to 1.
- Do not create or post accounting entries.
`;

        const model =
          Deno.env.get(
            'OPENAI_DOCUMENT_MODEL'
          ) ||
          'gpt-5.6';

        const aiResponse =
          await fetch(
            'https://api.openai.com/v1/responses',
            {
              method: 'POST',

              headers: {
                Authorization:
                  `Bearer ${openAiKey}`,

                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({
                  model,

                  store: false,

                  input: [
                    {
                      role: 'user',

                      content: [
                        {
                          type:
                            'input_text',

                          text:
                            prompt
                        },

                        sourceInput
                      ]
                    }
                  ],

                  text: {
                    format: {
                      type:
                        'json_schema',

                      name:
                        'avan_document_extraction',

                      strict: true,

                      schema: {
                        type:
                          'object',

                        additionalProperties:
                          false,

                        properties: {
                          document_type: {
                            type:
                              'string',

                            enum: [
                              'receipt',
                              'invoice',
                              'purchase_invoice',
                              'sales_invoice',
                              'bank_slip',
                              'other'
                            ]
                          },

                          party_name: {
                            type:
                              'string'
                          },

                          document_number: {
                            type:
                              'string'
                          },

                          document_date: {
                            type:
                              'string'
                          },

                          total_amount: {
                            type:
                              'string'
                          },

                          tax_amount: {
                            type:
                              'string'
                          },

                          description: {
                            type:
                              'string'
                          },

                          account_hint: {
                            type:
                              'string'
                          },

                          ocr_text: {
                            type:
                              'string'
                          },

                          confidence: {
                            type:
                              'object',

                            additionalProperties:
                              false,

                            properties: {
                              party: {
                                type:
                                  'number'
                              },

                              date: {
                                type:
                                  'number'
                              },

                              amount: {
                                type:
                                  'number'
                              },

                              document_type: {
                                type:
                                  'number'
                              },

                              overall: {
                                type:
                                  'number'
                              }
                            },

                            required: [
                              'party',
                              'date',
                              'amount',
                              'document_type',
                              'overall'
                            ]
                          }
                        },

                        required: [
                          'document_type',
                          'party_name',
                          'document_number',
                          'document_date',
                          'total_amount',
                          'tax_amount',
                          'description',
                          'account_hint',
                          'ocr_text',
                          'confidence'
                        ]
                      }
                    }
                  },

                  max_output_tokens:
                    2500
                })
            }
          );

        const aiData =
          await aiResponse
            .json();

        if (
  !aiResponse.ok
) {
  const apiError =
    aiData?.error || {};

  const errorInfo = {
    status:
      aiResponse.status,

    type:
      String(
        apiError.type ||
        ''
      ),

    code:
      String(
        apiError.code ||
        ''
      ),

    param:
      String(
        apiError.param ||
        ''
      ),

    message:
      String(
        apiError.message ||
        'OpenAI request failed'
      ).slice(0, 800)
  };

  console.error(
    'OPENAI_DOCUMENT_ERROR ' +
    JSON.stringify(
      errorInfo
    )
  );

  throw new Error(
    `DOCUMENT_AI_FAILED:` +
    `${errorInfo.status}:` +
    `${
      errorInfo.code ||
      errorInfo.type ||
      'UNKNOWN'
    }`
  );
}

        const text =
          outputText(
            aiData
          );

        if (!text) {
          throw new Error(
            'DOCUMENT_AI_EMPTY'
          );
        }

        const extraction =
          JSON.parse(text);

        const {
          confidence,
          ocr_text,
          ...extracted
        } = extraction;

        // -------------------------------
        // 7) Persist extraction via RLS
        // -------------------------------

        const existing =
          (
            document
              .extracted_data &&
            typeof document
              .extracted_data ===
                'object'
          )
            ? document
                .extracted_data
            : {};

        const savedResponse =
          await fetch(
            `${supabaseUrl}` +
            `/rest/v1/documents` +
            `?id=eq.${
              encodeURIComponent(
                document.id
              )
            }` +
            `&workspace_id=eq.${
              encodeURIComponent(
                document.workspace_id
              )
            }` +
            `&select=*`,
            {
              method: 'PATCH',

              headers: {
                apikey:
                  apiKey,

                Authorization:
                  authorization,

                'Content-Type':
                  'application/json',

                Prefer:
                  'return=representation'
              },

              body:
                JSON.stringify({
                  status:
                    'extracted',

                  ocr_text:
                    String(
                      ocr_text || ''
                    ),

                  extracted_data: {
                    ...existing,
                    ...extracted,

                    ai: {
                      provider:
                        'openai',

                      model,

                      extracted_by:
                        user?.id ||
                        null,

                      extracted_at:
                        new Date()
                          .toISOString()
                    }
                  },

                  confidence:
                    confidence || {}
                })
            }
          );

        if (
          !savedResponse.ok
        ) {
          throw new Error(
            'DOCUMENT_EXTRACTION_SAVE_FAILED'
          );
        }

        const saved =
          await savedResponse
            .json();

        return reply({
          ok: true,
          document:
            saved?.[0] ||
            null
        });

      } catch (error) {

        // Do not leave document stuck in processing.
        try {
          await fetch(
            `${supabaseUrl}` +
            `/rest/v1/documents` +
            `?id=eq.${
              encodeURIComponent(
                document.id
              )
            }`,
            {
              method: 'PATCH',

              headers: {
                apikey:
                  apiKey,

                Authorization:
                  authorization,

                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({
                  status:
                    previousStatus
                })
            }
          );
        } catch {
          // best effort rollback
        }

        throw error;
      }

    } catch (error) {

      console.error(
        'AVAN_DOCUMENT_EXTRACT_ERROR',
        error
      );

      return reply(
        {
          error:
            String(
              error?.message ||
              'DOCUMENT_EXTRACTION_FAILED'
            )
        },
        500
      );
    }
  }
);
