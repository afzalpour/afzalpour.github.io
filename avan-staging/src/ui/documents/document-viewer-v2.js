'use strict';

import {
  openModal,
  closeModal
} from '../components/modal.js';

const PDFJS_URL =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.min.mjs';

const PDF_WORKER_URL =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs';

let pdfModulePromise = null;

function esc(value) {
  return String(value ?? '')
    .replace(
      /[&<>'"]/g,
      char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[char]
    );
}

async function loadPdfJs() {
  if (!pdfModulePromise) {
    pdfModulePromise =
      import(PDFJS_URL)
        .then(module => {
          module.GlobalWorkerOptions.workerSrc =
            PDF_WORKER_URL;
          return module;
        });
  }

  return pdfModulePromise;
}

function isPdf(mimeType, fileName) {
  return (
    String(mimeType || '') ===
      'application/pdf' ||
    /\.pdf$/i.test(
      String(fileName || '')
    )
  );
}

function setViewerModalClass(enabled) {
  const modal =
    document.getElementById('modal');

  if (modal) {
    modal.classList.toggle(
      'avan-doc-viewer-modal',
      enabled
    );
  }
}

function closeViewer() {
  setViewerModalClass(false);
  closeModal();
}

function viewerHtml({
  fileName,
  sourceUrl,
  pdf
}) {
  return `
    <div
      class="avan-doc-viewer"
      data-viewer-kind="${pdf ? 'pdf' : 'image'}"
    >
      <div class="avan-doc-viewer-head">
        <div>
          <h2>مشاهده سند</h2>
          <div class="muted avan-doc-viewer-name">
            ${esc(fileName || 'فایل سند')}
          </div>
        </div>

        <div class="row-actions">
          <a
            class="ghost small avan-doc-original-link"
            href="${esc(sourceUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            باز کردن اصل فایل
          </a>
          <button
            type="button"
            class="ghost small"
            id="avanDocViewerClose"
          >
            بستن
          </button>
        </div>
      </div>

      <div class="avan-doc-viewer-toolbar">
        <button
          type="button"
          class="ghost small"
          id="avanDocZoomOut"
          aria-label="کوچک‌نمایی"
        >−</button>
        <span
          class="avan-doc-zoom-label"
          id="avanDocZoomLabel"
        >۱۰۰٪</span>
        <button
          type="button"
          class="ghost small"
          id="avanDocZoomIn"
          aria-label="بزرگ‌نمایی"
        >＋</button>
        <button
          type="button"
          class="ghost small"
          id="avanDocFit"
        >اندازه مناسب</button>
        <button
          type="button"
          class="ghost small"
          id="avanDocRotateRight"
        >↻ چرخش</button>

        <div
          class="avan-doc-page-controls"
          id="avanDocPageControls"
          ${pdf ? '' : 'hidden'}
        >
          <button
            type="button"
            class="ghost small"
            id="avanDocPrevPage"
          >صفحه قبل</button>
          <span id="avanDocPageLabel">—</span>
          <button
            type="button"
            class="ghost small"
            id="avanDocNextPage"
          >صفحه بعد</button>
        </div>
      </div>

      <div
        class="avan-doc-viewer-stage"
        id="avanDocViewerStage"
        aria-busy="true"
      >
        <div class="loading">
          در حال آماده‌سازی فایل…
        </div>
      </div>

      <div
        class="avan-doc-viewer-status muted"
        id="avanDocViewerStatus"
        aria-live="polite"
      ></div>
    </div>
  `;
}

function faNumber(value) {
  try {
    return Number(value)
      .toLocaleString('fa-IR');
  } catch {
    return String(value);
  }
}

function mountCommonControls(state) {
  const zoomLabel =
    document.getElementById(
      'avanDocZoomLabel'
    );

  const updateZoomLabel = () => {
    if (zoomLabel) {
      zoomLabel.textContent =
        `${faNumber(
          Math.round(
            state.zoom * 100
          )
        )}٪`;
    }
  };

  const changeZoom = delta => {
    state.zoom =
      Math.max(
        0.5,
        Math.min(
          3,
          Math.round(
            (state.zoom + delta) * 10
          ) / 10
        )
      );

    updateZoomLabel();
    state.render();
  };

  document.getElementById(
    'avanDocViewerClose'
  ).onclick = closeViewer;

  document.getElementById(
    'avanDocZoomOut'
  ).onclick = () =>
    changeZoom(-0.2);

  document.getElementById(
    'avanDocZoomIn'
  ).onclick = () =>
    changeZoom(0.2);

  document.getElementById(
    'avanDocFit'
  ).onclick = () => {
    state.zoom = 1;
    updateZoomLabel();
    state.render();
  };

  document.getElementById(
    'avanDocRotateRight'
  ).onclick = () => {
    state.rotation =
      (state.rotation + 90) % 360;
    state.render();
  };

  updateZoomLabel();
}

async function mountImageViewer({
  sourceUrl,
  fileName
}) {
  const stage =
    document.getElementById(
      'avanDocViewerStage'
    );

  const status =
    document.getElementById(
      'avanDocViewerStatus'
    );

  if (!stage) {
    return;
  }

  const image =
    document.createElement('img');

  image.className =
    'avan-doc-viewer-image';
  image.alt =
    fileName || 'تصویر سند';
  image.decoding = 'async';
  image.loading = 'eager';
  image.src = sourceUrl;

  const state = {
    zoom: 1,
    rotation: 0,
    render() {
      image.style.width =
        `${state.zoom * 100}%`;
      image.style.transform =
        `rotate(${state.rotation}deg)`;
    }
  };

  mountCommonControls(state);

  image.onload = () => {
    stage.innerHTML = '';
    stage.appendChild(image);
    stage.setAttribute(
      'aria-busy',
      'false'
    );

    if (status) {
      status.textContent =
        `${faNumber(image.naturalWidth)} × ${faNumber(image.naturalHeight)} پیکسل`;
    }

    state.render();
  };

  image.onerror = () => {
    stage.setAttribute(
      'aria-busy',
      'false'
    );
    stage.innerHTML = `
      <div class="error-box">
        تصویر در Viewer بارگذاری نشد.
        از گزینه «باز کردن اصل فایل» استفاده کنید.
      </div>
    `;
  };
}

async function mountPdfViewer({
  sourceUrl
}) {
  const stage =
    document.getElementById(
      'avanDocViewerStage'
    );

  const status =
    document.getElementById(
      'avanDocViewerStatus'
    );

  const pageLabel =
    document.getElementById(
      'avanDocPageLabel'
    );

  const prev =
    document.getElementById(
      'avanDocPrevPage'
    );

  const next =
    document.getElementById(
      'avanDocNextPage'
    );

  if (!stage) {
    return;
  }

  const state = {
    pdf: null,
    page: 1,
    zoom: 1,
    rotation: 0,
    renderToken: 0,
    render: () => {}
  };

  mountCommonControls(state);

  try {
    const [pdfjs, response] =
      await Promise.all([
        loadPdfJs(),
        fetch(
          sourceUrl,
          {
            cache: 'no-store'
          }
        )
      ]);

    if (!response.ok) {
      throw new Error(
        'DOCUMENT_PDF_DOWNLOAD_FAILED'
      );
    }

    const bytes =
      new Uint8Array(
        await response.arrayBuffer()
      );

    const loadingTask =
      pdfjs.getDocument({
        data: bytes
      });

    state.pdf =
      await loadingTask.promise;

    const updatePageControls = () => {
      if (pageLabel) {
        pageLabel.textContent =
          `صفحه ${faNumber(state.page)} از ${faNumber(state.pdf.numPages)}`;
      }

      if (prev) {
        prev.disabled =
          state.page <= 1;
      }

      if (next) {
        next.disabled =
          state.page >=
          state.pdf.numPages;
      }
    };

    state.render = async () => {
      const token =
        ++state.renderToken;

      stage.setAttribute(
        'aria-busy',
        'true'
      );

      stage.innerHTML = `
        <div class="loading">
          در حال رندر صفحه…
        </div>
      `;

      const page =
        await state.pdf.getPage(
          state.page
        );

      const baseScale = 1.25;
      const viewport =
        page.getViewport({
          scale:
            baseScale *
            state.zoom,
          rotation:
            (
              page.rotate +
              state.rotation
            ) % 360
        });

      const ratio =
        Math.min(
          2.25,
          Math.max(
            1,
            window.devicePixelRatio || 1
          )
        );

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
          'DOCUMENT_PDF_CANVAS_FAILED'
        );
      }

      canvas.className =
        'avan-doc-viewer-pdf-canvas';

      canvas.width =
        Math.ceil(
          viewport.width * ratio
        );
      canvas.height =
        Math.ceil(
          viewport.height * ratio
        );

      canvas.style.width =
        `${Math.ceil(viewport.width)}px`;
      canvas.style.height =
        `${Math.ceil(viewport.height)}px`;

      const transform =
        ratio === 1
          ? null
          : [
              ratio,
              0,
              0,
              ratio,
              0,
              0
            ];

      await page.render({
        canvasContext: context,
        viewport,
        transform
      }).promise;

      if (
        token !==
          state.renderToken ||
        !stage.isConnected
      ) {
        return;
      }

      stage.innerHTML = '';
      stage.appendChild(canvas);
      stage.setAttribute(
        'aria-busy',
        'false'
      );

      if (status) {
        status.textContent =
          'PDF با موتور داخلی آوان رندر شده است.';
      }

      updatePageControls();
    };

    if (prev) {
      prev.onclick = () => {
        if (state.page > 1) {
          state.page -= 1;
          state.render();
        }
      };
    }

    if (next) {
      next.onclick = () => {
        if (
          state.page <
          state.pdf.numPages
        ) {
          state.page += 1;
          state.render();
        }
      };
    }

    updatePageControls();
    await state.render();

  } catch (error) {
    console.error(
      'AVAN_DOCUMENT_PDF_VIEWER_FAILED',
      error
    );

    stage.setAttribute(
      'aria-busy',
      'false'
    );

    stage.innerHTML = `
      <div class="error-box">
        رندر PDF انجام نشد.
        اصل فایل همچنان محفوظ است و می‌توانید آن را از دکمه بالای Viewer باز کنید.
      </div>
    `;
  }
}

export async function
openDocumentViewer({
  sourceUrl,
  mimeType,
  fileName
} = {}) {
  if (!sourceUrl) {
    throw new Error(
      'DOCUMENT_VIEWER_SOURCE_REQUIRED'
    );
  }

  const pdf =
    isPdf(
      mimeType,
      fileName
    );

  openModal(
    viewerHtml({
      fileName,
      sourceUrl,
      pdf
    })
  );

  setViewerModalClass(true);

  const backdrop =
    document.getElementById(
      'modalBackdrop'
    );

  if (
    backdrop &&
    backdrop.dataset
      .avanViewerCleanup !== '1'
  ) {
    backdrop.dataset
      .avanViewerCleanup = '1';

    backdrop.addEventListener(
      'click',
      event => {
        if (
          event.target === backdrop
        ) {
          setViewerModalClass(false);
        }
      },
      true
    );
  }

  if (pdf) {
    await mountPdfViewer({
      sourceUrl,
      fileName
    });
  } else {
    await mountImageViewer({
      sourceUrl,
      fileName
    });
  }
}
