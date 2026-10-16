/* ==========================================================================
   Nusa Politik — js/slot.js   (v5.4)
   Slot simpanan berbilang (maks 5). Setiap slot menyimpan satu watak lengkap:
   profil pemain, acara rawak dan kemajuan tutorial.

   Reka bentuk: kunci biasa (myPolitik_player / _events / _tutorial) sentiasa mewakili
   slot AKTIF, jadi modul lain tidak berubah. Apabila slot ditukar, kandungan slot lama
   disalin ke kunci slotnya (myPolitik_slot<N>_*) dan kandungan slot baharu dimuatkan
   ke kunci biasa. Simpanan lama (satu watak) menjadi slot 1 secara automatik.

   Penukaran slot dibuat pada menu utama (index.html), sebelum dashboard dimuatkan.
   API: MAKS, aktif(), senarai(), ringkasan(n), slotKosong(), aktifkan(n), padam(n)
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikSlot = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  var MAKS = 5, INDEKS = 'myPolitik_slot_aktif';
  var KANON = { player: 'myPolitik_player', player_bak: 'myPolitik_player_bak', events: 'myPolitik_events', tutorial: 'myPolitik_tutorial' };
  var JENIS = Object.keys(KANON);

  function S() { try { return root.localStorage || null; } catch (e) { return null; } }
  function kunciSlot(n, j) { return 'myPolitik_slot' + n + '_' + j; }
  function sahNo(n) { if (typeof n === 'string') { n = n.replace(/^slot_/i, ''); } n = parseInt(n, 10); return n >= 1 && n <= MAKS ? n : 0; }     // v7.25: terima 'slot_1' … 'slot_5'

  function aktif() {
    var s = S(); if (!s) { return 1; }
    try { return sahNo(s.getItem(INDEKS)) || 1; } catch (e) { return 1; }
  }

  function baca(k) { var s = S(); try { return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function tulis(k, v) { var s = S(); if (!s) { return; } if (v === null || v === undefined) { s.removeItem(k); } else { s.setItem(k, v); } }

  /** Ringkasan satu slot, atau null jika kosong. */
  function ringkasan(n) {
    n = sahNo(n); if (!n) { return null; }
    var raw = n === aktif() ? baca(KANON.player) : baca(kunciSlot(n, 'player')), p = null;
    try { p = raw ? JSON.parse(raw) : null; } catch (e) { p = null; }
    if (!p || typeof p !== 'object' || !p.nama) { return null; }
    var d = p.demografik || {}, umur = isFinite(parseInt(d.umur, 10)) ? parseInt(d.umur, 10) + Math.max(0, (parseInt(p.tahun, 10) || 2026) - 2026) : null;
    return {
      no: n, nama: p.nama, jawatan: p.jawatan || 'Ahli Biasa', cawangan: p.cawangan || '', tahun: p.tahun || 2026, bulan: p.bulan || 1,
      umur: umur, kategori: d.kategori || '', avatar: p.avatar || d.kategoriKod || 'pemuda', tamat: !!p.tamat
    };
  }

  function senarai() {
    var a = aktif(), r = [];
    for (var n = 1; n <= MAKS; n++) { r.push({ no: n, aktif: n === a, ringkas: ringkasan(n) }); }
    return r;
  }

  /** Nombor slot kosong pertama (mengutamakan slot aktif jika kosong), atau 0 jika semua penuh. */
  function slotKosong() {
    if (!ringkasan(aktif())) { return aktif(); }
    for (var n = 1; n <= MAKS; n++) { if (!ringkasan(n)) { return n; } }
    return 0;
  }

  /** Jadikan slot n aktif: simpan slot semasa, muatkan slot n. Pulang { ok } atau { ok:false, ralat }. */
  function aktifkan(n) {
    n = sahNo(n); if (!n) { return { ok: false, ralat: 'Nombor slot tidak sah.' }; }
    var s = S(); if (!s) { return { ok: false, ralat: 'Pelayar menyekat storan setempat.' }; }
    var lama = aktif();
    if (n === lama) { return { ok: true, tukar: false }; }
    try {
      JENIS.forEach(function (j) { tulis(kunciSlot(lama, j), baca(KANON[j])); });         // simpan slot lama
      JENIS.forEach(function (j) { tulis(KANON[j], baca(kunciSlot(n, j))); tulis(kunciSlot(n, j), null); });   // muat slot baharu
      s.setItem(INDEKS, String(n));
    } catch (e) {
      return { ok: false, ralat: 'Gagal menukar slot (storan penuh atau disekat).' };
    }
    return { ok: true, tukar: true };
  }

  /** Padam slot n (termasuk acara dan tutorial). */
  function padam(n) {
    n = sahNo(n); if (!n) { return { ok: false, ralat: 'Nombor slot tidak sah.' }; }
    try {
      JENIS.forEach(function (j) { tulis(kunciSlot(n, j), null); if (n === aktif()) { tulis(KANON[j], null); } });
    } catch (e) { return { ok: false, ralat: 'Gagal memadam slot.' }; }
    return { ok: true };
  }

  return { MAKS: MAKS, nombor: sahNo, kunci: kunciSlot, aktif: aktif, senarai: senarai, ringkasan: ringkasan, slotKosong: slotKosong, aktifkan: aktifkan, padam: padam };
});
