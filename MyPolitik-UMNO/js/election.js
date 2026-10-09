/* ==========================================================================
   MyPolitik: UMNO — js/election.js
   Enjin Kitaran Pemilihan 3 Tahun.

   1. Jam kitaran
        Tahun permulaan 2026. Tahun pemilihan jika (tahun - 2026) % 3 === 0,
        iaitu 2026, 2029, 2032. Tahun lain ialah tahun pentadbiran.
   2. Tahun Pemilihan
        Pertandingan jawatan dibuka, begitu juga pemilihan perwakilan
        (5 perwakilan Cawangan ke Bahagian, 10 perwakilan Bahagian ke PAU)
        dan aktiviti kempen.
   3. Tahun Pentadbiran
        Pertandingan dan kempen ditutup. Fokus pada pentadbiran, perbahasan
        usul (js/meeting.js) dan mengumpul IP serta MYR.
   4. Aktiviti kempen
        Jamuan Mesyuarat, Siri Jelajah, Lobi Ketua Bahagian, Simulasi Pengundian.

   Keadaan disimpan dalam profil.pemilihan (localStorage) melalui
   MyPolitikSave.applyEffects(). Perlu dimuatkan selepas js/save.js dan
   js/ordinaryMember.js.

   Cara guna dalam dashboard.html:
     var E = MyPolitikElection;
     E.getStatusModul();                    // fasa, senarai pertandingan, kempen
     E.daftarBertanding('ajk_cawangan');
     E.jalankanKempen('siri_jelajah');
     E.jalankanKempen('simulasi_pengundian', { kod: 'ajk_cawangan' });  // anggaran peluang
     E.jalankanPemilihan('ajk_cawangan');   // hari mengundi (juga dipanggil oleh meeting.js)
     E.majuTahun();                         // tamat tahun, AP dipulihkan
   ========================================================================== */
