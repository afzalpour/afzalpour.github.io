'use strict';

const TESSERACT_URL =
  'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js';

const PDFJS_URL =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.min.mjs';

const PDF_WORKER_URL =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs';

let tesseractModulePromise = null;
let pdfModulePromise = null;

function loadTesseract() {
  if (!tesseractModulePromise) {
    tesseractModulePromise =
      import(TESSERACT_URL);
  }

  return tesseractModulePromise;
}

async function loadPdfJs() {
  if (!pdfModulePromise) {
    pdfModulePromise =
      import(PDFJS_URL)
        .then(module => {

          module
            .GlobalWorkerOptions
            .workerSrc =
              PDF_WORKER_URL;

          return module;
        });
  }

  return pdfModulePromise;
}

function report(
  callback,
  value
) {
  if (
    typeof callback ===
      'function'
  ) {
    callback(value);
  }
}

async function downloadSource(
  sourceUrl
) {
  if (!sourceUrl) {
    throw new Error(
      'LOCAL_OCR_SOURCE_REQUIRED'
    );
  }

  const response =
    await fetch(
      sourceUrl,
      {
        cache: 'no-store'
      }
    );

  if (!response.ok) {
    throw new Error(
      'LOCAL_OCR_SOURCE_DOWNLOAD_FAILED'
    );
  }

  return response.blob();
}

async function createOcrWorker(
  onProgress
) {
  const tesseract =
    await loadTesseract();

  if (
    !tesseract?.createWorker
  ) {
    throw new Error(
      'LOCAL_OCR_RUNTIME_UNAVAILABLE'
    );
  }

  report(
    onProgress,
    {
      phase: 'loading',
      progress: 0,
      message:
        'در حال بارگذاری موتور OCR…'
    }
  );

  const worker =
    await tesseract.createWorker(
      [
        'fas',
        'eng'
      ],
      1,
      {
        logger:
          message => {

            if (
              typeof
                message?.progress ===
                'number'
            ) {
              report(
                onProgress,
                {
                  phase:
                    'ocr',

                  progress:
                    message.progress,

                  status:
                    message.status ||
                    ''
                }
              );
            }
          }
      }
    );

  return worker;
}

async function recognizeImage(
  worker,
  source,
  onProgress
) {
  report(
    onProgress,
    {
      phase: 'ocr',
      progress: 0,
      page: 1,
      pages: 1,
      message:
        'در حال خواندن تصویر…'
    }
  );

  const result =
    await worker.recognize(
      source
    );

  return {
    text:
      String(
        result
          ?.data
          ?.text ||
        ''
      ).trim(),

    confidence:
      Number(
        result
          ?.data
          ?.confidence ||
        0
      ),

    pages: 1,

    truncated:
      false
  };
}

async function recognizePdf(
  worker,
  blob,
  onProgress,
  maxPages
) {
  const pdfjs =
    await loadPdfJs();

  const bytes =
    new Uint8Array(
      await blob.arrayBuffer()
    );

  const loadingTask =
    pdfjs.getDocument({
      data: bytes
    });

  const pdf =
    await loadingTask.promise;

  const pageCount =
    Math.min(
      pdf.numPages,
      maxPages
    );

  const texts = [];
  const confidences = [];

  try {

    for (
      let index = 1;
      index <= pageCount;
      index++
    ) {
      report(
        onProgress,
        {
          phase:
            'rendering',

          progress:
            (index - 1) /
            pageCount,

          page:
            index,

          pages:
            pageCount,

          message:
            `در حال آماده‌سازی صفحه ${index}…`
        }
      );

      const page =
        await pdf.getPage(
          index
        );

      const viewport =
        page.getViewport({
          scale: 1.8
        });

      const canvas =
        document.createElement(
          'canvas'
        );

      const context =
        canvas.getContext(
          '2d',
          {
            alpha: false
          }
        );

      if (!context) {
        throw new Error(
          'LOCAL_OCR_CANVAS_FAILED'
        );
      }

      canvas.width =
        Math.ceil(
          viewport.width
        );

      canvas.height =
        Math.ceil(
          viewport.height
        );

      await page.render({
        canvasContext:
          context,

        viewport
      }).promise;

      report(
        onProgress,
        {
          phase: 'ocr',
          progress:
            (index - 1) /
            pageCount,

          page:
            index,

          pages:
            pageCount,

          message:
            `در حال OCR صفحه ${index}…`
        }
      );

      const result =
        await worker.recognize(
          canvas
        );

      const text =
        String(
          result
            ?.data
            ?.text ||
          ''
        ).trim();

      if (text) {
        texts.push(
          text
        );
      }

      confidences.push(
        Number(
          result
            ?.data
            ?.confidence ||
          0
        )
      );

      canvas.width = 1;
      canvas.height = 1;
    }

  } finally {

    await pdf.destroy();
  }

  const averageConfidence =
    confidences.length
      ? confidences.reduce(
          (
            sum,
            value
          ) =>
            sum + value,
          0
        ) /
        confidences.length
      : 0;

  return {
    text:
      texts.join(
        '\n\n--- PAGE ---\n\n'
      ),

    confidence:
      averageConfidence,

    pages:
      pageCount,

    truncated:
      pdf.numPages >
      pageCount
  };
}

export async function
recognizeLocalDocument({
  sourceUrl,
  mimeType,
  onProgress = null,
  maxPdfPages = 4
} = {}) {

  const type =
    String(
      mimeType || ''
    ).toLowerCase();

  if (
    type !==
      'application/pdf' &&
    !type.startsWith(
      'image/'
    )
  ) {
    throw new Error(
      'LOCAL_OCR_FILE_TYPE_INVALID'
    );
  }

  report(
    onProgress,
    {
      phase: 'download',
      progress: 0,
      message:
        'در حال دریافت فایل خصوصی…'
    }
  );

  const blob =
    await downloadSource(
      sourceUrl
    );

  let worker = null;

  try {

    worker =
      await createOcrWorker(
        onProgress
      );

    const result =
      type ===
        'application/pdf'
        ? await recognizePdf(
            worker,
            blob,
            onProgress,
            maxPdfPages
          )
        : await recognizeImage(
            worker,
            blob,
            onProgress
          );

    report(
      onProgress,
      {
        phase: 'done',
        progress: 1,
        message:
          'OCR محلی کامل شد'
      }
    );

    return {
      ...result,

      engine:
        'tesseract-browser',

      languages: [
        'fas',
        'eng'
      ]
    };

  } finally {

    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // best effort cleanup
      }
    }
  }
}
