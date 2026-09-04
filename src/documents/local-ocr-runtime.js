'use strict';

const TESSERACT_URL =
  'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';

const PDFJS_URL =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.min.mjs';

const PDF_WORKER_URL =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs';

let tesseractModulePromise = null;
let pdfModulePromise = null;

function loadTesseract() {

  if (
    globalThis.Tesseract
      ?.createWorker
  ) {
    return Promise.resolve(
      globalThis.Tesseract
    );
  }

  if (!tesseractModulePromise) {

    tesseractModulePromise =
      new Promise(
        (resolve, reject) => {

          const finish = () => {

            if (
              globalThis.Tesseract
                ?.createWorker
            ) {
              resolve(
                globalThis.Tesseract
              );

              return;
            }

            reject(
              new Error(
                'LOCAL_OCR_RUNTIME_UNAVAILABLE'
              )
            );
          };

          const existing =
            document.querySelector(
              'script[data-avan-tesseract]'
            );

          if (existing) {

            if (
              existing.dataset
                .loaded === 'true'
            ) {
              finish();
              return;
            }

            existing.addEventListener(
              'load',
              finish,
              {
                once: true
              }
            );

            existing.addEventListener(
              'error',
              () =>
                reject(
                  new Error(
                    'LOCAL_OCR_RUNTIME_LOAD_FAILED'
                  )
                ),
              {
                once: true
              }
            );

            return;
          }

          const script =
            document.createElement(
              'script'
            );

          script.src =
            TESSERACT_URL;

          script.async =
            true;

          script.crossOrigin =
            'anonymous';

          script.dataset
            .avanTesseract =
              'true';

          script.onload =
            () => {

              script.dataset.loaded =
                'true';

              finish();
            };

          script.onerror =
            () =>
              reject(
                new Error(
                  'LOCAL_OCR_RUNTIME_LOAD_FAILED'
                )
              );

          document.head
            .appendChild(
              script
            );
        }
      );
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

async function preprocessImage(
  blob
) {
  if (
    !globalThis
      .createImageBitmap
  ) {
    return blob;
  }

  const bitmap =
    await createImageBitmap(
      blob
    );

  try {

    let scale = 1;

    if (
      bitmap.width < 1600
    ) {
      scale =
        Math.min(
          1600 /
            bitmap.width,
          2.5
        );
    }

    if (
      bitmap.width > 2400
    ) {
      scale =
        2400 /
        bitmap.width;
    }

    const canvas =
      document.createElement(
        'canvas'
      );

    canvas.width =
      Math.round(
        bitmap.width *
        scale
      );

    canvas.height =
      Math.round(
        bitmap.height *
        scale
      );

    const context =
      canvas.getContext(
        '2d',
        {
          alpha: false,
          willReadFrequently:
            true
        }
      );

    if (!context) {
      return blob;
    }

    context.fillStyle =
      '#ffffff';

    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    context.drawImage(
      bitmap,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const image =
      context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

    const pixels =
      image.data;

    for (
      let i = 0;
      i < pixels.length;
      i += 4
    ) {
      const gray =
        (
          pixels[i] *
            0.299 +
          pixels[i + 1] *
            0.587 +
          pixels[i + 2] *
            0.114
        );

      const contrast =
        Math.max(
          0,
          Math.min(
            255,
            (
              gray - 128
            ) * 1.45 +
            128
          )
        );

      pixels[i] =
        contrast;

      pixels[i + 1] =
        contrast;

      pixels[i + 2] =
        contrast;
    }

    context.putImageData(
      image,
      0,
      0
    );

    return canvas;

  } finally {

    if (bitmap.close) {
      bitmap.close();
    }
  }
}

function ocrResultScore(
  result
) {
  const text =
    String(
      result
        ?.data
        ?.text ||
      ''
    ).trim();

  const confidence =
    Number(
      result
        ?.data
        ?.confidence ||
      0
    );

  const usefulChars =
    (
      text.match(
        /[\u0600-\u06FF0-9۰-۹]/g
      ) || []
    ).length;

  return (
    confidence +
    Math.min(
      25,
      usefulChars / 8
    )
  );
}

async function recognizePass(
  worker,
  source,
  psm
) {
  await worker.setParameters({
    tessedit_pageseg_mode:
      psm,

    preserve_interword_spaces:
      '1',

    user_defined_dpi:
      '300'
  });

  return worker.recognize(
    source
  );
}

function cropVerticalBand(
  source,
  fromRatio,
  toRatio
) {
  if (
    !source?.width ||
    !source?.height
  ) {
    return null;
  }

  const top =
    Math.max(
      0,
      Math.floor(
        source.height *
        fromRatio
      )
    );

  const bottom =
    Math.min(
      source.height,
      Math.ceil(
        source.height *
        toRatio
      )
    );

  const height =
    bottom - top;

  if (
    height <= 20
  ) {
    return null;
  }

  const canvas =
    document.createElement(
      'canvas'
    );

  canvas.width =
    source.width;

  canvas.height =
    height;

  const context =
    canvas.getContext(
      '2d',
      {
        alpha: false
      }
    );

  if (!context) {
    return null;
  }

  context.fillStyle =
    '#ffffff';

  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  context.drawImage(
    source,

    0,
    top,
    source.width,
    height,

    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
}

async function recognizeCriticalBand(
  worker,
  source,
  onProgress,
  message
) {
  if (!source) {
    return {
      text: '',
      confidence: 0
    };
  }

  report(
    onProgress,
    {
      phase:
        'critical-ocr',

      progress: 0,

      message
    }
  );

  const result =
    await recognizePass(
      worker,
      source,
      '6'
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
      )
  };
}

async function recognizeImage(
  worker,
  source,
  onProgress
) {
  report(
    onProgress,
    {
      phase:
        'preprocess',

      progress: 0,

      page: 1,
      pages: 1,

      message:
        'در حال بهبود تصویر…'
    }
  );

  const prepared =
    await preprocessImage(
      source
    );

  report(
    onProgress,
    {
      phase: 'ocr',
      progress: 0,

      page: 1,
      pages: 1,

      message:
        'در حال OCR متن رسید…'
    }
  );

  const sparse =
    await recognizePass(
      worker,
      prepared,
      '11'
    );

  report(
    onProgress,
    {
      phase: 'ocr',
      progress: 0.35,

      page: 1,
      pages: 1,

      message:
        'در حال کنترل ساختار رسید…'
    }
  );

  const block =
    await recognizePass(
      worker,
      prepared,
      '6'
    );

  const best =
    ocrResultScore(
      sparse
    ) >=
    ocrResultScore(
      block
    )
      ? sparse
      : block;

  /*
    Receipt-oriented regions.

    Date/time is commonly located
    around the middle-upper area.

    Amount is commonly located
    in the lower part of the receipt.
  */

  const dateBand =
    cropVerticalBand(
      prepared,
      0.25,
      0.62
    );

  const amountBand =
    cropVerticalBand(
      prepared,
      0.60,
      0.94
    );

  const dateResult =
    await recognizeCriticalBand(
      worker,
      dateBand,
      onProgress,
      'در حال خواندن دقیق تاریخ و زمان…'
    );

  const amountResult =
    await recognizeCriticalBand(
      worker,
      amountBand,
      onProgress,
      'در حال خواندن دقیق مبلغ…'
    );

  const fullText =
    String(
      best
        ?.data
        ?.text ||
      ''
    ).trim();

  const criticalText =
    [
      dateResult.text,
      amountResult.text
    ]
      .filter(Boolean)
      .join('\n');

  return {
    text:
      fullText,

    confidence:
      Number(
        best
          ?.data
          ?.confidence ||
        0
      ),

    critical_text:
      criticalText,

    critical: {
      date_text:
        dateResult.text,

      date_confidence:
        dateResult.confidence,

      amount_text:
        amountResult.text,

      amount_confidence:
        amountResult.confidence
    },

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
