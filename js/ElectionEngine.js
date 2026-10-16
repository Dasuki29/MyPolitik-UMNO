/* ==========================================================================
   Nusa Politik — js/ElectionEngine.js   (v7.25)
   Fasad nipis ("enjin") yang menyatukan modul sedia ada di bawah satu nama. TIADA kod dialihkan:
     .PRU        = MyPolitikPRU       (pru.js)       PRU/PRN: pencalonan, kempen, manifesto, keputusan FPTP, keputusan nasional
     .PRK        = MyPolitikPRK       (prk.js)       Pilihan Raya Kecil
     .Pemilihan  = MyPolitikElection  (election.js)  pemilihan dalaman parti (blok, undi, jawatan)
     .Demografi  = MyPolitikData      (data.js)      demografi kawasan & data Sheets
   Modul asal dimuat secara malas (lazy) pada akses pertama, jadi susunan <script> tidak kritikal.
   Penggunaan: NusaEngine.Election.PRU.kelayakan(p);  ElectionEngine.PRK.getPRK(p);
   ========================================================================== */
(function (root) {
  'use strict';
  function ambil(nama, fail) {
    if (root[nama]) { return root[nama]; }
    try { if (typeof require === 'function') { return require('./' + fail); } } catch (e) { /* tidak dimuatkan */ }
    return null;
  }
  var enjin = {};
  Object.defineProperty(enjin, 'PRU', { enumerable: true, get: function () { return ambil('MyPolitikPRU', 'pru.js'); } });
  Object.defineProperty(enjin, 'PRK', { enumerable: true, get: function () { return ambil('MyPolitikPRK', 'prk.js'); } });
  Object.defineProperty(enjin, 'Pemilihan', { enumerable: true, get: function () { return ambil('MyPolitikElection', 'election.js'); } });
  Object.defineProperty(enjin, 'Demografi', { enumerable: true, get: function () { return ambil('MyPolitikData', 'data.js'); } });
  root.NusaEngine = root.NusaEngine || {};
  root.NusaEngine.Election = enjin;
  root.ElectionEngine = enjin;
  if (typeof module === 'object' && module.exports) { module.exports = enjin; }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
