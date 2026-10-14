/* ==========================================================================
   Nusa Politik — js/sayap.js   (v5.9)
   Mod Kerjaya Berbilang Sayap: laluan kerjaya dipilih semasa pendaftaran dan kelebihan (buff) setiap sayap.

   Laluan (profil.sayap): 'utama' (Induk) | 'pemuda' | 'puteri' | 'wanita'
     - Utama / Induk : tiada jawatan sayap; laluan jawatan utama sahaja. Kekal sepanjang kerjaya.
     - Pemuda  (lelaki 18-40), Puteri (perempuan 18-35), Wanita (perempuan 36-59): jawatan sayap dibuka.
   Apabila umur melepasi had kategori, laluan sayap bertukar mengikut kategori (hayat.js); laluan Utama tidak berubah.

   Kelebihan (angka ialah andaian permainan; laras dalam CONFIG):
     Utama  : +10% pada setiap kemasukan Dana (elaun dan sumbangan).
     Pemuda : +20% kenaikan IP (selepas redaman IP tinggi), tetapi beban Stress bulanan +10%.
     Puteri : +25% kenaikan Kesetiaan AJK dan Perwakilan, dan +25% kenaikan Reputasi Parti.
     Wanita : kerugian Kesetiaan Akar Umbi -30%, susutan akar umbi bulanan pemegang jawatan -1,
              beban Stress bulanan -20% dan pemulihan Stress +1 sebulan.
   Modul ini tiada kebergantungan; save.js, stress.js dan calendar.js memanggilnya.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikSayap = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  var SENARAI = ['utama', 'pemuda', 'puteri', 'wanita'];
  var SAYAP = ['pemuda', 'puteri', 'wanita'];

  var CONFIG = {
    utama:  { danaMult: 1.10 },
    pemuda: { ipMult: 1.20, bebanStresMult: 1.10 },
    puteri: { kesetiaanMult: { ajk: 1.25, perwakilan: 1.25 }, reputasiMult: 1.25 },
    wanita: { akarUmbiRugiMult: 0.70, susutAkarUmbiKurang: 1, bebanStresMult: 0.80, pemulihanStresTambah: 1 }
  };

  var INFO = {
    utama:  { kod: 'utama',  nama: 'Utama / Induk', ikon: '🏛️', ringkas: 'Laluan jawatan utama parti', kelebihan: ['+10% Dana masuk'], syarat: 'Terbuka kepada semua.' },
    pemuda: { kod: 'pemuda', nama: 'Pemuda',        ikon: '⚡', ringkas: 'Laju naik, tetapi lebih penat', kelebihan: ['+20% kenaikan IP', 'Beban Stress +10%'], syarat: 'Lelaki berumur 18 hingga 40 tahun.' },
    puteri: { kod: 'puteri', nama: 'Puteri',        ikon: '🌸', ringkas: 'Rangkaian dan nama baik', kelebihan: ['+25% kesetiaan AJK dan Perwakilan', '+25% Reputasi Parti'], syarat: 'Perempuan berumur 18 hingga 35 tahun.' },
    wanita: { kod: 'wanita', nama: 'Wanita',        ikon: '🛡️', ringkas: 'Stabil dan tenang', kelebihan: ['Kerugian akar umbi -30%', 'Susutan akar umbi pemegang jawatan -1', 'Beban Stress -20%, pulih +1'], syarat: 'Perempuan berumur 36 hingga 59 tahun.' }
  };

  /** Isu fokus golongan setiap sayap (v6.0). Digunakan pada Struktur Organisasi dan Mesyuarat Sayap (meeting.js). */
  var ISU = {
    pemuda: { golongan: 'lelaki muda', isu: ['Pekerjaan dan gaji permulaan', 'Rumah pertama', 'Kos sara hidup belia', 'Ekonomi gig dan digital'] },
    puteri: { golongan: 'perempuan muda', isu: ['Keselamatan dan gangguan', 'Gaji dan kerjaya setara', 'Usahawan muda', 'Kesihatan mental'] },
    wanita: { golongan: 'perempuan dewasa dan warga emas', isu: ['Penjagaan keluarga dan warga emas', 'Kos isi rumah', 'Kesihatan wanita', 'Ibu tunggal dan usahawan mikro'] }
  };

  function sah(k) { return SENARAI.indexOf(k) >= 0; }

  /** Kategori demografi (sama dengan Data.kategoriMengikutUmur): pemuda | puteri | wanita | biasa | veteran | null. */
  function kategori(jantina, umur) {
    var j = String(jantina || '').trim().toUpperCase().charAt(0); umur = parseInt(umur, 10);
    if ((j !== 'L' && j !== 'P') || !isFinite(umur) || umur < 18) { return null; }
    if (umur >= 60) { return 'veteran'; }
    if (j === 'L') { return umur <= 40 ? 'pemuda' : 'biasa'; }
    return umur <= 35 ? 'puteri' : 'wanita';
  }

  /** Laluan dicadangkan: sayap mengikut kategori, atau 'utama' (Biasa / Veteran). */
  function cadangan(jantina, umur) { var k = kategori(jantina, umur); return SAYAP.indexOf(k) >= 0 ? k : 'utama'; }

  /** Kelayakan semua laluan bagi jantina dan umur: { utama:{boleh,sebab}, pemuda:{...}, ... }. */
  function kelayakan(jantina, umur) {
    var k = kategori(jantina, umur), r = {};
    SENARAI.forEach(function (s) {
      r[s] = (s === 'utama' || k === s) ? { boleh: true, sebab: '' } : { boleh: false, sebab: k ? INFO[s].syarat : 'Isi jantina dan umur dahulu.' };
    });
    return r;
  }

  /** Laluan pemain. Profil lama (tiada medan sayap) mengikut avatar/kategori seperti sebelum ini. */
  function kod(p) {
    if (p && sah(p.sayap)) { return p.sayap; }
    var a = p && p.avatar ? p.avatar : (p && p.demografik ? p.demografik.kategoriKod : null);
    return SAYAP.indexOf(a) >= 0 ? a : 'utama';
  }
  /** Sayap jawatan: pemuda | puteri | wanita | null (Utama). */
  function sayapJawatan(p) { var k = kod(p); return k === 'utama' ? null : k; }
  function info(p) { return INFO[kod(p)]; }

  function bulat(asal, baharu) { return asal > 0 ? Math.max(1, Math.round(baharu)) : Math.round(baharu); }

  /**
   * Laraskan kesan sebelum dikenakan (dipanggil oleh Save.applyEffects).
   * k = { ip (selepas redaman), myr, reputasi, kesetiaan:{} }. Pulang salinan terlaras.
   */
  function sesuaikan(p, k) {
    var s = kod(p), o = { ip: k.ip || 0, myr: k.myr || 0, reputasi: k.reputasi || 0, kesetiaan: {} }, c = CONFIG[s] || {};
    Object.keys(k.kesetiaan || {}).forEach(function (n) { o.kesetiaan[n] = k.kesetiaan[n]; });
    if (c.danaMult && o.myr > 0) { o.myr = bulat(o.myr, o.myr * c.danaMult); }
    if (c.ipMult && o.ip > 0) { o.ip = bulat(o.ip, o.ip * c.ipMult); }
    if (c.reputasiMult && o.reputasi > 0) { o.reputasi = bulat(o.reputasi, o.reputasi * c.reputasiMult); }
    if (c.kesetiaanMult) { Object.keys(c.kesetiaanMult).forEach(function (n) { if (o.kesetiaan[n] > 0) { o.kesetiaan[n] = bulat(o.kesetiaan[n], o.kesetiaan[n] * c.kesetiaanMult[n]); } }); }
    if (c.akarUmbiRugiMult && o.kesetiaan.akarUmbi < 0) { o.kesetiaan.akarUmbi = Math.round(o.kesetiaan.akarUmbi * c.akarUmbiRugiMult); }
    return o;
  }

  /** Beban Stress bulanan terlaras mengikut sayap. */
  function bebanStres(p, beban) { var c = CONFIG[kod(p)] || {}; return c.bebanStresMult && beban > 0 ? Math.max(1, Math.round(beban * c.bebanStresMult)) : beban; }
  /** Tambahan pemulihan Stress sebulan. */
  function pemulihanStres(p) { return (CONFIG[kod(p)] || {}).pemulihanStresTambah || 0; }
  /** Pengurangan susutan akar umbi bulanan bagi pemegang jawatan. */
  function kurangSusutAkarUmbi(p) { return (CONFIG[kod(p)] || {}).susutAkarUmbiKurang || 0; }

  return {
    SENARAI: SENARAI, SAYAP: SAYAP, CONFIG: CONFIG, INFO: INFO, ISU: ISU, sah: sah, kategori: kategori, cadangan: cadangan, kelayakan: kelayakan,
    kod: kod, sayapJawatan: sayapJawatan, info: info, sesuaikan: sesuaikan, bebanStres: bebanStres, pemulihanStres: pemulihanStres, kurangSusutAkarUmbi: kurangSusutAkarUmbi
  };
});
