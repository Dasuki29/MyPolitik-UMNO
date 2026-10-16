/* ==========================================================================
   Nusa Politik — js/avatar.js
   Avatar watak (SVG asli, dilukis dengan kod): Pemuda, Puteri, Wanita, Biasa, Veteran.
   v5.1: tambah Biasa (lelaki pertengahan umur, baju Melayu biru tua, songkok hitam).
   v4.3: Pemuda (baju Melayu putih, songkok hitam), Puteri (kebaya putih, tudung merah jambu),
         Wanita (baju kurung putih, tudung merah, berusia), Veteran (baju Melayu merah, songkok hitam, berusia).
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
    { kod: 'pemuda',  label: 'Pemuda',  penerangan: 'Lelaki muda, baju Melayu putih, songkok hitam' },
    { kod: 'puteri',  label: 'Puteri',  penerangan: 'Perempuan muda, kebaya putih, tudung merah jambu' },
    { kod: 'wanita',  label: 'Wanita',  penerangan: 'Perempuan berusia, baju kurung putih, tudung merah' },
    { kod: 'biasa',   label: 'Biasa',   penerangan: 'Lelaki pertengahan umur, baju Melayu biru tua, songkok hitam' },
    { kod: 'veteran', label: 'Veteran', penerangan: 'Lelaki berusia, baju Melayu merah, songkok hitam' }
  ];

  var LATAR = {
    pemuda:  { bg1: '#E8344F', bg2: '#7A0A1E' },
    puteri:  { bg1: '#5B6BC0', bg2: '#232A63' },
    wanita:  { bg1: '#FFD84D', bg2: '#B8860B' },
    biasa:   { bg1: '#2E8B6E', bg2: '#0E3B2E' },
    veteran: { bg1: '#6B7387', bg2: '#242834' },
    veteran_p: { bg1: '#6B7387', bg2: '#242834' }          // v7.50: variasi Veteran perempuan (dashboard sahaja; bukan pilihan pendaftaran)
  };

  var seq = 0;
  var MATA = function (x, y, tua) {
    return '<ellipse cx="' + x + '" cy="' + y + '" rx="2" ry="' + (tua ? 1.5 : 2) + '" fill="#2B1B12"/><circle cx="' + (x + .7) + '" cy="' + (y - .7) + '" r=".6" fill="#fff"/>';
  };

  function bahagian(kod) {
    var s = '';
    if (kod === 'pemuda') {
      var kulit = '#E2B08A', gelap = '#C48B66';
      // baju Melayu putih
      s += '<path d="M6 96 C8 76 26 68 48 68 C70 68 88 76 90 96Z" fill="#F7F7F3"/>' +
           '<path d="M6 96 C8 76 26 68 48 68 C70 68 88 76 90 96" fill="none" stroke="#D9D9D0" stroke-width="1.5"/>' +
           '<path d="M48 76 L48 96" stroke="#DADAD0" stroke-width="1.6"/>' +
           '<circle cx="48" cy="82" r="1.5" fill="#E2B93B"/><circle cx="48" cy="89" r="1.5" fill="#E2B93B"/>';
      // leher dan kolar cekak musang
      s += '<rect x="42" y="56" width="12" height="14" rx="4" fill="' + kulit + '"/>' +
           '<path d="M38 67 Q48 74 58 67 L58 74 Q48 81 38 74Z" fill="#FFFFFF" stroke="#D9D9D0" stroke-width="1.3" stroke-linejoin="round"/>';
      // kepala
      s += '<circle cx="32.5" cy="46" r="3.2" fill="' + kulit + '"/><circle cx="63.5" cy="46" r="3.2" fill="' + kulit + '"/>' +
           '<ellipse cx="48" cy="45" rx="15.5" ry="18" fill="' + kulit + '"/>' +
           '<path d="M33 38 Q32 44 34 49 L35 40Z M63 38 Q64 44 62 49 L61 40Z" fill="#1C1713"/>';
      s += '<path d="M37 40 q4 -2.4 8 -.4 M51 39.6 q4 -2 8 .4" fill="none" stroke="#2B1B12" stroke-width="1.7" stroke-linecap="round"/>' +
           MATA(42, 45, 0) + MATA(54, 45, 0) +
           '<path d="M48 46 q-2.4 5.5 .8 6.4" fill="none" stroke="' + gelap + '" stroke-width="1.4" stroke-linecap="round"/>' +
           '<path d="M42.5 55 q5.5 4.5 11 0" fill="none" stroke="#7A3B2A" stroke-width="1.8" stroke-linecap="round"/>' +
           '<circle cx="38" cy="51" r="3" fill="#F08A7A" opacity=".22"/><circle cx="58" cy="51" r="3" fill="#F08A7A" opacity=".22"/>';
      // songkok hitam
      s += '<path d="M30.5 36 L32.5 21 Q33 16 40 16 L56 16 Q63 16 63.5 21 L65.5 36 Q48 30.5 30.5 36Z" fill="#15171D"/>' +
           '<path d="M33 23 Q48 19 63 23 L63.5 26 Q48 22 32.5 26Z" fill="#2B2F3A" opacity=".8"/>' +
           '<path d="M31 35 Q48 29.8 65 35" fill="none" stroke="#2B2F3A" stroke-width="1.2"/>';
      return s;
    }

    if (kod === 'puteri') {
      var k = '#F0C4A0', merah = '#E9729B', bayangM = '#C84F7E', cerah = '#F7A9C4';
      // kebaya putih berenda
      s += '<path d="M6 96 C8 76 26 68 48 68 C70 68 88 76 90 96Z" fill="#FDFCFA"/>' +
           '<path d="M6 96 C8 76 26 68 48 68 C70 68 88 76 90 96" fill="none" stroke="#E4DCE2" stroke-width="1.4"/>' +
           '<path d="M42 72 Q44 86 41 96 L55 96 Q52 86 54 72Z" fill="#F4E6EE"/>' +
           '<path d="M42 72 Q44 86 41 96 M54 72 Q52 86 55 96" fill="none" stroke="#E9C9D9" stroke-width="3" stroke-linecap="round" stroke-dasharray="1.4 3"/>' +
           '<path d="M12 88 Q20 79 32 76 M84 88 Q76 79 64 76" fill="none" stroke="#EADDE6" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1.4 3"/>';
      // tudung merah jambu
      s += '<path d="M21 48 C19 17 77 17 75 48 C75 59 78 66 82 74 C71 73 60 77 48 77 C36 77 25 73 14 74 C18 66 21 59 21 48Z" fill="' + merah + '"/>' +
           '<path d="M14 74 C25 73 36 77 48 77 C60 77 71 73 82 74" fill="none" stroke="' + bayangM + '" stroke-width="1.6"/>' +
           '<path d="M24 56 C26 62 29 68 33 74 M72 56 C70 62 67 68 63 74" fill="none" stroke="' + bayangM + '" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>' +
           '<path d="M30 30 C38 22 58 22 66 30" fill="none" stroke="' + cerah + '" stroke-width="2" stroke-linecap="round" opacity=".75"/>';
      // muka
      s += '<ellipse cx="48" cy="47" rx="14.5" ry="17.5" fill="' + bayangM + '"/>' +
           '<ellipse cx="48" cy="47.6" rx="13.4" ry="16.6" fill="' + k + '"/>' +
           '<path d="M38 41 q4 -2.4 8 -.2 M50 40.8 q4 -2 8 .2" fill="none" stroke="#4A2F22" stroke-width="1.4" stroke-linecap="round"/>' +
           MATA(42.5, 46, 0) + MATA(53.5, 46, 0) +
           '<path d="M40.4 44.2 q2 -1.6 4.2 -.3 M51.4 43.9 q2.2 -1.3 4.2 .3" fill="none" stroke="#2B1B12" stroke-width="1" stroke-linecap="round"/>' +
           '<path d="M48 47 q-2 5 .8 5.6" fill="none" stroke="#D09A78" stroke-width="1.3" stroke-linecap="round"/>' +
           '<path d="M43.5 56 q4.5 3.6 9 0 q-4.5 1.6 -9 0Z" fill="#D9546F" stroke="#D9546F" stroke-width="1.2" stroke-linejoin="round"/>' +
           '<circle cx="38.8" cy="52" r="3" fill="#F08A9A" opacity=".3"/><circle cx="57.2" cy="52" r="3" fill="#F08A9A" opacity=".3"/>';
      // kerongsang
      s += '<circle cx="48" cy="77.5" r="3.2" fill="#E2B93B" stroke="#B8860B" stroke-width="1"/><circle cx="48" cy="77.5" r="1.1" fill="#fff" opacity=".8"/>' +
           '<path d="M48 80.6 L45.8 86 L50.2 86Z" fill="#E2B93B" stroke="#B8860B" stroke-width=".8" stroke-linejoin="round"/>';
      return s;
    }

    if (kod === 'wanita') {
      var kw = '#DDA982', gw = '#B98660', merahT = '#C8102E', bayangT = '#8E0B22';
      // baju kurung putih
      s += '<path d="M6 96 C8 76 26 68 48 68 C70 68 88 76 90 96Z" fill="#FBFBF7"/>' +
           '<path d="M6 96 C8 76 26 68 48 68 C70 68 88 76 90 96" fill="none" stroke="#DCDCD2" stroke-width="1.5"/>' +
           '<path d="M48 80 L48 96" stroke="#DCDCD2" stroke-width="1.5"/><circle cx="48" cy="86" r="1.3" fill="#E2B93B"/><circle cx="48" cy="92" r="1.3" fill="#E2B93B"/>' +
           '<path d="M26 90 Q36 86 44 88 M70 90 Q60 86 52 88" fill="none" stroke="#E5E5DC" stroke-width="1.4" stroke-linecap="round"/>';
      // tudung merah
      s += '<path d="M20 50 C18 16 78 16 76 50 C76 62 80 70 84 79 C72 77 60 80 48 80 C36 80 24 77 12 79 C16 70 20 62 20 50Z" fill="' + merahT + '"/>' +
           '<path d="M12 79 C24 77 36 80 48 80 C60 80 72 77 84 79" fill="none" stroke="' + bayangT + '" stroke-width="1.7"/>' +
           '<path d="M23 58 C25 66 28 72 32 78 M73 58 C71 66 68 72 64 78" fill="none" stroke="' + bayangT + '" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>' +
           '<path d="M30 28 C38 21 58 21 66 28" fill="none" stroke="#E8344F" stroke-width="2" stroke-linecap="round" opacity=".8"/>';
      // muka berusia
      s += '<ellipse cx="48" cy="48" rx="14.8" ry="17.8" fill="' + bayangT + '"/>' +
           '<ellipse cx="48" cy="48.6" rx="13.7" ry="16.9" fill="' + kw + '"/>' +
           '<path d="M39 41.4 q4 -2 8 -.2 M50 41.2 q4 -1.8 8 .2" fill="none" stroke="#7B6B62" stroke-width="1.6" stroke-linecap="round"/>' +
           MATA(42.6, 46.4, 1) + MATA(53.4, 46.4, 1) +
           // kedutan: dahi, kaki gagak, bawah mata, lipatan senyum
           '<path d="M40 35.5 q8 -2.2 16 0 M41.5 38 q6.5 -1.6 13 0" fill="none" stroke="' + gw + '" stroke-width="1" stroke-linecap="round" opacity=".8"/>' +
           '<path d="M36.6 45.4 l-3 -.9 M36.7 47.2 l-3 .4 M59.4 45.4 l3 -.9 M59.3 47.2 l3 .4" stroke="' + gw + '" stroke-width="1" stroke-linecap="round"/>' +
           '<path d="M39.6 49.3 q3 1.6 6 0 M50.4 49.3 q3 1.6 6 0" fill="none" stroke="' + gw + '" stroke-width=".9" stroke-linecap="round" opacity=".8"/>' +
           '<path d="M48 47.5 q-2 5 .8 5.6" fill="none" stroke="' + gw + '" stroke-width="1.3" stroke-linecap="round"/>' +
           '<path d="M40.4 51 q-1.6 5 .6 9 M55.6 51 q1.6 5 -.6 9" fill="none" stroke="' + gw + '" stroke-width="1" stroke-linecap="round" opacity=".8"/>' +
           '<path d="M43.4 57.4 q4.6 3.4 9.2 0" fill="none" stroke="#9A4A3A" stroke-width="1.9" stroke-linecap="round"/>' +
           '<circle cx="38.8" cy="53" r="3" fill="#E3877A" opacity=".2"/><circle cx="57.2" cy="53" r="3" fill="#E3877A" opacity=".2"/>';
      // kerongsang di bahu
      s += '<g transform="translate(33 76)"><circle r="3" fill="#E2B93B" stroke="#B8860B" stroke-width="1"/><circle r="1" fill="#fff" opacity=".8"/></g>';
      return s;
    }

    /* biasa (lelaki 41-59) */
    if (kod === 'biasa') {
      var kb = '#D8A57C', gb = '#AE7650';
      s += '<path d="M6 96 C8 76 26 68 48 68 C70 68 88 76 90 96Z" fill="#1D3A6E"/>' +
           '<path d="M6 96 C8 76 26 68 48 68 C70 68 88 76 90 96" fill="none" stroke="#11264B" stroke-width="1.6"/>' +
           '<path d="M48 76 L48 96" stroke="#11264B" stroke-width="1.6"/>' +
           '<circle cx="48" cy="82" r="1.6" fill="#E2B93B"/><circle cx="48" cy="89" r="1.6" fill="#E2B93B"/>' +
           '<path d="M20 90 Q30 84 40 86 M76 90 Q66 84 56 86" fill="none" stroke="#3B5FA3" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>';
      s += '<rect x="41" y="56" width="14" height="14" rx="4" fill="' + kb + '"/>' +
           '<path d="M37 67 Q48 74 59 67 L59 74 Q48 81 37 74Z" fill="#2B4E8F" stroke="#11264B" stroke-width="1.3" stroke-linejoin="round"/>';
      s += '<circle cx="32" cy="47" r="3.4" fill="' + kb + '"/><circle cx="64" cy="47" r="3.4" fill="' + kb + '"/>' +
           '<ellipse cx="48" cy="46" rx="16" ry="18.5" fill="' + kb + '"/>' +
           '<path d="M33 40 Q31.6 45 33.4 49.5 Q35 46 35.2 41.5Z M63 40 Q64.4 45 62.6 49.5 Q61 46 60.8 41.5Z" fill="#6E6A68"/>';
      s += '<path d="M36 40.4 q4.5 -2.8 9 -.6 M51 39.8 q4.5 -2.2 9 .6" fill="none" stroke="#3A2A22" stroke-width="2.6" stroke-linecap="round"/>' +
           MATA(42, 46, 0) + MATA(54, 46, 0) +
           '<path d="M39 37.4 q9 -2.2 18 0" fill="none" stroke="' + gb + '" stroke-width=".9" stroke-linecap="round" opacity=".6"/>' +
           '<path d="M36.6 45.8 l-2.4 -.6 M59.4 45.8 l2.4 -.6" stroke="' + gb + '" stroke-width=".9" stroke-linecap="round"/>' +
           '<path d="M48 47 q-2.2 5.4 .9 6.2" fill="none" stroke="' + gb + '" stroke-width="1.3" stroke-linecap="round"/>' +
           '<path d="M40.4 52 q-1.4 4.6 .4 8 M55.6 52 q1.4 4.6 -.4 8" fill="none" stroke="' + gb + '" stroke-width=".9" stroke-linecap="round" opacity=".7"/>' +
           '<path d="M48 55.4 Q43 52.8 39 56 Q43 59 48 57.4 Q53 59 57 56 Q53 52.8 48 55.4Z" fill="#3A2A22"/>' +
           '<path d="M44 60.4 q4 2.2 8 0" fill="none" stroke="#7A3B2A" stroke-width="1.6" stroke-linecap="round"/>';
      s += '<path d="M30 36.5 L32 20.5 Q32.5 15.5 39.5 15.5 L56.5 15.5 Q63.5 15.5 64 20.5 L66 36.5 Q48 31 30 36.5Z" fill="#15171D"/>' +
           '<path d="M32.6 22.5 Q48 18.5 63.4 22.5 L63.8 25.5 Q48 21.5 32.2 25.5Z" fill="#2B2F3A" opacity=".8"/>' +
           '<path d="M30.5 35.6 Q48 30.4 65.5 35.6" fill="none" stroke="#2B2F3A" stroke-width="1.2"/>';
      return s;
    }

    /* veteran perempuan (v7.50): paparan dashboard bagi pemain perempuan kategori Veteran */
    if (kod === 'veteran_p') {
      var kw = '#D9A47E', gw = '#A8714C', tud = '#E3E5EB', bay = '#A9AEBB';
      // baju kurung merah
      s += '<path d="M6 96 C8 76 26 68 48 68 C70 68 88 76 90 96Z" fill="#B3122B"/>' +
           '<path d="M6 96 C8 76 26 68 48 68 C70 68 88 76 90 96" fill="none" stroke="#7E0A1D" stroke-width="1.6"/>' +
           '<path d="M48 80 L48 96" stroke="#7E0A1D" stroke-width="1.5"/><circle cx="48" cy="86" r="1.4" fill="#E2B93B"/><circle cx="48" cy="92" r="1.4" fill="#E2B93B"/>' +
           '<path d="M26 90 Q36 86 44 88 M70 90 Q60 86 52 88" fill="none" stroke="#C93249" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>';
      // tudung kelabu perak
      s += '<path d="M20 50 C18 16 78 16 76 50 C76 62 80 70 84 79 C72 77 60 80 48 80 C36 80 24 77 12 79 C16 70 20 62 20 50Z" fill="' + tud + '"/>' +
           '<path d="M12 79 C24 77 36 80 48 80 C60 80 72 77 84 79" fill="none" stroke="' + bay + '" stroke-width="1.7"/>' +
           '<path d="M23 58 C25 66 28 72 32 78 M73 58 C71 66 68 72 64 78" fill="none" stroke="' + bay + '" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>' +
           '<path d="M30 28 C38 21 58 21 66 28" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity=".8"/>';
      // muka tua
      s += '<ellipse cx="48" cy="48" rx="14.8" ry="17.8" fill="' + bay + '"/>' +
           '<ellipse cx="48" cy="48.6" rx="13.7" ry="16.9" fill="' + kw + '"/>' +
           '<path d="M39 41.4 q4 -2 8 -.2 M50 41.2 q4 -1.8 8 .2" fill="none" stroke="#9A9AA4" stroke-width="1.6" stroke-linecap="round"/>' +
           MATA(42.6, 46.4, 1) + MATA(53.4, 46.4, 1) +
           // cermin mata
           '<circle cx="42.6" cy="46.4" r="5.2" fill="none" stroke="#5B4636" stroke-width="1.1"/><circle cx="53.4" cy="46.4" r="5.2" fill="none" stroke="#5B4636" stroke-width="1.1"/><path d="M47.8 46 q.2 -.8 .4 0" stroke="#5B4636" stroke-width="1.1" fill="none"/>' +
           '<path d="M40 35.5 q8 -2.2 16 0 M41.5 38 q6.5 -1.6 13 0" fill="none" stroke="' + gw + '" stroke-width="1" stroke-linecap="round" opacity=".8"/>' +
           '<path d="M36.6 45.4 l-3 -.9 M36.7 47.2 l-3 .4 M59.4 45.4 l3 -.9 M59.3 47.2 l3 .4" stroke="' + gw + '" stroke-width="1" stroke-linecap="round"/>' +
           '<path d="M48 47.5 q-2 5 .8 5.6" fill="none" stroke="' + gw + '" stroke-width="1.3" stroke-linecap="round"/>' +
           '<path d="M40.4 51.4 q-1.6 5 .6 9 M55.6 51.4 q1.6 5 -.6 9" fill="none" stroke="' + gw + '" stroke-width="1" stroke-linecap="round" opacity=".8"/>' +
           '<path d="M43.4 57.4 q4.6 3.4 9.2 0" fill="none" stroke="#9A4A3A" stroke-width="1.9" stroke-linecap="round"/>' +
           '<circle cx="38.8" cy="54" r="3" fill="#E3877A" opacity=".2"/><circle cx="57.2" cy="54" r="3" fill="#E3877A" opacity=".2"/>';
      s += '<g transform="translate(33 76)"><circle r="3" fill="#E2B93B" stroke="#B8860B" stroke-width="1"/><circle r="1" fill="#fff" opacity=".8"/></g>';
      return s;
    }

    /* veteran */
    var kv = '#D49C74', gv = '#A8714C';
    s += '<path d="M6 96 C8 76 26 68 48 68 C70 68 88 76 90 96Z" fill="#B3122B"/>' +
         '<path d="M6 96 C8 76 26 68 48 68 C70 68 88 76 90 96" fill="none" stroke="#7E0A1D" stroke-width="1.6"/>' +
         '<path d="M48 76 L48 96" stroke="#7E0A1D" stroke-width="1.6"/>' +
         '<circle cx="48" cy="82" r="1.6" fill="#E2B93B"/><circle cx="48" cy="89" r="1.6" fill="#E2B93B"/>' +
         '<path d="M20 90 Q30 84 40 86 M76 90 Q66 84 56 86" fill="none" stroke="#C93249" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>';
    s += '<rect x="41" y="56" width="14" height="14" rx="4" fill="' + kv + '"/>' +
         '<path d="M37 67 Q48 74 59 67 L59 74 Q48 81 37 74Z" fill="#C41E37" stroke="#7E0A1D" stroke-width="1.3" stroke-linejoin="round"/>';
    s += '<circle cx="32" cy="47" r="3.4" fill="' + kv + '"/><circle cx="64" cy="47" r="3.4" fill="' + kv + '"/>' +
         '<ellipse cx="48" cy="46" rx="16" ry="18.5" fill="' + kv + '"/>' +
         '<path d="M33 40 Q31.6 45 33.4 49.5 Q35 46 35.2 41.5Z M63 40 Q64.4 45 62.6 49.5 Q61 46 60.8 41.5Z" fill="#E9E9EC"/>';
    s += '<path d="M36 40.4 q4.5 -2.8 9 -.6 M51 39.8 q4.5 -2.2 9 .6" fill="none" stroke="#E4E4E8" stroke-width="2.6" stroke-linecap="round"/>' +
         MATA(42, 46, 1) + MATA(54, 46, 1) +
         '<path d="M38 36.5 q10 -2.8 20 0 M39.4 39 q8.6 -1.8 17.2 0" fill="none" stroke="' + gv + '" stroke-width="1" stroke-linecap="round" opacity=".8"/>' +
         '<path d="M36.4 45.6 l-3.2 -.9 M36.5 47.5 l-3.2 .4 M59.6 45.6 l3.2 -.9 M59.5 47.5 l3.2 .4" stroke="' + gv + '" stroke-width="1" stroke-linecap="round"/>' +
         '<path d="M38.6 50 q3.4 1.8 6.8 0 M50.6 50 q3.4 1.8 6.8 0" fill="none" stroke="' + gv + '" stroke-width=".9" stroke-linecap="round" opacity=".8"/>' +
         '<path d="M48 47 q-2.4 5.8 .9 6.6" fill="none" stroke="' + gv + '" stroke-width="1.4" stroke-linecap="round"/>' +
         '<path d="M39.6 52 q-2 5.4 .4 9.6 M56.4 52 q2 5.4 -.4 9.6" fill="none" stroke="' + gv + '" stroke-width="1" stroke-linecap="round" opacity=".8"/>' +
         // misai uban
         '<path d="M48 55.4 Q43 52.6 38.6 56 Q43 59.4 48 57.4 Q53 59.4 57.4 56 Q53 52.6 48 55.4Z" fill="#E9E9EC" stroke="#C7C7CE" stroke-width=".8" stroke-linejoin="round"/>' +
         '<path d="M44 60.4 q4 2.2 8 0" fill="none" stroke="#7A3B2A" stroke-width="1.6" stroke-linecap="round"/>';
    // songkok hitam
    s += '<path d="M30 36.5 L32 20.5 Q32.5 15.5 39.5 15.5 L56.5 15.5 Q63.5 15.5 64 20.5 L66 36.5 Q48 31 30 36.5Z" fill="#15171D"/>' +
         '<path d="M32.6 22.5 Q48 18.5 63.4 22.5 L63.8 25.5 Q48 21.5 32.2 25.5Z" fill="#2B2F3A" opacity=".8"/>' +
         '<path d="M30.5 35.6 Q48 30.4 65.5 35.6" fill="none" stroke="#2B2F3A" stroke-width="1.2"/>';
    return s;
  }

  function svg(kod, opts) {
    opts = opts || {};
    var c = LATAR[kod] || LATAR.pemuda, id = 'mpa' + (++seq), saiz = opts.saiz || 96;
    var lbl = opts.label || ((LIST.filter(function (a) { return a.kod === kod; })[0] || LIST[0]).label);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="' + saiz + '" height="' + saiz + '" role="img" aria-label="Avatar ' + lbl + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c.bg1 + '"/><stop offset="1" stop-color="' + c.bg2 + '"/></linearGradient>' +
      '<clipPath id="' + id + 'c"><circle cx="48" cy="48" r="48"/></clipPath></defs>' +
      '<circle cx="48" cy="48" r="48" fill="url(#' + id + ')"/>' +
      '<g clip-path="url(#' + id + 'c)">' + bahagian(kod) + '</g></svg>';
  }
  function adaKod(kod) { return LIST.some(function (a) { return a.kod === kod; }); }
  function pasang(el, kod, opts) {
    if (!el) { return; }
    if (kod === 'veteran' && opts && opts.jantina === 'Perempuan') { el.innerHTML = svg('veteran_p', Object.assign({ label: 'Veteran' }, opts)); return; }   // v7.50: Veteran perempuan
    el.innerHTML = svg(adaKod(kod) ? kod : 'pemuda', opts);
  }
  function cadangan(demografik) { var k = demografik && demografik.kod ? demografik.kod : demografik; return adaKod(k) ? k : 'pemuda'; }
  return { LIST: LIST, svg: svg, pasang: pasang, cadangan: cadangan, adaKod: adaKod };
});
