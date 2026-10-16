/* Nusa Politik v7.8: daftar service worker supaya Chrome menawarkan "Install app".
   v7.53: semak versi baharu. Permainan yang dibiarkan terbuka lama (terutama aplikasi di telefon) memaparkan bar
   "Versi baharu tersedia" bila fail di pelayan berubah. Tiada muat semula automatik supaya tindakan pemain tidak terganggu. */
(function () {
  'use strict';
  var SELANG_MS = 15 * 60 * 1000, JARAK_MIN_MS = 5 * 60 * 1000;
  var asas = null, terakhir = 0, dipaparkan = false, dilepaskan = false;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* senyap */ }); });
  }

  /** Senarai fail tempatan yang membentuk halaman ini (halaman, skrip, helaian gaya). */
  function senaraiFail() {
    var o = {}, d = document;
    o[location.pathname] = 1;
    Array.prototype.forEach.call(d.querySelectorAll('script[src], link[rel="stylesheet"][href]'), function (e) {
      try { var u = new URL(e.getAttribute('src') || e.getAttribute('href'), location.href); if (u.origin === location.origin) { o[u.pathname] = 1; } } catch (x) { /* abaikan */ }
    });
    return Object.keys(o);
  }

  /** Tandatangan versi: ETag/Last-Modified/saiz bagi setiap fail (permintaan HEAD sahaja, tanpa cache). Pulang null jika gagal. */
  function tandatangan() {
    return Promise.all(senaraiFail().map(function (f) {
      return fetch(f, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
        return r.ok ? f + '|' + (r.headers.get('etag') || '') + '|' + (r.headers.get('last-modified') || '') + '|' + (r.headers.get('content-length') || '') : null;
      });
    })).then(function (a) { return a.some(function (x) { return x === null; }) ? null : a.join('\n'); }).catch(function () { return null; });
  }

  function papar() {
    if (dipaparkan || dilepaskan || !document.body) { return; }
    dipaparkan = true;
    var b = document.createElement('div');
    b.id = 'pwa-versi'; b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--bottom-nav-h,0px) + 16px + env(safe-area-inset-bottom,0px));z-index:400;display:flex;align-items:center;gap:.6rem;max-width:calc(100vw - 24px);padding:.55rem .75rem;border:2px solid var(--gold,#d4a017);border-radius:12px;background:var(--bg-elev-3,#1c1c24);color:var(--white,#fff);font:600 .85rem system-ui;box-shadow:0 4px 14px rgba(0,0,0,.35)';
    b.innerHTML = '<span>Versi baharu tersedia.</span><button type="button" data-a="muat" style="font:700 .8rem system-ui;padding:.35rem .7rem;border:0;border-radius:8px;background:var(--gold,#d4a017);color:#111;cursor:pointer">Muat semula</button><button type="button" data-a="tutup" aria-label="Tutup" style="font:700 .9rem system-ui;padding:.2rem .45rem;border:0;background:transparent;color:inherit;cursor:pointer">✕</button>';
    b.addEventListener('click', function (e) {
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
      if (a === 'muat') { location.reload(); } else if (a === 'tutup') { dilepaskan = true; b.remove(); }
    });
    document.body.appendChild(b);
  }

  /** Bandingkan dengan versi semasa memuat. paksa = abaikan jarak minimum. */
  function semak(paksa) {
    var kini = Date.now();
    if (!paksa && (kini - terakhir < JARAK_MIN_MS || document.visibilityState === 'hidden' || navigator.onLine === false)) { return Promise.resolve(false); }
    terakhir = kini;
    return tandatangan().then(function (t) {
      if (t === null) { return false; }
      if (asas === null) { asas = t; return false; }
      if (t !== asas) { papar(); return true; }
      return false;
    });
  }

  window.addEventListener('load', function () { setTimeout(function () { semak(true); }, 3000); });          // tetapkan asas
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { semak(false); } });
  setInterval(function () { semak(false); }, SELANG_MS);
  window.MyPolitikPWA = { semak: semak, tandatangan: tandatangan };
})();
