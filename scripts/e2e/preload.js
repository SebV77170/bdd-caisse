const targetOrigin = process.env.BDD_CAISSE_E2E_ORIGIN;

function rewriteUrl(value) {
  if (!targetOrigin || typeof value !== 'string') return value;
  return value
    .replace('http://localhost:3001', targetOrigin)
    .replace('http://127.0.0.1:3001', targetOrigin);
}

const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  if (typeof input === 'string') {
    return originalFetch(rewriteUrl(input), init);
  }

  if (input instanceof Request) {
    return originalFetch(new Request(rewriteUrl(input.url), input), init);
  }

  return originalFetch(input, init);
};

const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
  return originalOpen.call(this, method, rewriteUrl(url), ...rest);
};
