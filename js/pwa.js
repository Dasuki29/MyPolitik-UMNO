/* Nusa Politik v7.8: daftar service worker supaya Chrome menawarkan "Install app". */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) { return; }
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* senyap */ }); });
})();
