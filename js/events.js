/* ==========================================================================
   Nusa Politik — js/events.js
   Sistem Acara Rawak (Random Event Pop-Up).

   Cetusan
     - 'bulan'    : setiap kali bulan bertukar (peluang CONFIG.PELUANG_BULAN)
     - 'aktiviti' : selepas tindakan akar umbi (peluang CONFIG.PELUANG_AKTIVITI,
                    maks CONFIG.MAKS_AKTIVITI_SEBULAN sebulan)

   Setiap acara ada 2-3 pilihan dengan implikasi berbeza (guna Dana / guna AP /
   abaikan). Kesan terus dikenakan melalui MyPolitikSave.applyEffects().
   Pilihan yang kosnya melebihi AP/Dana pemain dinyahaktifkan; pilihan
   "abaikan" sentiasa ada, jadi pemain tidak pernah terperangkap.

   Acara yang belum dijawab disimpan (kunci 'myPolitik_events') supaya tidak
   hilang jika halaman dimuat semula.

   Cara guna:
     var a = MyPolitikEvents.janaAcara({ pencetus: 'bulan' });   // acara | null
     // a = { uid, id, kategori, ikon, tajuk, huraian, pilihan:[{id,label,huraian,ringkas,boleh,sebab}] }
     var h = MyPolitikEvents.pilih(a.pilihan[0].id);             // { ok, mesej, ringkas, perubahan, acara, pilihan }
     MyPolitikEvents.getTertunggak();                            // acara belum dijawab | null
   Perlu dimuatkan selepas js/save.js.
   ========================================================================== */
