/* ==========================================================================
   MyPolitik: UMNO — js/save.js
   Simpan dan muat profil pemain dalam localStorage (kunci 'myPolitik_player').
   Tiada kebergantungan lain. Semua akses storan dibalut try/catch kerana
   localStorage boleh dilarang (mod peribadi, tetapan pelayar).

   Setiap simpanan menyiarkan acara 'myPolitik:player-updated' pada window
   (dan 'storage' dari tab lain), supaya dashboard.html boleh segar semula
   secara langsung melalui MyPolitikSave.subscribe(fn).

   applyEffects() ialah laluan tunggal untuk mengubah IP, MYR, AP dan
   kesetiaan. Modul tindakan (ordinaryMember.js, incumbent.js) memanggilnya.
   ========================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikSave = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  var KEY = 'myPolitik_player';
  var VERSI = 2;
  var NAMA_ACARA = 'myPolitik:player-updated';
  var MAKS_LOG = 50;
  var MAKS_ISU = 12;

  // Kesetiaan dalam peratus (0 hingga 100).
  var KESETIAAN_LALAI = Object.freeze({
    ketuaCawangan: 50,
    ajk: 50,
    akarUmbi: 50,
    perwakilan: 40,       // Perwakilan PAU
    penentang: 30         // Penentang / Atas Pagar
  });

  var KESETIAAN_LABEL = Object.freeze({
    ketuaCawangan: 'Ketua Cawangan',
    ajk: 'AJK',
    akarUmbi: 'Akar Umbi',
    perwakilan: 'Perwakilan PAU',
    penentang: 'Penentang/Atas Pagar'
  });

  // Nilai permulaan setiap pemain baharu.
  var DEFAULTS = Object.freeze({ jawatan: 'Ahli Biasa', ip: 10, myr: 1000, ap: 5, tahun: 2026, reputasi: 50 });

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function salin(o) { return JSON.parse(JSON.stringify(o)); }

  function storan() {
    try {
      var s = typeof localStorage !== 'undefined' ? localStorage : null;
      if (!s) { return null; }
      var ujian = '__mp_ujian__';
      s.setItem(ujian, '1'); s.removeItem(ujian);
      return s;
    } catch (e) { return null; }
  }

  function boleh() { return !!storan(); }

  function sah(p) {
    return !!(p && typeof p === 'object' && typeof p.nama === 'string' && p.nama && typeof p.id === 'string' && p.id);
  }

  /** Lengkapkan medan yang tiada (profil lama daripada versi 1) dan hadkan nilai. */
  function normalisasi(p) {
    if (!sah(p)) { return p; }
    p.versi = VERSI;
    p.ip = Math.max(0, Math.round(Number(p.ip) || 0));
    p.ap = Math.max(0, Math.round(Number(p.ap) || 0));
    p.myr = Math.max(0, Math.round(Number(p.myr) || 0));
    var rep = Number(p.reputasi);                    // Reputasi Parti, 0 hingga 100
    p.reputasi = isFinite(rep) ? clamp(Math.round(rep), 0, 100) : DEFAULTS.reputasi;
    if (!p.kesetiaan || typeof p.kesetiaan !== 'object') { p.kesetiaan = {}; }
    Object.keys(KESETIAAN_LALAI).forEach(function (k) {
      var v = Number(p.kesetiaan[k]);
      p.kesetiaan[k] = isFinite(v) ? clamp(Math.round(v), 0, 100) : KESETIAAN_LALAI[k];
    });
    if (!Array.isArray(p.isu)) { p.isu = []; }
    if (!Array.isArray(p.log)) { p.log = []; }
    if (p.cabaran === undefined) { p.cabaran = null; }
    if (p.calon === undefined) { p.calon = null; }
    p.bilTindakan = Math.max(0, parseInt(p.bilTindakan, 10) || 0);
    p.amaranAktif = !!p.amaranAktif;
    return p;
  }

  /**
   * Bina profil lengkap pemain.
   * input: {
   *   nama,
   *   demografik: { jantina:'Lelaki'|'Perempuan', umur, kod:'pemuda'|..., label },
   *   cawangan: objek cawangan daripada data.js (id, nama, dunNama, bahagianNama, negeri, jumlahAhli, ...)
   * }
   */
  function buildPlayerProfile(input) {
    var c = input.cawangan, d = input.demografik;
    var idPenuh = String(c.idSheet || c.id);      // ID seperti dalam Google Sheets
    var bhg = idPenuh.split('/'), n = bhg.length;
    return normalisasi({
      versi: VERSI,
      nama: String(input.nama || '').trim(),
      negeri: c.negeri,
      bahagian: c.bahagianNama,
      dun: c.dunNama,
      cawangan: c.nama,
      id: idPenuh,
      kod: { negeri: n === 4 ? bhg[0] : null, parlimen: bhg[n - 3], dun: bhg[n - 2], lokaliti: bhg[n - 1] },
      demografik: { jantina: d.jantina, umur: d.umur, kategori: d.label, kategoriKod: d.kod },
      cawanganInfo: {
        jumlahAhli: c.jumlahAhli, lelaki: c.lelaki, perempuan: c.perempuan,
        bawah40: c.bawah40, atas40: c.atas40
      },
      jawatan: DEFAULTS.jawatan,
      ip: DEFAULTS.ip,
      myr: DEFAULTS.myr,
      ap: DEFAULTS.ap,
      tahun: DEFAULTS.tahun,
      kesetiaan: salin(KESETIAAN_LALAI),
      dicipta: new Date().toISOString()
    });
  }

  function siarkan(profil, meta) {
    try {
      if (root.window && typeof root.window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        root.window.dispatchEvent(new CustomEvent(NAMA_ACARA, { detail: { profil: profil, meta: meta || null } }));
      }
    } catch (e) { /* acara tidak kritikal */ }
  }

  /** Simpan profil. Pulang { ok:true } atau { ok:false, ralat:'...' }. Bacaan semula mengesahkan simpanan. */
  function savePlayer(profil, meta) {
    if (!sah(profil)) { return { ok: false, ralat: 'Profil pemain tidak lengkap.' }; }
    var s = storan();
    if (!s) { return { ok: false, ralat: 'Pelayar menyekat storan setempat. Matikan mod peribadi atau benarkan data tapak web, kemudian cuba lagi.' }; }
    try {
      normalisasi(profil);
      s.setItem(KEY, JSON.stringify(profil));
      var balik = JSON.parse(s.getItem(KEY));
      if (!sah(balik) || balik.id !== profil.id) { throw new Error('semakan gagal'); }
    } catch (e) {
      return { ok: false, ralat: 'Profil tidak dapat disimpan (storan penuh atau disekat).' };
    }
    siarkan(profil, meta);
    return { ok: true };
  }

  /** Muat profil (sentiasa lengkap). Pulang objek atau null jika tiada / rosak. */
  function loadPlayer() {
    var s = storan();
    if (!s) { return null; }
    try {
      var p = JSON.parse(s.getItem(KEY));
      return sah(p) ? normalisasi(p) : null;
    } catch (e) { return null; }
  }

  function hasPlayer() { return loadPlayer() !== null; }

  /** Gabung perubahan ke dalam profil sedia ada. */
  function updatePlayer(perubahan) {
    var p = loadPlayer();
    if (!p) { return { ok: false, ralat: 'Tiada profil pemain.' }; }
    for (var k in perubahan) { p[k] = perubahan[k]; }
    var h = savePlayer(p);
    if (h.ok) { h.profil = p; }
    return h;
  }

  function clearPlayer() {
    var s = storan();
    if (!s) { return false; }
    try { s.removeItem(KEY); return true; } catch (e) { return false; }
  }

  /**
   * Laluan tunggal untuk mengubah sumber pemain.
   * kesan: { ip, myr, ap, kesetiaan:{ketuaCawangan, ajk, akarUmbi, perwakilan, penentang}, isu:{...} }
   *        nilai ialah perubahan (boleh negatif). AP dan MYR tidak boleh jatuh bawah 0
   *        (tindakan ditolak). IP tidak jatuh bawah 0. Kesetiaan dihadkan 0 hingga 100.
   * opts:  { log:{ tindakan, nama, ... }, patch:{ medan profil untuk digabung }, kiraTindakan:false }
   * Pulangan: { ok, perubahan:{ip,myr,ap,kesetiaan}, sebelum, profil } atau { ok:false, kod, ralat }
   * Perubahan yang dipulangkan ialah nilai sebenar selepas had dikenakan.
   */
  function applyEffects(kesan, opts) {
    opts = opts || {}; kesan = kesan || {};
    var p = loadPlayer();
    if (!p) { return { ok: false, kod: 'tiada_profil', ralat: 'Tiada profil pemain. Daftar dahulu di halaman utama.' }; }

    var sebelum = { ip: p.ip, myr: p.myr, ap: p.ap, reputasi: p.reputasi, kesetiaan: salin(p.kesetiaan) };
    var ap = p.ap + (kesan.ap || 0), myr = p.myr + (kesan.myr || 0);
    if (ap < 0) { return { ok: false, kod: 'ap', ralat: 'Mata Tindakan (AP) tidak mencukupi.' }; }
    if (myr < 0) { return { ok: false, kod: 'myr', ralat: 'Wang (MYR) tidak mencukupi.' }; }

    var kes = kesan.kesetiaan || {};
    for (var k in kes) {
      if (!Object.prototype.hasOwnProperty.call(KESETIAAN_LALAI, k)) {
        return { ok: false, kod: 'kesetiaan', ralat: 'Jenis kesetiaan tidak sah: ' + k };
      }
    }

    p.ap = ap; p.myr = myr;
    p.ip = Math.max(0, p.ip + (kesan.ip || 0));
    p.reputasi = clamp(p.reputasi + (kesan.reputasi || 0), 0, 100);
    for (var j in kes) { p.kesetiaan[j] = clamp(p.kesetiaan[j] + kes[j], 0, 100); }
    if (kesan.isu) { p.isu.unshift(kesan.isu); p.isu = p.isu.slice(0, MAKS_ISU); }
    if (opts.kiraTindakan !== false) { p.bilTindakan += 1; }
    if (opts.patch) { for (var f in opts.patch) { p[f] = opts.patch[f]; } }

    var perubahan = { ip: p.ip - sebelum.ip, myr: p.myr - sebelum.myr, ap: p.ap - sebelum.ap, reputasi: p.reputasi - sebelum.reputasi, kesetiaan: {} };
    Object.keys(KESETIAAN_LALAI).forEach(function (n) {
      var d = p.kesetiaan[n] - sebelum.kesetiaan[n];
      if (d) { perubahan.kesetiaan[n] = d; }
    });

    if (opts.log) {
      var entri = { masa: new Date().toISOString(), tahun: p.tahun, perubahan: perubahan };
      for (var l in opts.log) { entri[l] = opts.log[l]; }
      p.log.unshift(entri);
      p.log = p.log.slice(0, MAKS_LOG);
    }

    var hasil = savePlayer(p, { perubahan: perubahan, tindakan: opts.log ? opts.log.tindakan : null });
    if (!hasil.ok) { return { ok: false, kod: 'simpan', ralat: hasil.ralat }; }
    return { ok: true, perubahan: perubahan, sebelum: sebelum, profil: p };
  }

  /** Format ringkas: "+10 IP, -1 AP, +15 Kesetiaan Ketua Cawangan". */
  function ringkasPerubahan(perubahan) {
    var bahagian = [];
    function tanda(n) { return (n > 0 ? '+' : '-') + Math.abs(n).toLocaleString('ms-MY'); }
    if (perubahan.ip) { bahagian.push(tanda(perubahan.ip) + ' IP'); }
    if (perubahan.myr) { bahagian.push((perubahan.myr > 0 ? '+' : '-') + 'MYR ' + Math.abs(perubahan.myr).toLocaleString('ms-MY')); }
    if (perubahan.ap) { bahagian.push(tanda(perubahan.ap) + ' AP'); }
    if (perubahan.reputasi) { bahagian.push(tanda(perubahan.reputasi) + ' Reputasi Parti'); }
    Object.keys(perubahan.kesetiaan || {}).forEach(function (k) {
      bahagian.push(tanda(perubahan.kesetiaan[k]) + ' Kesetiaan ' + KESETIAAN_LABEL[k]);
    });
    return bahagian.join(', ');
  }

  /**
   * Dengar perubahan profil (tab ini melalui acara tersuai, tab lain melalui 'storage').
   * fn(profil, meta). Pulang fungsi untuk berhenti mendengar.
   */
  function subscribe(fn) {
    var w = root.window;
    if (!w || typeof w.addEventListener !== 'function') { return function () {}; }
    function dalam(ev) { fn(ev.detail.profil, ev.detail.meta); }
    function luar(ev) {
      if (ev.key === KEY || ev.key === null) { fn(loadPlayer(), { dariTabLain: true }); }
    }
    w.addEventListener(NAMA_ACARA, dalam);
    w.addEventListener('storage', luar);
    return function () { w.removeEventListener(NAMA_ACARA, dalam); w.removeEventListener('storage', luar); };
  }

  /** Rawak berbenih: seed yang sama memberi turutan yang sama. Dikongsi oleh enjin pemilihan dan mesyuarat. */
  function rngBerbenih(seed) {
    var s = String(seed), h = 1779033703 ^ s.length, i;
    for (i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    var a = (h ^= h >>> 16) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return {
    KEY: KEY,
    rngBerbenih: rngBerbenih,
    NAMA_ACARA: NAMA_ACARA,
    DEFAULTS: DEFAULTS,
    KESETIAAN_LALAI: KESETIAAN_LALAI,
    KESETIAAN_LABEL: KESETIAAN_LABEL,
    boleh: boleh,
    buildPlayerProfile: buildPlayerProfile,
    savePlayer: savePlayer,
    loadPlayer: loadPlayer,
    hasPlayer: hasPlayer,
    updatePlayer: updatePlayer,
    clearPlayer: clearPlayer,
    applyEffects: applyEffects,
    ringkasPerubahan: ringkasPerubahan,
    subscribe: subscribe
  };
});