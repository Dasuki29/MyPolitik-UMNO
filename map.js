/* ==========================================================================
   MyPolitik: UMNO — js/map.js
   Peta Interaktif 3 Mod:
     1. Peta Negeri        — kekuatan parti dan sokongan, 14 negeri
     2. Peta Bahagian      — status lobi perwakilan, semua bahagian (parlimen)
     3. Peta PDM/Lokaliti  — paparan mikro peringkat cawangan; menyokong peta SVG
                             kustom melalui loadCustomPDMMap('assets/maps/fail.svg')

   Peta dilukis sebagai peta jubin (cartogram), bukan sempadan sebenar, supaya semua
   kawasan sama besar dan mudah diklik di telefon. Peta SVG kustom (PDM) menggantikan
   grid cawangan apabila dimuatkan.

   14 negeri = 13 negeri + Wilayah Persekutuan (KL, Putrajaya, Labuan digabung).

   Cara guna (dashboard.html):
     <div id="peta" data-mypolitik-map></div>            <- dipasang automatik
     <script src="js/data.js"></script> <script src="js/save.js"></script>
     <script src="js/election.js"></script> <script src="js/map.js"></script>
   atau:
     var peta = await MyPolitikMap.mount(document.getElementById('peta'), { mode: 'negeri' });
     peta.setMode('bahagian');  peta.pilih('bahagian', '097');
     MyPolitikMap.loadCustomPDMMap('assets/maps/p097.svg');   // PDM kustom untuk bahagian aktif

   Data kawasan datang daripada js/data.js (loadPartyData). Nilai sokongan ialah nilai
   asas berbenih (tetap bagi setiap permainan) ditambah kesan Lobi/Jelajah pemain, yang
   disimpan dalam profil.peta melalui MyPolitikSave.applyEffects (kemas kini masa nyata).
   Acara 'myPolitik:map-action' dihantar pada document selepas setiap tindakan.
   ========================================================================== */
