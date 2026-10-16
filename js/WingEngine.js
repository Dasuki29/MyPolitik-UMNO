/* ==========================================================================
   Nusa Politik — js/WingEngine.js   (v7.25)
   Fasad nipis ("enjin") yang menyatukan modul sedia ada di bawah satu nama. TIADA kod dialihkan:
     .Sayap = MyPolitikSayap (sayap.js)  Pemuda/Puteri/Wanita, peralihan umur
     .Blok  = MyPolitikBlok  (blok.js)   undi blok & tawar-menawar Ketua Bahagian
     .Misi  = MyPolitikMisi  (misi.js)   misi sayap bulanan
   Modul asal dimuat secara malas (lazy) pada akses pertama, jadi susunan <script> tidak kritikal.
   Penggunaan: WingEngine.Sayap.cadangan(jantina, umur);  WingEngine.Blok;  WingEngine.Misi;
   ========================================================================== */
(function (root) {
  'use strict';
  function ambil(nama, fail) {
    if (root[nama]) { return root[nama]; }
    try { if (typeof require === 'function') { return require('./' + fail); } } catch (e) { /* tidak dimuatkan */ }
    return null;
  }
  var enjin = {};
  Object.defineProperty(enjin, 'Sayap', { enumerable: true, get: function () { return ambil('MyPolitikSayap', 'sayap.js'); } });
  Object.defineProperty(enjin, 'Blok', { enumerable: true, get: function () { return ambil('MyPolitikBlok', 'blok.js'); } });
  Object.defineProperty(enjin, 'Misi', { enumerable: true, get: function () { return ambil('MyPolitikMisi', 'misi.js'); } });
  root.NusaEngine = root.NusaEngine || {};
  root.NusaEngine.Wing = enjin;
  root.WingEngine = enjin;
  if (typeof module === 'object' && module.exports) { module.exports = enjin; }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
