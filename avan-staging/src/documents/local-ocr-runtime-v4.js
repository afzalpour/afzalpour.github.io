'use strict';

// RC1.2-C.4 compatibility entry.
// Preserve the existing import contract while the improved reference-receipt
// implementation lives in v5.
export {
  recognizeLocalDocumentV5 as recognizeLocalDocumentV4
} from './local-ocr-runtime-v5.js';
