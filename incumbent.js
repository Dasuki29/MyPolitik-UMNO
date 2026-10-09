/* ==========================================================================
   MyPolitik: UMNO — js/incumbent.js
   Modul Pemegang Jawatan (jawatan pemain bukan 'Ahli Biasa').

   1. Tindakan Pentadbiran dan Kepimpinan
        Anjur Mesyuarat AJK        +10 Kesetiaan AJK, -MYR 300, -1 AP
        Agih Peruntukan Kebajikan  +15 Kesetiaan Akar Umbi, -MYR 1,000, -1 AP
        Lobi Perwakilan            +8 Kesetiaan Perwakilan PAU, -MYR 500, -1 AP
        Terbit Kenyataan Media     +15 IP, -10 Kesetiaan Penentang/Atas Pagar, -1 AP
   2. Sistem Amaran Kesetiaan
        Jika Kesetiaan Akar Umbi < 40%, amaran dicetuskan dan satu kejadian rawak
        boleh berlaku: penentang mencabar jawatan pemain.

   Setiap tindakan terus mengemas kini profil dalam localStorage melalui
   MyPolitikSave.applyEffects() dan menyiarkan acara 'myPolitik:player-updated'.
   Perlu dimuatkan selepas js/save.js.

   Cara guna dalam dashboard.html:
     var senarai = MyPolitikIncumbent.senaraiTindakan();
     var hasil   = MyPolitikIncumbent.jalankanTindakan('anjur_mesyuarat_ajk');
     // hasil.amaran dan hasil.peristiwa memaklumkan UI jika kejadian rawak berlaku
     MyPolitikIncumbent.semakAmaranKesetiaan();   // panggil semasa dashboard dimuat / tamat giliran
   ========================================================================== */
