/**
 * Minimal DOM stubs so Vue's runtime-dom can mount without a real browser.
 * Must be imported BEFORE any Vue imports, since Vue captures `document` at module load time.
 */
const doc: any = {};

function createElement(tag?: string): any {
  const el: any = {
    nodeType: 1,
    tagName: (tag || 'DIV').toUpperCase(),
    textContent: '',
    innerHTML: '',
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    appendChild: (c: any) => c,
    removeChild: (c: any) => c,
    insertBefore: (c: any) => c,
    replaceChild: () => {},
    contains: () => false,
    querySelector: () => null,
    querySelectorAll: () => [],
    cloneNode: () => createElement(tag),
    parentNode: null,
    nextSibling: null,
    childNodes: [],
    firstChild: null,
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    ownerDocument: doc,
  };
  return el;
}

Object.assign(doc, {
  createElement,
  createElementNS: (_ns: string, tag: string) => createElement(tag),
  createTextNode: (text: string) => ({ nodeType: 3, textContent: text, parentNode: null }),
  createComment: (text: string) => ({ nodeType: 8, textContent: text, parentNode: null }),
  querySelector: () => null,
  documentElement: createElement(),
  body: createElement('body'),
});

if (typeof globalThis.document === 'undefined') {
  (globalThis as any).document = doc;
}
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (typeof globalThis.SVGElement === 'undefined') {
  (globalThis as any).SVGElement = class {};
}
if (typeof globalThis.HTMLElement === 'undefined') {
  (globalThis as any).HTMLElement = class {};
}
if (typeof globalThis.Element === 'undefined') {
  (globalThis as any).Element = class {};
}
if (typeof globalThis.Node === 'undefined') {
  (globalThis as any).Node = class {};
}
if (typeof globalThis.MutationObserver === 'undefined') {
  (globalThis as any).MutationObserver = class {
    observe() {}
    disconnect() {}
  };
}

export { createElement, doc };
