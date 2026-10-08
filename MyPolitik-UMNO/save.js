/* ==========================================================================
   MyPolitik: UMNO — js/save.js
   Simpan dan muat profil pemain dalam localStorage (kunci 'myPolitik_player').
   Tiada kebergantungan lain. Semua akses storan dibalut try/catch kerana
   localStorage boleh dilarang (mod peribadi, tetapan pelayar).
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikSave = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  var KEY = 'myPolitik_player';
  var VERSI = 1;

  // Nilai permulaan setiap pemain baharu.
  var DEFAULTS = Object.freeze({ jawatan: 'Ahli Biasa', ip: 10, myr: 1000, ap: 5, tahun: 2026 });

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
    var kod = String(c.id).split('/');
    return {
      versi: VERSI,
      nama: String(input.nama || '').trim(),
      negeri: c.negeri,
      bahagian: c.bahagianNama,
      dun: c.dunNama,
      cawangan: c.nama,
      id: c.id,
      kod: { parlimen: kod[0], dun: kod[1], lokaliti: kod[2] },
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
      dicipta: new Date().toISOString()
    };
  }

  function sah(p) {
    return !!(p && typeof p === 'object' && typeof p.nama === 'string' && p.nama && typeof p.id === 'string' && p.id);
  }

  /** Simpan profil. Pulang { ok:true } atau { ok:false, ralat:'...' }. Bacaan semula mengesahkan simpanan. */
  function savePlayer(profil) {
    if (!sah(profil)) { return { ok: false, ralat: 'Profil pemain tidak lengkap.' }; }
    var s = storan();
    if (!s) { return { ok: false, ralat: 'Pelayar menyekat storan setempat. Matikan mod peribadi atau benarkan data tapak web, kemudian cuba lagi.' }; }
    try {
      s.setItem(KEY, JSON.stringify(profil));
      var balik = JSON.parse(s.getItem(KEY));
      if (!sah(balik) || balik.id !== profil.id) { throw new Error('semakan gagal'); }
      return { ok: true };
    } catch (e) {
      return { ok: false, ralat: 'Profil tidak dapat disimpan (storan penuh atau disekat).' };
    }
  }

  /** Muat profil. Pulang objek atau null jika tiada / rosak. */
  function loadPlayer() {
    var s = storan();
    if (!s) { return null; }
    try {
      var p = JSON.parse(s.getItem(KEY));
      return sah(p) ? p : null;
    } catch (e) { return null; }
  }

  function hasPlayer() { return loadPlayer() !== null; }

  /** Gabung perubahan ke dalam profil sedia ada (untuk dashboard dan permainan). */
  function updatePlayer(perubahan) {
    var p = loadPlayer();
    if (!p) { return { ok: false, ralat: 'Tiada profil pemain.' }; }
    for (var k in perubahan) { p[k] = perubahan[k]; }
    return savePlayer(p);
  }

  function clearPlayer() {
    var s = storan();
    if (!s) { return false; }
    try { s.removeItem(KEY); return true; } catch (e) { return false; }
  }

  return {
    KEY: KEY,
    DEFAULTS: DEFAULTS,
    boleh: boleh,
    buildPlayerProfile: buildPlayerProfile,
    savePlayer: savePlayer,
    loadPlayer: loadPlayer,
    hasPlayer: hasPlayer,
    updatePlayer: updatePlayer,
    clearPlayer: clearPlayer
  };
});