/* ==========================================================================
   Nusa Politik — js/stress.js   (v5.6)
   Tahap Stress dan Kesihatan pemain.

   - Stress (0 hingga 100) bertambah setiap bulan mengikut jawatan yang dipegang (makin tinggi pangkat,
     makin besar beban), ditolak pemulihan semula jadi. Ahli Biasa pulih perlahan.
   - Kesihatan (0 hingga 100) pulih jika Stress rendah, dan merosot jika Stress melebihi 60.
     Makin lanjut usia, makin cepat merosot.
   - Kesihatan di bawah 50 menambah risiko tahunan tamat kerjaya (lihat hayat.js). Kesihatan 0 menamatkan
     kerjaya serta-merta (bersara kerana kesihatan).
   - Tindakan Rehat dan acara krisis akar umbi boleh mengurangkan Stress; melepaskan jawatan
     (lepasJawatan) mengurangkan beban dengan serta-merta.
   Medan profil: stress, kesihatan. Simpanan lama mendapat nilai lalai (0 dan 100).
   Angka ialah andaian permainan, boleh dilaras dalam CONFIG.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikStres = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  var CONFIG = {
    PEMULIHAN: 3,                 // pemulihan Stress semula jadi sebulan
    BEBAN: [                      // [pangkat minimum, beban sebulan]
      [12, 8], [10, 7], [8, 6], [6, 5], [4, 4], [3, 3], [1, 2]
    ],
    AMBANG_STRESS: { sederhana: 40, tinggi: 60, kritikal: 80 },
    PULIH_KESIHATAN: 1,           // kesihatan pulih sebulan jika Stress <= 40
    PEMBAGI_ROSAK: 8,             // kerosakan sebulan = (Stress - 60) / PEMBAGI_ROSAK, sekurang-kurangnya 1
    UMUR_PENGGANDA: 50,           // selepas umur ini kerosakan digandakan beransur-ansur
    RISIKO_KESIHATAN_MULA: 50,    // kesihatan di bawah nilai ini menambah risiko tahunan
    RISIKO_TAMBAHAN_MAKS: 0.06    // tambahan risiko tahunan pada kesihatan 0
  };

  function S() { return root.MyPolitikSave || (typeof require === 'function' ? tryReq('./save.js') : null); }
  function J() { return root.MyPolitikJawatan || (typeof require === 'function' ? tryReq('./jawatan.js') : null); }
  function H() { return root.MyPolitikHayat || (typeof require === 'function' ? tryReq('./hayat.js') : null); }
  function tryReq(f) { try { return require(f); } catch (e) { return null; } }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function nilai(p) {
    var st = Number(p && p.stress), ks = Number(p && p.kesihatan);
    return { stress: isFinite(st) ? clamp(Math.round(st), 0, 100) : 0, kesihatan: isFinite(ks) ? clamp(Math.round(ks), 0, 100) : 100 };
  }

  /** Pangkat jawatan semasa (0 jika Ahli Biasa). */
  function pangkatSemasa(p) {
    var j = J(), t = 0;
    if (j && j.getJawatan) { j.getJawatan(p).forEach(function (x) { t = Math.max(t, x.pangkat || 0); }); }
    return t;
  }

  /** Beban Stress sebulan daripada jawatan yang dipegang. */
  function bebanJawatan(p) {
    var pg = pangkatSemasa(p);
    for (var i = 0; i < CONFIG.BEBAN.length; i++) { if (pg >= CONFIG.BEBAN[i][0]) { return CONFIG.BEBAN[i][1]; } }
    return 0;
  }

  function umur(p) { var h = H(); return h && h.umurSemasa ? h.umurSemasa(p) : null; }

  /** Perubahan Kesihatan sebulan bagi Stress dan umur tertentu. */
  function kadarKesihatan(stress, u) {
    if (stress <= CONFIG.AMBANG_STRESS.sederhana) { return CONFIG.PULIH_KESIHATAN; }
    if (stress <= CONFIG.AMBANG_STRESS.tinggi) { return 0; }
    var rosak = Math.max(1, (stress - CONFIG.AMBANG_STRESS.tinggi) / CONFIG.PEMBAGI_ROSAK);
    if (u && u > CONFIG.UMUR_PENGGANDA) { rosak *= 1 + (u - CONFIG.UMUR_PENGGANDA) / CONFIG.UMUR_PENGGANDA; }
    return -Math.round(rosak);
  }

  function labelStress(s) { return s >= CONFIG.AMBANG_STRESS.kritikal ? 'Kritikal' : s >= CONFIG.AMBANG_STRESS.tinggi ? 'Tinggi' : s >= CONFIG.AMBANG_STRESS.sederhana ? 'Sederhana' : 'Rendah'; }
  function labelKesihatan(k) { return k <= 25 ? 'Kritikal' : k <= 50 ? 'Lemah' : k <= 75 ? 'Sederhana' : 'Baik'; }

  /** Ringkasan untuk UI. */
  function ringkasan(p) {
    var n = nilai(p), beban = bebanJawatan(p), u = umur(p);
    return {
      stress: n.stress, kesihatan: n.kesihatan, labelStress: labelStress(n.stress), labelKesihatan: labelKesihatan(n.kesihatan),
      beban: beban, bersih: beban - CONFIG.PEMULIHAN, kadarKesihatan: kadarKesihatan(n.stress, u), risikoTambahan: risikoTambahan(p)
    };
  }

  /** Tambahan kebarangkalian tamat kerjaya tahunan akibat kesihatan lemah. */
  function risikoTambahan(p) {
    var k = nilai(p).kesihatan;
    return k >= CONFIG.RISIKO_KESIHATAN_MULA ? 0 : (CONFIG.RISIKO_KESIHATAN_MULA - k) / CONFIG.RISIKO_KESIHATAN_MULA * CONFIG.RISIKO_TAMBAHAN_MAKS;
  }

  /** Laraskan Stress/Kesihatan. d = { stress, kesihatan } (delta, boleh negatif). Pulang { ok, stress, kesihatan }. */
  function laras(d) {
    var s = S(), p = s && s.loadPlayer();
    if (!p) { return { ok: false }; }
    var n = nilai(p), ns = clamp(n.stress + (Number(d && d.stress) || 0), 0, 100), nk = clamp(n.kesihatan + (Number(d && d.kesihatan) || 0), 0, 100);
    var r = s.applyEffects({}, { kiraTindakan: false, patch: { stress: ns, kesihatan: nk } });
    return { ok: !!(r && r.ok), stress: ns, kesihatan: nk };
  }

  /** Lepaskan jawatan semasa secara sukarela (menjadi Ahli Biasa). */
  function lepasJawatan() {
    var s = S(), p = s && s.loadPlayer();
    if (!p) { return { ok: false }; }
    var j = J(), senarai = j && j.getJawatan ? j.getJawatan(p) : [], lama = p.jawatan, tangga = Number(p.pangkatUtamaLalu) || 0;
    senarai.forEach(function (x) { if (x.kumpulan === 'utama') { tangga = Math.max(tangga, x.pangkat || 0); } });
    var patch = { jawatanList: [], jawatan: 'Ahli Biasa', cabaran: null, amaranAktif: false, pangkatUtamaLalu: tangga };
    var r = s.applyEffects({}, { kiraTindakan: false, patch: patch, log: { tindakan: 'lepas_jawatan', nama: 'Melepaskan ' + lama, peringkat: 'ahli' } });
    return { ok: !!(r && r.ok), jawatanLama: lama };
  }

  /**
   * Proses bulanan (dipanggil oleh Calendar.majuBulan). Pulang { peristiwa:[{jenis,mesej}], tamat }.
   */
  function prosesBulan() {
    var s = S(), p = s && s.loadPlayer(), ev = [];
    if (!p || p.tamat) { return { peristiwa: ev, tamat: (p && p.tamat) || null }; }
    var n = nilai(p), beban = bebanJawatan(p), baruS = clamp(n.stress + beban - CONFIG.PEMULIHAN, 0, 100);
    var dK = kadarKesihatan(baruS, umur(p)), baruK = clamp(n.kesihatan + dK, 0, 100);
    s.applyEffects({}, { kiraTindakan: false, patch: { stress: baruS, kesihatan: baruK } });

    var T = CONFIG.AMBANG_STRESS;
    if (n.stress < T.tinggi && baruS >= T.tinggi) { ev.push({ jenis: 'stress', mesej: 'Tekanan kerja mula menjejaskan anda (Stress ' + baruS + '). Kesihatan akan merosot jika tidak berehat.' }); }
    else if (n.stress < T.kritikal && baruS >= T.kritikal) { ev.push({ jenis: 'stress', mesej: 'Stress anda kritikal (' + baruS + '). Berehat atau lepaskan jawatan sebelum kesihatan runtuh.' }); }
    if (baruK <= 25 && n.kesihatan > 25) { ev.push({ jenis: 'stress', mesej: 'Doktor memberi amaran: kesihatan anda kritikal (' + baruK + '%). Kurangkan tekanan segera.' }); }

    if (baruK <= 0) {
      var h = H();
      if (h && h.tamatkan) { var t = h.tamatkan('kesihatan_merosot'); if (t.ok) { ev.push({ jenis: 'hayat', mesej: t.tamat.mesej }); return { peristiwa: ev, tamat: t.tamat }; } }
    }
    return { peristiwa: ev, tamat: null };
  }

  return {
    CONFIG: CONFIG, ringkasan: ringkasan, bebanJawatan: bebanJawatan, kadarKesihatan: kadarKesihatan, risikoTambahan: risikoTambahan,
    labelStress: labelStress, labelKesihatan: labelKesihatan, laras: laras, lepasJawatan: lepasJawatan, prosesBulan: prosesBulan
  };
});
