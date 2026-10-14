/* Nusa Politik service worker (v7.8): network-first supaya sentiasa dapat versi terkini; cache hanya sebagai sandaran luar talian. */
var VERSI = 'nusa-v7.8';
var ASAS = ['index.html', 'dashboard.html', 'manifest.webmanifest', 'assets/images/favicon.svg', 'assets/images/icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSI).then(function (c) { return c.addAll(ASAS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSI; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin) { return; }       // abaikan Sheets, analitik dan fon luar
  e.respondWith(fetch(r).then(function (res) {
    if (res && res.ok) { var salin = res.clone(); caches.open(VERSI).then(function (c) { c.put(r, salin); }); }
    return res;
  }).catch(function () {
    return caches.match(r).then(function (m) { return m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()); });
  }));
});
