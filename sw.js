const CACHE_NAME = 'adl2000-v9';

const APP_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './adllogo.png',
  './adlicon.png'
];


/*
 * =========================================================
 * INSTALL
 * =========================================================
 *
 * cache: 'reload' voorkomt dat de browser bij het installeren
 * van een nieuwe service worker opnieuw een oude HTTP-cache
 * gebruikt voor index.html, app.js of style.css.
 */

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        Promise.all(
          APP_FILES.map(file =>
            fetch(
              new Request(file, {
                cache: 'reload'
              })
            ).then(response => {
              if (!response.ok) {
                throw new Error(
                  `Bestand kon niet gecachet worden: ${file}`
                );
              }

              return cache.put(
                file,
                response.clone()
              );
            })
          )
        )
      )
  );

  self.skipWaiting();
});


/*
 * =========================================================
 * ACTIVATE
 * =========================================================
 */

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});


/*
 * =========================================================
 * FETCH
 * =========================================================
 *
 * Voor dezelfde website gebruiken we network-first met
 * cache: 'no-store'. Daardoor vraagt Android bij online
 * gebruik echt de nieuwste bestanden op.
 *
 * De cache blijft beschikbaar als offline fallback.
 */

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl =
    new URL(event.request.url);

  const isSameOrigin =
    requestUrl.origin === self.location.origin;

  if (!isSameOrigin) {
    return;
  }

  event.respondWith(
    fetch(
      new Request(
        event.request,
        {
          cache: 'no-store'
        }
      )
    )
      .then(response => {
        if (!response || !response.ok) {
          return response;
        }

        const copy =
          response.clone();

        event.waitUntil(
          caches.open(CACHE_NAME)
            .then(cache =>
              cache.put(
                event.request,
                copy
              )
            )
        );

        return response;
      })
      .catch(async () => {
        const cached =
          await caches.match(
            event.request,
            {
              ignoreSearch: true
            }
          );

        if (cached) {
          return cached;
        }

        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }

        throw new Error(
          'Geen netwerkverbinding en geen cache beschikbaar.'
        );
      })
  );
});
