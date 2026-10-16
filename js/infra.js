/* Nusa Politik — utiliti infrastruktur (v7.31): Baris Gilir Acara, Bas CustomEvent, Pengesah Migrasi Simpanan.
   Modul bebas (UMD): window.MyPolitikBus / MyPolitikQueue / MyPolitikMigrasi. Tiada perubahan pada mekanik sedia ada. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikBus = api.Bus; root.MyPolitikQueue = api.Queue; root.MyPolitikMigrasi = api.Migrasi;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  /* ===== 1) BUS: Pub/Sub berasaskan CustomEvent (menyahgandingkan modul) ===== */
  var AWALAN = 'nusa:';
  var ACARA = Object.freeze({                       // nama acara rasmi (elak salah eja antara modul)
    BULAN_TAMAT: 'bulan:tamat',
    ACARA_SELESAI: 'acara:selesai',
    SAYAP_PEMILIHAN: 'sayap:pemilihan-selesai',
    PILIHAN_RAYA: 'pilihanraya:keputusan',
    SIMPANAN_DIMIGRASI: 'simpanan:dimigrasi'
  });
  var sasaran = (root.window && typeof root.window.addEventListener === 'function') ? root.window
    : (typeof EventTarget === 'function' ? new EventTarget() : null);
  var CE = typeof root.CustomEvent === 'function' ? root.CustomEvent : (typeof CustomEvent === 'function' ? CustomEvent : null);
  var pendengar = [];                               // { nama, fn, wrap } untuk off()

  function emit(nama, detail) {
    if (!sasaran || !CE) { return false; }
    return sasaran.dispatchEvent(new CE(AWALAN + nama, { detail: detail === undefined ? null : detail }));
  }
  /** Daftar pendengar; pulang fungsi nyahdaftar. Ralat dalam satu pendengar tidak menjejaskan yang lain. */
  function on(nama, fn) {
    if (!sasaran || typeof fn !== 'function') { return function () {}; }
    var wrap = function (ev) { try { fn(ev.detail, ev); } catch (e) { if (root.console) { root.console.error('[Bus] ' + nama, e); } } };
    sasaran.addEventListener(AWALAN + nama, wrap);
    pendengar.push({ nama: nama, fn: fn, wrap: wrap });
    return function () { off(nama, fn); };
  }
  function once(nama, fn) { var u = on(nama, function (d, ev) { u(); fn(d, ev); }); return u; }
  function off(nama, fn) {
    pendengar = pendengar.filter(function (x) {
      if (x.nama === nama && (!fn || x.fn === fn)) { sasaran.removeEventListener(AWALAN + nama, x.wrap); return false; }
      return true;
    });
  }
  var Bus = { ACARA: ACARA, emit: emit, on: on, once: once, off: off };

  /* ===== 2) QUEUE: baris gilir acara bersiri (gameState.eventQueue = profil.eventQueue) =====
     Item: { id, jenis, kunci?, keutamaan?, data? }. Hanya data JSON supaya selamat disimpan. */
  var MAKS_BARIS = 50;
  var sibuk = false;

  function baris(p) { if (!p) { return []; } if (!Array.isArray(p.eventQueue)) { p.eventQueue = []; } return p.eventQueue; }
  /** Tolak acara. Item dengan `kunci` yang sama (cth 'krisis-2026-3') tidak digandakan. Pulang true jika ditambah. */
  function tolak(p, item) {
    var q = baris(p); if (!item || !item.jenis) { return false; }
    if (item.kunci && q.some(function (x) { return x.kunci === item.kunci; })) { return false; }
    if (q.length >= MAKS_BARIS) { return false; }
    q.push({ id: item.id || (item.jenis + ':' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      jenis: item.jenis, kunci: item.kunci || null, keutamaan: Number(item.keutamaan) || 0, data: item.data === undefined ? null : item.data });
    q.sort(function (a, b) { return b.keutamaan - a.keutamaan; });       // sort stabil (ES2019): FIFO dalam keutamaan sama
    return true;
  }
  function intip(p) { return baris(p)[0] || null; }
  function ambil(p) { return baris(p).shift() || null; }
  function panjang(p) { return baris(p).length; }
  function kosongkan(p) { baris(p).length = 0; }

  /** Proses SATU PER SATU. pengendali(item) boleh pulang Promise (cth tunggu pemain menutup modal).
      Item dibuang HANYA selepas pengendali selesai, jadi muat semula tidak menghilangkan acara. */
  async function proses(p, pengendali, selepas) {
    if (sibuk) { return 0; }
    sibuk = true; var n = 0;
    try {
      while (baris(p).length) {
        var item = intip(p);
        try { await pengendali(item); } catch (e) { if (root.console) { root.console.error('[Queue]', item, e); } }
        var q = baris(p), i = q.indexOf(item); if (i >= 0) { q.splice(i, 1); }   // buang walaupun ralat: elak gelung tak berkesudahan
        n++; if (typeof selepas === 'function') { selepas(item, p); }
      }
    } finally { sibuk = false; }
    return n;
  }
  var Queue = { tolak: tolak, intip: intip, ambil: ambil, panjang: panjang, kosongkan: kosongkan, proses: proses, sibuk: function () { return sibuk; } };

  /* ===== 3) MIGRASI: pengesah versi simpanan lama =====
     Langkah ke versi N didaftar dalam LANGKAH[N]. isiLalai() melengkapkan medan baharu TANPA menimpa nilai sedia ada. */
  function klon(v) { return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; }
  function adaBiasa(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  /** Isi medan hilang/null daripada templat (rekursif untuk objek biasa; tatasusunan tidak digabung). Pulang senarai laluan yang diisi. */
  function isiLalai(sasar, templat, laluan, diisi) {
    diisi = diisi || []; laluan = laluan || '';
    Object.keys(templat).forEach(function (k) {
      var lp = laluan ? laluan + '.' + k : k, t = templat[k];
      if (sasar[k] === undefined || sasar[k] === null) { sasar[k] = klon(t); diisi.push(lp); }
      else if (adaBiasa(t) && adaBiasa(sasar[k])) { isiLalai(sasar[k], t, lp, diisi); }
      else if (Array.isArray(t) && !Array.isArray(sasar[k])) { sasar[k] = klon(t); diisi.push(lp); }
    });
    return diisi;
  }

  var LANGKAH = {};                                  // { versi: function (p) { ...ubah p di tempat... } }
  var TEMPLAT = { eventQueue: [], settings: { difficultyLevel: 'NORMAL' } };   // medan baharu; tambah di sini bila ada medan baru
  var VERSI_SEMASA = 2;

  /** Daftar langkah migrasi ke `versi` (cth Migrasi.daftar(3, function (p) { p.rival = p.rival || {}; })). */
  function daftar(versi, fn) { LANGKAH[versi] = fn; if (versi > VERSI_SEMASA) { VERSI_SEMASA = versi; } }
  function tetapTemplat(t) { TEMPLAT = t; }

  /** Migrasi satu profil. opts: { versi (sasaran), templat, sandar(fnMentah) }. Pulang { profil, dari, ke, diisi, langkah, diubah }. */
  function migrasi(p, opts) {
    opts = opts || {};
    if (!p || typeof p !== 'object') { return { profil: p, diubah: false, dari: null, ke: null, diisi: [], langkah: [] }; }
    var sasaranV = opts.versi || VERSI_SEMASA, dari = parseInt(p.versi, 10); if (!isFinite(dari) || dari < 1) { dari = 1; }
    var hasil = { profil: p, dari: dari, ke: Math.max(dari, sasaranV), diisi: [], langkah: [], diubah: false };
    if (dari > sasaranV) { hasil.ke = dari; return hasil; }                          // simpanan lebih baharu: jangan sentuh
    if (typeof opts.sandar === 'function' && dari < sasaranV) { try { opts.sandar(klon(p)); } catch (e) { /* sandaran gagal tidak menghalang */ } }
    for (var v = dari + 1; v <= sasaranV; v++) {
      if (typeof LANGKAH[v] === 'function') { try { LANGKAH[v](p); hasil.langkah.push(v); } catch (e) { if (root.console) { root.console.error('[Migrasi] v' + v, e); } } }
    }
    hasil.diisi = isiLalai(p, opts.templat || TEMPLAT);
    if (!Array.isArray(p.eventQueue)) { p.eventQueue = []; }
    p.versi = sasaranV;
    hasil.diubah = dari < sasaranV || hasil.diisi.length > 0;
    if (hasil.diubah && Bus) { emit(ACARA.SIMPANAN_DIMIGRASI, { dari: dari, ke: sasaranV, diisi: hasil.diisi }); }
    return hasil;
  }
  var Migrasi = { migrasi: migrasi, daftar: daftar, isiLalai: isiLalai, tetapTemplat: tetapTemplat, versi: function () { return VERSI_SEMASA; } };

  return { Bus: Bus, Queue: Queue, Migrasi: Migrasi };
});
