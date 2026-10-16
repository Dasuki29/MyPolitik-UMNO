/* ==========================================================================
   Nusa Politik — js/CabinetEngine.js   (v7.25)
   Fasad nipis ("enjin") yang menyatukan modul sedia ada di bawah satu nama. TIADA kod dialihkan:
     .Kabinet = MyPolitikKabinet (kabinet.js)  pelantikan portfolio (lobi, PM/TPM), KPI tadbir urus, dilema kementerian, CDF, rombakan
   Modul asal dimuat secara malas (lazy) pada akses pertama, jadi susunan <script> tidak kritikal.
   Penggunaan: CabinetEngine.ringkasan(p);  CabinetEngine.lobiPortfolio(id);  CabinetEngine.lantikKanan('PERDANA_MENTERI');
   ========================================================================== */
(function (root) {
  'use strict';
  function ambil(nama, fail) {
    if (root[nama]) { return root[nama]; }
    try { if (typeof require === 'function') { return require('./' + fail); } } catch (e) { /* tidak dimuatkan */ }
    return null;
  }
  var enjin = {};
  Object.defineProperty(enjin, 'Kabinet', { enumerable: true, get: function () { return ambil('MyPolitikKabinet', 'kabinet.js'); } });
  enjin.ringkasan = function () { var m = ambil('MyPolitikKabinet', 'kabinet.js'); return m.ringkasan.apply(m, arguments); };
  enjin.bukaLobi = function () { var m = ambil('MyPolitikKabinet', 'kabinet.js'); return m.bukaLobi.apply(m, arguments); };
  enjin.lobiPortfolio = function () { var m = ambil('MyPolitikKabinet', 'kabinet.js'); return m.lobiPortfolio.apply(m, arguments); };
  enjin.lantikKanan = function () { var m = ambil('MyPolitikKabinet', 'kabinet.js'); return m.lantikKanan.apply(m, arguments); };
  enjin.prosesBulan = function () { var m = ambil('MyPolitikKabinet', 'kabinet.js'); return m.prosesBulan.apply(m, arguments); };
  enjin.jawabAcara = function () { var m = ambil('MyPolitikKabinet', 'kabinet.js'); return m.jawabAcara.apply(m, arguments); };
  enjin.salurCDF = function () { var m = ambil('MyPolitikKabinet', 'kabinet.js'); return m.salurCDF.apply(m, arguments); };
  root.NusaEngine = root.NusaEngine || {};
  root.NusaEngine.Cabinet = enjin;
  root.CabinetEngine = enjin;
  if (typeof module === 'object' && module.exports) { module.exports = enjin; }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
