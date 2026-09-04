'use strict';

// RC1.2-C compatibility entry.
// Preserve the existing import contract while the latest receipt recovery
// implementation lives in v6.
export {
  recognizeLocalDocumentV6 as recognizeLocalDocumentV4
} from './local-ocr-runtime-v6.js';
