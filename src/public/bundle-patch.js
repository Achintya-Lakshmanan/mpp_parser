// This script patches any hardcoded localhost URLs in the minified bundles
(function() {
  // Function to intercept XMLHttpRequest and modify URLs
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    // Check if this is a localhost URL
    if (typeof url === 'string' && url.includes('localhost:3001')) {
      console.log(`[XHR Patch] Redirecting ${url} to ${window.location.origin + url.split('localhost:3001')[1]}`);
      url = window.location.origin + url.split('localhost:3001')[1];
    }
    return originalXHROpen.call(this, method, url, async, user, password);
  };

  // Function to intercept fetch and modify URLs
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if (typeof url === 'string' && url.includes('localhost:3001')) {
      console.log(`[Fetch Patch] Redirecting ${url} to ${window.location.origin + url.split('localhost:3001')[1]}`);
      url = window.location.origin + url.split('localhost:3001')[1];
    }
    return originalFetch.call(this, url, options);
  };

  console.log('[Bundle Patch] Request interception installed');
})(); 