'use strict';

// RC1.2-C compatibility entry.
// Preserve the existing import contract while the latest receipt recovery
// implementation lives in v7. The delete UI is loaded as a side-effect here
// so the existing rc12-documents entry point does not need another script tag.
import './document-delete-ui.js';

export {
  recognizeLocalDocumentV7 as recognizeLocalDocumentV4
} from './local-ocr-runtime-v7.js';