(function (root, factory) {
  var S = root.MyPolitikSave || (typeof module === 'object' && typeof require === 'function' ? require('./save.js') : null);
  if (!S) { throw new Error('incumbent.js memerlukan js/save.js dimuatkan dahulu.'); }
  var api = factory(S);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikIncumbent = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (S) {
  'use strict';

  var CONFIG = {
    JAWATAN_BIASA: 'Ahli Biasa',
    AMBANG_AMARAN: 40,             // Kesetiaan Akar Umbi di bawah nilai ini mencetuskan amaran
    AMBANG_KRITIKAL: 25,           // di bawah nilai ini amaran menjadi kritikal
    KEBARANGKALIAN_ASAS: 0.25,     // peluang kejadian rawak pada 39%
    KEBARANGKALIAN_MAKS: 0.75,     // peluang pada 0%
    COOLDOWN_TINDAKAN: 3           // bilangan tindakan minimum antara dua cabaran
  };

  /* ------------------------------------------------------------------------
     1. TINDAKAN PENTADBIRAN DAN KEPIMPINAN
     ------------------------------------------------------------------------ */
  var TINDAKAN = [
    {
      id: 'anjur_mesyuarat_ajk', nama: 'Anjur Mesyuarat AJK',
      penerangan: 'Memanggil mesyuarat jawatankuasa untuk menyelaraskan kerja dan mengeratkan hubungan.',
      kesan: { myr: -300, ap: -1, kesetiaan: { ajk: 10 } }
    },
    {
      id: 'agih_peruntukan', nama: 'Agih Peruntukan Kebajikan',
      penerangan: 'Mengagihkan bantuan kepada keluarga yang memerlukan di kawasan anda.',
      kesan: { myr: -1000, ap: -1, kesetiaan: { akarUmbi: 15 } }
    },
    {
      id: 'lobi_perwakilan', nama: 'Lobi Perwakilan',
      penerangan: 'Bertemu perwakilan Perhimpunan Agung UMNO untuk meraih sokongan.',
      kesan: { myr: -500, ap: -1, kesetiaan: { perwakilan: 8 } }
    },
    {
      id: 'kenyataan_media', nama: 'Terbit Kenyataan Media',
      penerangan: 'Menerbitkan kenyataan untuk menaikkan nama, dengan risiko menjauhkan penentang.',
      kesan: { ip: 15, ap: -1, kesetiaan: { penentang: -10 } }
    }
  ];

  /* ------------------------------------------------------------------------
     2. PEMBANTU
     ------------------------------------------------------------------------ */
  function salin(o) { return JSON.parse(JSON.stringify(o)); }

  function adalahPemegangJawatan(p) {
    return !!p && typeof p.jawatan === 'string' && p.jawatan !== '' && p.jawatan !== CONFIG.JAWATAN_BIASA;
  }

  /** Peringkat jawatan: 'cawangan' | 'bahagian' | 'pusat', daripada nama jawatan. */
  function peringkatJawatan(jawatan) {
    var j = String(jawatan || '');
    if (/Bahagian/i.test(j)) { return 'bahagian'; }
    if (/Cawangan/i.test(j)) { return 'cawangan'; }
    return 'pusat';
  }

  function cariTindakan(id) {
    for (var i = 0; i < TINDAKAN.length; i++) { if (TINDAKAN[i].id === id) { return TINDAKAN[i]; } }
    return null;
  }

  function semakBoleh(def, p) {
    if (!p) { return { boleh: false, sebab: 'Tiada profil pemain.' }; }
    if (!adalahPemegangJawatan(p)) { return { boleh: false, sebab: 'Tindakan ini untuk pemegang jawatan. Anda masih Ahli Biasa.' }; }
    if (p.ap + (def.kesan.ap || 0) < 0) { return { boleh: false, sebab: 'AP tidak mencukupi (perlu ' + Math.abs(def.kesan.ap) + ').' }; }
    if (p.myr + (def.kesan.myr || 0) < 0) { return { boleh: false, sebab: 'Wang tidak mencukupi (perlu MYR ' + Math.abs(def.kesan.myr).toLocaleString('ms-MY') + ').' }; }
    return { boleh: true, sebab: '' };
  }

  /* ------------------------------------------------------------------------
     3. API TINDAKAN
     ------------------------------------------------------------------------ */

  /** Senarai tindakan beserta keadaan semasa (untuk melukis butang dashboard). */
  function senaraiTindakan(profil) {
    var p = profil || S.loadPlayer();
    return TINDAKAN.map(function (d) {
      var s = semakBoleh(d, p);
      return {
        id: d.id, nama: d.nama, penerangan: d.penerangan,
        kos: { ap: Math.abs(Math.min(0, d.kesan.ap || 0)), myr: Math.abs(Math.min(0, d.kesan.myr || 0)) },
        kesan: salin(d.kesan),
        ringkas: S.ringkasPerubahan({ ip: d.kesan.ip || 0, myr: d.kesan.myr || 0, ap: d.kesan.ap || 0, kesetiaan: d.kesan.kesetiaan || {} }),
        boleh: s.boleh, sebab: s.sebab
      };
    });
  }

  /**
   * Jalankan satu tindakan dan simpan hasilnya terus ke localStorage.
   * Selepas itu semakan amaran kesetiaan dijalankan secara automatik.
   * opts: { rng } untuk ujian.
   * Pulangan: { ok, mesej, perubahan, profil, amaran, peristiwa:[] } atau { ok:false, kod, ralat }
   */
  function jalankanTindakan(id, opts) {
    opts = opts || {};
    var def = cariTindakan(id);
    if (!def) { return { ok: false, kod: 'tidak_dikenali', ralat: 'Tindakan tidak dikenali: ' + id }; }
    var p = S.loadPlayer();
    var s = semakBoleh(def, p);
    if (!s.boleh) { return { ok: false, kod: 'tidak_boleh', ralat: s.sebab }; }

    var r = S.applyEffects(salin(def.kesan), {
      log: { tindakan: def.id, nama: def.nama, peringkat: peringkatJawatan(p.jawatan) }
    });
    if (!r.ok) { return r; }

    var amaran = semakAmaranKesetiaan({ rng: opts.rng });
    var peristiwa = [];
    if (amaran.cabaranBaru) { peristiwa.push({ jenis: 'cabaran_jawatan', cabaran: amaran.cabaranBaru, mesej: amaran.cabaranBaru.mesej }); }

    return {
      ok: true,
      mesej: def.nama + ': ' + S.ringkasPerubahan(r.perubahan) + '.',
      perubahan: r.perubahan,
      profil: S.loadPlayer() || r.profil,
      amaran: amaran,
      peristiwa: peristiwa
    };
  }

  /* ------------------------------------------------------------------------
     4. SISTEM AMARAN KESETIAAN
     ------------------------------------------------------------------------ */
  var PENENTANG_GELARAN = ['Haji', 'Dato\'', 'Tuan Haji', 'Encik', 'Puan Hajjah'];
  var PENENTANG_NAMA = ['Rahman', 'Salleh', 'Kamarul', 'Zainuddin', 'Mansor', 'Rohaizad', 'Jalil', 'Normala', 'Samsiah', 'Hashim'];
  var PENENTANG_BIN = ['Daud', 'Ahmad', 'Yaakob', 'Ghani', 'Osman', 'Bakar', 'Karim', 'Mat Zin'];
  var PENENTANG_PERANAN = [
    'bekas pemimpin cawangan yang tidak berpuas hati',
    'ahli veteran yang berpengaruh',
    'ketua kumpulan Atas Pagar',
    'AJK yang kehilangan kepercayaan kepada anda'
  ];

  function pilih(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  function janaPenentang(rng) {
    var nama = pilih(rng, PENENTANG_GELARAN) + ' ' + pilih(rng, PENENTANG_NAMA) + ' bin ' + pilih(rng, PENENTANG_BIN);
    return { nama: nama, peranan: pilih(rng, PENENTANG_PERANAN) };
  }

  /** Peluang kejadian rawak: naik linear daripada KEBARANGKALIAN_ASAS (pada ambang) kepada MAKS (pada 0%). */
  function kebarangkalianCabaran(akarUmbi) {
    var a = CONFIG.AMBANG_AMARAN;
    var nisbah = Math.max(0, Math.min(1, (a - akarUmbi) / a));
    return CONFIG.KEBARANGKALIAN_ASAS + nisbah * (CONFIG.KEBARANGKALIAN_MAKS - CONFIG.KEBARANGKALIAN_ASAS);
  }

  function cabaranAktif(p) { return p && p.cabaran && p.cabaran.status === 'aktif' ? p.cabaran : null; }

  /**
   * Semak Kesetiaan Akar Umbi pemegang jawatan.
   * opts: { profil, rng, paksa:true }  (paksa mencetuskan cabaran, untuk ujian dan UI)
   * Pulangan:
   *   { ok, amaran:false, akarUmbi }                       jika kesetiaan sihat
   *   { ok, amaran:true, tahap:'amaran'|'kritikal', akarUmbi, ambang, mesej, kebarangkalian,
   *     cabaranBaru:{...}|null, cabaranAktif:{...}|null }  jika di bawah 40%
   * Amaran berstatus dan cabaran baharu disimpan dalam localStorage.
   */
  function semakAmaranKesetiaan(opts) {
    opts = opts || {};
    var p = opts.profil || S.loadPlayer();
    if (!p) { return { ok: false, ralat: 'Tiada profil pemain.' }; }
    if (!adalahPemegangJawatan(p)) { return { ok: true, amaran: false, sebab: 'bukan_pemegang_jawatan' }; }

    var k = p.kesetiaan.akarUmbi, ambang = CONFIG.AMBANG_AMARAN;
    if (k >= ambang) {
      if (p.amaranAktif) { S.updatePlayer({ amaranAktif: false }); }
      return { ok: true, amaran: false, akarUmbi: k, ambang: ambang };
    }

    var tahap = k < CONFIG.AMBANG_KRITIKAL ? 'kritikal' : 'amaran';
    var kemungkinan = kebarangkalianCabaran(k);
    var aktif = cabaranAktif(p);
    var sejuk = (p.bilTindakan - (typeof p.cabaranTerakhirTindakan === 'number' ? p.cabaranTerakhirTindakan : -1e9)) < CONFIG.COOLDOWN_TINDAKAN;
    var rng = opts.rng || Math.random;
    var hasil = {
      ok: true, amaran: true, tahap: tahap, akarUmbi: k, ambang: ambang, kebarangkalian: kemungkinan,
      mesej: 'Kesetiaan Akar Umbi tinggal ' + k + '% (di bawah ' + ambang + '%). Penentang mula bergerak dan jawatan ' + p.jawatan + ' anda berisiko dicabar.',
      cabaranBaru: null, cabaranAktif: aktif
    };

    if (!aktif && (opts.paksa || (!sejuk && rng() < kemungkinan))) {
      var lawan = janaPenentang(rng);
      var cabaran = {
        id: 'cabaran-' + Date.now().toString(36),
        jenis: 'cabaran_jawatan',
        tajuk: 'Jawatan anda dicabar',
        penentang: lawan,
        jawatanDicabar: p.jawatan,
        peringkat: peringkatJawatan(p.jawatan),
        akarUmbi: k, tahap: tahap,
        mesej: lawan.nama + ', ' + lawan.peranan + ', mengumpul sokongan untuk mencabar jawatan ' + p.jawatan + ' anda.',
        tahun: p.tahun, tarikh: new Date().toISOString(), status: 'aktif'
      };
      var r = S.applyEffects({}, {
        kiraTindakan: false,
        patch: { cabaran: cabaran, amaranAktif: true, cabaranTerakhirTindakan: p.bilTindakan },
        log: { tindakan: 'cabaran_jawatan', nama: 'Jawatan dicabar oleh ' + lawan.nama, peringkat: peringkatJawatan(p.jawatan) }
      });
      if (r.ok) { hasil.cabaranBaru = cabaran; hasil.cabaranAktif = cabaran; }
    } else if (!p.amaranAktif) {
      S.updatePlayer({ amaranAktif: true });
    }
    return hasil;
  }

  function getCabaranAktif() { return cabaranAktif(S.loadPlayer()); }

  /**
   * Tutup cabaran aktif. keputusan: 'ditangkis' | 'diterima' | 'tamat'.
   * Logik pemilihan yang menentukan keputusan belum dibina; fungsi ini hanya merekodkannya.
   */
  function selesaikanCabaran(keputusan) {
    var p = S.loadPlayer(), c = cabaranAktif(p);
    if (!c) { return { ok: false, ralat: 'Tiada cabaran aktif.' }; }
    if (['ditangkis', 'diterima', 'tamat'].indexOf(keputusan) < 0) { return { ok: false, ralat: 'Keputusan tidak sah: ' + keputusan }; }
    var tutup = {};
    for (var k in c) { tutup[k] = c[k]; }
    tutup.status = keputusan; tutup.tamat = new Date().toISOString();
    var r = S.applyEffects({}, {
      kiraTindakan: false, patch: { cabaran: tutup },
      log: { tindakan: 'cabaran_selesai', nama: 'Cabaran ' + c.penentang.nama + ': ' + keputusan, peringkat: peringkatJawatan(p.jawatan) }
    });
    return r.ok ? { ok: true, cabaran: tutup, profil: r.profil } : r;
  }

  return {
    CONFIG: CONFIG,
    TINDAKAN: TINDAKAN,
    adalahPemegangJawatan: adalahPemegangJawatan,
    peringkatJawatan: peringkatJawatan,
    senaraiTindakan: senaraiTindakan,
    jalankanTindakan: jalankanTindakan,
    kebarangkalianCabaran: kebarangkalianCabaran,
    semakAmaranKesetiaan: semakAmaranKesetiaan,
    getCabaranAktif: getCabaranAktif,
    selesaikanCabaran: selesaikanCabaran
  };
});