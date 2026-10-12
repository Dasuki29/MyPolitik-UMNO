/* ==========================================================================
   MyPolitik: UMNO — js/avatar.js
   Avatar watak (SVG asli, dilukis dengan kod): Pemuda, Puteri, Wanita, Veteran.
     MyPolitikAvatar.LIST                        senarai { kod, label, penerangan }
     MyPolitikAvatar.svg('pemuda', {saiz:96})    penanda SVG (string)
     MyPolitikAvatar.pasang(elemen, 'puteri')    letak avatar dalam elemen
     MyPolitikAvatar.cadangan(demografik)        kod avatar sepadan dengan demografik
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikAvatar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var LIST = [
    { kod: 'pemuda',  label: 'Pemuda',  penerangan: 'Muda, bertenaga, songkok hitam' },
    { kod: 'puteri',  label: 'Puteri',  penerangan: 'Generasi baharu, tudung putih' },
    { kod: 'wanita',  label: 'Wanita',  penerangan: 'Berpengalaman, baju kurung' },
    { kod: 'veteran', label: 'Veteran', penerangan: 'Penjaga parti, kopiah putih' }
  ];

  var CONTOH = {
    pemuda:  { kulit: '#E2B08A', baju: '#C8102E', kolar: '#F2B705', bg1: '#E8344F', bg2: '#7A0A1E' },
    puteri:  { kulit: '#F0C4A0', baju: '#C8102E', kolar: '#FFFFFF', bg1: '#FFD84D', bg2: '#B8860B' },
    wanita:  { kulit: '#DDA982', baju: '#7A0A1E', kolar: '#F2B705', bg1: '#E8344F', bg2: '#5A0716' },
    veteran: { kulit: '#D49C74', baju: '#2B2E3A', kolar: '#F2B705', bg1: '#4B5163', bg2: '#1C1F28' }
  };

  var seq = 0;

  function bahagian(kod, c) {
    var muka = '<circle cx="48" cy="44" r="17" fill="' + c.kulit + '"/>';
    var mata = '<circle cx="42" cy="44" r="1.8" fill="#2B1B12"/><circle cx="54" cy="44" r="1.8" fill="#2B1B12"/>' +
               '<path d="M42 51 q6 5 12 0" fill="none" stroke="#7A3B2A" stroke-width="1.8" stroke-linecap="round"/>';
    var leher = '<rect x="42" y="58" width="12" height="12" rx="4" fill="' + c.kulit + '"/>';
    var bahu = '<path d="M10 96 C12 76 28 68 48 68 C68 68 84 76 86 96Z" fill="' + c.baju + '"/>' +
               '<path d="M40 68 L48 80 L56 68" fill="none" stroke="' + c.kolar + '" stroke-width="3" stroke-linejoin="round"/>';
    if (kod === 'pemuda') {
      return bahu + leher + muka + mata +
        '<path d="M31 36 L31 24 Q31 18 38 18 L58 18 Q65 18 65 24 L65 36 Q48 30 31 36Z" fill="#14161C"/>' +
        '<rect x="31" y="31" width="34" height="3" fill="#F2B705"/>';
    }
    if (kod === 'puteri' || kod === 'wanita') {
      var tudung = kod === 'puteri' ? '#FFFFFF' : '#F2B705', bayang = kod === 'puteri' ? '#D9DBE3' : '#C99700';
      return bahu +
        '<path d="M24 46 C24 18 72 18 72 46 C72 62 70 74 62 78 L34 78 C26 74 24 62 24 46Z" fill="' + tudung + '"/>' +
        '<path d="M34 78 C28 74 26 62 26 48" fill="none" stroke="' + bayang + '" stroke-width="2"/>' +
        '<ellipse cx="48" cy="46" rx="13" ry="16" fill="' + c.kulit + '"/>' +
        '<circle cx="43" cy="46" r="1.8" fill="#2B1B12"/><circle cx="53" cy="46" r="1.8" fill="#2B1B12"/>' +
        '<path d="M43 53 q5 4 10 0" fill="none" stroke="#7A3B2A" stroke-width="1.8" stroke-linecap="round"/>';
    }
    /* veteran */
    return bahu + leher + muka +
      '<path d="M31 42 Q29 34 33 30 L33 42Z M65 42 Q67 34 63 30 L63 42Z" fill="#ECECEF"/>' +
      '<path d="M32 33 Q48 14 64 33 Q48 27 32 33Z" fill="#FFFFFF" stroke="#D9DBE3" stroke-width="1"/>' +
      '<circle cx="42" cy="44" r="5" fill="none" stroke="#14161C" stroke-width="1.5"/><circle cx="54" cy="44" r="5" fill="none" stroke="#14161C" stroke-width="1.5"/>' +
      '<path d="M47 44 h2" stroke="#14161C" stroke-width="1.5"/>' +
      '<circle cx="42" cy="44" r="1.5" fill="#2B1B12"/><circle cx="54" cy="44" r="1.5" fill="#2B1B12"/>' +
      '<path d="M41 52 Q48 49 55 52 Q48 58 41 52Z" fill="#ECECEF"/>';
  }

  /** Penanda SVG sebagai string. Pilihan: { saiz, label } */
  function svg(kod, opts) {
    opts = opts || {};
    var c = CONTOH[kod] || CONTOH.pemuda, id = 'mpa' + (++seq), saiz = opts.saiz || 96;
    var lbl = opts.label || ((LIST.filter(function (a) { return a.kod === kod; })[0] || LIST[0]).label);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="' + saiz + '" height="' + saiz + '" role="img" aria-label="Avatar ' + lbl + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c.bg1 + '"/><stop offset="1" stop-color="' + c.bg2 + '"/></linearGradient>' +
      '<clipPath id="' + id + 'c"><circle cx="48" cy="48" r="48"/></clipPath></defs>' +
      '<circle cx="48" cy="48" r="48" fill="url(#' + id + ')"/>' +
      '<g clip-path="url(#' + id + 'c)">' + bahagian(kod, c) + '</g></svg>';
  }

  function adaKod(kod) { return LIST.some(function (a) { return a.kod === kod; }); }

  function pasang(el, kod, opts) {
    if (!el) { return; }
    el.innerHTML = svg(adaKod(kod) ? kod : 'pemuda', opts);
  }

  /** demografik: objek { kod } daripada tentukanDemografi(), atau string kod. */
  function cadangan(demografik) {
    var k = demografik && demografik.kod ? demografik.kod : demografik;
    return adaKod(k) ? k : 'pemuda';
  }

  return { LIST: LIST, svg: svg, pasang: pasang, cadangan: cadangan, adaKod: adaKod };
});
