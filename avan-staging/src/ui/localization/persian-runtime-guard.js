'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';
import { translateUserFacingText } from './user-facing-fa.js';

const Lifecycle = installUiLifecycle();

function translateNode(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT','STYLE','CODE','PRE'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return /[A-Za-z]/.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const next = translateUserFacingText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }
  root.querySelectorAll?.('[placeholder],[title],[aria-label]').forEach(element => {
    for (const attr of ['placeholder','title','aria-label']) {
      if (!element.hasAttribute(attr)) continue;
      const value = element.getAttribute(attr);
      const next = translateUserFacingText(value);
      if (next !== value) element.setAttribute(attr, next);
    }
  });
}

Lifecycle.use('localization:persian-runtime-guard', () => translateNode(document.body), { priority:1000 });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Lifecycle.schedule('persian-ready'), { once:true });
else Lifecycle.schedule('persian-ready');

export { translateUserFacingText, translateNode };