(function (root, factory) {
  function cari(nama, fail) {
    if (root[nama]) { return root[nama]; }
    if (typeof module === 'object' && typeof require === 'function') {
      try { return require('./' + fail); } catch (e) { return null; }
    }
    return null;
  }
  var api = factory(root, cari('MyPolitikSave', 'save.js'), cari('MyPolitikData', 'data.js'),
    cari('MyPolitikElection', 'election.js'));
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikMap = api;
  root.loadCustomPDMMap = api.loadCustomPDMMap;           // nama fungsi seperti diminta
  if (root.document && api.autoMount) {
    var mula = function () { api.autoMount(); };
    if (root.document.readyState === 'loading') { root.document.addEventListener('DOMContentLoaded', mula); }
    else { setTimeout(mula, 0); }
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root, S, D, E) {
  'use strict';

  /* ------------------------------------------------------------------------
     1. TETAPAN
     ------------------------------------------------------------------------ */
  var CONFIG = {
    FOLDER_PETA: 'assets/maps/',
    PERWAKILAN_CAWANGAN: 5,                 // perwakilan cawangan ke Bahagian
    PERWAKILAN_BAHAGIAN: 10,                // perwakilan bahagian ke PAU
    HAD_TINDAKAN_SETAHUN: 3,                // setiap jenis tindakan, setiap kawasan, setahun
    HAD_BONUS: 30,                          // had mata bonus setiap kawasan
    KESAN_BONUS_BAHAGIAN_KE_CAWANGAN: 0.6,  // bonus bahagian meresap ke cawangan di bawahnya
    KESAN_BONUS_NEGERI_KE_CAWANGAN: 0.3,
    GAUN_RUMAH: 0.4,                        // kawasan sendiri: campur dengan kesetiaan akar umbi
    AMBANG: [35, 48, 60, 75]                // sempadan lima tahap
  };

  var TAHAP_LABEL = {
    sokongan: ['Sangat Lemah', 'Lemah', 'Sederhana', 'Kukuh', 'Sangat Kukuh'],
    lobi: ['Menentang', 'Belum Yakin', 'Condong Sokong', 'Menyokong', 'Terjamin']
  };
  var WARNA = ['#353B4A', '#6A2C3E', '#9D1E37', '#D4152F', '#F2B705'];   // kelabu > merah > emas
  var TAHAP_NAMA = { negeri: 'Negeri', bahagian: 'Bahagian', cawangan: 'Cawangan' };

  /** 14 negeri; pos = [lajur, baris] pada peta jubin. */
  var NEGERI14 = [
    { kod: 'perlis',    nama: 'Perlis',              pendek: 'PLS', pos: [0, 0] },
    { kod: 'kedah',     nama: 'Kedah',               pendek: 'KDH', pos: [0, 1] },
    { kod: 'kelantan',  nama: 'Kelantan',            pendek: 'KTN', pos: [2, 1] },
    { kod: 'terengganu', nama: 'Terengganu',         pendek: 'TRG', pos: [3, 1] },
    { kod: 'pulaupinang', nama: 'Pulau Pinang',      pendek: 'PNG', pos: [0, 2] },
    { kod: 'perak',     nama: 'Perak',               pendek: 'PRK', pos: [1, 2] },
    { kod: 'pahang',    nama: 'Pahang',              pendek: 'PHG', pos: [2, 2] },
    { kod: 'selangor',  nama: 'Selangor',            pendek: 'SGR', pos: [1, 3] },
    { kod: 'wp',        nama: 'Wilayah Persekutuan', pendek: 'WP',  pos: [2, 3] },
    { kod: 'n9',        nama: 'Negeri Sembilan',     pendek: 'N9',  pos: [1, 4] },
    { kod: 'melaka',    nama: 'Melaka',              pendek: 'MLK', pos: [1, 5] },
    { kod: 'johor',     nama: 'Johor',               pendek: 'JHR', pos: [2, 5] },
    { kod: 'sarawak',   nama: 'Sarawak',             pendek: 'SWK', pos: [5, 3] },
    { kod: 'sabah',     nama: 'Sabah',               pendek: 'SBH', pos: [6, 2] }
  ];

  /** Tindakan pada kawasan. kos/bonus/ip/kesetiaan mengikut peringkat. */
  var TINDAKAN = {
    lobi: {
      nama: 'Lobi Kawasan Ini',
      kos:  { negeri: { ap: 2, myr: 1500 }, bahagian: { ap: 1, myr: 500 }, cawangan: { ap: 1, myr: 200 } },
      bonus: { negeri: 4, bahagian: 6, cawangan: 8 },
      ip: { negeri: 2, bahagian: 2, cawangan: 1 },
      kesetiaan: { negeri: { perwakilan: 1 }, bahagian: { perwakilan: 2 }, cawangan: { ajk: 2 } }
    },
    jelajah: {
      nama: 'Anjur Jelajah',
      kos:  { negeri: { ap: 3, myr: 2000 }, bahagian: { ap: 2, myr: 800 }, cawangan: { ap: 1, myr: 300 } },
      bonus: { negeri: 5, bahagian: 8, cawangan: 10 },
      ip: { negeri: 8, bahagian: 5, cawangan: 3 },
      kesetiaan: { negeri: { akarUmbi: 2 }, bahagian: { akarUmbi: 3 }, cawangan: { akarUmbi: 4 } }
    }
  };
  var KUNCI = { negeri: 'N', bahagian: 'B', cawangan: 'C' };

  /* ------------------------------------------------------------------------
     2. PEMBANTU
     ------------------------------------------------------------------------ */
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function fmt(n) { return Number(n || 0).toLocaleString('ms-MY'); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function slug(s) { return norm(s).replace(/ /g, '-'); }
  function rngBerbenih(seed) {
    if (S && S.rngBerbenih) { return S.rngBerbenih(seed); }
    var h = 2166136261, i, str = String(seed);
    for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    var a = h >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Padankan nama negeri daripada sheet kepada salah satu daripada 14 negeri. */
  function padanNegeri(nama) {
    var n = norm(nama), k = null;
    if (/perlis/.test(n)) { k = 'perlis'; }
    else if (/kedah/.test(n)) { k = 'kedah'; }
    else if (/kelantan/.test(n)) { k = 'kelantan'; }
    else if (/terengganu/.test(n)) { k = 'terengganu'; }
    else if (/pinang/.test(n)) { k = 'pulaupinang'; }
    else if (/perak/.test(n)) { k = 'perak'; }
    else if (/pahang/.test(n)) { k = 'pahang'; }
    else if (/selangor/.test(n)) { k = 'selangor'; }
    else if (/wilayah|kuala lumpur|putrajaya|labuan|^wp\b/.test(n)) { k = 'wp'; }
    else if (/sembilan|^n9$|negeri 9/.test(n)) { k = 'n9'; }
    else if (/melaka|malacca/.test(n)) { k = 'melaka'; }
    else if (/johor/.test(n)) { k = 'johor'; }
    else if (/sabah/.test(n)) { k = 'sabah'; }
    else if (/sarawak/.test(n)) { k = 'sarawak'; }
    if (!k) { return null; }
    for (var i = 0; i < NEGERI14.length; i++) { if (NEGERI14[i].kod === k) { return NEGERI14[i]; } }
    return null;
  }

  function tahapIndeks(peratus) {
    var a = CONFIG.AMBANG;
    return peratus < a[0] ? 0 : peratus < a[1] ? 1 : peratus < a[2] ? 2 : peratus < a[3] ? 3 : 4;
  }
  /** Label tahap. jenis: 'sokongan' atau 'lobi'. */
  function tahapSokongan(peratus, jenis) {
    var i = tahapIndeks(peratus);
    return { indeks: i, label: TAHAP_LABEL[jenis || 'sokongan'][i], warna: WARNA[i] };
  }

  /* ------------------------------------------------------------------------
     3. MODEL KAWASAN (daripada data.js)
     ------------------------------------------------------------------------ */
  /**
   * Bina model negeri > bahagian > cawangan daripada hierarki data.js.
   * Nilai asas (kekuatan parti) berbenih mengikut seed supaya tetap sepanjang permainan.
   */
  function binaModel(data, seed) {
    seed = seed || 'mypolitik';
    var m = { negeri: [], bahagian: [], cawangan: [], idxN: {}, idxB: {}, idxC: {}, seed: seed };

    NEGERI14.forEach(function (d) {
      var r = rngBerbenih(seed + '|N|' + d.kod);
      var n = { tahap: 'negeri', id: d.kod, kod: d.kod, nama: d.nama, pendek: d.pendek, pos: d.pos,
        bahagian: [], offset: 38 + r() * 24 };
      m.negeri.push(n); m.idxN[d.kod] = n;
    });

    ((data && data.negeri) || []).forEach(function (nd) {
      var def = padanNegeri(nd.nama), n;
      if (def) { n = m.idxN[def.kod]; }
      else {
        var lk = 'lain-' + slug(nd.nama);
        n = m.idxN[lk];
        if (!n) {
          n = { tahap: 'negeri', id: lk, kod: lk, nama: nd.nama || 'Lain-lain', pendek: '?', pos: null,
            bahagian: [], offset: 50 };
          m.negeri.push(n); m.idxN[lk] = n;
        }
      }
      (nd.bahagian || []).forEach(function (bd) {
        var rb = rngBerbenih(seed + '|B|' + bd.id);
        var b = { tahap: 'bahagian', id: bd.id, kod: bd.kod || bd.id, nama: bd.nama, negeri: n,
          cawangan: [], dun: [], offsetB: (rb() - 0.5) * 16 };
        (bd.dun || []).forEach(function (dd) {
          var dun = { id: dd.id, nama: dd.nama, cawangan: [] };
          (dd.cawangan || []).forEach(function (cd) {
            var rc = rngBerbenih(seed + '|C|' + cd.id);
            var c = { tahap: 'cawangan', id: cd.id, idSheet: cd.idSheet || cd.id, kod: cd.kod, nama: cd.nama,
              dunNama: dd.nama, jumlahAhli: cd.jumlahAhli || 0, lelaki: cd.lelaki, perempuan: cd.perempuan,
              bahagian: b, negeri: n,
              asas: clamp(n.offset + b.offsetB + (rc() - 0.5) * 20, 15, 90) };
            dun.cawangan.push(c); b.cawangan.push(c); m.cawangan.push(c);
            m.idxC[c.id] = c; if (c.idSheet) { m.idxC[c.idSheet] = c; }
          });
          b.dun.push(dun);
        });
        n.bahagian.push(b); m.bahagian.push(b); m.idxB[b.id] = b;
      });
    });
    return m;
  }

  function cariRumah(m, profil) {
    var r = { cawangan: null, bahagian: null, negeri: null };
    if (!profil) { return r; }
    var c = m.idxC[profil.id];
    if (!c && profil.kod) {
      c = m.idxC[[profil.kod.parlimen, profil.kod.dun, profil.kod.lokaliti].join('/')];
    }
    if (c) { r.cawangan = c; r.bahagian = c.bahagian; r.negeri = c.negeri; }
    return r;
  }

  /** Kira semula sokongan (kesan usaha pemain) dan kekuatan parti (asas) untuk semua kawasan. */
  function kira(m, profil) {
    var peta = (profil && profil.peta) || {}, bonus = peta.bonus || {};
    var rumah = cariRumah(m, profil);
    m.rumah = rumah;
    var akarUmbi = profil && profil.kesetiaan ? profil.kesetiaan.akarUmbi : 50;

    m.negeri.forEach(function (n) {
      var bn = bonus['N:' + n.id] || 0, sN = 0, kN = 0, wN = 0, ahliN = 0, cawN = 0, perwN = 0;
      n.bonusSendiri = bn;
      n.bahagian.forEach(function (b) {
        var bb = bonus['B:' + b.id] || 0, sB = 0, kB = 0, wB = 0, ahliB = 0;
        b.bonusSendiri = bb;
        b.cawangan.forEach(function (c) {
          var bc = bonus['C:' + c.id] || 0;
          var tambah = bc + bb * CONFIG.KESAN_BONUS_BAHAGIAN_KE_CAWANGAN + bn * CONFIG.KESAN_BONUS_NEGERI_KE_CAWANGAN;
          var eff = clamp(c.asas + tambah, 0, 100);
          if (rumah.cawangan === c) { eff = eff * (1 - CONFIG.GAUN_RUMAH) + akarUmbi * CONFIG.GAUN_RUMAH; }
          c.bonusSendiri = bc; c.tambah = Math.round(tambah);
          c.sokonganRaw = eff; c.sokongan = Math.round(eff); c.kekuatan = Math.round(c.asas);
          c.perwakilan = CONFIG.PERWAKILAN_CAWANGAN; c.perwakilanPAU = 0;
          var w = Math.max(1, c.jumlahAhli);
          sB += eff * w; kB += c.asas * w; wB += w; ahliB += c.jumlahAhli;
        });
        b.jumlahAhli = ahliB; b.bilCawangan = b.cawangan.length;
        b.sokonganRaw = wB ? sB / wB : 0; b.sokongan = Math.round(b.sokonganRaw);
        b.kekuatan = wB ? Math.round(kB / wB) : 0;
        b.tambah = Math.round(b.cawangan.length ? b.cawangan.reduce(function (a, c) { return a + c.tambah; }, 0) / b.cawangan.length : bb);
        b.perwakilan = b.bilCawangan * CONFIG.PERWAKILAN_CAWANGAN; b.perwakilanPAU = CONFIG.PERWAKILAN_BAHAGIAN;
        sN += b.sokonganRaw * Math.max(1, b.jumlahAhli); kN += b.kekuatan * Math.max(1, b.jumlahAhli);
        wN += Math.max(1, b.jumlahAhli); ahliN += b.jumlahAhli; cawN += b.bilCawangan; perwN += b.perwakilan;
      });
      n.jumlahAhli = ahliN; n.bilCawangan = cawN; n.bilBahagian = n.bahagian.length;
      n.sokongan = wN ? Math.round(sN / wN) : 0; n.kekuatan = wN ? Math.round(kN / wN) : 0;
      n.tambah = Math.round(n.bahagian.length ? n.bahagian.reduce(function (a, b) { return a + b.tambah; }, 0) / n.bahagian.length : bn);
      n.perwakilan = perwN; n.perwakilanPAU = n.bilBahagian * CONFIG.PERWAKILAN_BAHAGIAN;
      n.adaData = n.bahagian.length > 0;
    });
    return m;
  }

  function dapatkanNod(m, tahap, id) {
    return (tahap === 'negeri' ? m.idxN : tahap === 'bahagian' ? m.idxB : m.idxC)[id] || null;
  }

  /* ------------------------------------------------------------------------
     4. TINDAKAN: Lobi dan Jelajah (kemas kini profil masa nyata)
     ------------------------------------------------------------------------ */
  function salinPeta(p) {
    var a = p.peta || {}, b = {};
    b.bonus = JSON.parse(JSON.stringify(a.bonus || {}));
    b.kiraan = (a.kiraan && a.kiraan.tahun === p.tahun) ? JSON.parse(JSON.stringify(a.kiraan)) : { tahun: p.tahun };
    return b;
  }

  function gagal(kod, ralat) { return { ok: false, kod: kod, ralat: ralat }; }

  /** Baki tindakan dan semakan kelayakan, untuk UI (butang). */
  function semakTindakan(jenis, tahap, id, profil) {
    var def = TINDAKAN[jenis];
    if (!def || !def.kos[tahap]) { return { boleh: false, sebab: 'Tindakan tidak sah.' }; }
    var kos = def.kos[tahap];
    if (!profil) { return { boleh: false, sebab: 'Daftar pemain dahulu.', kos: kos }; }
    var peta = salinPeta(profil), guna = peta.kiraan[jenis + ':' + KUNCI[tahap] + ':' + id] || 0;
    var baki = CONFIG.HAD_TINDAKAN_SETAHUN - guna;
    if (baki <= 0) { return { boleh: false, sebab: 'Had ' + CONFIG.HAD_TINDAKAN_SETAHUN + 'x setahun dicapai.', kos: kos, baki: 0 }; }
    if (profil.ap < kos.ap) { return { boleh: false, sebab: 'AP tidak mencukupi (perlu ' + kos.ap + ').', kos: kos, baki: baki }; }
    if (profil.myr < kos.myr) { return { boleh: false, sebab: 'Wang tidak mencukupi (perlu MYR ' + fmt(kos.myr) + ').', kos: kos, baki: baki }; }
    return { boleh: true, sebab: '', kos: kos, baki: baki };
  }

  /**
   * jenis: 'lobi' | 'jelajah'; tahap: 'negeri' | 'bahagian' | 'cawangan'; id: id kawasan.
   * Tolak AP/MYR, tambah IP dan kesetiaan, naikkan mata bonus kawasan, tulis ke localStorage.
   */
  function jalankanTindakan(jenis, tahap, id, opts) {
    opts = opts || {};
    var def = TINDAKAN[jenis];
    if (!def) { return gagal('tidak_dikenali', 'Tindakan tidak dikenali: ' + jenis); }
    if (!def.kos[tahap]) { return gagal('tahap', 'Peringkat kawasan tidak sah: ' + tahap); }
    if (!S) { return gagal('tiada_save', 'save.js tidak dimuatkan.'); }
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain. Daftar dahulu di halaman utama.'); }
    var sem = semakTindakan(jenis, tahap, id, p);
    if (!sem.boleh) { return gagal('terhad', sem.sebab); }

    var rng = opts.rng || Math.random, peta = salinPeta(p), kos = def.kos[tahap];
    var tambah = Math.max(1, def.bonus[tahap] + Math.floor(rng() * 3) - 1);
    var kb = KUNCI[tahap] + ':' + id, kk = jenis + ':' + kb;
    var lama = peta.bonus[kb] || 0;
    peta.bonus[kb] = Math.min(CONFIG.HAD_BONUS, lama + tambah);
    peta.kiraan[kk] = (peta.kiraan[kk] || 0) + 1;
    var nama = opts.nama || id;

    var h = S.applyEffects({
      ap: -kos.ap, myr: -kos.myr, ip: def.ip[tahap] || 0, kesetiaan: def.kesetiaan[tahap]
    }, {
      log: { tindakan: 'peta_' + jenis, nama: def.nama + ': ' + nama, tahapKawasan: tahap, kawasan: id },
      patch: { peta: peta }
    });
    if (!h.ok) { return gagal(h.kod, h.ralat); }

    var hasil = {
      ok: true, jenis: jenis, tahap: tahap, id: id, nama: nama,
      bonus: peta.bonus[kb] - lama, bonusJumlah: peta.bonus[kb], baki: sem.baki - 1,
      perubahan: h.perubahan, profil: h.profil,
      mesej: def.nama + ' di ' + nama + ': sokongan +' + (peta.bonus[kb] - lama) + ' mata. ' + S.ringkasPerubahan(h.perubahan) + '.'
    };
    if (root.document && typeof root.CustomEvent === 'function') {
      try { root.document.dispatchEvent(new root.CustomEvent('myPolitik:map-action', { detail: hasil })); } catch (e) { /* abaikan */ }
    }
    return hasil;
  }

  /* ------------------------------------------------------------------------
     5. PETA SVG KUSTOM (PDM)
     ------------------------------------------------------------------------ */
  /** Hanya fail dalam assets/maps/. Pulang laluan boleh guna atau null. */
  function sahkanLaluan(laluan) {
    if (typeof laluan !== 'string') { return null; }
    var p = laluan.trim();
    if (!p || /^[a-z][a-z0-9+.-]*:/i.test(p) || p.indexOf('//') === 0 || p.charAt(0) === '/' ||
        p.indexOf('..') >= 0 || p.indexOf('\\') >= 0) { return null; }
    if (p.indexOf('/') < 0) { p = CONFIG.FOLDER_PETA + p; }
    if (p.indexOf(CONFIG.FOLDER_PETA) !== 0 || !/\.svg$/i.test(p)) { return null; }
    return p;
  }

  /** Bersihkan SVG: buang skrip, objek terbenam, pengendali acara dan pautan luar. */
  function bersihkanSvg(teks) {
    var DP = root.DOMParser;
    if (!DP) { return { ok: false, ralat: 'Pelayar tidak menyokong DOMParser.' }; }
    var doc = new DP().parseFromString(teks, 'image/svg+xml');
    var svg = doc.documentElement;
    if (!svg || doc.getElementsByTagName('parsererror').length || svg.localName !== 'svg') {
      return { ok: false, ralat: 'Fail bukan SVG yang sah.' };
    }
    var bahaya = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'animate', 'set', 'style'];
    var semua = Array.prototype.slice.call(svg.querySelectorAll('*')), i, j;
    for (i = 0; i < semua.length; i++) {
      var el = semua[i];
      if (bahaya.indexOf(el.localName) >= 0) { if (el.parentNode) { el.parentNode.removeChild(el); } continue; }
      var attrs = Array.prototype.slice.call(el.attributes);
      for (j = 0; j < attrs.length; j++) {
        var nm = attrs[j].name.toLowerCase(), val = attrs[j].value;
        if (nm.indexOf('on') === 0) { el.removeAttribute(attrs[j].name); }
        else if ((nm === 'href' || nm === 'xlink:href') && val.charAt(0) !== '#') { el.removeAttribute(attrs[j].name); }
        else if (/url\s*\(\s*['"]?\s*(?!#)/i.test(val) && nm !== 'd') { el.removeAttribute(attrs[j].name); }
      }
    }
    if (!svg.getAttribute('viewBox')) {
      var w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
      if (w > 0 && h > 0) { svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h); }
    }
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.setAttribute('class', 'mpm-svg'); svg.setAttribute('role', 'group');
    return { ok: true, markup: new root.XMLSerializer().serializeToString(svg) };
  }

  function normId(s) { return String(s || '').toLowerCase().replace(/^(cawangan|lokaliti|pdm|lok|c)[-_ ]?(?=\d)/, '').replace(/[^a-z0-9]+/g, '/').replace(/^\/|\/$/g, ''); }

  /** Padankan zon dalam SVG dengan cawangan bahagian. */
  function padanZon(svgEl, bahagian) {
    var kamus = {}, kodBilang = {};
    bahagian.cawangan.forEach(function (c) {
      kamus[normId(c.id)] = c; kamus[normId(c.idSheet)] = c; kamus['n:' + slug(c.nama)] = c;
      kodBilang[c.kod] = (kodBilang[c.kod] || 0) + 1;
    });
    bahagian.cawangan.forEach(function (c) { if (kodBilang[c.kod] === 1) { kamus['k:' + norm(c.kod)] = c; } });
    var padan = {}, n = 0;
    Array.prototype.forEach.call(svgEl.querySelectorAll('[data-id],[data-cawangan],[data-kod],[data-nama],[id]'), function (el) {
      var calon = [el.getAttribute('data-id'), el.getAttribute('data-cawangan'), el.getAttribute('id')];
      var c = null, i;
      for (i = 0; i < calon.length && !c; i++) { if (calon[i]) { c = kamus[normId(calon[i])] || kamus['n:' + slug(calon[i])] || null; } }
      if (!c && el.getAttribute('data-kod')) { c = kamus['k:' + norm(el.getAttribute('data-kod'))] || null; }
      if (!c && el.getAttribute('data-nama')) { c = kamus['n:' + slug(el.getAttribute('data-nama'))] || null; }
      if (!c) { return; }
      el.setAttribute('data-cid', c.id);
      el.setAttribute('class', ((el.getAttribute('class') || '') + ' mpm-zon').trim());
      el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button');
      (padan[c.id] = padan[c.id] || []).push(el); n++;
    });
    return { padan: padan, bilangan: n };
  }

  /* ------------------------------------------------------------------------
     6. UI
     ------------------------------------------------------------------------ */
  var CSS = [
    '.mpm{--mpm-bg:var(--bg-elev-1,#16181E);--mpm-bg2:var(--bg-elev-2,#1D2028);--mpm-bd:var(--border,#2E333F);--mpm-tx:var(--text,#F4F5F7);--mpm-mut:var(--text-muted,#A3A9B8);--mpm-red:var(--red,#C8102E);--mpm-gold:var(--gold,#F2B705);color:var(--mpm-tx);font-family:var(--font-body,system-ui,sans-serif);min-width:0}',
    '.mpm *{box-sizing:border-box}',
    '.mpm-tabs{display:flex;gap:4px;background:var(--mpm-bg);border:1px solid var(--mpm-bd);border-radius:14px;padding:4px;overflow-x:auto;scrollbar-width:none}',
    '.mpm-tab{flex:1 0 auto;min-height:44px;padding:8px 14px;border:0;border-radius:10px;background:transparent;color:var(--mpm-mut);font:600 .9rem/1.2 inherit;font-family:inherit;cursor:pointer;white-space:nowrap;transition:background .2s,color .2s}',
    '.mpm-tab small{display:block;font-weight:500;font-size:.72rem;opacity:.8}',
    '.mpm-tab:hover{color:var(--mpm-tx)}',
    '.mpm-tab[aria-selected="true"]{background:linear-gradient(135deg,var(--mpm-red),#9B0C23);color:#fff;box-shadow:0 4px 16px rgba(200,16,46,.35)}',
    '.mpm :focus-visible{outline:2px solid var(--mpm-gold);outline-offset:2px}',
    '.mpm-toolbar{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;margin:12px 0}',
    '.mpm-seg{display:inline-flex;border:1px solid var(--mpm-bd);border-radius:10px;overflow:hidden}',
    '.mpm-seg button{min-height:38px;padding:6px 12px;border:0;background:var(--mpm-bg);color:var(--mpm-mut);font:600 .82rem inherit;font-family:inherit;cursor:pointer}',
    '.mpm-seg button[aria-pressed="true"]{background:var(--mpm-bg2);color:var(--mpm-gold);box-shadow:inset 0 -2px 0 var(--mpm-gold)}',
    '.mpm-field{display:flex;align-items:center;gap:6px;font-size:.82rem;color:var(--mpm-mut)}',
    '.mpm-field select{min-height:38px;max-width:100%;background:var(--mpm-bg);color:var(--mpm-tx);border:1px solid var(--mpm-bd);border-radius:10px;padding:6px 10px;font:inherit}',
    '.mpm-body{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}',
    '.mpm-main,.mpm-panel{background:var(--mpm-bg);border:1px solid var(--mpm-bd);border-radius:14px;padding:14px;min-width:0}',
    '.mpm-stage{min-height:200px}',
    '.mpm-status{padding:28px 12px;text-align:center;color:var(--mpm-mut)}',
    '.mpm-nota{margin:0 0 10px;font-size:.78rem;color:var(--mpm-mut)}',
    /* jubin negeri */
    '.mpm-negeri{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-auto-rows:minmax(58px,auto);gap:6px}',
    '.mpm-tile{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:44px;padding:6px 4px;border:2px solid transparent;border-radius:10px;color:#fff;font-family:inherit;text-align:center;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s}',
    '.mpm-tile:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.45)}',
    '.mpm-tile[data-level="4"]{color:#2B2100}',
    '.mpm-tile[aria-pressed="true"]{border-color:#fff;box-shadow:0 0 0 2px var(--mpm-gold)}',
    '.mpm-tile.is-rumah::after{content:"\\2605";position:absolute;top:2px;right:5px;font-size:.7rem;color:var(--mpm-gold)}',
    '.mpm-tile[data-level="4"].is-rumah::after{color:#7a1020}',
    '.mpm-tile.is-kosong{background:transparent!important;border:1px dashed var(--mpm-bd);color:var(--mpm-mut);cursor:default}',
    '.mpm-tile.is-kosong:hover{transform:none;box-shadow:none}',
    '.mpm-t-nama{font-weight:700;font-size:.85rem;line-height:1.15}',
    '.mpm-t-nama .s{display:none}',
    '.mpm-t-nilai{font-size:.78rem;font-weight:600;opacity:.95}',
    '.mpm-label{grid-column:span 7;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mpm-mut);margin:4px 0 -2px}',
    /* grid bahagian / cawangan */
    '.mpm-sek{margin:0 0 16px}',
    '.mpm-sek h3{margin:0 0 8px;font-size:.95rem;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}',
    '.mpm-sek h3 small{font-weight:500;color:var(--mpm-mut);font-size:.75rem}',
    '.mpm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(58px,1fr));gap:5px}',
    '.mpm-grid .mpm-tile{min-height:46px;padding:4px 2px}',
    '.mpm-grid .mpm-t-nama{font-size:.78rem}',
    '.mpm-grid .mpm-t-nilai{font-size:.72rem}',
    /* svg kustom */
    '.mpm-svgwrap{border:1px solid var(--mpm-bd);border-radius:10px;background:var(--mpm-bg2);padding:8px;overflow:auto}',
    '.mpm-svg{width:100%;height:auto;display:block;max-height:70vh}',
    '.mpm-zon{cursor:pointer;stroke:#0E0F13;stroke-width:.6;transition:opacity .15s}',
    '.mpm-zon:hover{opacity:.82}',
    '.mpm-zon.is-pilih{stroke:#fff;stroke-width:2}',
    '.mpm-zon:focus-visible{outline:none;stroke:var(--mpm-gold);stroke-width:2.5}',
    '.mpm-zon.is-rumah{stroke:var(--mpm-gold);stroke-width:1.6}',
    /* legenda */
    '.mpm-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:12px;font-size:.74rem;color:var(--mpm-mut)}',
    '.mpm-legend span{display:inline-flex;align-items:center;gap:6px}',
    '.mpm-legend i{width:14px;height:14px;border-radius:4px;display:inline-block;border:1px solid rgba(255,255,255,.15)}',
    /* panel */
    '.mpm-panel h3{margin:0 0 2px;font-family:var(--font-display,inherit);font-size:1.15rem}',
    '.mpm-sub{margin:0 0 12px;font-size:.8rem;color:var(--mpm-mut)}',
    '.mpm-chip{display:inline-block;padding:2px 10px;border-radius:99px;font-size:.74rem;font-weight:700;color:#fff;vertical-align:middle}',
    '.mpm-kosong{color:var(--mpm-mut);font-size:.9rem;margin:6px 0}',
    '.mpm-dl{display:grid;grid-template-columns:1fr auto;gap:6px 12px;margin:0 0 12px;font-size:.88rem}',
    '.mpm-dl dt{color:var(--mpm-mut)}.mpm-dl dd{margin:0;font-weight:700;text-align:right}',
    '.mpm-bar{margin:0 0 12px}',
    '.mpm-bar div.l{display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:4px}',
    '.mpm-bar div.t{height:10px;border-radius:99px;background:var(--mpm-bg2);overflow:hidden;border:1px solid var(--mpm-bd)}',
    '.mpm-bar div.t b{display:block;height:100%;border-radius:99px;transition:width .3s}',
    '.mpm-aksi{display:grid;gap:8px;margin-top:6px}',
    '.mpm-btn{min-height:46px;padding:8px 14px;border-radius:12px;border:1px solid var(--mpm-bd);background:var(--mpm-bg2);color:var(--mpm-tx);font:700 .9rem inherit;font-family:inherit;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:2px}',
    '.mpm-btn small{font-weight:500;font-size:.74rem;opacity:.85}',
    '.mpm-btn--lobi{background:linear-gradient(135deg,var(--mpm-red),#9B0C23);border-color:transparent;color:#fff}',
    '.mpm-btn--jelajah{background:linear-gradient(135deg,#FFD84D,var(--mpm-gold) 55%,#C99700);border-color:transparent;color:#2B2100}',
    '.mpm-btn:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.5)}',
    '.mpm-btn:not(:disabled):hover{filter:brightness(1.08)}',
    '.mpm-msg{margin-top:10px;padding:8px 10px;border-radius:10px;font-size:.84rem;background:var(--mpm-bg2);border-left:3px solid var(--mpm-gold)}',
    '.mpm-msg.ralat{border-left-color:#FF4D5E}',
    '.mpm-msg:empty{display:none}',
    '@media (min-width:900px){.mpm-body{grid-template-columns:minmax(0,1fr) 340px;align-items:start}.mpm-panel{position:sticky;top:12px}.mpm-negeri{grid-auto-rows:minmax(74px,auto)}.mpm-t-nama{font-size:.95rem}}',
    '@media (max-width:560px){.mpm-t-nama .f{display:none}.mpm-t-nama .s{display:inline}.mpm-negeri{gap:4px}.mpm-main,.mpm-panel{padding:10px}}',
    '@media (prefers-reduced-motion:reduce){.mpm *{transition:none!important}}'
  ].join('\n');

  function suntikCSS(doc) {
    if (doc.getElementById('mpm-style')) { return; }
    var s = doc.createElement('style'); s.id = 'mpm-style'; s.textContent = CSS;
    doc.head.appendChild(s);
  }

  var aktif = null;                        // pemasangan terkini (untuk loadCustomPDMMap global)

  /**
   * Pasang peta dalam elemen. opts: {
   *   data,          // hierarki data.js (jika tiada, dimuat melalui loadPartyData dengan opts.url / MYPOLITIK_CONFIG.sheetCsvUrl)
   *   mode,          // 'negeri' | 'bahagian' | 'pdm'
   *   seed,          // seed asas sokongan (lalai: ID pemain)
   *   tindakan,      // { lobi: fn(info), jelajah: fn(info) } untuk menggantikan tindakan lalai
   *   svgPdm         // { '097': 'assets/maps/p097.svg' } atau fn(bahagianId) -> laluan
   * }
   * Pulang Promise<instance>.
   */
  async function mount(el, opts) {
    opts = opts || {};
    var doc = el.ownerDocument;
    suntikCSS(doc);

    var inst = {
      el: el, opts: opts, model: null, profil: null, svg: {},
      state: { mode: opts.mode || 'negeri', metrik: 'sokongan', negeriTapis: '', pdmNegeri: '', pdmBahagian: '', pdmPaparan: 'grid', dipilih: null }
    };
    el.classList.add('mpm');
    el.innerHTML =
      '<div class="mpm-tabs" role="tablist" aria-label="Mod paparan peta"></div>' +
      '<div class="mpm-toolbar"></div>' +
      '<div class="mpm-body"><div class="mpm-main"><div class="mpm-stage"></div><div class="mpm-legend" aria-hidden="false"></div></div>' +
      '<aside class="mpm-panel" aria-live="polite" aria-label="Butiran kawasan"></aside></div>';
    var q = function (s) { return el.querySelector(s); };
    var $tabs = q('.mpm-tabs'), $bar = q('.mpm-toolbar'), $stage = q('.mpm-stage'), $legend = q('.mpm-legend'), $panel = q('.mpm-panel');

    $stage.innerHTML = '<div class="mpm-status" role="status">Memuatkan peta...</div>';

    /* ----- data ----- */
    var data = opts.data;
    if (!data) {
      if (!D) { $stage.innerHTML = '<div class="mpm-status">data.js tidak dimuatkan.</div>'; return inst; }
      try {
        var cfg = root.MYPOLITIK_CONFIG || {};
        data = await D.loadPartyData({ url: opts.url || cfg.sheetCsvUrl });
      } catch (e) {
        $stage.innerHTML = '<div class="mpm-status">Data tidak dapat dimuatkan: ' + esc(e && e.message ? e.message : e) + '</div>';
        return inst;
      }
    }
    inst.data = data;
    var profil0 = S ? S.loadPlayer() : null;
    inst.model = binaModel(data, opts.seed || (profil0 && profil0.id ? 'peta|' + profil0.id : 'mypolitik'));
    inst.profil = profil0;
    kira(inst.model, profil0);

    var st = inst.state, M = inst.model;
    var rumah0 = M.rumah;
    st.pdmNegeri = (rumah0.negeri && rumah0.negeri.id) || '';
    st.pdmBahagian = (rumah0.bahagian && rumah0.bahagian.id) || '';
    ensurePdmDefault();

    function negeriAdaData() { return M.negeri.filter(function (n) { return n.bahagian.length; }); }
    function ensurePdmDefault() {
      var n = M.idxN[st.pdmNegeri];
      if (!n || !n.bahagian.length) { n = negeriAdaData()[0]; st.pdmNegeri = n ? n.id : ''; }
      if (n && !(M.idxB[st.pdmBahagian] && M.idxB[st.pdmBahagian].negeri === n)) { st.pdmBahagian = n.bahagian[0].id; }
    }

    /* ----- pembantu paparan ----- */
    function nilaiMetrik(nod) { return st.metrik === 'kekuatan' ? nod.kekuatan : nod.sokongan; }
    function jenisLabel() { return (st.mode === 'bahagian' && st.metrik === 'sokongan') ? 'lobi' : 'sokongan'; }
    function tahapNod(nod) { return tahapSokongan(nilaiMetrik(nod), nod.tahap === 'bahagian' ? jenisLabel() : 'sokongan'); }
    function jenisMetrikLabel() { return st.metrik === 'kekuatan' ? 'Kekuatan Parti' : (st.mode === 'bahagian' ? 'Sokongan Perwakilan' : 'Sokongan Anda'); }

    function renderTabs() {
      var defs = [
        ['negeri', 'Peta Negeri', M.negeri.filter(function (n) { return n.pos; }).length + ' negeri'],
        ['bahagian', 'Peta Bahagian', fmt(M.bahagian.length) + ' bahagian'],
        ['pdm', 'Peta PDM / Lokaliti', fmt(M.cawangan.length) + ' cawangan']
      ];
      $tabs.innerHTML = defs.map(function (d) {
        var pilih = st.mode === d[0];
        return '<button class="mpm-tab" role="tab" id="mpm-tab-' + d[0] + '" data-act="mode" data-v="' + d[0] + '" aria-selected="' + pilih +
          '" tabindex="' + (pilih ? 0 : -1) + '">' + d[1] + '<small>' + d[2] + '</small></button>';
      }).join('');
      $stage.setAttribute('role', 'tabpanel'); $stage.setAttribute('aria-labelledby', 'mpm-tab-' + st.mode);
    }

    function opsiNegeri(terpilih, semua) {
      return (semua ? '<option value="">Semua negeri</option>' : '') + negeriAdaData().map(function (n) {
        return '<option value="' + esc(n.id) + '"' + (n.id === terpilih ? ' selected' : '') + '>' + esc(n.nama) + '</option>';
      }).join('');
    }

    function adaSvg(bid) { return !!inst.svg[bid] || !!svgDiKonfig(bid); }
    function svgDiKonfig(bid) {
      var c = opts.svgPdm; if (!c) { return null; }
      return sahkanLaluan(typeof c === 'function' ? c(bid) : c[bid]);
    }

    function renderToolbar() {
      var h = '<div class="mpm-seg" role="group" aria-label="Ukuran warna">' +
        '<button data-act="metrik" data-v="sokongan" aria-pressed="' + (st.metrik === 'sokongan') + '">' + (st.mode === 'bahagian' ? 'Status Lobi' : 'Sokongan Anda') + '</button>' +
        '<button data-act="metrik" data-v="kekuatan" aria-pressed="' + (st.metrik === 'kekuatan') + '">Kekuatan Parti</button></div>';
      if (st.mode === 'bahagian') {
        h += '<label class="mpm-field">Negeri <select data-act="tapis">' + opsiNegeri(st.negeriTapis, true) + '</select></label>';
      } else if (st.mode === 'pdm') {
        var n = M.idxN[st.pdmNegeri];
        h += '<label class="mpm-field">Negeri <select data-act="pdm-negeri">' + opsiNegeri(st.pdmNegeri, false) + '</select></label>';
        h += '<label class="mpm-field">Bahagian <select data-act="pdm-bahagian">' + (n ? n.bahagian.map(function (b) {
          return '<option value="' + esc(b.id) + '"' + (b.id === st.pdmBahagian ? ' selected' : '') + '>P.' + esc(b.kod) + ' ' + esc(b.nama) + '</option>';
        }).join('') : '') + '</select></label>';
        if (adaSvg(st.pdmBahagian)) {
          h += '<div class="mpm-seg" role="group" aria-label="Jenis paparan PDM"><button data-act="paparan" data-v="grid" aria-pressed="' + (st.pdmPaparan === 'grid') + '">Grid</button>' +
            '<button data-act="paparan" data-v="svg" aria-pressed="' + (st.pdmPaparan === 'svg') + '">Peta SVG</button></div>';
        }
      }
      $bar.innerHTML = h;
    }

    function renderLegend() {
      var lab = TAHAP_LABEL[jenisLabel()], t = CONFIG.AMBANG;
      var jul = ['< ' + t[0] + '%', t[0] + '-' + (t[1] - 1) + '%', t[1] + '-' + (t[2] - 1) + '%', t[2] + '-' + (t[3] - 1) + '%', '≥ ' + t[3] + '%'];
      $legend.innerHTML = '<strong style="color:var(--mpm-tx)">' + jenisMetrikLabel() + ':</strong>' + lab.map(function (l, i) {
        return '<span><i style="background:' + WARNA[i] + '"></i>' + l + ' (' + jul[i] + ')</span>';
      }).join('') + (rumah0.cawangan ? '<span>★ Kawasan anda</span>' : '');
    }

    function jubin(nod, kelas, dalam, extra) {
      var t = tahapNod(nod), rm = M.rumah && (M.rumah[nod.tahap] === nod);
      var pilih = st.dipilih && st.dipilih.tahap === nod.tahap && st.dipilih.id === nod.id;
      return '<button type="button" class="mpm-tile ' + kelas + (rm ? ' is-rumah' : '') + '" data-act="pilih" data-tahap="' + nod.tahap +
        '" data-id="' + esc(nod.id) + '" data-level="' + t.indeks + '" style="background:' + t.warna + (extra || '') + '" aria-pressed="' + !!pilih +
        '" aria-label="' + esc(nod.nama + ': ' + nilaiMetrik(nod) + '%, ' + t.label + (rm ? ', kawasan anda' : '')) + '" title="' + esc(nod.nama + ' (' + nilaiMetrik(nod) + '%)') + '">' + dalam + '</button>';
    }

    function stageNegeri() {
      var h = '<p class="mpm-nota">Peta jubin: kedudukan negeri dilukis mengikut geografi, saiz dilaraskan sama.</p><div class="mpm-negeri">';
      M.negeri.filter(function (n) { return n.pos; }).forEach(function (n) {
        var pos = 'grid-column:' + (n.pos[0] + 1) + ';grid-row:' + (n.pos[1] + 1) + ';';
        if (!n.adaData) {
          h += '<div class="mpm-tile is-kosong" style="' + pos + '" title="Tiada data"><span class="mpm-t-nama"><span class="f">' + esc(n.nama) + '</span><span class="s">' + n.pendek + '</span></span><span class="mpm-t-nilai">tiada data</span></div>';
        } else {
          h += jubin(n, 'mpm-tile--negeri', '<span class="mpm-t-nama"><span class="f">' + esc(n.nama) + '</span><span class="s">' + n.pendek + '</span></span><span class="mpm-t-nilai">' + nilaiMetrik(n) + '%</span>', ';' + pos);
        }
      });
      return h + '</div>';
    }

    function stageBahagian() {
      var senarai = M.negeri.filter(function (n) { return n.bahagian.length && (!st.negeriTapis || n.id === st.negeriTapis); });
      if (!senarai.length) { return '<div class="mpm-status">Tiada data bahagian.</div>'; }
      return senarai.map(function (n) {
        return '<section class="mpm-sek"><h3>' + esc(n.nama) + ' <small>' + n.bahagian.length + ' bahagian · ' + nilaiMetrik(n) + '%</small></h3><div class="mpm-grid">' +
          n.bahagian.map(function (b) {
            return jubin(b, '', '<span class="mpm-t-nama">P.' + esc(b.kod) + '</span><span class="mpm-t-nilai">' + nilaiMetrik(b) + '%</span>');
          }).join('') + '</div></section>';
      }).join('');
    }

    function stagePdm() {
      var b = M.idxB[st.pdmBahagian];
      if (!b) { return '<div class="mpm-status">Pilih bahagian untuk melihat cawangan.</div>'; }
      if (st.pdmPaparan === 'svg' && adaSvg(b.id)) {
        return '<p class="mpm-nota">P.' + esc(b.kod) + ' ' + esc(b.nama) + ' — peta SVG kustom. <span data-svgstat></span></p><div class="mpm-svgwrap" data-svgwrap><div class="mpm-status" role="status">Memuatkan peta SVG...</div></div>';
      }
      if (!b.cawangan.length) { return '<div class="mpm-status">Tiada cawangan dalam bahagian ini.</div>'; }
      return '<p class="mpm-nota">P.' + esc(b.kod) + ' ' + esc(b.nama) + ' — ' + fmt(b.cawangan.length) + ' cawangan. Muatkan SVG kustom dengan <code>loadCustomPDMMap()</code>.</p>' +
        b.dun.filter(function (d) { return d.cawangan.length; }).map(function (d) {
          return '<section class="mpm-sek"><h3>' + esc(d.nama) + ' <small>' + d.cawangan.length + ' cawangan</small></h3><div class="mpm-grid">' +
            d.cawangan.map(function (c) {
              return jubin(c, '', '<span class="mpm-t-nama">' + esc(c.kod) + '</span><span class="mpm-t-nilai">' + nilaiMetrik(c) + '%</span>');
            }).join('') + '</div></section>';
        }).join('');
    }

    function warnaSvg() {
      var wrap = $stage.querySelector('[data-svgwrap]'); if (!wrap) { return; }
      Array.prototype.forEach.call(wrap.querySelectorAll('[data-cid]'), function (z) {
        var c = M.idxC[z.getAttribute('data-cid')]; if (!c) { return; }
        var t = tahapNod(c);
        var sasaran = [z].concat(Array.prototype.slice.call(z.querySelectorAll('path,polygon,rect,circle,ellipse,polyline')));
        sasaran.forEach(function (s) { if (s.localName !== 'g') { s.style.fill = t.warna; } });
        z.setAttribute('aria-label', c.nama + ': ' + nilaiMetrik(c) + '%, ' + t.label);
        var rm = M.rumah && M.rumah.cawangan === c, pl = st.dipilih && st.dipilih.id === c.id && st.dipilih.tahap === 'cawangan';
        z.classList.toggle('is-rumah', !!rm); z.classList.toggle('is-pilih', !!pl);
      });
    }

    async function isiSvg() {
      var wrap = $stage.querySelector('[data-svgwrap]'); if (!wrap) { return; }
      var bid = st.pdmBahagian, b = M.idxB[bid], rekod = inst.svg[bid];
      if (!rekod) {
        var lp = svgDiKonfig(bid);
        if (lp) { var h = await muatSvg(inst, lp, bid); if (!h.ok) { wrap.innerHTML = '<div class="mpm-status">' + esc(h.ralat) + '</div>'; return; } rekod = inst.svg[bid]; }
      }
      if (!rekod || !$stage.contains(wrap)) { return; }
      wrap.innerHTML = rekod.markup;
      var svgEl = wrap.querySelector('svg'), pd = padanZon(svgEl, b);
      var tiada = b.cawangan.length - Object.keys(pd.padan).length;
      var stat = $stage.querySelector('[data-svgstat]');
      if (stat) { stat.textContent = Object.keys(pd.padan).length + ' zon dipadankan' + (tiada > 0 ? ', ' + tiada + ' cawangan tiada zon dalam SVG' : '') + '.'; }
      warnaSvg();
    }

    function renderStage() {
      var aktifId = doc.activeElement && doc.activeElement.getAttribute ? doc.activeElement.getAttribute('data-id') : null;
      $stage.innerHTML = st.mode === 'negeri' ? stageNegeri() : st.mode === 'bahagian' ? stageBahagian() : stagePdm();
      if (st.mode === 'pdm' && st.pdmPaparan === 'svg') { isiSvg(); }
      if (aktifId) { var f = $stage.querySelector('[data-id="' + (root.CSS && root.CSS.escape ? root.CSS.escape(aktifId) : aktifId) + '"]'); if (f) { f.focus({ preventScroll: true }); } }
    }

    function tandaPilihan() {
      Array.prototype.forEach.call($stage.querySelectorAll('.mpm-tile[data-id]'), function (t) {
        t.setAttribute('aria-pressed', String(!!st.dipilih && t.getAttribute('data-id') === st.dipilih.id && t.getAttribute('data-tahap') === st.dipilih.tahap));
      });
      warnaSvg();
    }

    function bar(label, nilai, warna) {
      return '<div class="mpm-bar"><div class="l"><span>' + label + '</span><strong>' + nilai + '%</strong></div><div class="t"><b style="width:' + clamp(nilai, 0, 100) + '%;background:' + warna + '"></b></div></div>';
    }

    function renderPanel(mesej, ralat) {
      var d = st.dipilih, nod = d && dapatkanNod(M, d.tahap, d.id);
      if (!nod) {
        $panel.innerHTML = '<h3>Butiran Kawasan</h3><p class="mpm-kosong">Klik mana-mana kawasan pada peta untuk melihat butiran, kemudian Lobi atau Anjur Jelajah.</p>';
        return;
      }
      var t = tahapNod(nod), tS = tahapSokongan(nod.sokongan, nod.tahap === 'bahagian' ? 'lobi' : 'sokongan'), tK = tahapSokongan(nod.kekuatan, 'sokongan');
      var rm = M.rumah && M.rumah[nod.tahap] === nod;
      var sub = nod.tahap === 'negeri' ? 'Negeri' : nod.tahap === 'bahagian' ? 'Bahagian P.' + nod.kod + ' · ' + nod.negeri.nama : 'Cawangan ' + nod.kod + ' · ' + nod.dunNama + ' · P.' + nod.bahagian.kod + ' ' + nod.bahagian.nama;
      var dl = '<dl class="mpm-dl"><dt>Jumlah Ahli</dt><dd>' + (nod.jumlahAhli ? fmt(nod.jumlahAhli) : '–') + '</dd>';
      if (nod.tahap === 'negeri') {
        dl += '<dt>Bahagian / Cawangan</dt><dd>' + fmt(nod.bilBahagian) + ' / ' + fmt(nod.bilCawangan) + '</dd>' +
          '<dt>Jumlah Perwakilan</dt><dd>' + fmt(nod.perwakilan) + '</dd><dt>Kerusi ke PAU</dt><dd>' + fmt(nod.perwakilanPAU) + '</dd>';
      } else if (nod.tahap === 'bahagian') {
        dl += '<dt>Cawangan</dt><dd>' + fmt(nod.bilCawangan) + '</dd><dt>Jumlah Perwakilan</dt><dd>' + fmt(nod.perwakilan) + '</dd><dt>Kerusi ke PAU</dt><dd>' + nod.perwakilanPAU + '</dd>';
      } else {
        dl += '<dt>Perwakilan ke Bahagian</dt><dd>' + nod.perwakilan + '</dd>';
      }
      dl += '</dl>';

      var p = S ? S.loadPlayer() : null;
      var btn = function (jenis) {
        var def = TINDAKAN[jenis], s = semakTindakan(jenis, nod.tahap, nod.id, p), kos = def.kos[nod.tahap];
        return '<button type="button" class="mpm-btn mpm-btn--' + jenis + '" data-act="tindakan" data-v="' + jenis + '"' + (s.boleh ? '' : ' disabled title="' + esc(s.sebab) + '"') + '>' +
          def.nama + '<small>' + kos.ap + ' AP · MYR ' + fmt(kos.myr) + (s.boleh ? ' · baki ' + s.baki + 'x tahun ini' : ' · ' + esc(s.sebab)) + '</small></button>';
      };
      var drill = nod.tahap === 'negeri' ? '<button type="button" class="mpm-btn" data-act="drill">Lihat Bahagian di ' + esc(nod.nama) + '</button>' :
        nod.tahap === 'bahagian' ? '<button type="button" class="mpm-btn" data-act="drill">Lihat Cawangan (PDM)</button>' : '';

      $panel.innerHTML = '<h3>' + esc(nod.nama) + (rm ? ' <span title="Kawasan anda" style="color:var(--mpm-gold)">★</span>' : '') + '</h3><p class="mpm-sub">' + esc(sub) + '</p>' +
        '<p><span class="mpm-chip" style="background:' + t.warna + ';' + (t.indeks === 4 ? 'color:#2B2100' : '') + '">' + t.label + '</span></p>' + dl +
        bar(nod.tahap === 'bahagian' ? '% Sokongan Perwakilan' : '% Sokongan Anda', nod.sokongan, tS.warna) +
        bar('Kekuatan Parti', nod.kekuatan, tK.warna) +
        (nod.tambah ? '<p class="mpm-sub">Usaha anda menambah kira-kira +' + nod.tambah + ' mata sokongan di sini.</p>' : '') +
        '<div class="mpm-aksi">' + btn('lobi') + btn('jelajah') + drill + '</div>' +
        '<div class="mpm-msg' + (ralat ? ' ralat' : '') + '" role="status">' + esc(mesej || '') + '</div>';
    }

    function renderSemua() { renderTabs(); renderToolbar(); renderStage(); renderLegend(); renderPanel(); }

    /* ----- tindakan pengguna ----- */
    function setMode(mode) {
      if (['negeri', 'bahagian', 'pdm'].indexOf(mode) < 0) { return; }
      var d = st.dipilih;
      if (mode === 'pdm' && d) {
        if (d.tahap === 'bahagian' && M.idxB[d.id]) { st.pdmNegeri = M.idxB[d.id].negeri.id; st.pdmBahagian = d.id; }
        else if (d.tahap === 'negeri' && M.idxN[d.id] && M.idxN[d.id].bahagian.length) { st.pdmNegeri = d.id; st.pdmBahagian = M.idxN[d.id].bahagian[0].id; }
        else if (d.tahap === 'cawangan' && M.idxC[d.id]) { st.pdmNegeri = M.idxC[d.id].negeri.id; st.pdmBahagian = M.idxC[d.id].bahagian.id; }
      }
      if (mode === 'bahagian' && d && d.tahap === 'negeri' && M.idxN[d.id] && M.idxN[d.id].bahagian.length) { st.negeriTapis = d.id; }
      if (!(d && ((mode === 'negeri' && d.tahap === 'negeri') || (mode === 'bahagian' && d.tahap === 'bahagian') || (mode === 'pdm' && d.tahap === 'cawangan')))) { st.dipilih = null; }
      st.mode = mode;
      ensurePdmDefault();
      renderSemua();
    }

    function pilih(tahap, id, tanpaGulung) {
      var nod = dapatkanNod(M, tahap, id); if (!nod) { return false; }
      st.dipilih = { tahap: tahap, id: id };
      tandaPilihan(); renderPanel();
      if (!tanpaGulung && root.matchMedia && root.matchMedia('(max-width:899px)').matches && $panel.scrollIntoView) {
        $panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      return true;
    }

    async function lakukan(jenis) {
      var d = st.dipilih, nod = d && dapatkanNod(M, d.tahap, d.id); if (!nod) { return; }
      var info = { jenis: jenis, tahap: nod.tahap, id: nod.id, nama: nod.nama, nod: nod };
      var h;
      if (opts.tindakan && typeof opts.tindakan[jenis] === 'function') { h = await opts.tindakan[jenis](info); }
      else { h = jalankanTindakan(jenis, nod.tahap, nod.id, { nama: nod.nama }); }
      h = h || { ok: true, mesej: '' };
      refresh();
      renderPanel(h.ok ? h.mesej : h.ralat, !h.ok);
    }

    function refresh() {
      inst.profil = S ? S.loadPlayer() : null;
      kira(M, inst.profil);
      renderToolbar(); renderStage(); renderLegend();
      var d = st.dipilih; if (d && !dapatkanNod(M, d.tahap, d.id)) { st.dipilih = null; }
      renderPanel();
    }

    /* ----- acara (delegasi) ----- */
    el.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-act],[data-cid]') : null;
      if (!t || !el.contains(t)) { return; }
      if (t.hasAttribute('data-cid') && !t.hasAttribute('data-act')) { pilih('cawangan', t.getAttribute('data-cid')); return; }
      var act = t.getAttribute('data-act'), v = t.getAttribute('data-v');
      if (act === 'mode') { setMode(v); }
      else if (act === 'metrik') { st.metrik = v; renderToolbar(); renderStage(); renderLegend(); renderPanel(); }
      else if (act === 'pilih') { pilih(t.getAttribute('data-tahap'), t.getAttribute('data-id')); }
      else if (act === 'tindakan') { lakukan(v); }
      else if (act === 'paparan') { st.pdmPaparan = v; renderToolbar(); renderStage(); }
      else if (act === 'drill') { setMode(st.dipilih && st.dipilih.tahap === 'negeri' ? 'bahagian' : 'pdm'); }
    });
    el.addEventListener('change', function (ev) {
      var t = ev.target, act = t.getAttribute && t.getAttribute('data-act');
      if (act === 'tapis') { st.negeriTapis = t.value; st.dipilih = null; renderStage(); renderPanel(); }
      else if (act === 'pdm-negeri') { st.pdmNegeri = t.value; st.pdmBahagian = ''; ensurePdmDefault(); st.dipilih = null; st.pdmPaparan = adaSvg(st.pdmBahagian) ? st.pdmPaparan : 'grid'; renderToolbar(); renderStage(); renderPanel(); }
      else if (act === 'pdm-bahagian') { st.pdmBahagian = t.value; st.dipilih = null; if (!adaSvg(st.pdmBahagian)) { st.pdmPaparan = 'grid'; } renderToolbar(); renderStage(); renderPanel(); }
    });
    el.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if (t.getAttribute && t.getAttribute('role') === 'tab') {                       // navigasi tab dengan anak panah
        var order = ['negeri', 'bahagian', 'pdm'], i = order.indexOf(t.getAttribute('data-v')), n = -1;
        if (ev.key === 'ArrowRight') { n = (i + 1) % 3; } else if (ev.key === 'ArrowLeft') { n = (i + 2) % 3; }
        else if (ev.key === 'Home') { n = 0; } else if (ev.key === 'End') { n = 2; }
        if (n >= 0) { ev.preventDefault(); setMode(order[n]); var f = q('#mpm-tab-' + order[n]); if (f) { f.focus(); } }
      } else if ((ev.key === 'Enter' || ev.key === ' ') && t.hasAttribute && t.hasAttribute('data-cid')) {   // zon SVG
        ev.preventDefault(); pilih('cawangan', t.getAttribute('data-cid'));
      }
    });

    inst.unsub = S && S.subscribe ? S.subscribe(function () { refresh(); }) : function () {};

    /* ----- API pemasangan ----- */
    inst.setMode = setMode;
    inst.setMetrik = function (m) { if (m === 'sokongan' || m === 'kekuatan') { st.metrik = m; renderToolbar(); renderStage(); renderLegend(); renderPanel(); } };
    inst.pilih = function (tahap, id) {
      if (tahap === 'cawangan' && M.idxC[id]) { var c = M.idxC[id]; st.pdmNegeri = c.negeri.id; st.pdmBahagian = c.bahagian.id; if (st.mode !== 'pdm') { st.mode = 'pdm'; } st.dipilih = null; renderSemua(); }
      else if (tahap === 'bahagian' && M.idxB[id]) { if (st.mode === 'pdm') { st.pdmNegeri = M.idxB[id].negeri.id; st.pdmBahagian = id; ensurePdmDefault(); renderToolbar(); renderStage(); } else if (st.mode === 'negeri') { st.mode = 'bahagian'; st.negeriTapis = ''; renderSemua(); } }
      else if (tahap === 'negeri' && st.mode !== 'negeri') { st.mode = 'negeri'; st.dipilih = null; renderSemua(); }
      return pilih(tahap, id, true);
    };
    inst.refresh = refresh;
    inst.getState = function () { return JSON.parse(JSON.stringify(st)); };
    inst.getModel = function () { return M; };
    inst.lakukan = lakukan;
    inst.renderSvg = function () { if (st.mode === 'pdm' && st.pdmPaparan === 'svg') { renderToolbar(); renderStage(); } };
    inst.renderToolbar = renderToolbar;
    inst.destroy = function () { inst.unsub(); el.innerHTML = ''; el.classList.remove('mpm'); if (aktif === inst) { aktif = null; } };

    renderSemua();
    aktif = inst;
    return inst;
  }

  /** Muat dan simpan SVG untuk satu bahagian (dalaman). */
  async function muatSvg(inst, laluan, bahagianId) {
    var lp = sahkanLaluan(laluan);
    if (!lp) { return { ok: false, ralat: 'Laluan SVG mesti berada dalam ' + CONFIG.FOLDER_PETA + ' dan berakhir .svg.' }; }
    if (typeof root.fetch !== 'function') { return { ok: false, ralat: 'fetch tidak tersedia.' }; }
    var teks;
    try {
      var r = await root.fetch(lp, { cache: 'no-cache' });
      if (!r.ok) { return { ok: false, ralat: 'Fail peta tidak ditemui (' + r.status + '): ' + lp }; }
      teks = await r.text();
    } catch (e) { return { ok: false, ralat: 'Gagal memuat peta: ' + (e && e.message ? e.message : e) }; }
    var b = bersihkanSvg(teks);
    if (!b.ok) { return b; }
    inst.svg[bahagianId] = { laluan: lp, markup: b.markup };
    return { ok: true, laluan: lp };
  }

  /**
   * Muat peta SVG PDM kustom daripada assets/maps/ dan paparkannya dalam mod PDM.
   * Zon dalam SVG dipadankan dengan cawangan melalui atribut data-id / data-cawangan / data-kod /
   * data-nama atau id (contoh: id="097/013/001", data-id="097-013-001" atau nama cawangan).
   * svgFilePath: 'assets/maps/p097.svg' atau 'p097.svg'.
   * opts: { bahagianId (lalai: bahagian PDM aktif), instance }
   * Pulang Promise<{ ok, bahagianId, laluan, zon, dipadan, tiadaZon[], ralat }>.
   */
  async function loadCustomPDMMap(svgFilePath, opts) {
    opts = opts || {};
    var inst = opts.instance || aktif;
    if (!inst || !inst.model) { return { ok: false, ralat: 'Peta belum dipasang. Panggil MyPolitikMap.mount() dahulu.' }; }
    var bid = opts.bahagianId || inst.state.pdmBahagian;
    var b = inst.model.idxB[bid];
    if (!b) { return { ok: false, ralat: 'Bahagian tidak ditemui: ' + bid }; }
    var h = await muatSvg(inst, svgFilePath, bid);
    if (!h.ok) { return h; }

    inst.state.pdmNegeri = b.negeri.id; inst.state.pdmBahagian = bid; inst.state.mode = 'pdm'; inst.state.pdmPaparan = 'svg'; inst.state.dipilih = null;
    inst.setMode('pdm');
    inst.refresh();

    var tmp = root.document.createElement('div'); tmp.innerHTML = inst.svg[bid].markup;
    var pd = padanZon(tmp.querySelector('svg'), b);
    var tiada = b.cawangan.filter(function (c) { return !pd.padan[c.id]; }).map(function (c) { return c.id; });
    return { ok: true, bahagianId: bid, laluan: h.laluan, zon: pd.bilangan, dipadan: Object.keys(pd.padan).length, tiadaZon: tiada };
  }

  function dapatkanInstance() { return aktif; }

  /** Pasang automatik pada elemen [data-mypolitik-map] (data-mode='negeri|bahagian|pdm'). */
  function autoMount() {
    var senarai = root.document.querySelectorAll('[data-mypolitik-map]');
    Array.prototype.forEach.call(senarai, function (el) {
      if (el.getAttribute('data-mpm-dipasang')) { return; }
      el.setAttribute('data-mpm-dipasang', '1');
      mount(el, { mode: el.getAttribute('data-mode') || 'negeri' });
    });
  }

  return {
    CONFIG: CONFIG,
    NEGERI14: NEGERI14,
    TINDAKAN: TINDAKAN,
    mount: mount,
    autoMount: autoMount,
    getInstance: dapatkanInstance,
    loadCustomPDMMap: loadCustomPDMMap,
    jalankanTindakan: jalankanTindakan,
    semakTindakan: semakTindakan,
    binaModel: binaModel,
    kira: kira,
    tahapSokongan: tahapSokongan,
    padanNegeri: padanNegeri,
    sahkanLaluan: sahkanLaluan
  };
});