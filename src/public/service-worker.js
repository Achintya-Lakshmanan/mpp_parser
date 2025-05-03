// Service worker to intercept localhost requests
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Check if this is a localhost API request
  if (url.hostname === 'localhost' && url.port === '3001') {
    // Create a new URL using the origin of the page and the path from the request
    const newUrl = new URL(url.pathname, self.location.origin);
    console.log(`[Service Worker] Redirecting request from ${url} to ${newUrl}`);
    
    // Fetch with the new URL instead
    event.respondWith(
      fetch(newUrl, {
        method: event.request.method,
        headers: event.request.headers,
        body: event.request.method !== 'GET' && event.request.method !== 'HEAD' ? event.request.clone().body : undefined,
        mode: 'cors',
        credentials: 'same-origin'
      })
    );
  }
}); 