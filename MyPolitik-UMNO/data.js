/* ==========================================================================
   MyPolitik: UMNO — js/data.js
   1. Ambil data Parlimen / DUN / Lokaliti daripada Google Sheets (Published CSV)
      dengan async/await. Ada cache terakhir dan data contoh jika tiada internet.
   2. Jana ahli cawangan (Lokaliti) secara automatik, minimum 50 orang,
      dengan demografi yang mengikut angka Lelaki/Perempuan dan Bawah/Atas 40
      daripada Sheet.
   3. Struktur kepimpinan Cawangan, Bahagian dan Pusat (MKT) serta pengisiannya.

   STRUKTUR GOOGLE SHEETS (baris tajuk dikesan automatik; kedudukan lajur
   dipakai jika nama tajuk tidak dijumpai):
     A  ID             097/013/001  (Parlimen / DUN / Lokaliti)
     B  Nama Parlimen  Selayang     (= Bahagian)
     C  Nama DUN       Kuang
     D  Nama Lokaliti  Pengkalan Kundang   (= Cawangan)
     E  Jumlah Ahli
     G  Lelaki      I  Perempuan
     K  Bawah 40    M  Atas 40
   Lajur F, H, J, L (peratus) tidak dibaca. Lajur "Negeri" tiada dalam Sheet,
   jadi negeri diterbitkan daripada kod Parlimen (CONFIG.NEGERI_RANGES).
   Jika anda menambah lajur bertajuk "Negeri", nilainya diutamakan.

   Cara guna:
     var data  = await MyPolitikData.loadPartyData({ url: 'PAUTAN_CSV' });
     var world = MyPolitikData.buildPartyWorld(data, { seed: 'permainan-1' });
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikData = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. TETAPAN
     ------------------------------------------------------------------------ */
  var CONFIG = {
    // Tampal pautan "File > Share > Publish to web > CSV" di sini (atau hantar melalui opts.url).
    SHEET_CSV_URL: '',
    FETCH_TIMEOUT_MS: 8000,
    CACHE_KEY: 'mypolitik_umno_csv_v2',     // CSV terakhir yang berjaya, dipakai jika rangkaian gagal
    MIN_AHLI_CAWANGAN: 50,
    MAX_AHLI_CAWANGAN: 500,                 // had ahli yang dijana setiap cawangan (Jumlah Ahli sebenar kekal dalam data)
    JULAT_AHLI_RAWAK: [50, 90],             // jika Sheet tiada Jumlah Ahli
    // Negeri mengikut julat kod Parlimen (persempadanan 2018, 222 kerusi).
    NEGERI_RANGES: [
      { nama: 'Perlis',            dari: 1,   hingga: 3 },
      { nama: 'Kedah',             dari: 4,   hingga: 18 },
      { nama: 'Kelantan',          dari: 19,  hingga: 32 },
      { nama: 'Terengganu',        dari: 33,  hingga: 40 },
      { nama: 'Pulau Pinang',      dari: 41,  hingga: 53 },
      { nama: 'Perak',             dari: 54,  hingga: 77 },
      { nama: 'Pahang',            dari: 78,  hingga: 91 },
      { nama: 'Selangor',          dari: 92,  hingga: 113 },
      { nama: 'WP Kuala Lumpur',   dari: 114, hingga: 124 },
      { nama: 'WP Putrajaya',      dari: 125, hingga: 125 },
      { nama: 'Negeri Sembilan',   dari: 126, hingga: 133 },
      { nama: 'Melaka',            dari: 134, hingga: 139 },
      { nama: 'Johor',             dari: 140, hingga: 165 },
      { nama: 'WP Labuan',         dari: 166, hingga: 166 },
      { nama: 'Sabah',             dari: 167, hingga: 191 },
      { nama: 'Sarawak',           dari: 192, hingga: 222 }
    ]
  };

  /* Demografi ahli. "veteran" ialah Veteran/Ahli Biasa: lelaki 41 tahun ke atas
     dan wanita 66 tahun ke atas. Julat umur boleh dilaras untuk keseimbangan. */
  var DEMOGRAFI = {
    pemuda:  { label: 'Pemuda',             berat: 0.26, minBil: 3, profil: [{ jantina: 'L', umur: [18, 40], w: 1 }] },
    puteri:  { label: 'Puteri',             berat: 0.14, minBil: 3, profil: [{ jantina: 'P', umur: [18, 35], w: 1 }] },
    wanita:  { label: 'Wanita',             berat: 0.26, minBil: 3, profil: [{ jantina: 'P', umur: [36, 65], w: 1 }] },
    veteran: { label: 'Veteran/Ahli Biasa', berat: 0.34, minBil: 8, profil: [{ jantina: 'L', umur: [41, 85], w: 0.75 }, { jantina: 'P', umur: [66, 85], w: 0.25 }] }
  };

  /** Tentukan kategori demografi pemain. jantina: 'L' | 'P'. Pulang null jika tidak sah. */
  function tentukanDemografi(jantina, umur) {
    var j = String(jantina || '').trim().toUpperCase().charAt(0);
    umur = parseInt(umur, 10);
    if ((j !== 'L' && j !== 'P') || !isFinite(umur) || umur < 18) { return null; }
    var kod = null;
    Object.keys(DEMOGRAFI).forEach(function (k) {
      DEMOGRAFI[k].profil.forEach(function (p) {
        if (!kod && p.jantina === j && umur >= p.umur[0] && umur <= p.umur[1]) { kod = k; }
      });
    });
    if (!kod && umur > 85) { kod = 'veteran'; }
    return kod ? { kod: kod, label: DEMOGRAFI[kod].label, jantina: j === 'L' ? 'Lelaki' : 'Perempuan', umur: umur } : null;
  }

  function negeriDariKod(kodParlimen) {
    var n = parseInt(kodParlimen, 10);
    for (var i = 0; i < CONFIG.NEGERI_RANGES.length; i++) {
      var r = CONFIG.NEGERI_RANGES[i];
      if (n >= r.dari && n <= r.hingga) { return r.nama; }
    }
    return 'Lain-lain';
  }

  /* ------------------------------------------------------------------------
     2. STRUKTUR KEPIMPINAN
     bil: bilangan penyandang. bil = null bermaksud baki ahli.
     kumpulan: utama | ajk | dilantik | ahli
     sayap: jawatan hanya boleh diisi ahli demografi tersebut
     ------------------------------------------------------------------------ */
  function jawatan(kod, nama, bil, extra) {
    var o = { kod: kod, jawatan: nama, bil: bil, kumpulan: 'utama', sayap: null, dilantik: false };
    for (var k in (extra || {})) { o[k] = extra[k]; }
    return o;
  }

  var LEADERSHIP_STRUCTURE = deepFreeze({
    cawangan: [
      jawatan('ketua',           'Ketua Cawangan', 1),
      jawatan('naib',            'Naib Ketua Cawangan', 1),
      jawatan('su',              'Setiausaha Cawangan', 1),
      jawatan('bendahari',       'Bendahari Cawangan', 1),
      jawatan('penerangan',      'Ketua Penerangan Cawangan', 1),
      jawatan('ketua_pemuda',    'Ketua Pemuda Cawangan', 1, { sayap: 'pemuda' }),
      jawatan('ketua_wanita',    'Ketua Wanita Cawangan', 1, { sayap: 'wanita' }),
      jawatan('ketua_puteri',    'Ketua Puteri Cawangan', 1, { sayap: 'puteri' }),
      jawatan('ajk',             'AJK Cawangan', 7, { kumpulan: 'ajk' }),
      jawatan('setiausaha_kerja','Setiausaha Kerja Cawangan (Urus Setia Mesyuarat)', 1, { kumpulan: 'dilantik', dilantik: true }),
      jawatan('ahli',            'Ahli Biasa', null, { kumpulan: 'ahli' })
    ],
    bahagian: [
      jawatan('ketua',           'Ketua Bahagian', 1),
      jawatan('timbalan',        'Timbalan Ketua Bahagian', 1),
      jawatan('naib',            'Naib Ketua Bahagian', 1),
      jawatan('su',              'Setiausaha Bahagian', 1),
      jawatan('bendahari',       'Bendahari Bahagian', 1),
      jawatan('penerangan',      'Ketua Penerangan Bahagian', 1),
      jawatan('ketua_pemuda',    'Ketua Pemuda Bahagian', 1, { sayap: 'pemuda' }),
      jawatan('ketua_wanita',    'Ketua Wanita Bahagian', 1, { sayap: 'wanita' }),
      jawatan('ketua_puteri',    'Ketua Puteri Bahagian', 1, { sayap: 'puteri' }),
      jawatan('ajk',             'AJK Bahagian', 15, { kumpulan: 'ajk' }),
      jawatan('setiausaha_kerja','Setiausaha Kerja Bahagian', 1, { kumpulan: 'dilantik', dilantik: true })
    ],
    pusat: [
      jawatan('presiden',        'Presiden', 1),
      jawatan('timbalan',        'Timbalan Presiden', 1),
      jawatan('naib_presiden',   'Naib Presiden', 3),
      jawatan('su_agung',        'Setiausaha Agung', 1),
      jawatan('bendahari_agung', 'Bendahari Agung', 1),
      jawatan('penerangan',      'Ketua Penerangan', 1),
      jawatan('ketua_pemuda',    'Ketua Pemuda', 1, { sayap: 'pemuda' }),
      jawatan('ketua_wanita',    'Ketua Wanita', 1, { sayap: 'wanita' }),
      jawatan('ketua_puteri',    'Ketua Puteri', 1, { sayap: 'puteri' }),
      jawatan('ahli_mkt',        'Ahli MKT', 25, { kumpulan: 'ajk' }),
      jawatan('setiausaha_kerja','Setiausaha Kerja Pusat', 1, { kumpulan: 'dilantik', dilantik: true })
    ]
  });

  function jumlahJawatan(peringkat) {
    return LEADERSHIP_STRUCTURE[peringkat].reduce(function (n, d) { return n + (d.bil || 0); }, 0);
  }

  function getLeadershipTemplate(peringkat) {
    if (!LEADERSHIP_STRUCTURE[peringkat]) { throw new Error('Peringkat tidak sah: ' + peringkat); }
    return LEADERSHIP_STRUCTURE[peringkat];
  }

  function deepFreeze(o) {
    Object.getOwnPropertyNames(o).forEach(function (k) {
      if (o[k] && typeof o[k] === 'object') { deepFreeze(o[k]); }
    });
    return Object.freeze(o);
  }

  /* ------------------------------------------------------------------------
     3. DATA FALLBACK (contoh, dipakai jika tiada internet dan tiada cache)
     Semua angka dan nama DUN/Lokaliti di sini ialah data contoh sahaja.
     Dilalukan melalui saluran pemprosesan yang sama seperti CSV sebenar.
     ------------------------------------------------------------------------ */
  var FALLBACK_SAMPLE = [
    // ID, Parlimen, DUN, Lokaliti, Jumlah Ahli, Lelaki, Bawah 40
    ['001/001/001', 'Padang Besar', 'DUN Contoh A', 'Cawangan Contoh 1', 188, 104, 71],
    ['001/001/002', 'Padang Besar', 'DUN Contoh A', 'Cawangan Contoh 2', 142, 79, 52],
    ['001/002/001', 'Padang Besar', 'DUN Contoh B', 'Cawangan Contoh 3', 215, 120, 90],
    ['085/001/001', 'Pekan', 'DUN Contoh C', 'Cawangan Contoh 4', 326, 181, 118],
    ['085/001/002', 'Pekan', 'DUN Contoh C', 'Cawangan Contoh 5', 97, 51, 33],
    ['085/002/001', 'Pekan', 'DUN Contoh D', 'Cawangan Contoh 6', 264, 139, 101],
    ['097/013/001', 'Selayang', 'Kuang', 'Pengkalan Kundang', 412, 236, 171],
    ['097/013/002', 'Selayang', 'Kuang', 'Taman Contoh Jaya', 233, 125, 98],
    ['097/013/003', 'Selayang', 'Kuang', 'Kampung Contoh Tengah', 121, 70, 40],
    ['097/014/001', 'Selayang', 'Rawang', 'Taman Contoh Seri', 351, 190, 160],
    ['097/014/002', 'Selayang', 'Rawang', 'Kampung Contoh Baru', 176, 95, 66],
    ['097/015/001', 'Selayang', 'Taman Templer', 'Cawangan Contoh 7', 298, 160, 124]
  ];

  function fallbackRows() {
    var rows = [['ID', 'Nama Parlimen', 'Nama DUN', 'Nama Lokaliti', 'Jumlah Ahli', '%', 'Lelaki', '%', 'Perempuan', '%', 'Bawah 40', '%', 'Atas 40']];
    FALLBACK_SAMPLE.forEach(function (s) {
      rows.push([s[0], s[1], s[2], s[3], String(s[4]), '', String(s[5]), '', String(s[4] - s[5]), '', String(s[6]), '', String(s[4] - s[6])]);
    });
    return rows;
  }

  /* ------------------------------------------------------------------------
     4. RAWAK BERBENIH (seed) supaya dunia permainan boleh dijana semula
     ------------------------------------------------------------------------ */
  function hashString(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createGameSeed() { return 'g' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

  /** seed kosong = rawak sebenar setiap kali. */
  function createRng(seed) {
    var s = (seed === undefined || seed === null) ? createGameSeed() : String(seed);
    return mulberry32(hashString(s));
  }

  function randInt(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function shuffle(rng, arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function normal(rng, mean, sd) {
    var u = 1 - rng(), v = rng();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function weightedPick(rng, items, weightFn) {
    var total = 0, ws = items.map(function (it) { var w = Math.max(0, weightFn(it)); total += w; return w; });
    if (total <= 0) { return items[Math.floor(rng() * items.length)]; }
    var r = rng() * total;
    for (var i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) { return items[i]; } }
    return items[items.length - 1];
  }

  /* ------------------------------------------------------------------------
     5. PARSER CSV + PEMBINA HIERARKI (Negeri > Parlimen > DUN > Lokaliti)
     ------------------------------------------------------------------------ */
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    var rows = [], row = [], field = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else { inQ = false; }
        } else { field += c; }
      } else if (c === '"') { inQ = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') { i++; }
        row.push(field); field = ''; rows.push(row); row = [];
      } else { field += c; }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (cell) { return String(cell).trim() !== ''; }); });
  }

  var ALIAS_LAJUR = {
    id:        ['id', 'kod', 'kodlokaliti'],
    parlimen:  ['namaparlimen', 'parlimen', 'namabahagian', 'bahagian'],
    dun:       ['namadun', 'dun'],
    lokaliti:  ['namalokaliti', 'lokaliti', 'namacawangan', 'cawangan'],
    jumlah:    ['jumlahahli', 'jumlah', 'ahli'],
    lelaki:    ['lelaki'],
    perempuan: ['perempuan'],
    bawah40:   ['bawah40', 'dibawah40', 'kurang40'],
    atas40:    ['atas40', 'diatas40'],
    negeri:    ['negeri']
  };
  // A=0, B=1, C=2, D=3, E=4, G=6, I=8, K=10, M=12
  var LAJUR_LALAI = { id: 0, parlimen: 1, dun: 2, lokaliti: 3, jumlah: 4, lelaki: 6, perempuan: 8, bawah40: 10, atas40: 12, negeri: -1 };
  var REGEX_ID = /^(\d{1,3})\s*\/\s*(\d{1,3})\s*\/\s*(\d{1,3})$/;

  function normHeader(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function pad3(s) { s = String(parseInt(s, 10)); while (s.length < 3) { s = '0' + s; } return s; }
  function slug(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
  }
  function nombor(v) {
    var n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/[^\d.-]/g, ''));
    return isFinite(n) ? Math.round(n) : 0;
  }
  function teks(row, i) { return i >= 0 && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : ''; }

  /** Cari baris tajuk (dalam 10 baris pertama) dan petakan lajur. Tanpa tajuk, guna kedudukan A-M. */
  function petakanLajur(rows) {
    var jumpa = -1, i;
    function ada(h, kunci) { return h.some(function (x) { return ALIAS_LAJUR[kunci].indexOf(x) > -1; }); }
    for (i = 0; i < Math.min(rows.length, 10); i++) {
      var h = rows[i].map(normHeader);
      if (ada(h, 'parlimen') && ada(h, 'lokaliti')) { jumpa = i; break; }
    }
    var tajuk = jumpa >= 0 ? rows[jumpa].map(normHeader) : [], idx = {};
    Object.keys(ALIAS_LAJUR).forEach(function (k) {
      idx[k] = -1;
      for (var j = 0; j < tajuk.length; j++) {
        if (ALIAS_LAJUR[k].indexOf(tajuk[j]) > -1) { idx[k] = j; break; }
      }
      if (idx[k] < 0) { idx[k] = LAJUR_LALAI[k]; }
    });
    return { idx: idx, mula: jumpa >= 0 ? jumpa + 1 : 0 };
  }

  /**
   * Tukar baris CSV kepada hierarki.
   * Pulangan: { negeri:[{id,nama,bahagian:[...]}], bahagian:[...], jumlah:{...} }
   * Setiap bahagian (Parlimen): { id, kod, nama, negeri, dun:[{id,kod,nama,cawangan:[...]}], cawangan:[...] }
   * Setiap cawangan (Lokaliti): { id, kod, nama, bahagianId, bahagianNama, dunId, dunNama, negeri,
   *                               jumlahAhli, lelaki, perempuan, bawah40, atas40, lokaliti:[] }
   */
  function rowsToHierarchy(rows) {
    if (!rows || !rows.length) { throw new Error('CSV kosong'); }
    var peta = petakanLajur(rows), idx = peta.idx;
    var parlimenMap = {}, senarai = [], dilihat = {}, bilCawangan = 0, jumlahAhli = 0;

    for (var r = peta.mula; r < rows.length; r++) {
      var row = rows[r];
      var m = REGEX_ID.exec(teks(row, idx.id));
      if (!m) { continue; }                                   // lompat baris jumlah, tajuk kedua, dsb.
      var kodP = pad3(m[1]), kodD = pad3(m[2]), kodL = pad3(m[3]);
      var id = kodP + '/' + kodD + '/' + kodL;
      if (dilihat[id]) { continue; }
      dilihat[id] = true;

      var p = parlimenMap[kodP];
      if (!p) {
        p = parlimenMap[kodP] = { id: kodP, kod: kodP, nama: '', negeri: '', _negeriSheet: '', dun: [], cawangan: [], _d: {} };
        senarai.push(p);
      }
      if (!p.nama) { p.nama = teks(row, idx.parlimen); }
      if (!p._negeriSheet) { p._negeriSheet = teks(row, idx.negeri); }

      var d = p._d[kodD];
      if (!d) {
        d = p._d[kodD] = { id: kodP + '/' + kodD, kod: kodD, nama: '', parlimenId: kodP, cawangan: [] };
        p.dun.push(d);
      }
      if (!d.nama) { d.nama = teks(row, idx.dun); }

      var lelaki = nombor(row[idx.lelaki]), perempuan = nombor(row[idx.perempuan]);
      var jumlah = nombor(row[idx.jumlah]) || (lelaki + perempuan);
      var c = {
        id: id, kod: kodL, nama: teks(row, idx.lokaliti) || ('Lokaliti ' + kodL),
        bahagianId: kodP, dunId: d.id,
        jumlahAhli: jumlah, lelaki: lelaki, perempuan: perempuan,
        bawah40: nombor(row[idx.bawah40]), atas40: nombor(row[idx.atas40]),
        lokaliti: []
      };
      d.cawangan.push(c);
      p.cawangan.push(c);
      bilCawangan++; jumlahAhli += jumlah;
    }

    if (!senarai.length) { throw new Error('Tiada baris sah. Lajur A mesti berformat 097/013/001'); }

    var negeriMap = {}, negeriList = [], bilDun = 0;
    senarai.sort(function (a, b) { return a.kod < b.kod ? -1 : 1; });
    senarai.forEach(function (p) {
      p.nama = p.nama || ('Parlimen ' + p.kod);
      p.negeri = p._negeriSheet || negeriDariKod(p.kod);
      delete p._negeriSheet; delete p._d;
      p.dun.sort(function (a, b) { return a.kod < b.kod ? -1 : 1; });
      p.dun.forEach(function (d) {
        d.nama = d.nama || ('DUN ' + d.kod);
        d.cawangan.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
        d.cawangan.forEach(function (c) {
          c.bahagianNama = p.nama; c.dunNama = d.nama; c.negeri = p.negeri;
        });
        bilDun++;
      });
      p.cawangan.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      var n = negeriMap[p.negeri];
      if (!n) { n = negeriMap[p.negeri] = { id: slug(p.negeri), nama: p.negeri, bahagian: [] }; negeriList.push(n); }
      n.bahagian.push(p);
    });

    return {
      negeri: negeriList,                                      // tertib mengikut kod Parlimen terendah
      bahagian: senarai,
      jumlah: { negeri: negeriList.length, bahagian: senarai.length, dun: bilDun, cawangan: bilCawangan, ahli: jumlahAhli }
    };
  }

  /** Cari cawangan melalui ID penuh (cth. '097/013/001'). */
  function findCawangan(data, id) {
    if (!data._indeks) {
      var idx = {};
      data.bahagian.forEach(function (b) { b.cawangan.forEach(function (c) { idx[c.id] = c; }); });
      Object.defineProperty(data, '_indeks', { value: idx, enumerable: false });
    }
    return data._indeks[id] || null;
  }

  /* ------------------------------------------------------------------------
     6. FETCH GOOGLE SHEETS (async/await) + CACHE + FALLBACK
     ------------------------------------------------------------------------ */
  async function fetchSheetCSV(url, timeoutMs) {
    var ms = timeoutMs || CONFIG.FETCH_TIMEOUT_MS;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
    try {
      var res = await fetch(url, { signal: ctrl ? ctrl.signal : undefined, cache: 'no-store' });
      if (!res.ok) { throw new Error('HTTP ' + res.status); }
      var text = await res.text();
      if (!text || /^\s*<(!doctype|html)/i.test(text)) {
        throw new Error('Respons bukan CSV. Semak bahawa sheet sudah di-Publish to web dalam format CSV');
      }
      return text;
    } catch (e) {
      if (e && e.name === 'AbortError') { throw new Error('Masa tamat selepas ' + (ms / 1000) + ' saat'); }
      throw e;
    } finally {
      if (timer) { clearTimeout(timer); }
    }
  }

  function cacheWrite(url, csv) {
    try {
      if (typeof localStorage === 'undefined') { return; }
      localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ url: url, simpanPada: Date.now(), csv: csv }));
    } catch (e) { /* storan penuh atau disekat: abaikan */ }
  }

  function cacheRead(url) {
    try {
      if (typeof localStorage === 'undefined') { return null; }
      var raw = localStorage.getItem(CONFIG.CACHE_KEY);
      if (!raw) { return null; }
      var o = JSON.parse(raw);
      return (o && o.url === url && typeof o.csv === 'string') ? o : null;
    } catch (e) { return null; }
  }

  /**
   * Muat data parti.
   * opts: { url, timeoutMs, paksaFallback }
   * Pulangan: { source: 'sheet' | 'cache' | 'fallback', negeri, bahagian, jumlah, amaran:[], dimuatPada }
   * Urutan: Google Sheets -> CSV cache terakhir -> data contoh terbina dalam.
   */
  async function loadPartyData(opts) {
    opts = opts || {};
    var url = opts.url || CONFIG.SHEET_CSV_URL;
    var hasil = { source: 'fallback', amaran: [], dimuatPada: Date.now() }, h = null;

    if (!opts.paksaFallback) {
      if (!url) {
        hasil.amaran.push('URL Google Sheets belum ditetapkan.');
      } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        hasil.amaran.push('Tiada sambungan internet.');
      } else {
        try {
          var csv = await fetchSheetCSV(url, opts.timeoutMs);
          h = rowsToHierarchy(parseCSV(csv));
          hasil.source = 'sheet';
          cacheWrite(url, csv);
        } catch (e) {
          hasil.amaran.push('Gagal mengambil Google Sheets: ' + (e && e.message ? e.message : e));
        }
      }
      if (!h && url) {
        var c = cacheRead(url);
        if (c) {
          try {
            h = rowsToHierarchy(parseCSV(c.csv));
            hasil.source = 'cache';
            hasil.amaran.push('Menggunakan salinan tersimpan pada ' + new Date(c.simpanPada).toLocaleString('ms-MY') + '.');
          } catch (e) { h = null; }
        }
      }
    }

    if (!h) { h = rowsToHierarchy(fallbackRows()); hasil.source = 'fallback'; }
    hasil.negeri = h.negeri; hasil.bahagian = h.bahagian; hasil.jumlah = h.jumlah;
    return hasil;
  }

  function getFallbackData() { return rowsToHierarchy(fallbackRows()); }

  /* ------------------------------------------------------------------------
     7. PENJANA AHLI CAWANGAN
     ------------------------------------------------------------------------ */
  var NAMA_LELAKI = ['Ahmad', 'Muhammad', 'Mohd', 'Abdul', 'Hasan', 'Hussein', 'Ismail', 'Ibrahim', 'Yusof', 'Zulkifli',
    'Azman', 'Faizal', 'Hafiz', 'Khairul', 'Rosli', 'Shahrul', 'Syafiq', 'Aizat', 'Amirul', 'Danial', 'Fauzi', 'Hakim',
    'Kamal', 'Latif', 'Mazlan', 'Nasir', 'Omar', 'Rahim', 'Salleh', 'Taufik', 'Zainal', 'Razak', 'Samad', 'Jamal',
    'Harun', 'Idris', 'Azlan', 'Roslan', 'Shamsul', 'Badrul'];
  var NAMA_LELAKI_2 = ['Faiz', 'Hafiz', 'Amir', 'Iskandar', 'Aiman', 'Zaki', 'Shafiq', 'Redzuan', 'Hanafi', 'Izzat',
    'Farhan', 'Syukri', 'Afiq', 'Adli', 'Nazmi', 'Hilmi', 'Rizal', 'Azri', 'Fitri', 'Luqman'];
  var NAMA_PEREMPUAN = ['Nur', 'Siti', 'Nor', 'Noraini', 'Aishah', 'Fatimah', 'Zainab', 'Halimah', 'Rohani', 'Salmah',
    'Normah', 'Rosnah', 'Mariam', 'Khadijah', 'Asmah', 'Aminah', 'Habsah', 'Zaleha', 'Rokiah', 'Sharifah', 'Nurul',
    'Farah', 'Aina', 'Balqis', 'Hidayah', 'Izzati', 'Liyana', 'Syuhada', 'Wardah', 'Yasmin'];
  var NAMA_PEREMPUAN_2 = ['Aisyah', 'Huda', 'Ain', 'Atiqah', 'Batrisyia', 'Husna', 'Izzah', 'Nabilah', 'Nadia', 'Najwa',
    'Sofea', 'Syazwani', 'Zulaikha', 'Amalina', 'Farhana', 'Hanis', 'Dayana', 'Alia', 'Syafiqah', 'Suhana'];

  function janaNama(rng, jantina) {
    var bapa = pick(rng, NAMA_LELAKI);
    if (jantina === 'L') {
      return pick(rng, NAMA_LELAKI) + ' ' + pick(rng, NAMA_LELAKI_2) + ' bin ' + bapa;
    }
    return pick(rng, NAMA_PEREMPUAN) + ' ' + pick(rng, NAMA_PEREMPUAN_2) + ' binti ' + bapa;
  }

  /**
   * Berat demografi daripada angka Sheet. Lelaki/Perempuan dan Bawah/Atas 40 dianggap
   * tidak bersandar: Pemuda = lelaki bawah 40, Puteri = perempuan bawah 40,
   * Wanita = perempuan atas 40, Veteran = lelaki atas 40. Pulang null jika data tiada.
   */
  function bobotDemografi(c) {
    var jk = (c.lelaki || 0) + (c.perempuan || 0), um = (c.bawah40 || 0) + (c.atas40 || 0);
    if (jk <= 0 || um <= 0) { return null; }
    var pL = c.lelaki / jk, pU = c.bawah40 / um;
    return { pemuda: pL * pU, puteri: (1 - pL) * pU, wanita: (1 - pL) * (1 - pU), veteran: pL * (1 - pU) };
  }

  /** Agihan bilangan ikut demografi: minimum terjamin + baki ikut berat. */
  function agihDemografi(n, rng, bobot) {
    var keys = Object.keys(DEMOGRAFI), counts = {}, w = {}, totalW = 0, baki = n;
    keys.forEach(function (k) {
      counts[k] = DEMOGRAFI[k].minBil; baki -= counts[k];
      var asas = bobot ? bobot[k] : DEMOGRAFI[k].berat;
      w[k] = asas * (bobot ? 0.9 + rng() * 0.2 : 0.7 + rng() * 0.6);
      totalW += w[k];
    });
    var guna = 0, pecahan = [];
    keys.forEach(function (k) {
      var share = baki * w[k] / totalW, asas = Math.floor(share);
      counts[k] += asas; guna += asas; pecahan.push([k, share - asas]);
    });
    pecahan.sort(function (a, b) { return b[1] - a[1]; });
    for (var i = 0; guna < baki; i++, guna++) { counts[pecahan[i % pecahan.length][0]]++; }
    return counts;
  }

  function janaAhli(rng, demografi) {
    var d = DEMOGRAFI[demografi];
    var p = weightedPick(rng, d.profil, function (x) { return x.w; });
    var umur = randInt(rng, p.umur[0], p.umur[1]);
    return {
      jantina: p.jantina,
      umur: umur,
      demografi: demografi,
      demografiLabel: d.label,
      pengaruh: clamp(Math.round(normal(rng, 30, 12) + (umur - 30) * 0.25), 5, 95),
      loyalti: randInt(rng, 35, 95)
    };
  }

  /**
   * Jana ahli bagi satu cawangan (Lokaliti). Minimum 50 orang.
   * Bilangan = Jumlah Ahli dalam Sheet (dihadkan 50..MAX_AHLI_CAWANGAN), atau rawak jika tiada.
   * Pecahan demografi mengikut angka Lelaki/Perempuan dan Bawah/Atas 40 dalam Sheet.
   * opts: { seed, rng, jumlah }. Seed yang sama menghasilkan ahli yang sama.
   */
  function generateAhliCawangan(cawangan, opts) {
    opts = opts || {};
    var rng = opts.rng || createRng(opts.seed === undefined ? null : opts.seed + '|ahli|' + cawangan.id);
    var sasaran = opts.jumlah || cawangan.jumlahAhli || randInt(rng, CONFIG.JULAT_AHLI_RAWAK[0], CONFIG.JULAT_AHLI_RAWAK[1]);
    var n = clamp(Math.round(sasaran), CONFIG.MIN_AHLI_CAWANGAN, CONFIG.MAX_AHLI_CAWANGAN);

    var counts = agihDemografi(n, rng, bobotDemografi(cawangan)), ahli = [], namaDigunakan = {};
    Object.keys(counts).forEach(function (k) {
      for (var i = 0; i < counts[k]; i++) {
        var a = janaAhli(rng, k);
        for (var t = 0; t < 6; t++) {
          a.nama = janaNama(rng, a.jantina);
          if (!namaDigunakan[a.nama]) { break; }
        }
        namaDigunakan[a.nama] = true;
        ahli.push(a);
      }
    });
    shuffle(rng, ahli);

    var lok = cawangan.lokaliti || [];
    var bagiLokaliti = lok.map(function () { return 0.5 + rng(); });
    ahli.forEach(function (a, i) {
      var seq = String(i + 1); while (seq.length < 3) { seq = '0' + seq; }
      a.id = cawangan.id + '#' + seq;
      a.noAhli = a.id;
      a.cawanganId = cawangan.id;
      a.bahagianId = cawangan.bahagianId || opts.bahagianId || null;
      a.dunId = cawangan.dunId || null;
      if (lok.length) {
        var l = weightedPick(rng, lok.map(function (x, j) { return { x: x, w: bagiLokaliti[j] }; }), function (o) { return o.w; }).x;
        a.lokalitiId = l.id; a.lokalitiNama = l.nama;
      } else { a.lokalitiId = null; a.lokalitiNama = null; }
      a.jawatan = { cawangan: 'Ahli Biasa', bahagian: null, pusat: null };
    });
    return ahli;
  }

  /* ------------------------------------------------------------------------
     8. PENGISIAN KEPIMPINAN
     Setiap peringkat mengisi jawatan daripada senarai "tier" calon:
     tier pertama diutamakan, tier seterusnya dipakai jika calon habis.
     Calon berpengaruh tinggi lebih berpeluang dipilih. Jawatan sayap hanya
     boleh diisi ahli demografi sayap tersebut. Jawatan "dilantik" (Setiausaha
     Kerja) dipilih secara rawak biasa.
     ------------------------------------------------------------------------ */
  function keutamaanSlot(def) {
    if (def.sayap) { return 0; }
    if (def.kumpulan === 'utama') { return 1; }
    if (def.kumpulan === 'ajk') { return 2; }
    return 3;
  }

  function expandSlots(peringkat) {
    var out = [];
    LEADERSHIP_STRUCTURE[peringkat].forEach(function (def) {
      if (def.bil === null) { return; }
      for (var i = 0; i < def.bil; i++) {
        out.push({
          peringkat: peringkat, kod: def.kod,
          jawatan: def.bil > 1 ? def.jawatan + ' ' + (i + 1) : def.jawatan,
          jawatanAsas: def.jawatan,
          kumpulan: def.kumpulan, sayap: def.sayap, dilantik: def.dilantik,
          keutamaan: keutamaanSlot(def),
          ahliId: null, nama: null, kosong: true
        });
      }
    });
    return out;
  }

  function pilihCalon(tiers, slot, digunakan, rng) {
    for (var t = 0; t < tiers.length; t++) {
      var calon = tiers[t].filter(function (c) {
        return !digunakan[c.id] && (!slot.sayap || c.demografi === slot.sayap);
      });
      if (calon.length) {
        return weightedPick(rng, calon, function (c) { return slot.dilantik ? 1 : Math.pow(c.pengaruh, 1.5) + 1; });
      }
    }
    return null;
  }

  /**
   * Isi semua jawatan satu peringkat.
   * peringkat: 'cawangan' | 'bahagian' | 'pusat'
   * tiers: array of array ahli (calon)
   * Pulangan: { peringkat, slots:[...], bilKosong }
   * Nota: medan ahli.jawatan[peringkat] dikemas kini pada objek ahli.
   */
  function fillLeadership(peringkat, tiers, opts) {
    opts = opts || {};
    var rng = opts.rng || createRng(opts.seed);
    var slots = expandSlots(peringkat), digunakan = {};
    var turutan = slots.map(function (s, i) { return i; }).sort(function (a, b) {
      return (slots[a].keutamaan - slots[b].keutamaan) || (a - b);
    });
    turutan.forEach(function (i) {
      var s = slots[i], c = pilihCalon(tiers, s, digunakan, rng);
      if (c) {
        digunakan[c.id] = true;
        s.ahliId = c.id; s.nama = c.nama; s.kosong = false;
        c.jawatan[peringkat] = s.jawatan;
      }
    });
    return {
      peringkat: peringkat,
      slots: slots,
      bilKosong: slots.filter(function (s) { return s.kosong; }).length
    };
  }

  function buildCawanganLeadership(ahli, opts) {
    var kep = fillLeadership('cawangan', [ahli], opts);
    kep.bilAhliBiasa = ahli.length - kep.slots.filter(function (s) { return !s.kosong; }).length;
    return kep;
  }

  /** Kumpul calon peringkat atas daripada kepimpinan peringkat bawah. */
  function calonDariKepimpinan(senaraiKep, indeksAhli, semuaAhli) {
    var utama = [], ajk = [], lain = [], ada = {};
    senaraiKep.forEach(function (kep) {
      kep.slots.forEach(function (s) {
        if (s.kosong || ada[s.ahliId]) { return; }
        ada[s.ahliId] = true;
        var m = indeksAhli[s.ahliId];
        if (!m) { return; }
        if (s.kumpulan === 'utama') { utama.push(m); }
        else if (s.kumpulan === 'ajk') { ajk.push(m); }
        else { lain.push(m); }
      });
    });
    var baki = semuaAhli.filter(function (m) { return !ada[m.id]; });
    return [utama, ajk, lain.concat(baki)];
  }

  function indeksKan(ahli) {
    var idx = {};
    ahli.forEach(function (m) { idx[m.id] = m; });
    return idx;
  }

  /** bahagian: { cawangan: [{ ahli, kepimpinan }] }. Calon utama ialah pemimpin cawangan. */
  function buildBahagianLeadership(bahagian, opts) {
    var semua = [];
    bahagian.cawangan.forEach(function (c) { semua = semua.concat(c.ahli); });
    var tiers = calonDariKepimpinan(
      bahagian.cawangan.map(function (c) { return c.kepimpinan; }), indeksKan(semua), semua);
    return fillLeadership('bahagian', tiers, opts);
  }

  /** senaraiBahagian: bahagian yang sudah ada kepimpinan. Calon utama ialah pemimpin bahagian. */
  function buildPusatLeadership(senaraiBahagian, opts) {
    var semua = [];
    senaraiBahagian.forEach(function (b) {
      b.cawangan.forEach(function (c) { semua = semua.concat(c.ahli); });
    });
    var tiers = calonDariKepimpinan(
      senaraiBahagian.map(function (b) { return b.kepimpinan; }), indeksKan(semua), semua);
    return fillLeadership('pusat', tiers, opts);
  }

  /* ------------------------------------------------------------------------
     9. DUNIA PERMAINAN PENUH
     ------------------------------------------------------------------------ */
  /**
   * Bina dunia: ahli semua cawangan dan kepimpinan tiga peringkat.
   * data: hasil loadPartyData()
   * opts: { seed, bahagianId: ['097', ...] }
   * Nota: bilangan cawangan seluruh negara sangat besar. Hadkan dengan
   * opts.bahagianId, atau panggil generateAhliCawangan() apabila cawangan dibuka.
   */
  function buildPartyWorld(data, opts) {
    opts = opts || {};
    var seed = opts.seed !== undefined && opts.seed !== null ? opts.seed : createGameSeed();
    var sumber = Array.isArray(data) ? data : data.bahagian;
    var pilih = opts.bahagianId && opts.bahagianId.length ? opts.bahagianId : null;

    var world = {
      seed: seed, source: Array.isArray(data) ? 'manual' : data.source,
      amaran: Array.isArray(data) ? [] : (data.amaran || []),
      bahagian: [], pusat: null, ringkasan: null
    };

    sumber.forEach(function (b) {
      if (pilih && pilih.indexOf(b.id) < 0) { return; }
      var nb = { id: b.id, kod: b.kod || null, nama: b.nama, negeri: b.negeri, cawangan: [] };
      b.cawangan.forEach(function (c) {
        var ahli = generateAhliCawangan(c, { seed: seed });
        var salin = {};
        for (var k in c) { salin[k] = c[k]; }
        salin.ahli = ahli;
        salin.kepimpinan = buildCawanganLeadership(ahli, { seed: seed + '|kep|' + c.id });
        nb.cawangan.push(salin);
      });
      nb.kepimpinan = buildBahagianLeadership(nb, { seed: seed + '|kep|' + nb.id });
      world.bahagian.push(nb);
    });

    world.pusat = buildPusatLeadership(world.bahagian, { seed: seed + '|kep|pusat' });
    world.ringkasan = ringkasKan(world);
    return world;
  }

  function ringkasKan(world) {
    var r = { bahagian: world.bahagian.length, cawangan: 0, ahli: 0, demografi: {}, jawatanKosong: { cawangan: 0, bahagian: 0, pusat: world.pusat ? world.pusat.bilKosong : 0 } };
    Object.keys(DEMOGRAFI).forEach(function (k) { r.demografi[k] = 0; });
    world.bahagian.forEach(function (b) {
      r.jawatanKosong.bahagian += b.kepimpinan.bilKosong;
      b.cawangan.forEach(function (c) {
        r.cawangan++; r.ahli += c.ahli.length;
        r.jawatanKosong.cawangan += c.kepimpinan.bilKosong;
        c.ahli.forEach(function (a) { r.demografi[a.demografi]++; });
      });
    });
    return r;
  }

  /* ------------------------------------------------------------------------
     10. API AWAM
     ------------------------------------------------------------------------ */
  return {
    CONFIG: CONFIG,
    DEMOGRAFI: DEMOGRAFI,
    LEADERSHIP_STRUCTURE: LEADERSHIP_STRUCTURE,
    jumlahJawatan: jumlahJawatan,
    getLeadershipTemplate: getLeadershipTemplate,
    tentukanDemografi: tentukanDemografi,
    negeriDariKod: negeriDariKod,

    // data sumber
    loadPartyData: loadPartyData,
    fetchSheetCSV: fetchSheetCSV,
    parseCSV: parseCSV,
    rowsToHierarchy: rowsToHierarchy,
    getFallbackData: getFallbackData,
    findCawangan: findCawangan,

    // penjana
    createRng: createRng,
    createGameSeed: createGameSeed,
    generateAhliCawangan: generateAhliCawangan,

    // kepimpinan
    fillLeadership: fillLeadership,
    buildCawanganLeadership: buildCawanganLeadership,
    buildBahagianLeadership: buildBahagianLeadership,
    buildPusatLeadership: buildPusatLeadership,
    buildPartyWorld: buildPartyWorld
  };
});