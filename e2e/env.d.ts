// `worker.evaluate(...)` callbacks run inside the extension's service worker,
// where `chrome` exists. Type it the same way the extension sees it.
declare const chrome: typeof import('wxt/browser').browser;
