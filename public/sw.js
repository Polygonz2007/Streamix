async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open("StreamixCache");
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        return cachedResponse || Response.error();
    }
}

async function cacheFirst(request) {
    const responseFromCache = await caches.match(request);
    if (responseFromCache)
        return responseFromCache;

    return fetch(request);
};

self.addEventListener("fetch", (event) => {
    const req = event.request;
    const url = new URL(event.request.url);

    // Tracks and stuff

    
    // Fonts always cached!
    if (url.endsWith(".tff"))
        return event.respondWith(cacheFirst(req));

    return event.respondWith(networkFirst(req));
});