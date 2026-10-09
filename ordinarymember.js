/* ==========================================================================
   MyPolitik: UMNO — js/ordinaryMember.js
   Modul Ahli Biasa Cawangan (jawatan pemain = 'Ahli Biasa').

   1. Tindakan Akar Umbi
        Ziarah Kasih          +10 IP, -1 AP
        Hadir Gotong-Royong   +15 Kesetiaan Ketua Cawangan, -1 AP
        Sembang Warung        isu tempatan + 5 Kesetiaan Akar Umbi, -1 AP
        Kerja Sampingan       +MYR 500, -2 AP
   2. Kelayakan Bertanding
        Bahagian dan Pusat sentiasa terkunci.
        AJK Cawangan dan Ketua Sayap Cawangan dibuka apabila IP >= 50.

   Setiap tindakan terus mengemas kini profil dalam localStorage melalui
   MyPolitikSave.applyEffects() dan menyiarkan acara 'myPolitik:player-updated'.
   Perlu dimuatkan selepas js/save.js.

   Cara guna dalam dashboard.html:
     var senarai = MyPolitikOrdinaryMember.senaraiTindakan();      // untuk melukis butang
     var hasil   = MyPolitikOrdinaryMember.jalankanTindakan('ziarah_kasih');
     var layak   = MyPolitikOrdinaryMember.getKelayakanBertanding(); // untuk mengunci butang
   ========================================================================== */