(function (root, factory) {
  function muat(fail, nama) {
    if (root[nama]) { return root[nama]; }
    if (typeof module === 'object' && typeof require === 'function') {
      try { return require('./' + fail); } catch (e) { return null; }
    }
    return null;
  }
  var S = muat('save.js', 'MyPolitikSave'), O = muat('ordinaryMember.js', 'MyPolitikOrdinaryMember');
  if (!S || !O) { throw new Error('election.js memerlukan js/save.js dan js/ordinaryMember.js dimuatkan dahulu.'); }
  var api = factory(S, O);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikElection = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (S, O) {
  'use strict';

  var CONFIG = {
    TAHUN_MULA: 2026,
    KITARAN_TAHUN: 3,
    PERWAKILAN_CAWANGAN: 5,              // perwakilan Cawangan ke Bahagian
    PERWAKILAN_BAHAGIAN: 10,             // perwakilan Bahagian ke PAU
    ANGGARAN_CAWANGAN_PER_BAHAGIAN: 25,  // untuk anggaran pengundi perwakilan Bahagian (5 setiap cawangan)
    PEMILIH_PUSAT: 1500,                 // pengundi simulasi peringkat pusat
    KERUSI_AJK_CAWANGAN: 7,
    PESAING_TAMBAHAN: 4,                 // bilangan calon = kerusi + nilai ini
    PENYEBARAN_PESAING: { min: 44, sd: 12 },
    MENANG_IP: { jawatan: 20, perwakilan: 10 },
    KALAH_IP: { jawatan: -5, perwakilan: -3 },
    ANGGARAN_ULANGAN: 300,               // bilangan larian simulasi pengundian
    // Berat kekuatan calon (jumlah setiap peringkat = 1)
    BERAT: {
      cawangan: { ip: 0.30, akarUmbi: 0.25, ketuaCawangan: 0.15, ajk: 0.10, perwakilan: 0,    kempen: 0.20 },
      bahagian: { ip: 0.30, akarUmbi: 0,    ketuaCawangan: 0.15, ajk: 0,    perwakilan: 0.35, kempen: 0.20 }
    }
  };

  /* ------------------------------------------------------------------------
     1. JAM KITARAN
     ------------------------------------------------------------------------ */
  function nomborTahun(t) { t = parseInt(t, 10); return isFinite(t) ? t : CONFIG.TAHUN_MULA; }

  function adalahTahunPemilihan(tahun) {
    var t = nomborTahun(tahun);
    return t >= CONFIG.TAHUN_MULA && (t - CONFIG.TAHUN_MULA) % CONFIG.KITARAN_TAHUN === 0;
  }

  /** Tahun pemilihan terdekat pada atau selepas tahun ini. */
  function tahunPemilihanSeterusnya(tahun) {
    var t = nomborTahun(tahun);
    if (t <= CONFIG.TAHUN_MULA) { return CONFIG.TAHUN_MULA; }
    var baki = (t - CONFIG.TAHUN_MULA) % CONFIG.KITARAN_TAHUN;
    return baki === 0 ? t : t + (CONFIG.KITARAN_TAHUN - baki);
  }

  function tahunPemilihanLepas(tahun) {
    var t = nomborTahun(tahun);
    return t < CONFIG.TAHUN_MULA ? null : t - ((t - CONFIG.TAHUN_MULA) % CONFIG.KITARAN_TAHUN);
  }

  function getKitaran(tahun) {
    var t = nomborTahun(tahun), k = CONFIG.KITARAN_TAHUN, d = Math.max(0, t - CONFIG.TAHUN_MULA);
    var pemilihan = adalahTahunPemilihan(t);
    return {
      tahun: t,
      pemilihan: pemilihan,
      fasa: pemilihan ? 'pemilihan' : 'pentadbiran',
      kitaran: Math.floor(d / k),                        // 0 = 2026-2028, 1 = 2029-2031
      tahunDalamKitaran: (d % k) + 1,                    // 1, 2 atau 3
      tahunPemilihanLepas: tahunPemilihanLepas(t),
      pemilihanBerikutnya: t + (k - (d % k))             // sentiasa selepas tahun ini
    };
  }

  /** Apa yang dibuka dan ditutup pada tahun ini. */
  function getFokusTahun(tahun) {
    var kit = getKitaran(tahun);
    if (kit.pemilihan) {
      return {
        tahun: kit.tahun, fasa: 'pemilihan', tajuk: 'Tahun Pemilihan',
        pertandinganTerbuka: true, perwakilanTerbuka: true, kempenTerbuka: true, usulTerbuka: true,
        fokus: ['Pertandingan jawatan', 'Pemilihan perwakilan', 'Kempen pemilihan', 'Perbahasan usul']
      };
    }
    return {
      tahun: kit.tahun, fasa: 'pentadbiran', tajuk: 'Tahun Pentadbiran',
      pertandinganTerbuka: false, perwakilanTerbuka: false, kempenTerbuka: false, usulTerbuka: true,
      pemilihanBerikutnya: kit.pemilihanBerikutnya,
      fokus: ['Pentadbiran', 'Perbahasan usul', 'Mengumpul sumber (IP dan MYR)']
    };
  }

  /* ------------------------------------------------------------------------
     2. KEADAAN PEMILIHAN (profil.pemilihan)
     ------------------------------------------------------------------------ */
  function salin(o) { return JSON.parse(JSON.stringify(o)); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function keadaanBaharu(tahun) {
    var kit = getKitaran(tahun);
    return {
      kitaran: kit.kitaran, tahunPemilihan: kit.tahunPemilihanLepas,
      kempen: { mata: 0, aktiviti: {} },
      daftar: {},                                // kod -> pendaftaran
      keputusan: {},                             // kod -> keputusan pengundian
      perwakilan: { cawangan: false, bahagian: false }
    };
  }

  /** Keadaan untuk kitaran semasa. Kitaran baharu bermula dengan keadaan kosong. */
  function getKeadaanPemilihan(profil) {
    var p = profil || S.loadPlayer();
    if (!p) { return null; }
    var kit = getKitaran(p.tahun), st = p.pemilihan ? salin(p.pemilihan) : null;
    if (!st || st.kitaran !== kit.kitaran) { return keadaanBaharu(p.tahun); }
    st.kempen = st.kempen || { mata: 0, aktiviti: {} };
    st.kempen.aktiviti = st.kempen.aktiviti || {};
    st.daftar = st.daftar || {}; st.keputusan = st.keputusan || {};
    st.perwakilan = st.perwakilan || { cawangan: false, bahagian: false };
    return st;
  }

  function peringkatJawatan(jawatan) {
    var j = String(jawatan || '');
    if (/Bahagian/i.test(j)) { return 'bahagian'; }
    if (/Cawangan/i.test(j)) { return 'cawangan'; }
    return 'pusat';
  }

  function gagal(kod, ralat) { return { ok: false, kod: kod, ralat: ralat }; }

  function tutupTahun(p) {
    return 'Hanya dibuka pada tahun pemilihan. Pemilihan seterusnya ' + tahunPemilihanSeterusnya(p.tahun) + '.';
  }

  /* ------------------------------------------------------------------------
     3. SENARAI PERTANDINGAN
     ------------------------------------------------------------------------ */
  function kerusiJawatan(jawatan) {
    var j = String(jawatan || '');
    if (/^AJK Cawangan/.test(j)) { return CONFIG.KERUSI_AJK_CAWANGAN; }
    if (/^AJK Bahagian/.test(j)) { return 15; }
    if (/^Ahli MKT/.test(j)) { return 25; }
    return 1;
  }

  /**
   * Senarai pertandingan untuk pemain pada tahun ini.
   * Setiap entri: { kod, jenis:'jawatan'|'perwakilan', jawatan, peringkat, kerusi, terbuka, sebab,
   *                 didaftar, selesai, keputusan }
   * Gunakan entri.terbuka untuk mengunci butang bertanding.
   */
  function senaraiPertandingan(profil) {
    var p = profil || S.loadPlayer();
    if (!p) { return []; }
    var st = getKeadaanPemilihan(p), buka = adalahTahunPemilihan(p.tahun), ahli = p.jawatan === 'Ahli Biasa';
    var senarai = [];

    function tambah(e) {
      e.didaftar = !!st.daftar[e.kod];
      e.keputusan = st.keputusan[e.kod] || null;
      e.selesai = !!e.keputusan;
      if (e.terbuka && e.selesai) { e.terbuka = false; e.sebab = 'Pertandingan ini sudah selesai.'; }
      senarai.push(e);
    }

    if (ahli) {
      O.getKelayakanBertanding(p).senarai.forEach(function (x) {
        tambah({
          kod: x.kod, jenis: 'jawatan', jawatan: x.jawatan, peringkat: x.peringkat,
          kerusi: (x.kod === 'ajk_cawangan') ? CONFIG.KERUSI_AJK_CAWANGAN : (x.kod === 'sayap_cawangan' ? 1 : null),
          terbuka: x.terbuka, sebab: x.sebab, ipPerlu: x.ipPerlu
        });
      });
    } else {
      tambah({
        kod: 'pertahan_jawatan', jenis: 'jawatan', jawatan: p.jawatan, peringkat: peringkatJawatan(p.jawatan),
        kerusi: kerusiJawatan(p.jawatan), terbuka: buka, sebab: buka ? '' : tutupTahun(p)
      });
    }

    tambah({
      kod: 'perwakilan_cawangan', jenis: 'perwakilan', jawatan: 'Perwakilan Cawangan ke Bahagian', peringkat: 'cawangan',
      kerusi: CONFIG.PERWAKILAN_CAWANGAN, terbuka: buka, sebab: buka ? '' : tutupTahun(p)
    });

    var layakBahagian = buka && (st.perwakilan.cawangan || !ahli);
    tambah({
      kod: 'perwakilan_bahagian', jenis: 'perwakilan', jawatan: 'Perwakilan Bahagian ke PAU', peringkat: 'bahagian',
      kerusi: CONFIG.PERWAKILAN_BAHAGIAN, terbuka: layakBahagian,
      sebab: !buka ? tutupTahun(p) : (layakBahagian ? '' : 'Menangi kerusi Perwakilan Cawangan atau pegang jawatan dahulu.')
    });
    return senarai;
  }

  function cariPertandingan(p, kod) {
    var s = senaraiPertandingan(p);
    for (var i = 0; i < s.length; i++) { if (s[i].kod === kod) { return s[i]; } }
    return null;
  }

  function kodJawatanDidaftar(st) {
    return Object.keys(st.daftar).filter(function (k) { return st.daftar[k].jenis === 'jawatan' && !st.keputusan[k]; });
  }

  /** Daftar sebagai calon. Hanya pada tahun pemilihan. */
  function daftarBertanding(kod) {
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    if (!adalahTahunPemilihan(p.tahun)) { return gagal('tutup', 'Pertandingan ditutup. ' + tutupTahun(p)); }
    var e = cariPertandingan(p, kod);
    if (!e) { return gagal('tidak_dikenali', 'Pertandingan tidak dikenali: ' + kod); }
    if (e.selesai) { return gagal('selesai', e.sebab); }
    if (e.didaftar) { return gagal('sudah_daftar', 'Anda sudah mendaftar bertanding ' + e.jawatan + '.'); }
    if (!e.terbuka) { return gagal('terkunci', e.sebab); }

    var st = getKeadaanPemilihan(p);
    if (e.jenis === 'jawatan') {
      var lain = kodJawatanDidaftar(st);
      if (lain.length) { return gagal('satu_jawatan', 'Anda sudah mendaftar bertanding ' + st.daftar[lain[0]].jawatan + '. Tarik balik dahulu.'); }
    }
    st.daftar[kod] = {
      kod: kod, jenis: e.jenis, jawatan: e.jawatan, peringkat: e.peringkat, kerusi: e.kerusi,
      tahun: p.tahun, didaftarPada: new Date().toISOString()
    };
    var patch = { pemilihan: st };
    if (e.jenis === 'jawatan') { patch.calon = { kod: kod, jawatan: e.jawatan, peringkat: e.peringkat, tahun: p.tahun, didaftarPada: st.daftar[kod].didaftarPada }; }
    var r = S.applyEffects({}, { kiraTindakan: false, patch: patch, log: { tindakan: 'daftar_bertanding', nama: 'Daftar bertanding ' + e.jawatan, peringkat: 'pemilihan' } });
    return r.ok ? { ok: true, mesej: 'Anda didaftarkan sebagai calon ' + e.jawatan + '.', pendaftaran: st.daftar[kod], profil: r.profil } : r;
  }

  function tarikBalik(kod) {
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    var st = getKeadaanPemilihan(p);
    if (!st.daftar[kod]) { return gagal('tiada_pendaftaran', 'Tiada pendaftaran untuk ditarik balik.'); }
    if (st.keputusan[kod]) { return gagal('selesai', 'Pertandingan ini sudah selesai.'); }
    var d = st.daftar[kod];
    delete st.daftar[kod];
    var patch = { pemilihan: st };
    if (d.jenis === 'jawatan') { patch.calon = null; }
    var r = S.applyEffects({}, { kiraTindakan: false, patch: patch, log: { tindakan: 'tarik_balik', nama: 'Tarik balik pencalonan ' + d.jawatan, peringkat: 'pemilihan' } });
    return r.ok ? { ok: true, mesej: 'Pencalonan ' + d.jawatan + ' ditarik balik.', profil: r.profil } : r;
  }

  /* ------------------------------------------------------------------------
     4. MODEL PENGUNDIAN
     ------------------------------------------------------------------------ */
  var NAMA_L = ['Ahmad', 'Muhammad', 'Mohd', 'Abdul', 'Hasan', 'Ismail', 'Ibrahim', 'Yusof', 'Zulkifli', 'Azman', 'Faizal', 'Hafiz', 'Khairul', 'Rosli', 'Shahrul', 'Syafiq', 'Amirul', 'Danial', 'Kamal', 'Mazlan'];
  var NAMA_P = ['Nur', 'Siti', 'Nor', 'Noraini', 'Aishah', 'Fatimah', 'Zainab', 'Halimah', 'Rohani', 'Salmah', 'Normah', 'Rosnah', 'Mariam', 'Khadijah', 'Asmah', 'Aminah', 'Farah', 'Aina', 'Hidayah', 'Liyana'];
  var NAMA_2 = ['Faiz', 'Amir', 'Iskandar', 'Aiman', 'Zaki', 'Shafiq', 'Hanafi', 'Izzat', 'Farhan', 'Adli', 'Aisyah', 'Huda', 'Husna', 'Nabilah', 'Najwa', 'Sofea', 'Hanis', 'Alia'];

  function normal(rng, min, sd) {
    var u = 1 - rng(), v = rng();
    return min + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Kekuatan pemain (0 hingga 100) mengikut peringkat pengundi. */
  function kekuatanPemain(p, st, peringkat) {
    var b = CONFIG.BERAT[peringkat === 'cawangan' ? 'cawangan' : 'bahagian'], k = p.kesetiaan;
    var v = Math.min(100, p.ip) * b.ip + k.akarUmbi * b.akarUmbi + k.ketuaCawangan * b.ketuaCawangan +
            k.ajk * b.ajk + k.perwakilan * b.perwakilan + st.kempen.mata * b.kempen;
    return clamp(v, 0, 100);
  }

  function bilPemilih(p, peringkat, opts) {
    if (peringkat === 'cawangan') {
      var jumlah = p.cawanganInfo && p.cawanganInfo.jumlahAhli ? p.cawanganInfo.jumlahAhli : 60;
      return Math.max(50, jumlah);
    }
    if (peringkat === 'bahagian') {
      return CONFIG.PERWAKILAN_CAWANGAN * ((opts && opts.bilCawangan) || CONFIG.ANGGARAN_CAWANGAN_PER_BAHAGIAN);
    }
    return CONFIG.PEMILIH_PUSAT;
  }

  /** Pesaing tetap bagi satu pertandingan (seed daripada ID pemain, tahun dan kod). */
  function janaPesaing(p, kod, bilangan) {
    var rng = S.rngBerbenih(p.id + '|' + p.tahun + '|' + kod + '|pesaing');
    var senarai = [], guna = {};
    for (var i = 0; i < bilangan; i++) {
      var nama, cuba = 0;
      do {
        var lelaki = rng() < 0.55;
        var senaraiNama = lelaki ? NAMA_L : NAMA_P;
        nama = senaraiNama[Math.floor(rng() * senaraiNama.length)] + ' ' + NAMA_2[Math.floor(rng() * NAMA_2.length)] +
               (lelaki ? ' bin ' : ' binti ') + NAMA_L[Math.floor(rng() * NAMA_L.length)];
      } while (guna[nama] && ++cuba < 8);
      guna[nama] = true;
      senarai.push({ nama: nama, pemain: false, kekuatan: clamp(normal(rng, CONFIG.PENYEBARAN_PESAING.min, CONFIG.PENYEBARAN_PESAING.sd), 8, 85) });
    }
    return senarai;
  }

  /** Satu pusingan undi blok: setiap pengundi boleh menanda sehingga 'kerusi' calon. */
  function undi(calon, kerusi, pemilih, rng) {
    var hadir = Math.round(pemilih * (0.55 + rng() * 0.25));
    var w = calon.map(function (c) { return Math.exp(c.kekuatan / 18); });
    var jumlahW = w.reduce(function (a, b) { return a + b; }, 0);
    var jadual = calon.map(function (c, i) {
      var kebarangkalian = Math.min(0.97, 0.9 * kerusi * w[i] / jumlahW);
      var jangka = hadir * kebarangkalian, sisihan = Math.sqrt(hadir * kebarangkalian * (1 - kebarangkalian));
      return { nama: c.nama, pemain: c.pemain, undi: clamp(Math.round(normal(rng, jangka, sisihan)), 0, hadir) };
    });
    jadual.sort(function (a, b) { return b.undi - a.undi; });
    jadual.forEach(function (j, i) { j.kedudukan = i + 1; j.menang = i < kerusi; });
    return { hadir: hadir, jadual: jadual };
  }

  function bina(p, st, d, opts) {
    var peringkat = d.peringkat, kerusi = d.kerusi || 1;
    var bil = Math.max(4, kerusi + CONFIG.PESAING_TAMBAHAN);
    var calon = janaPesaing(p, d.kod, bil - 1);
    calon.push({ nama: p.nama, pemain: true, kekuatan: kekuatanPemain(p, st, peringkat) });
    return { calon: calon, kerusi: kerusi, pemilih: bilPemilih(p, peringkat, opts) };
  }

  /** Anggaran peluang menang dengan banyak larian simulasi (tiada kesan pada profil). */
  function anggarkanPeluang(kod, opts) {
    opts = opts || {};
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    var st = getKeadaanPemilihan(p), d = st.daftar[kod];
    if (!d) { return gagal('belum_daftar', 'Daftar bertanding dahulu.'); }
    var b = bina(p, st, d, opts), rng = opts.rng || Math.random, n = opts.ulangan || CONFIG.ANGGARAN_ULANGAN;
    var menang = 0, jumlahKedudukan = 0;
    for (var i = 0; i < n; i++) {
      var h = undi(b.calon, b.kerusi, b.pemilih, rng);
      var sendiri = h.jadual.filter(function (j) { return j.pemain; })[0];
      if (sendiri.menang) { menang++; }
      jumlahKedudukan += sendiri.kedudukan;
    }
    return {
      ok: true, kod: kod, jawatan: d.jawatan, kerusi: b.kerusi, jumlahCalon: b.calon.length,
      kekuatan: Math.round(b.calon[b.calon.length - 1].kekuatan),
      peluangMenang: Math.round(100 * menang / n), kedudukanPurata: Math.round(10 * jumlahKedudukan / n) / 10, ulangan: n
    };
  }

  /* ------------------------------------------------------------------------
     5. AKTIVITI KEMPEN
     ------------------------------------------------------------------------ */
  var KEMPEN = [
    {
      id: 'jamuan_mesyuarat', nama: 'Jamuan Mesyuarat',
      penerangan: 'Menjamu ahli dan AJK selepas mesyuarat untuk mengeratkan hubungan.',
      kesan: { myr: -800, ap: -1, kesetiaan: { ajk: 8, akarUmbi: 6 } }, mata: 10, maksKali: 3
    },
    {
      id: 'siri_jelajah', nama: 'Siri Jelajah',
      penerangan: 'Menjelajah lokaliti dan bertemu ahli dari rumah ke rumah.',
      kesan: { myr: -600, ap: -2, ip: 5, kesetiaan: { akarUmbi: 12 } }, mata: 12, maksKali: 3
    },
    {
      id: 'lobi_ketua_bahagian', nama: 'Lobi Ketua Bahagian',
      penerangan: 'Bertemu Ketua Bahagian dan perwakilan untuk meraih sokongan.',
      kesan: { myr: -700, ap: -1, kesetiaan: { perwakilan: 10 } }, mata: 8, maksKali: 2
    },
    {
      id: 'simulasi_pengundian', nama: 'Simulasi Pengundian',
      penerangan: 'Tinjauan undi percubaan untuk menganggar peluang anda. Tiada kesan pada keputusan sebenar.',
      kesan: { ap: -1 }, mata: 0, maksKali: null, perluKod: true
    }
  ];

  function cariKempen(id) {
    for (var i = 0; i < KEMPEN.length; i++) { if (KEMPEN[i].id === id) { return KEMPEN[i]; } }
    return null;
  }

  function semakKempen(def, p, st) {
    if (!p) { return { boleh: false, sebab: 'Tiada profil pemain.' }; }
    if (!adalahTahunPemilihan(p.tahun)) { return { boleh: false, sebab: 'Kempen ditutup. ' + tutupTahun(p) }; }
    var kali = st.kempen.aktiviti[def.id] || 0;
    if (def.maksKali && kali >= def.maksKali) { return { boleh: false, sebab: 'Had ' + def.maksKali + ' kali bagi kitaran ini telah dicapai.' }; }
    if (p.ap + (def.kesan.ap || 0) < 0) { return { boleh: false, sebab: 'AP tidak mencukupi (perlu ' + Math.abs(def.kesan.ap) + ').' }; }
    if (p.myr + (def.kesan.myr || 0) < 0) { return { boleh: false, sebab: 'Wang tidak mencukupi (perlu MYR ' + Math.abs(def.kesan.myr).toLocaleString('ms-MY') + ').' }; }
    return { boleh: true, sebab: '' };
  }

  function senaraiKempen(profil) {
    var p = profil || S.loadPlayer(), st = p ? getKeadaanPemilihan(p) : null;
    return KEMPEN.map(function (d) {
      var s = semakKempen(d, p, st || { kempen: { aktiviti: {} } });
      return {
        id: d.id, nama: d.nama, penerangan: d.penerangan, perluKod: !!d.perluKod,
        kos: { ap: Math.abs(d.kesan.ap || 0), myr: Math.abs(d.kesan.myr || 0) },
        ringkas: S.ringkasPerubahan({ ip: d.kesan.ip || 0, myr: d.kesan.myr || 0, ap: d.kesan.ap || 0, reputasi: 0, kesetiaan: d.kesan.kesetiaan || {} }) + (d.mata ? ', +' + d.mata + ' mata kempen' : ''),
        kali: st ? (st.kempen.aktiviti[d.id] || 0) : 0, maksKali: d.maksKali,
        boleh: s.boleh, sebab: s.sebab
      };
    });
  }

  /**
   * Jalankan aktiviti kempen. Hanya pada tahun pemilihan.
   * opts: { kod } untuk Simulasi Pengundian, { rng } untuk ujian.
   */
  function jalankanKempen(id, opts) {
    opts = opts || {};
    var def = cariKempen(id);
    if (!def) { return gagal('tidak_dikenali', 'Aktiviti tidak dikenali: ' + id); }
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain. Daftar dahulu di halaman utama.'); }
    var st = getKeadaanPemilihan(p), s = semakKempen(def, p, st);
    if (!s.boleh) { return gagal('tidak_boleh', s.sebab); }

    var anggaran = null;
    if (def.perluKod) {
      if (!opts.kod) { return gagal('perlu_kod', 'Pilih pertandingan untuk disimulasikan.'); }
      anggaran = anggarkanPeluang(opts.kod, opts);
      if (!anggaran.ok) { return anggaran; }
    }

    st.kempen.aktiviti[def.id] = (st.kempen.aktiviti[def.id] || 0) + 1;
    st.kempen.mata = clamp(st.kempen.mata + def.mata, 0, 100);
    var r = S.applyEffects(salin(def.kesan), {
      patch: { pemilihan: st },
      log: { tindakan: def.id, nama: def.nama, peringkat: 'pemilihan' }
    });
    if (!r.ok) { return r; }

    var mesej = def.nama + ': ' + S.ringkasPerubahan(r.perubahan) + (def.mata ? ', +' + def.mata + ' mata kempen' : '') + '.';
    if (anggaran) {
      mesej = 'Simulasi Pengundian untuk ' + anggaran.jawatan + ': peluang menang ' + anggaran.peluangMenang + '% (' + anggaran.kerusi +
              ' kerusi, ' + anggaran.jumlahCalon + ' calon, kedudukan purata ' + anggaran.kedudukanPurata + ').';
    }
    return { ok: true, mesej: mesej, perubahan: r.perubahan, mataKempen: st.kempen.mata, anggaran: anggaran, profil: r.profil };
  }

  /* ------------------------------------------------------------------------
     6. HARI MENGUNDI
     ------------------------------------------------------------------------ */
  var SAYAP_JAWATAN = { pemuda: 'Ketua Pemuda Cawangan', puteri: 'Ketua Puteri Cawangan', wanita: 'Ketua Wanita Cawangan' };

  /**
   * Jalankan pengundian sebenar bagi satu pertandingan yang sudah didaftarkan.
   * opts: { rng, bilCawangan }
   * Pulangan: { ok, mesej, keputusan, perubahan, peristiwa:[], profil }
   */
  function jalankanPemilihan(kod, opts) {
    opts = opts || {};
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    if (!adalahTahunPemilihan(p.tahun)) { return gagal('tutup', 'Pemilihan hanya berlaku pada tahun pemilihan. ' + tutupTahun(p)); }
    var st = getKeadaanPemilihan(p), d = st.daftar[kod];
    if (!d) { return gagal('belum_daftar', 'Anda belum mendaftar bertanding untuk kod ' + kod + '.'); }
    if (st.keputusan[kod]) { return gagal('sudah_selesai', 'Pertandingan ' + d.jawatan + ' sudah selesai.'); }

    var rng = opts.rng || Math.random, b = bina(p, st, d, opts), h = undi(b.calon, b.kerusi, b.pemilih, rng);
    var sendiri = h.jadual.filter(function (j) { return j.pemain; })[0], menang = sendiri.menang;
    var jenis = d.jenis === 'perwakilan' ? 'perwakilan' : 'jawatan';

    var keputusan = {
      kod: kod, jawatan: d.jawatan, peringkat: d.peringkat, kerusi: b.kerusi, pemilih: b.pemilih, hadir: h.hadir,
      menang: menang, kedudukan: sendiri.kedudukan, undi: sendiri.undi, jumlahCalon: b.calon.length,
      jadual: h.jadual.filter(function (j, i) { return i < 10 || j.pemain; }), tahun: p.tahun, tarikh: new Date().toISOString()
    };
    st.keputusan[kod] = keputusan;

    var patch = { pemilihan: st }, peristiwa = [];
    if (kod === 'perwakilan_cawangan') { st.perwakilan.cawangan = menang; }
    if (kod === 'perwakilan_bahagian') { st.perwakilan.bahagian = menang; }
    if (jenis === 'jawatan') {
      if (kod !== 'pertahan_jawatan') { patch.calon = null; }
      if (menang && kod === 'ajk_cawangan') { patch.jawatan = 'AJK Cawangan'; }
      else if (menang && kod === 'sayap_cawangan') { patch.jawatan = d.jawatan; }
      else if (!menang && kod === 'pertahan_jawatan') { patch.jawatan = 'Ahli Biasa'; patch.cabaran = null; patch.amaranAktif = false; }
      if (menang && kod !== 'pertahan_jawatan') {
        peristiwa.push({ jenis: 'jawatan_baharu', mesej: 'Tahniah. Anda dipilih sebagai ' + d.jawatan + '. Tindakan pemegang jawatan kini dibuka.' });
      }
      if (!menang && kod === 'pertahan_jawatan') {
        peristiwa.push({ jenis: 'jawatan_hilang', mesej: 'Anda kalah mempertahankan jawatan ' + d.jawatan + ' dan kembali menjadi Ahli Biasa.' });
      }
    } else if (menang) {
      peristiwa.push({ jenis: 'perwakilan_terpilih', mesej: 'Anda terpilih sebagai ' + d.jawatan + '.' });
    }

    var ip = menang ? CONFIG.MENANG_IP[jenis] : CONFIG.KALAH_IP[jenis];
    var r = S.applyEffects({ ip: ip }, {
      kiraTindakan: false, patch: patch,
      log: { tindakan: 'pemilihan_' + kod, nama: (menang ? 'Menang ' : 'Kalah ') + d.jawatan, peringkat: 'pemilihan' }
    });
    if (!r.ok) { return r; }

    var mesej = (menang ? 'Menang' : 'Kalah') + ' ' + d.jawatan + ': kedudukan ' + sendiri.kedudukan + ' daripada ' + b.calon.length +
                ' calon (' + sendiri.undi + ' undi, ' + b.kerusi + ' kerusi). ' + S.ringkasPerubahan(r.perubahan) + '.';
    return { ok: true, mesej: mesej, keputusan: keputusan, perubahan: r.perubahan, peristiwa: peristiwa, profil: r.profil };
  }

  /**
   * Selesaikan semua pertandingan berdaftar pada satu peringkat ('cawangan' | 'bahagian').
   * Dipanggil oleh meeting.js apabila mesyuarat ditutup. Pulang senarai hasil.
   */
  function jalankanPemilihanPeringkat(peringkat, opts) {
    var p = S.loadPlayer();
    if (!p || !adalahTahunPemilihan(p.tahun)) { return []; }
    var st = getKeadaanPemilihan(p);
    var kod = Object.keys(st.daftar).filter(function (k) { return !st.keputusan[k] && st.daftar[k].peringkat === peringkat; });
    kod.sort(function (a, b) { return (st.daftar[a].jenis === 'jawatan' ? 0 : 1) - (st.daftar[b].jenis === 'jawatan' ? 0 : 1); });
    return kod.map(function (k) { return jalankanPemilihan(k, opts); });
  }

  /* ------------------------------------------------------------------------
     7. STATUS MODUL DAN TAHUN BAHARU
     ------------------------------------------------------------------------ */
  function getStatusModul(profil) {
    var p = profil || S.loadPlayer();
    if (!p) { return null; }
    var st = getKeadaanPemilihan(p);
    return {
      tahun: p.tahun, kitaran: getKitaran(p.tahun), fokus: getFokusTahun(p.tahun),
      pertandingan: senaraiPertandingan(p), kempen: senaraiKempen(p),
      mataKempen: st.kempen.mata, perwakilan: st.perwakilan
    };
  }

  /**
   * Tamat tahun dan mulakan tahun seterusnya. AP dipulihkan kepada nilai permulaan
   * (opts.pulihAP = false untuk melangkaunya). Kitaran baharu mengosongkan keadaan pemilihan.
   */
  function majuTahun(opts) {
    opts = opts || {};
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    var lama = p.tahun, baru = lama + 1;
    var st = getKitaran(baru).kitaran === getKitaran(lama).kitaran ? getKeadaanPemilihan(p) : keadaanBaharu(baru);
    var kesan = opts.pulihAP === false ? {} : { ap: S.DEFAULTS.ap - p.ap };
    var r = S.applyEffects(kesan, {
      kiraTindakan: false, patch: { tahun: baru, pemilihan: st },
      log: { tindakan: 'tahun_baharu', nama: 'Tahun ' + baru + ' bermula', peringkat: 'tahun' }
    });
    if (!r.ok) { return r; }
    var fokus = getFokusTahun(baru), peristiwa = [];
    peristiwa.push(fokus.fasa === 'pemilihan'
      ? { jenis: 'pemilihan_dibuka', mesej: 'Tahun ' + baru + ' ialah tahun pemilihan. Pertandingan jawatan, pemilihan perwakilan dan kempen dibuka.' }
      : { jenis: 'tahun_pentadbiran', mesej: 'Tahun ' + baru + ' ialah tahun pentadbiran. Pertandingan jawatan ditutup. Pemilihan seterusnya ' + tahunPemilihanSeterusnya(baru) + '.' });
    return { ok: true, tahunLama: lama, tahunBaru: baru, fasa: fokus.fasa, mesej: peristiwa[0].mesej, peristiwa: peristiwa, perubahan: r.perubahan, profil: r.profil };
  }

  return {
    CONFIG: CONFIG,
    KEMPEN: KEMPEN,
    adalahTahunPemilihan: adalahTahunPemilihan,
    tahunPemilihanSeterusnya: tahunPemilihanSeterusnya,
    tahunPemilihanLepas: tahunPemilihanLepas,
    getKitaran: getKitaran,
    getFokusTahun: getFokusTahun,
    getKeadaanPemilihan: getKeadaanPemilihan,
    getStatusModul: getStatusModul,
    senaraiPertandingan: senaraiPertandingan,
    daftarBertanding: daftarBertanding,
    tarikBalik: tarikBalik,
    senaraiKempen: senaraiKempen,
    jalankanKempen: jalankanKempen,
    anggarkanPeluang: anggarkanPeluang,
    jalankanPemilihan: jalankanPemilihan,
    jalankanPemilihanPeringkat: jalankanPemilihanPeringkat,
    majuTahun: majuTahun
  };
});