(function (root, factory) {
  var S = root.MyPolitikSave || (typeof module === 'object' && typeof require === 'function' ? require('./save.js') : null);
  if (!S) { throw new Error('events.js memerlukan js/save.js dimuatkan dahulu.'); }
  var api = factory(S, root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikEvents = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (S, root) {
  'use strict';

  function etika() { var g = typeof globalThis !== 'undefined' ? globalThis : null; if (g && g.MyPolitikEtika) { return g.MyPolitikEtika; } try { return typeof require === 'function' ? require('./etika.js') : null; } catch (e) { return null; } }

  var KEY = 'myPolitik_events';

  var CONFIG = {
    PELUANG_BULAN: 0.7,            // peluang acara apabila bulan bertukar
    PELUANG_AKTIVITI: 0.15,        // peluang acara selepas satu tindakan
    MAKS_AKTIVITI_SEBULAN: 2,
    ELAK_ULANG: 4,                 // acara sama tidak diulang dalam N acara terakhir
    BULAN_BANJIR: [11, 12, 1, 2],  // musim tengkujuh: banjir lebih kerap
    PELUANG_KRISIS: 0.35,          // v5.8: peluang krisis politik apabila bulan bertukar (pemegang jawatan sahaja)
    KRISIS_JARAK_BULAN: 2          // sekurang-kurangnya N bulan antara dua krisis (purata satu krisis setiap ~4-5 bulan)
  };

  /* ------------------------------------------------------------------------
     DEFINISI ACARA
     kategori : 'cawangan' | 'projek' | 'tempatan' | 'politik'
     syarat   : fn(profil) -> boolean (pilihan)
     berat    : nombor | fn(profil) -> nombor (lalai 1)
     pilihan  : [{ id, label, huraian, kesan, mesej, hasil? }]
        kesan  : dihantar ke applyEffects (ap/myr negatif = kos)
        hasil  : (pilihan) [{ peluang, kesan, mesej }] — keputusan berisiko;
                 jumlah peluang = 1. Kos asas dikira dahulu daripada `kesan`.
     Teks boleh guna {cawangan} / {bahagian} / {dun}.
     ------------------------------------------------------------------------ */
  /* v6.4: peristiwa khas sayap. 'sayapIni' = laluan sayap pemain; 'ketuaSayap' = memegang jawatan Ketua sayap di mana-mana peringkat. */
  function sayapIni(p, k) { return p.sayap === k; }
  function ketuaSayap(p, k) { return p.sayap === k && Array.isArray(p.jawatanList) && p.jawatanList.some(function (j) { return j.kumpulan === 'sayap' && j.sayap === k; }); }
  function bilJ(p) { return Array.isArray(p.jawatanList) ? p.jawatanList.length : (p.jawatan && p.jawatan !== 'Ahli Biasa' ? 1 : 0); }

  var DB = root.MyPolitikEventDB || (typeof module === 'object' && typeof require === 'function' ? require('./EventDatabase.js') : null);   // v7.25: data acara dalam js/EventDatabase.js
  if (!DB) { throw new Error('events.js memerlukan js/EventDatabase.js dimuatkan dahulu.'); }
  var ACARA = DB.buat({ etika: etika, sayapIni: sayapIni, ketuaSayap: ketuaSayap, bilJ: bilJ, CONFIG: CONFIG });

  /* ------------------------------------------------------------------------
     STATE (localStorage, berasingan daripada profil)
     ------------------------------------------------------------------------ */
  function storan() { try { return root.localStorage || null; } catch (e) { return null; } }
  var memori = null;            // sandaran jika localStorage tidak tersedia

  function lalai() { return { pemilik: '', sejarah: [], tertunggak: null, kiraBulan: {}, bil: 0, krisisTerakhir: 0 }; }
  function muat() {
    var s = storan(), d = null;
    if (s) { try { d = JSON.parse(s.getItem(KEY)); } catch (e) { d = null; } }
    else { d = memori; }
    if (!d || typeof d !== 'object') { d = lalai(); }
    d.sejarah = Array.isArray(d.sejarah) ? d.sejarah : [];
    d.kiraBulan = d.kiraBulan && typeof d.kiraBulan === 'object' ? d.kiraBulan : {};
    return d;
  }
  function simpan(d) {
    memori = d;
    var s = storan();
    if (s) { try { s.setItem(KEY, JSON.stringify(d)); } catch (e) { /* abaikan */ } }
  }
  /** State dipadankan dengan pemain semasa; jika pemain baharu, mula semula. */
  function muatUntuk(p) {
    var d = muat(), pemilik = p ? String(p.nama || '') + '|' + String(p.cawangan || '') : '';
    if (d.pemilik !== pemilik) { d = lalai(); d.pemilik = pemilik; simpan(d); }
    return d;
  }
  function reset() {
    memori = null;
    var s = storan();
    if (s) { try { s.removeItem(KEY); } catch (e) { /* abaikan */ } }
  }

  /* ------------------------------------------------------------------------
     PEMBANTU
     ------------------------------------------------------------------------ */
  function salin(o) { return JSON.parse(JSON.stringify(o)); }
  function def(id) { for (var i = 0; i < ACARA.length; i++) { if (ACARA[i].id === id) { return ACARA[i]; } } return null; }
  function isi(teks, p) {
    return String(teks || '')
      .replace(/\{cawangan\}/g, p.cawangan || 'anda')
      .replace(/\{bahagian\}/g, p.bahagian || 'anda')
      .replace(/\{dun\}/g, p.dun || 'kawasan anda');
  }
  function beratAcara(a, p) {
    if (a.syarat && !a.syarat(p)) { return 0; }
    var b = typeof a.berat === 'function' ? a.berat(p) : (a.berat == null ? 1 : a.berat);
    return b > 0 ? b : 0;
  }
  function kosPilihan(k) { return { ap: Math.abs(Math.min(0, k.ap || 0)), myr: Math.abs(Math.min(0, k.myr || 0)) }; }

  function bina(a, p, uid) {
    return {
      uid: uid, id: a.id, kategori: a.kategori, ikon: a.ikon, krisis: !!a.krisis,
      tajuk: a.tajuk, huraian: isi(a.huraian, p),
      bulan: p.bulan, tahun: p.tahun
    };
  }
  /** Sifat pilihan (boleh/sebab/ringkas) dikira semasa dipaparkan, ikut sumber semasa. */
  function huraikanPilihan(acara, p) {
    var a = def(acara.id);
    if (!a) { return []; }
    return a.pilihan.map(function (c) {
      var kos = kosPilihan(c.kesan || {}), boleh = true, sebab = '';
      if (p.ap < kos.ap) { boleh = false; sebab = 'AP tidak mencukupi (perlu ' + kos.ap + ').'; }
      else if (p.myr < kos.myr) { boleh = false; sebab = 'Dana tidak mencukupi (perlu RM ' + kos.myr + ').'; }
      var ringkas = S.ringkasPerubahan({ ip: (c.kesan || {}).ip || 0, myr: (c.kesan || {}).myr || 0, ap: (c.kesan || {}).ap || 0, reputasi: (c.kesan || {}).reputasi || 0, kesetiaan: (c.kesan || {}).kesetiaan || {} });
      return { id: c.id, label: c.label, huraian: c.huraian || '', ringkas: ((ringkas || '') + (c.stres && c.stres.stress ? (ringkas ? ', ' : '') + 'Stress ' + (c.stres.stress > 0 ? '+' : '') + c.stres.stress : '') + ((c.lepasJawatan || c.lucut) ? (ringkas || (c.stres && c.stres.stress) ? ', ' : '') + (c.lucut ? 'Jawatan dilucutkan' : 'Lepas jawatan') : '')) || 'Tiada kos', berisiko: !!c.hasil, kos: kos, boleh: boleh, sebab: sebab };
    });
  }
  function papar(acara, p) {
    var o = salin(acara);
    o.pilihan = huraikanPilihan(acara, p);
    return o;
  }

  /* ------------------------------------------------------------------------
     JANA ACARA
     opts: { pencetus:'bulan'|'aktiviti', rng, paksa:idAcara, abaikanPeluang }
     Pulang acara siap paparan, atau null (tiada acara kali ini).
     ------------------------------------------------------------------------ */
  function janaAcara(opts) {
    opts = opts || {};
    var p = S.loadPlayer();
    if (!p) { return null; }
    var rng = opts.rng || Math.random, d = muatUntuk(p);
    if (d.tertunggak) { return papar(d.tertunggak, p); }          // satu acara pada satu masa

    var wajib = !opts.paksa ? ACARA.filter(function (x) { return beratAcara(x, p) >= 1000; })[0] : null;   // cth. pendengaran disiplin
    if (wajib) { opts.paksa = wajib.id; }
    var kunciBulan = p.tahun + '-' + p.bulan;
    if (opts.pencetus === 'aktiviti' && (d.kiraBulan[kunciBulan] || 0) >= CONFIG.MAKS_AKTIVITI_SEBULAN) { return null; }
    var a = null;
    var indeksBulan = p.tahun * 12 + p.bulan, adaJawatan = p.jawatan && p.jawatan !== 'Ahli Biasa';
    if (!opts.paksa && opts.pencetus !== 'aktiviti') {                 // v5.8: undian krisis bulanan (pemegang jawatan sahaja)
      var layakKrisis = adaJawatan && (opts.krisis === true || (!opts.abaikanPeluang && indeksBulan - (d.krisisTerakhir || 0) >= CONFIG.KRISIS_JARAK_BULAN && rng() < CONFIG.PELUANG_KRISIS));
      if (layakKrisis) {
        var kolam = ACARA.filter(function (x) { return x.krisis && d.sejarah.slice(-CONFIG.ELAK_ULANG).indexOf(x.id) < 0 && beratAcara(x, p) > 0; });
        if (!kolam.length) { kolam = ACARA.filter(function (x) { return x.krisis && beratAcara(x, p) > 0; }); }
        if (kolam.length) {
          var jk = kolam.reduce(function (n, x) { return n + beratAcara(x, p); }, 0), tk = rng() * jk;
          for (var k = 0; k < kolam.length; k++) { tk -= beratAcara(kolam[k], p); if (tk < 0) { a = kolam[k]; break; } }
          a = a || kolam[kolam.length - 1]; d.krisisTerakhir = indeksBulan;
        }
      }
    }
    if (!a && !opts.paksa && !opts.abaikanPeluang) {                   // acara biasa: peluang bulanan / aktiviti
      var peluang = opts.pencetus === 'aktiviti' ? CONFIG.PELUANG_AKTIVITI : CONFIG.PELUANG_BULAN;
      if (rng() >= peluang) { return null; }
    }
    if (a) { /* krisis dipilih */ }
    else if (opts.paksa) { a = def(opts.paksa); if (!a) { return null; } }
    else {
      var calon = ACARA.filter(function (x) { return !x.hanyaKrisis && d.sejarah.slice(-CONFIG.ELAK_ULANG).indexOf(x.id) < 0 && beratAcara(x, p) > 0; });
      if (!calon.length) { calon = ACARA.filter(function (x) { return !x.hanyaKrisis && beratAcara(x, p) > 0; }); }
      var jumlah = calon.reduce(function (n, x) { return n + beratAcara(x, p); }, 0), t = rng() * jumlah;
      for (var i = 0; i < calon.length; i++) { t -= beratAcara(calon[i], p); if (t < 0) { a = calon[i]; break; } }
      a = a || calon[calon.length - 1];
    }

    d.bil += 1;
    var inst = bina(a, p, 'ev' + d.bil + '-' + a.id);
    d.tertunggak = inst;
    d.sejarah.push(a.id); d.sejarah = d.sejarah.slice(-20);
    if (opts.pencetus === 'aktiviti') { d.kiraBulan[kunciBulan] = (d.kiraBulan[kunciBulan] || 0) + 1; }
    simpan(d);
    return papar(inst, p);
  }

  /** Cuba cetus acara selepas aktiviti. Pulang acara atau null. */
  function selepasAktiviti(opts) {
    opts = opts || {}; opts.pencetus = 'aktiviti'; return janaAcara(opts);
  }

  function getTertunggak() {
    var p = S.loadPlayer();
    if (!p) { return null; }
    var d = muatUntuk(p);
    return d.tertunggak ? papar(d.tertunggak, p) : null;
  }

  /* ------------------------------------------------------------------------
     PILIH TINDAKAN
     Pulang { ok, mesej, ringkas, perubahan, acara, pilihan, berisiko } atau { ok:false, ralat }
     ------------------------------------------------------------------------ */
  function pilih(idPilihan, opts) {
    opts = opts || {};
    var p = S.loadPlayer();
    if (!p) { return { ok: false, kod: 'tiada_profil', ralat: 'Tiada profil pemain.' }; }
    var d = muatUntuk(p), t = d.tertunggak;
    if (!t) { return { ok: false, kod: 'tiada_acara', ralat: 'Tiada acara yang menunggu keputusan.' }; }
    var a = def(t.id), c = null;
    for (var i = 0; a && i < a.pilihan.length; i++) { if (a.pilihan[i].id === idPilihan) { c = a.pilihan[i]; break; } }
    if (!c) { return { ok: false, kod: 'pilihan', ralat: 'Pilihan tidak sah.' }; }

    var rng = opts.rng || Math.random, kesan = salin(c.kesan || {}), mesej = c.mesej || '', lucutHasil = false;
    if (c.hasil && c.hasil.length) {                              // keputusan berisiko
      var r = rng(), kum = 0, pilihanHasil = c.hasil[c.hasil.length - 1];
      for (var j = 0; j < c.hasil.length; j++) { kum += c.hasil[j].peluang; if (r < kum) { pilihanHasil = c.hasil[j]; break; } }
      var h = pilihanHasil.kesan || {};
      ['ip', 'myr', 'ap', 'reputasi'].forEach(function (k) { if (h[k]) { kesan[k] = (kesan[k] || 0) + h[k]; } });
      if (h.kesetiaan) { kesan.kesetiaan = kesan.kesetiaan || {}; for (var n in h.kesetiaan) { kesan.kesetiaan[n] = (kesan.kesetiaan[n] || 0) + h.kesetiaan[n]; } }
      mesej = pilihanHasil.mesej || mesej; lucutHasil = !!pilihanHasil.lucut;
    }

    var Et = etika(), eo = Et && c.etika ? Et.selepasAcara(p, c.etika, { rng: rng }) : null;
    var res = S.applyEffects(kesan, {
      kiraTindakan: false,
      patch: eo ? { etika: eo.etika } : undefined,
      log: { tindakan: 'acara:' + t.id, acara: t.tajuk, pilihan: c.label }
    });
    if (!res.ok) { return { ok: false, kod: res.kod, ralat: res.ralat }; }   // cth AP/Dana tidak cukup: acara kekal menunggu
    var STr = root.MyPolitikStres || (typeof require === 'function' ? (function () { try { return require('./stress.js'); } catch (e) { return null; } })() : null);
    if (STr) {                                                    // v5.6: kesan Stress/Kesihatan dan melepaskan jawatan
      if (c.lepasJawatan) { var lp = STr.lepasJawatan(c.lepasJawatan === 'terendah' ? { terendah: true } : undefined); if (lp && lp.jawatanLama) { mesej += ' (Dilepaskan: ' + lp.jawatanLama + '.)'; } }
      if (c.lucut || lucutHasil) { var lc = STr.lucutJawatan(); if (lc && lc.jawatanLama) { mesej += ' (Dilucutkan: ' + lc.jawatanLama + '.)'; } }
      if (c.stres) { STr.laras(c.stres); }
    }
    if (Et && c.pendengaran) { Et.responsPendengaran(c.pendengaran); }
    if (eo && eo.mesej) { mesej += eo.mesej; }

    d.tertunggak = null; simpan(d);
    return {
      ok: true, mesej: mesej, perubahan: res.perubahan,
      ringkas: [S.ringkasPerubahan(res.perubahan), c.stres && c.stres.stress ? 'Stress ' + (c.stres.stress > 0 ? '+' : '') + c.stres.stress : ''].filter(Boolean).join(', ') || 'Tiada perubahan sumber',
      acara: { id: t.id, tajuk: t.tajuk, ikon: t.ikon }, pilihan: { id: c.id, label: c.label }, berisiko: !!c.hasil
    };
  }

  /** Buang acara tertunggak tanpa kesan (cth. untuk ujian). */
  function buangTertunggak() { var p = S.loadPlayer(), d = muatUntuk(p); d.tertunggak = null; simpan(d); }

  return {
    KEY: KEY, CONFIG: CONFIG,
    senaraiAcara: function () { return ACARA.map(function (a) { return { id: a.id, kategori: a.kategori, tajuk: a.tajuk }; }); },
    janaAcara: janaAcara,
    selepasAktiviti: selepasAktiviti,
    getTertunggak: getTertunggak,
    pilih: pilih,
    buangTertunggak: buangTertunggak,
    reset: reset
  };
});