(function (root, factory) {
  var S = root.MyPolitikSave || (typeof module === 'object' && typeof require === 'function' ? require('./save.js') : null);
  if (!S) { throw new Error('ordinaryMember.js memerlukan js/save.js dimuatkan dahulu.'); }
  var api = factory(S);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikOrdinaryMember = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (S) {
  'use strict';

  var CONFIG = {
    JAWATAN: 'Ahli Biasa',
    IP_MIN_AJK_SAYAP: 50          // ambang IP untuk bertanding AJK / Sayap Cawangan
  };

  /* ------------------------------------------------------------------------
     1. TINDAKAN AKAR UMBI
     kesan: nilai perubahan (negatif = kos). Dihantar terus kepada applyEffects().
     ------------------------------------------------------------------------ */
  var TINDAKAN = [
    {
      id: 'ziarah_kasih', nama: 'Ziarah Kasih',
      penerangan: 'Menziarahi ahli yang uzur dan keluarga yang ditimpa musibah.',
      kesan: { ip: 10, ap: -1 }
    },
    {
      id: 'gotong_royong', nama: 'Hadir Gotong-Royong',
      penerangan: 'Turun bersama ahli membersihkan kawasan dan membantu kerja cawangan.',
      kesan: { ap: -1, kesetiaan: { ketuaCawangan: 15 } }
    },
    {
      id: 'sembang_warung', nama: 'Sembang Warung',
      penerangan: 'Berbual dengan orang kampung di warung untuk mendengar isu setempat.',
      kesan: { ap: -1, kesetiaan: { akarUmbi: 5 } },
      denganIsu: true
    },
    {
      id: 'kerja_sampingan', nama: 'Kerja Sampingan / Perniagaan',
      penerangan: 'Menambah pendapatan melalui kerja sampingan atau perniagaan kecil.',
      kesan: { myr: 500, ap: -2 }
    }
  ];

  // Isu tempatan yang boleh diperoleh melalui Sembang Warung.
  var ISU_TEMPATAN = [
    { kod: 'jalan_berlubang',  tajuk: 'Jalan kampung berlubang',        penerangan: 'Penduduk mengadu jalan masuk ke kawasan perumahan berlubang dan bahaya waktu malam.', tahap: 2 },
    { kod: 'air_terputus',     tajuk: 'Bekalan air kerap terputus',     penerangan: 'Beberapa lorong tidak mendapat air selama dua hari berturut-turut.', tahap: 3 },
    { kod: 'longkang_tersumbat', tajuk: 'Longkang tersumbat',           penerangan: 'Hujan lebat menyebabkan air bertakung di hadapan rumah penduduk.', tahap: 2 },
    { kod: 'kerja_belia',      tajuk: 'Belia sukar mendapat pekerjaan', penerangan: 'Ramai anak muda menganggur sejak kilang berhampiran mengurangkan pekerja.', tahap: 3 },
    { kod: 'bantuan_lewat',    tajuk: 'Bantuan kebajikan lewat sampai', penerangan: 'Warga emas mengadu bantuan bulanan lewat beberapa minggu.', tahap: 2 },
    { kod: 'lampu_jalan',      tajuk: 'Lampu jalan rosak',              penerangan: 'Lampu jalan di taman perumahan tidak menyala dan kes kecurian mula meningkat.', tahap: 1 },
    { kod: 'harga_barang',     tajuk: 'Harga barang runcit naik',       penerangan: 'Peniaga kecil dan suri rumah merungut kos sara hidup yang semakin tinggi.', tahap: 2 },
    { kod: 'dewan_usang',      tajuk: 'Dewan serbaguna usang',          penerangan: 'Bumbung dewan komuniti bocor dan tidak selamat untuk majlis kenduri.', tahap: 1 }
  ];

  /* ------------------------------------------------------------------------
     2. PEMBANTU
     ------------------------------------------------------------------------ */
  function adalahAhliBiasa(p) { return !!p && p.jawatan === CONFIG.JAWATAN; }

  function cariTindakan(id) {
    for (var i = 0; i < TINDAKAN.length; i++) { if (TINDAKAN[i].id === id) { return TINDAKAN[i]; } }
    return null;
  }

  function salin(o) { return JSON.parse(JSON.stringify(o)); }

  /** Semak sama ada tindakan boleh dibuat sekarang. Pulang { boleh, sebab }. */
  function semakBoleh(def, p) {
    if (!p) { return { boleh: false, sebab: 'Tiada profil pemain.' }; }
    if (!adalahAhliBiasa(p)) { return { boleh: false, sebab: 'Tindakan ini untuk Ahli Biasa sahaja.' }; }
    if (p.ap + (def.kesan.ap || 0) < 0) { return { boleh: false, sebab: 'AP tidak mencukupi (perlu ' + Math.abs(def.kesan.ap) + ').' }; }
    if (p.myr + (def.kesan.myr || 0) < 0) { return { boleh: false, sebab: 'Wang tidak mencukupi.' }; }
    return { boleh: true, sebab: '' };
  }

  function pilihIsu(p, rng) {
    var aktif = {};
    p.isu.forEach(function (i) { if (!i.selesai) { aktif[i.kod] = true; } });
    var baru = ISU_TEMPATAN.filter(function (i) { return !aktif[i.kod]; });
    var kolam = baru.length ? baru : ISU_TEMPATAN;
    var t = kolam[Math.floor(rng() * kolam.length)];
    return {
      id: t.kod + '-' + Date.now().toString(36),
      kod: t.kod, tajuk: t.tajuk, penerangan: t.penerangan, tahap: t.tahap,
      lokasi: p.cawangan, dicatat: new Date().toISOString(), selesai: false
    };
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
        ringkas: S.ringkasPerubahan({ ip: d.kesan.ip || 0, myr: d.kesan.myr || 0, ap: d.kesan.ap || 0, kesetiaan: d.kesan.kesetiaan || {} })
          + (d.denganIsu ? ', isu tempatan' : ''),
        boleh: s.boleh, sebab: s.sebab
      };
    });
  }

  /**
   * Jalankan satu tindakan dan simpan hasilnya terus ke localStorage.
   * opts: { rng } untuk ujian.
   * Pulangan: { ok, mesej, perubahan, profil, isu?, peristiwa:[] } atau { ok:false, kod, ralat }
   */
  function jalankanTindakan(id, opts) {
    opts = opts || {};
    var def = cariTindakan(id);
    if (!def) { return { ok: false, kod: 'tidak_dikenali', ralat: 'Tindakan tidak dikenali: ' + id }; }
    var p = S.loadPlayer();
    var s = semakBoleh(def, p);
    if (!s.boleh) { return { ok: false, kod: 'tidak_boleh', ralat: s.sebab }; }

    var layakSebelum = getKelayakanBertanding(p).ipCukup;
    var kesan = salin(def.kesan), isu = null;
    if (def.denganIsu) { isu = pilihIsu(p, opts.rng || Math.random); kesan.isu = isu; }

    var r = S.applyEffects(kesan, { log: { tindakan: def.id, nama: def.nama, peringkat: 'ahli', isu: isu ? isu.tajuk : undefined } });
    if (!r.ok) { return r; }

    var peristiwa = [];
    var layakSelepas = getKelayakanBertanding(r.profil).ipCukup;
    if (!layakSebelum && layakSelepas) {
      peristiwa.push({
        jenis: 'kelayakan_dibuka',
        mesej: 'Pengaruh anda mencapai ' + CONFIG.IP_MIN_AJK_SAYAP + ' IP. Anda kini layak bertanding AJK atau Sayap Cawangan.'
      });
    }

    var mesej = def.nama + ': ' + S.ringkasPerubahan(r.perubahan) + '.';
    if (isu) { mesej += ' Isu tempatan dicatat: ' + isu.tajuk + '.'; }
    return { ok: true, mesej: mesej, perubahan: r.perubahan, profil: r.profil, isu: isu, peristiwa: peristiwa };
  }

  /* ------------------------------------------------------------------------
     4. SISTEM KELAYAKAN BERTANDING
     ------------------------------------------------------------------------ */
  var SAYAP_JAWATAN = {
    pemuda: 'Ketua Pemuda Cawangan',
    puteri: 'Ketua Puteri Cawangan',
    wanita: 'Ketua Wanita Cawangan'
  };

  /**
   * Keadaan setiap pintu bertanding untuk Ahli Biasa.
   * Pulangan: { ip, ipMin, ajkSayapTerbuka, bilTerbuka, senarai:[{kod, jawatan, peringkat, terbuka, sebab, ipPerlu, ipSemasa}] }
   * Gunakan senarai[i].terbuka untuk mengunci (disabled) butang bertanding.
   */
  function getKelayakanBertanding(profil) {
    var p = profil || S.loadPlayer();
    var ip = p ? p.ip : 0, min = CONFIG.IP_MIN_AJK_SAYAP;
    var ahli = adalahAhliBiasa(p);
    var cukupIP = ip >= min;
    var kekurangan = 'Perlukan ' + min + ' IP (anda ada ' + ip + ').';
    var kodSayap = p && p.demografik ? p.demografik.kategoriKod : null;
    var jawatanSayap = SAYAP_JAWATAN[kodSayap] || null;

    function masuk(kod, jawatan, peringkat, terbuka, sebab, ipPerlu) {
      return { kod: kod, jawatan: jawatan, peringkat: peringkat, terbuka: terbuka, sebab: terbuka ? '' : sebab, ipPerlu: ipPerlu, ipSemasa: ip };
    }

    var senarai = [
      masuk('ajk_cawangan', 'AJK Cawangan', 'cawangan', ahli && cukupIP, ahli ? kekurangan : 'Hanya untuk Ahli Biasa.', min),
      jawatanSayap
        ? masuk('sayap_cawangan', jawatanSayap, 'cawangan', ahli && cukupIP, ahli ? kekurangan : 'Hanya untuk Ahli Biasa.', min)
        : masuk('sayap_cawangan', 'Ketua Sayap Cawangan', 'cawangan', false, 'Kategori Veteran/Ahli Biasa tidak mempunyai sayap.', min),
      masuk('bahagian', 'Jawatan Bahagian', 'bahagian', false, 'Terkunci untuk Ahli Biasa.', null),
      masuk('pusat', 'Jawatan Pusat (MKT)', 'pusat', false, 'Terkunci untuk Ahli Biasa.', null)
    ];

    // ipCukup: syarat IP dipenuhi, tanpa mengira tahun. Digunakan untuk peristiwa "kelayakan dibuka".
    var ipCukup = senarai[0].terbuka || senarai[1].terbuka;

    // Jika enjin pemilihan dimuatkan, pertandingan jawatan hanya dibuka pada tahun pemilihan.
    var E = typeof globalThis !== 'undefined' ? globalThis.MyPolitikElection : null;
    if (E && p && !E.adalahTahunPemilihan(p.tahun)) {
      var sebabTahun = 'Pertandingan jawatan ditutup pada tahun pentadbiran. Pemilihan seterusnya ' + E.tahunPemilihanSeterusnya(p.tahun) + '.';
      senarai.forEach(function (x) { if (x.terbuka) { x.terbuka = false; x.sebab = sebabTahun; } });
    }

    return {
      ip: ip, ipMin: min,
      ipCukup: ipCukup,
      ajkSayapTerbuka: senarai[0].terbuka || senarai[1].terbuka,
      bilTerbuka: senarai.filter(function (x) { return x.terbuka; }).length,
      senarai: senarai
    };
  }

  /** Pulang entri kelayakan bagi satu kod, atau null. */
  function bolehBertanding(kod, profil) {
    var k = getKelayakanBertanding(profil);
    for (var i = 0; i < k.senarai.length; i++) { if (k.senarai[i].kod === kod) { return k.senarai[i]; } }
    return null;
  }

  /**
   * Daftar sebagai calon. Pengesahan dibuat semula di sini, bukan hanya pada butang UI.
   * Hanya merekodkan pendaftaran dalam profil.calon. Keputusan pemilihan belum dikendalikan.
   */
  function mohonBertanding(kod) {
    var p = S.loadPlayer();
    if (!p) { return { ok: false, kod: 'tiada_profil', ralat: 'Tiada profil pemain.' }; }
    var e = bolehBertanding(kod, p);
    if (!e) { return { ok: false, kod: 'tidak_dikenali', ralat: 'Jawatan tidak dikenali: ' + kod }; }
    if (!e.terbuka) { return { ok: false, kod: 'terkunci', ralat: e.sebab }; }
    if (p.calon && p.calon.kod === kod) { return { ok: false, kod: 'sudah_daftar', ralat: 'Anda sudah mendaftar bertanding ' + e.jawatan + '.' }; }

    var calon = { kod: e.kod, jawatan: e.jawatan, peringkat: e.peringkat, tahun: p.tahun, didaftarPada: new Date().toISOString() };
    var r = S.applyEffects({}, {
      kiraTindakan: false, patch: { calon: calon },
      log: { tindakan: 'mohon_bertanding', nama: 'Daftar bertanding ' + e.jawatan, peringkat: 'ahli' }
    });
    if (!r.ok) { return r; }
    return { ok: true, mesej: 'Anda didaftarkan sebagai calon ' + e.jawatan + '.', calon: calon, profil: r.profil };
  }

  function batalBertanding() {
    var p = S.loadPlayer();
    if (!p || !p.calon) { return { ok: false, ralat: 'Tiada pendaftaran untuk dibatalkan.' }; }
    var jawatan = p.calon.jawatan;
    var r = S.applyEffects({}, {
      kiraTindakan: false, patch: { calon: null },
      log: { tindakan: 'batal_bertanding', nama: 'Batal bertanding ' + jawatan, peringkat: 'ahli' }
    });
    return r.ok ? { ok: true, mesej: 'Pendaftaran bertanding ' + jawatan + ' dibatalkan.', profil: r.profil } : r;
  }

  return {
    CONFIG: CONFIG,
    TINDAKAN: TINDAKAN,
    ISU_TEMPATAN: ISU_TEMPATAN,
    adalahAhliBiasa: adalahAhliBiasa,
    senaraiTindakan: senaraiTindakan,
    jalankanTindakan: jalankanTindakan,
    getKelayakanBertanding: getKelayakanBertanding,
    bolehBertanding: bolehBertanding,
    mohonBertanding: mohonBertanding,
    batalBertanding: batalBertanding
  };
});