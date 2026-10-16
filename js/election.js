/* ==========================================================================
   Nusa Politik — js/election.js
   Enjin Kitaran Pemilihan 3 Tahun.

   v3.0: jawatan berbilang peringkat dan mengikut sayap (js/jawatan.js), pusat (bulan 8),
         mandat perwakilan SETAHUN sahaja (bertanding semula di Cawangan setiap tahun).
         Pertandingan jawatan: tahun pemilihan sahaja. Pertandingan perwakilan: setiap tahun.

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

   v3.6: Tataetika dan disiplin (js/etika.js). Kempen kini bersih / kelabu / kotor. Kempen kotor
         (politik wang, fitnah, janji jawatan) memberi mata kempen lebih pantas tetapi mendedahkan pemain
         kepada aduan, siasatan dan hukuman Lembaga Disiplin (Fasal 20.10). Modal Sosial daripada kempen
         bersih menambah kekuatan undi. Hak keahlian (gantung/larang/pecat) menghalang pendaftaran dan kempen.

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
  var S = muat('save.js', 'MyPolitikSave'), O = muat('ordinaryMember.js', 'MyPolitikOrdinaryMember'), J = muat('jawatan.js', 'MyPolitikJawatan');
  if (!S || !O || !J) { throw new Error('election.js memerlukan js/save.js, js/ordinaryMember.js dan js/jawatan.js dimuatkan dahulu.'); }
  var api = factory(S, O, J);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikElection = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (S, O, J) {
  'use strict';

  function etika() { var g = typeof globalThis !== 'undefined' ? globalThis : null; if (g && g.MyPolitikEtika) { return g.MyPolitikEtika; } try { return typeof require === 'function' ? require('./etika.js') : null; } catch (e) { return null; } }

  var CONFIG = {
    TAHUN_MULA: 2026,
    KITARAN_TAHUN: 3,
    // v3.7: kuota perwakilan mengikut Perlembagaan
    KUOTA_CAWANGAN: { ahliPerWakil: 50, maks: 5, min: 1 },    // Fasal 14.4.4: 1 wakil / 50 ahli, maks 5 seorang Cawangan
    KUOTA_SAYAP_CAWANGAN: { ahliPerWakil: 10, maks: 3, min: 1 },    // v6.3: 1 wakil setiap 10 ahli sayap, maksimum 3 (wakil sayap Cawangan ke Mesyuarat Sayap Bahagian)
    SAYAP_G10: 10,                                                  // v6.2: 10 wakil sayap Bahagian ke Mesyuarat Bahagian (G10)
    SAYAP_G2: 2,                                                    // v6.2: 2 wakil sayap Bahagian ke Perhimpunan Sayap Pusat (G2)
    KUOTA_BAHAGIAN: { ahliPerWakil: 500, maks: 7, min: 1 },   // Fasal 8.4.3: 1 wakil / 500 ahli, maks 7 seorang Bahagian
    ANGGARAN_CAWANGAN_PER_BAHAGIAN: 25,  // anggaran bilangan Cawangan dalam satu Bahagian (jika tiada data sebenar)
    PEMILIH_PUSAT: 1500,                 // pengundi simulasi peringkat pusat
    KERUSI_AJK_CAWANGAN: 7,
    PESAING_TAMBAHAN: 4,                 // bilangan calon = kerusi + nilai ini
    PENYEBARAN_PESAING: { min: 44, sd: 12 },
    // v3.8 (kesukaran): pesaing lebih kuat pada peringkat tinggi; IP pemain dinilai mengikut skala peringkat
    ARAS_PESAING: { cawangan: -5, bahagian: 4, pusat: 7 },   // tambahan kekuatan purata pesaing
    GANDA_KESUKARAN: 0.58,                                   // darab 'kesukaran' jawatan (js/jawatan.js)
    IP_SKALA: { cawangan: 120, bahagian: 250, pusat: 450 },  // IP sebanyak ini = skor IP penuh (100) pada peringkat itu
    MENANG_IP: { jawatan: 20, perwakilan: 10 },
    KALAH_IP: { jawatan: -5, perwakilan: -3 },
    MENANG_IP_PERINGKAT: { cawangan: 20, bahagian: 30, pusat: 50, sayap_cawangan: 20, sayap_bahagian: 30, sayap_pau: 50 },   // jawatan
    KALAH_IP_PERINGKAT: { cawangan: -5, bahagian: -8, pusat: -10, sayap_cawangan: -5, sayap_bahagian: -8, sayap_pau: -10 },
    BONUS_SAYAP: 8,                      // kekuatan tambahan dalam pertandingan sayap sendiri
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
      pertandinganTerbuka: false, perwakilanTerbuka: true, kempenTerbuka: false, usulTerbuka: true,
      pemilihanBerikutnya: kit.pemilihanBerikutnya,
      fokus: ['Pentadbiran', 'Pemilihan perwakilan tahunan', 'Perbahasan usul', 'Mengumpul sumber (IP dan MYR)']
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
      perwakilan: { cawangan: false, bahagian: false, sayapCawangan: false, g10: false, g2: false }      // dikira semula daripada profil.perwakilan (setahun)
    };
  }

  /** Keadaan untuk kitaran semasa. Kitaran baharu bermula dengan keadaan kosong.
   *  Pendaftaran/keputusan perwakilan ialah tahunan: entri tahun lepas dibuang. */
  function getKeadaanPemilihan(profil) {
    var p = profil || S.loadPlayer();
    if (!p) { return null; }
    var kit = getKitaran(p.tahun), st = p.pemilihan ? salin(p.pemilihan) : null;
    if (!st || st.kitaran !== kit.kitaran) { st = keadaanBaharu(p.tahun); }
    st.kempen = st.kempen || { mata: 0, aktiviti: {} };
    st.kempen.aktiviti = st.kempen.aktiviti || {};
    st.daftar = st.daftar || {}; st.keputusan = st.keputusan || {};
    ['daftar', 'keputusan'].forEach(function (f) {
      Object.keys(st[f]).forEach(function (k) {
        if (/^perwakilan_/.test(k) && st[f][k].tahun !== p.tahun) { delete st[f][k]; }
      });
    });
    var pwS = p.perwakilan || {};
    st.perwakilan = { cawangan: J.perwakilanSah(p, 'cawangan').sah, bahagian: J.perwakilanSah(p, 'bahagian').sah, sayapCawangan: pwS.sayapCawangan === p.tahun, g10: pwS.g10 === p.tahun, g2: pwS.g2 === p.tahun };
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
   * Senarai pertandingan untuk pemain pada tahun ini (mengikut sayap dan jawatan dipegang).
   * Setiap entri: { kod, jenis:'jawatan'|'perwakilan', jawatan, peringkat, kumpulan, sayap, kerusi, terbuka, sebab,
   *                 pertahan, ipPerlu, kesukaran, didaftar, selesai, keputusan, tetingkap, bolehUndi }
   * Jawatan: hanya pada tahun pemilihan. Perwakilan: setiap tahun.
   */
  function senaraiPertandingan(profil) {
    var p = profil || S.loadPlayer();
    if (!p) { return []; }
    var st = getKeadaanPemilihan(p), buka = adalahTahunPemilihan(p.tahun);
    var senarai = [];

    var Et = etika();
    function tambah(e) {
      if (Et && e.terbuka) {                                          // hak keahlian (Fasal 20.10)
        var hak = Et.semakHak(p, e.jenis === 'jawatan' ? 'jawatan' : 'perwakilan');
        if (!hak.boleh) { e.terbuka = false; e.sebab = hak.sebab; }
      }
      e.didaftar = !!st.daftar[e.kod];
      e.keputusan = st.keputusan[e.kod] || null;
      e.selesai = !!e.keputusan;
      if (e.terbuka && e.selesai) { e.terbuka = false; e.sebab = 'Pertandingan ini sudah selesai.'; }
      var w = tetingkapPeringkat(p, e.peringkat);
      e.tetingkap = w;                                         // { mula, tamat, label, status } atau null
      e.bolehUndi = !!(w ? w.status === 'dibuka' : true) && e.didaftar && !e.selesai;
      if (w && !e.selesai && w.status === 'tamat' && !e.didaftar) {
        e.terbuka = false; e.sebab = 'Pendaftaran ditutup. Musim ' + w.nama + ' (' + w.label + ') sudah tamat.';
      }
      senarai.push(e);
    }

    // 1. Perwakilan tahunan
    var g10Sah = !!p.perwakilan && p.perwakilan.g10 === p.tahun;                      // v6.2: wakil G10 hadir Mesyuarat Bahagian
    var pc = J.perwakilanSah(p, 'cawangan'), exBhg = J.exOfficio(p, 'bahagian'), exPau = J.exOfficio(p, 'pau');
    tambah({
      kod: 'perwakilan_cawangan', jenis: 'perwakilan', jawatan: 'Perwakilan Cawangan ke Bahagian', peringkat: 'cawangan', kumpulan: 'perwakilan', sayap: null,
      kerusi: kuotaCawangan(p), kesukaran: 0,
      terbuka: !exBhg.sah,
      sebab: exBhg.sah ? 'Anda hadir Bahagian secara automatik sebagai ' + exBhg.sumber + '.' : ''
    });
    tambah({
      kod: 'perwakilan_bahagian', jenis: 'perwakilan', jawatan: 'Perwakilan Bahagian ke PAU', peringkat: 'bahagian', kumpulan: 'perwakilan', sayap: null,
      kerusi: kuotaBahagian(p), kesukaran: 0,
      terbuka: !exPau.sah && (pc.layak || g10Sah),
      sebab: exPau.sah ? 'Anda hadir PAU secara automatik sebagai ' + exPau.sumber + '.'
                       : (pc.layak || g10Sah ? '' : 'Menangi Perwakilan Cawangan tahun ' + p.tahun + ' dahulu' + (pc.luput ? ' (mandat tahun lepas sudah luput).' : '.'))
    });

    // 1b. v6.2: wakil sayap (laluan Pemuda / Puteri / Wanita sahaja)
    var sy = J.sayapPemain(p);
    if (sy) {
      var NS = J.NAMA_SAYAP[sy], pw2 = p.perwakilan || {}, swSah = pw2.sayapCawangan === p.tahun, ketuaSy = J.pegang(p, 'sayap_cawangan_' + sy);   // Ketua sayap Cawangan hadir automatik
      tambah({
        kod: 'perwakilan_sayap_cawangan', jenis: 'perwakilan', jawatan: 'Wakil ' + NS + ' Cawangan ke Mesyuarat ' + NS + ' Bahagian', peringkat: 'sayap_cawangan', kumpulan: 'perwakilan', sayap: sy,
        kerusi: kuotaSayapCawangan(p), kesukaran: 0,
        terbuka: !exBhg.sah && !ketuaSy,
        sebab: ketuaSy ? 'Anda hadir Mesyuarat ' + NS + ' Bahagian secara automatik sebagai Ketua ' + NS + ' Cawangan.' : (exBhg.sah ? 'Anda hadir Mesyuarat ' + NS + ' Bahagian secara automatik sebagai ' + exBhg.sumber + '.' : '')
      });
      var ketuaSyB = J.pegang(p, 'sayap_bahagian_' + sy);                       // Ketua sayap Bahagian hadir Perhimpunan Sayap Pusat automatik
      var layakB = swSah || exBhg.sah || ketuaSy;
      tambah({
        kod: 'perwakilan_sayap_g10', jenis: 'perwakilan', jawatan: 'G10 ' + NS + ': 10 wakil ke Mesyuarat Bahagian', peringkat: 'sayap_bahagian', kumpulan: 'perwakilan', sayap: sy,
        kerusi: CONFIG.SAYAP_G10, kesukaran: 0,
        terbuka: layakB && !exBhg.sah,
        sebab: exBhg.sah ? 'Anda hadir Mesyuarat Bahagian secara automatik sebagai ' + exBhg.sumber + '.' : (layakB ? '' : 'Menjadi wakil ' + NS + ' Cawangan tahun ' + p.tahun + ' dahulu.')
      });
      tambah({
        kod: 'perwakilan_sayap_g2', jenis: 'perwakilan', jawatan: 'G2 ' + NS + ': 2 wakil ke Perhimpunan ' + NS + ' Pusat', peringkat: 'sayap_bahagian', kumpulan: 'perwakilan', sayap: sy,
        kerusi: CONFIG.SAYAP_G2, kesukaran: 0,
        terbuka: layakB && !exPau.sah && !ketuaSyB,
        sebab: ketuaSyB ? 'Anda hadir Perhimpunan ' + NS + ' Pusat secara automatik sebagai Ketua ' + NS + ' Bahagian.' : exPau.sah ? 'Anda hadir Perhimpunan ' + NS + ' Pusat secara automatik sebagai ' + exPau.sumber + '.' : (layakB ? '' : 'Menjadi wakil ' + NS + ' Cawangan tahun ' + p.tahun + ' dahulu.')
      });
    }

    // 2. Jawatan (tahun pemilihan)
    if (buka) {
      J.katalogUntuk(p).forEach(function (d) {
        var k = J.semakKelayakan(p, d);
        tambah({
          kod: d.kod, jenis: 'jawatan', jawatan: d.jawatan, peringkat: peringkatPemilihan(d), kumpulan: d.kumpulan, sayap: d.sayap,
          kerusi: d.kerusi, kesukaran: d.kesukaran, pangkat: d.pangkat, ipPerlu: d.ipMin,
          pertahan: !!k.pertahan, terbuka: k.terbuka, sebab: k.sebab
        });
      });
    }
    return senarai;
  }

  /* ---- Takwim bulanan (js/calendar.js, pilihan) ---- */
  function kalendar() { var g = typeof globalThis !== 'undefined' ? globalThis : null; return g && g.MyPolitikCalendar ? g.MyPolitikCalendar : null; }
  /** v7.27: jawatan sayap Cawangan/Bahagian dipilih dalam MESYUARAT SAYAP (sayap_cawangan / sayap_bahagian), bukan mesyuarat induk. Ketua Sayap Pusat dipilih dalam Perhimpunan Sayap (Pra-PAU, sayap_pau). */
  function peringkatPemilihan(d) { return d.kumpulan === 'sayap' ? (d.peringkat === 'pusat' ? 'sayap_pau' : 'sayap_' + d.peringkat) : d.peringkat; }
  function tetingkapPeringkat(p, peringkat) {
    var K = kalendar();
    return K ? K.getTetingkap(peringkat === 'pusat' ? 'pau' : peringkat, p.bulan) : null;
  }

  function cariPertandingan(p, kod) {
    var s = senaraiPertandingan(p);
    for (var i = 0; i < s.length; i++) { if (s[i].kod === kod) { return s[i]; } }
    return null;
  }

  function kodJawatanDidaftar(st) {
    return Object.keys(st.daftar).filter(function (k) { return st.daftar[k].jenis === 'jawatan' && !st.keputusan[k]; });
  }

  /** Pertandingan jawatan belum selesai yang didaftarkan pada peringkat dan kumpulan yang sama. */
  function pendaftaranSekumpulan(st, e) {
    return Object.keys(st.daftar).filter(function (k) {
      var d = st.daftar[k];
      return k !== e.kod && d.jenis === 'jawatan' && !st.keputusan[k] && d.peringkat === e.peringkat && d.kumpulan === e.kumpulan;
    });
  }

  /** Daftar sebagai calon. Jawatan: tahun pemilihan sahaja. Perwakilan: setiap tahun. */
  function daftarBertanding(kod) {
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    var e = cariPertandingan(p, kod);
    if (!e) {
      return adalahTahunPemilihan(p.tahun) ? gagal('tidak_dikenali', 'Pertandingan tidak dikenali atau tidak dibuka untuk anda: ' + kod)
                                           : gagal('tutup', 'Pertandingan jawatan ditutup. ' + tutupTahun(p));
    }
    if (e.selesai) { return gagal('selesai', e.sebab); }
    if (e.didaftar) { return gagal('sudah_daftar', 'Anda sudah mendaftar bertanding ' + e.jawatan + '.'); }
    if (!e.terbuka) { return gagal('terkunci', e.sebab); }

    var st = getKeadaanPemilihan(p);
    if (e.jenis === 'jawatan') {
      var lain = pendaftaranSekumpulan(st, e);
      if (lain.length) {
        return gagal('satu_jawatan', 'Anda sudah mendaftar bertanding ' + st.daftar[lain[0]].jawatan + ' di peringkat ' + J.LABEL_PERINGKAT[e.peringkat] +
                     (e.kumpulan === 'sayap' ? ' (sayap)' : '') + '. Tarik balik dahulu.');
      }
    }
    st.daftar[kod] = {
      kod: kod, jenis: e.jenis, jawatan: e.jawatan, peringkat: e.peringkat, kumpulan: e.kumpulan, sayap: e.sayap,
      kerusi: e.kerusi, kesukaran: e.kesukaran || 0, pertahan: !!e.pertahan,
      tahun: p.tahun, didaftarPada: new Date().toISOString()
    };
    var r = S.applyEffects({}, { kiraTindakan: false, patch: { pemilihan: st }, log: { tindakan: 'daftar_bertanding', nama: 'Daftar bertanding ' + e.jawatan, peringkat: 'pemilihan' } });
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
  function kekuatanPemain(p, st, peringkat, d) {
    var pr = String(peringkat).replace(/^sayap_/, '').replace(/^pau$/, 'pusat');                          // v6.2: peringkat sayap ikut skala peringkat induknya
    var b = CONFIG.BERAT[pr === 'cawangan' ? 'cawangan' : 'bahagian'], k = p.kesetiaan;
    var skala = CONFIG.IP_SKALA[pr] || CONFIG.IP_SKALA.bahagian;
    var v = Math.min(100, 100 * p.ip / skala) * b.ip + k.akarUmbi * b.akarUmbi + k.ketuaCawangan * b.ketuaCawangan +
            k.ajk * b.ajk + k.perwakilan * b.perwakilan + st.kempen.mata * b.kempen;
    if (d && d.sayap && J.sayapPemain(p) === d.sayap) { v += CONFIG.BONUS_SAYAP; }
    var sm = syMod(); if (sm && sm.bonusWarisan) { v += sm.bonusWarisan(p, d); }              // v6.5: Legacy Loyalty (pertandingan Induk sahaja)
    var Et = etika();
    if (Et) { v += Et.bonusUndi(p); }                                // Modal Sosial (kempen bersih)
    return clamp(v, 0, 100);
  }

  /* ---- Kuota perwakilan (v3.7) ---- */
  function kuota(ahli, r) { return clamp(Math.floor((Number(ahli) || 0) / r.ahliPerWakil), r.min, r.maks); }
  function ahliCawangan(p) { return p && p.cawanganInfo && p.cawanganInfo.jumlahAhli ? p.cawanganInfo.jumlahAhli : 60; }
  /** Jumlah ahli Bahagian: opts.jumlahAhliBahagian > profil.bahagianInfo.jumlahAhli > anggaran (ahli Cawangan x bil. Cawangan). */
  function ahliBahagian(p, opts) {
    if (opts && opts.jumlahAhliBahagian) { return opts.jumlahAhliBahagian; }
    if (p && p.bahagianInfo && p.bahagianInfo.jumlahAhli) { return p.bahagianInfo.jumlahAhli; }
    return ahliCawangan(p) * ((opts && opts.bilCawangan) || CONFIG.ANGGARAN_CAWANGAN_PER_BAHAGIAN);
  }
  function syMod() { var g = typeof globalThis !== 'undefined' ? globalThis : null; if (g && g.MyPolitikSayap) { return g.MyPolitikSayap; } try { return typeof require === 'function' ? require('./sayap.js') : null; } catch (x) { return null; } }
  function blokMod() { var g = typeof globalThis !== 'undefined' ? globalThis : null; if (g && g.MyPolitikBlok) { return g.MyPolitikBlok; } try { return typeof require === 'function' ? require('./blok.js') : null; } catch (x) { return null; } }
  function bonusKuota(p) { var m = syMod(); return m && m.bonusKuota ? m.bonusKuota(p) : 0; }              // v6.5: Kempen Outreach Belia
  function kuotaCawangan(p) { return kuota(ahliCawangan(p), CONFIG.KUOTA_CAWANGAN) + bonusKuota(p); }              // wakil Cawangan ke Bahagian
  /** v6.3: bilangan ahli sayap dalam Cawangan pemain (Pemuda, Puteri atau Wanita); data silang jantina x umur atau anggaran. */
  function ahliSayap(p, sayap) {
    var sy = sayap || J.sayapPemain(p), info = p && p.cawanganInfo ? p.cawanganInfo : null;
    if (!sy) { return 0; }
    var kg = info && info.kumpulan;
    if (!kg) {
      var g = typeof globalThis !== 'undefined' ? globalThis : null, Dm = g && g.MyPolitikData ? g.MyPolitikData : null;
      if (!Dm) { try { Dm = typeof require === 'function' ? require('./data.js') : null; } catch (x) { Dm = null; } }
      kg = Dm && info ? Dm.pecahanKumpulan(info) : null;
    }
    return kg && kg[sy] !== undefined ? kg[sy] : Math.round(ahliCawangan(p) * 0.2);
  }
  function kuotaSayapCawangan(p) { return kuota(ahliSayap(p), CONFIG.KUOTA_SAYAP_CAWANGAN) + bonusKuota(p); }   // v6.3: 1 wakil / 10 ahli sayap, maks 3
  function kuotaBahagian(p, opts) { return kuota(ahliBahagian(p, opts), CONFIG.KUOTA_BAHAGIAN); }   // wakil Bahagian ke PAU

  function bilPemilih(p, peringkat, opts) {
    if (peringkat === 'sayap_cawangan') { return Math.max(10, ahliSayap(p)); }      // v6.2: pengundi mesyuarat sayap
    if (peringkat === 'sayap_bahagian') { return kuotaSayapCawangan(p) * ((opts && opts.bilCawangan) || CONFIG.ANGGARAN_CAWANGAN_PER_BAHAGIAN); }
    if (peringkat === 'cawangan') {
      var jumlah = p.cawanganInfo && p.cawanganInfo.jumlahAhli ? p.cawanganInfo.jumlahAhli : 60;
      return Math.max(50, jumlah);
    }
    if (peringkat === 'bahagian') {
      return kuotaCawangan(p) * ((opts && opts.bilCawangan) || CONFIG.ANGGARAN_CAWANGAN_PER_BAHAGIAN);
    }
    return CONFIG.PEMILIH_PUSAT;
  }

  /** Pesaing tetap bagi satu pertandingan (seed daripada ID pemain, tahun dan kod). */
  function janaPesaing(p, kod, bilangan, tambahan) {
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
      senarai.push({ nama: nama, pemain: false, kekuatan: clamp(normal(rng, CONFIG.PENYEBARAN_PESAING.min + (tambahan || 0), CONFIG.PENYEBARAN_PESAING.sd), 8, 96) });
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
    var aras = (CONFIG.ARAS_PESAING[String(peringkat).replace(/^sayap_/, '').replace(/^pau$/, 'pusat')] || 0) + (d.kesukaran || 0) * CONFIG.GANDA_KESUKARAN;
    var calon = janaPesaing(p, d.kod, bil - 1, aras);
    calon.push({ nama: p.nama, pemain: true, kekuatan: kekuatanPemain(p, st, peringkat, d) });
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
  /* etika.tahap: 'bersih' (membina Modal Sosial), 'kelabu' (risiko kecil), 'kotor' (laju tetapi berisiko disiplin).
     etika.risiko = peluang asas dilapor (%). etika.berat 1-3. Rujukan Tataetika Ahli UMNO 2025. */
  var KEMPEN = [
    {
      id: 'ziarah_kasih_kempen', nama: 'Ziarah Kasih',
      penerangan: 'Menziarahi ahli yang uzur dan keluarga yang ditimpa musibah, tanpa meminta undi. Membina Modal Sosial.',
      kesan: { myr: -100, ap: -1, ip: 4, kesetiaan: { akarUmbi: 6 } }, mata: 5, maksKali: 4,
      etika: { tahap: 'bersih', modal: 5 }
    },
    {
      id: 'khidmat_masyarakat', nama: 'Khidmat Masyarakat',
      penerangan: 'Gotong-royong, klinik bergerak dan kelas tuisyen percuma. Kerja ikhlas yang dikenang akar umbi.',
      kesan: { ap: -2, myr: -375, ip: 6, reputasi: 2, kesetiaan: { akarUmbi: 6, ajk: 2 } }, mata: 7, maksKali: 3,
      etika: { tahap: 'bersih', modal: 7 }
    },
    {
      id: 'jamuan_mesyuarat', nama: 'Jamuan Mesyuarat',
      penerangan: 'Menjamu ahli dan AJK selepas mesyuarat. Zon kelabu: jamuan bertujuan meraih undi boleh dianggap melanggar Perkara 5.6.',
      kesan: { myr: -1000, ap: -1, kesetiaan: { ajk: 8, akarUmbi: 6 } }, mata: 10, maksKali: 3,
      etika: { tahap: 'kelabu', modal: -2, risiko: 6, tambahRisiko: 4, berat: 1, perkara: 'Menganjurkan jamuan sambil berkempen (Tataetika Perkara 5.6)', fasal: 'Tataetika 5.6' }
    },
    {
      id: 'siri_jelajah', nama: 'Siri Jelajah',
      penerangan: 'Menjelajah lokaliti dan bertemu ahli dari rumah ke rumah.',
      kesan: { myr: -750, ap: -2, ip: 5, kesetiaan: { akarUmbi: 12 } }, mata: 10, maksKali: 3
    },
    {
      id: 'lobi_ketua_bahagian', nama: 'Lobi Ketua Bahagian',
      penerangan: 'Bertemu Ketua Bahagian dan perwakilan untuk meraih sokongan.',
      kesan: { myr: -850, ap: -1, kesetiaan: { perwakilan: 10 } }, mata: 8, maksKali: 2
    },
    {
      id: 'janji_jawatan', nama: 'Janji Jawatan & Projek',
      penerangan: 'Menjanjikan pangkat atau projek kepada perwakilan sebagai balasan undi. Cepat meraih sokongan, tetapi dilarang Tataetika.',
      kesan: { ap: -1, ip: 3, kesetiaan: { ajk: 10, perwakilan: 8 } }, mata: 20, maksKali: 2,
      etika: { tahap: 'kotor', modal: -6, risiko: 20, tambahRisiko: 18, berat: 2, perkara: 'Menjanjikan pangkat atau projek bagi mendapat undi (Tataetika Perkara 5.1.1)', fasal: 'Fasal 20.13' }
    },
    {
      id: 'serang_media', nama: 'Serang Lawan di Media Sosial',
      penerangan: 'Menyebar tuduhan dan hantaran memburukkan calon lawan. Melanggar Tataetika Perkara 5.3 dan menjejaskan reputasi parti.',
      kesan: { myr: -200, ap: -1, reputasi: -6, kesetiaan: { akarUmbi: 4 } }, mata: 16, maksKali: 3,
      etika: { tahap: 'kotor', modal: -6, risiko: 18, tambahRisiko: 15, berat: 2, perkara: 'Menyebar fitnah terhadap calon di media sosial (Tataetika Perkara 5.3)', fasal: 'Tataetika 5.3' }
    },
    {
      id: 'agih_wang_undi', nama: 'Agihan Wang Undi',
      penerangan: 'Memberi wang kepada perwakilan untuk mendapatkan undi. Kemenangan paling pantas, tetapi inilah politik wang yang dilarang Fasal 20.13 dan boleh membawa pemecatan.',
      kesan: { myr: -5000, ap: -1, kesetiaan: { perwakilan: 18, ajk: 8 } }, mata: 28, maksKali: 2,
      etika: { tahap: 'kotor', modal: -10, risiko: 30, tambahRisiko: 30, berat: 3, perkara: 'Memberi wang bagi mendapatkan undi (Tataetika Perkara 5.1.2, politik wang)', fasal: 'Fasal 20.13' }
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
    var Et = etika();
    if (Et) { var hak = Et.semakHak(p, 'kempen'); if (!hak.boleh) { return { boleh: false, sebab: hak.sebab }; } }
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
        tahap: d.etika ? d.etika.tahap : 'neutral', modalSosial: d.etika ? d.etika.modal || 0 : 0,
        peluangLapor: d.etika && d.etika.risiko && p && etika() ? Math.round(etika().peluangLapor(etika().getEtika(p), d.etika)) : 0,
        kos: { ap: Math.abs(d.kesan.ap || 0), myr: Math.abs(d.kesan.myr || 0) },
        ringkas: S.ringkasPerubahan({ ip: d.kesan.ip || 0, myr: d.kesan.myr || 0, ap: d.kesan.ap || 0, reputasi: d.kesan.reputasi || 0, kesetiaan: d.kesan.kesetiaan || {} }) + (d.mata ? ', +' + d.mata + ' mata kempen' : ''),
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
    var Et = etika(), eo = Et && def.etika ? Et.selepasAktiviti(p, def.etika, opts) : null;
    var r = S.applyEffects(salin(def.kesan), {
      patch: eo ? { pemilihan: st, etika: eo.etika } : { pemilihan: st },
      log: { tindakan: def.id, nama: def.nama, peringkat: 'pemilihan' }
    });
    if (!r.ok) { return r; }

    var mesej = def.nama + ': ' + S.ringkasPerubahan(r.perubahan) + (def.mata ? ', +' + def.mata + ' mata kempen' : '') + '.' + (eo && eo.mesej ? ' ' + eo.mesej : '');
    if (anggaran) {
      mesej = 'Simulasi Pengundian untuk ' + anggaran.jawatan + ': peluang menang ' + anggaran.peluangMenang + '% (' + anggaran.kerusi +
              ' kerusi, ' + anggaran.jumlahCalon + ' calon, kedudukan purata ' + anggaran.kedudukanPurata + ').';
    }
    return { ok: true, mesej: mesej, perubahan: r.perubahan, mataKempen: st.kempen.mata, anggaran: anggaran, profil: r.profil, dilapor: !!(eo && eo.dilapor) };
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
  var KUNCI_PERWAKILAN = { perwakilan_cawangan: 'cawangan', perwakilan_bahagian: 'bahagian', perwakilan_sayap_cawangan: 'sayapCawangan', perwakilan_sayap_g10: 'g10', perwakilan_sayap_g2: 'g2' };

  function jalankanPemilihan(kod, opts) {
    opts = opts || {};
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    var st = getKeadaanPemilihan(p), d = st.daftar[kod];
    if (!d) { return gagal('belum_daftar', 'Anda belum mendaftar bertanding untuk kod ' + kod + '.'); }
    if (st.keputusan[kod]) { return gagal('sudah_selesai', 'Pertandingan ' + d.jawatan + ' sudah selesai.'); }
    var Et = etika();
    if (Et) { var hak = Et.semakHak(p, d.jenis === 'jawatan' ? 'jawatan' : 'perwakilan'); if (!hak.boleh) { return gagal('hak_dicabut', hak.sebab); } }
    var win = tetingkapPeringkat(p, d.peringkat);
    if (win && win.status !== 'dibuka') {
      return gagal('luar_musim', 'Pengundian ' + d.jawatan + ' hanya dijalankan pada ' + win.label.toLowerCase() + ' (' + win.nama + '). ' +
        (win.status === 'belum_tiba' ? 'Sekarang bulan ' + p.bulan + ', teruskan ke bulan seterusnya.' : 'Musim ini sudah tamat.'));
    }

    var rng = opts.rng || Math.random, b = bina(p, st, d, opts), h = undi(b.calon, b.kerusi, b.pemilih, rng);
    var sendiri = h.jadual.filter(function (j) { return j.pemain; })[0], menang = sendiri.menang;
    var jenis = d.jenis === 'perwakilan' ? 'perwakilan' : 'jawatan';
    var kumpulanKod = function (k) { var df = J.cariDef(k); return df ? df.kumpulan || 'utama' : 'utama'; };
    if (jenis === 'jawatan') {                                                  // v6.8: satu jawatan setiap peringkat dalam satu pemilihan
      var sudahMenang = Object.keys(st.keputusan).filter(function (k) { return k !== kod && st.daftar[k] && st.daftar[k].jenis !== 'perwakilan' && st.daftar[k].peringkat === d.peringkat && kumpulanKod(k) === kumpulanKod(kod) && st.keputusan[k] && st.keputusan[k].menang; })[0];
      if (sudahMenang) { return gagal('satu_setahun', 'Anda sudah memenangi ' + st.daftar[sudahMenang].jawatan + ' pada peringkat ' + d.peringkat + ' tahun ini. Hanya satu jawatan bagi setiap peringkat dalam satu pemilihan.'); }
    }
    if (jenis === 'jawatan' && !adalahTahunPemilihan(p.tahun)) { return gagal('tutup', 'Pemilihan jawatan hanya berlaku pada tahun pemilihan. ' + tutupTahun(p)); }

    var keputusan = {
      kod: kod, jawatan: d.jawatan, peringkat: d.peringkat, kerusi: b.kerusi, pemilih: b.pemilih, hadir: h.hadir,
      menang: menang, kedudukan: sendiri.kedudukan, undi: sendiri.undi, jumlahCalon: b.calon.length,
      jadual: h.jadual.filter(function (j, i) { return i < 10 || j.pemain; }), tahun: p.tahun, tarikh: new Date().toISOString()
    };
    st.keputusan[kod] = keputusan;

    var patch = { pemilihan: st }, peristiwa = [];
    if (jenis === 'perwakilan') {
      var aras = KUNCI_PERWAKILAN[kod] || 'bahagian', pw = salin(p.perwakilan || { cawangan: 0, bahagian: 0 });
      pw[aras] = menang ? p.tahun : 0;
      patch.perwakilan = pw;
      if (menang) { peristiwa.push({ jenis: 'perwakilan_terpilih', mesej: 'Anda terpilih sebagai ' + d.jawatan + '. Mandat sah untuk tahun ' + p.tahun + ' sahaja.' }); }
    } else {
      var def = J.cariDef(kod), pegangSebelum = J.pegang(p, kod);
      if (def) { var pt = J.terapkan(p, def, menang); Object.keys(pt).forEach(function (k) { patch[k] = pt[k]; }); }
      if (menang) { peristiwa.push({ jenis: 'jawatan_baharu', mesej: 'Tahniah. ' + (pegangSebelum ? 'Anda kekal sebagai ' : 'Anda dipilih sebagai ') + d.jawatan + '.' }); }
      else if (pegangSebelum) { peristiwa.push({ jenis: 'jawatan_hilang', mesej: 'Anda kalah mempertahankan ' + d.jawatan + ' dan kehilangan jawatan itu.' }); }
    }

    var ip = jenis === 'jawatan' ? (menang ? CONFIG.MENANG_IP_PERINGKAT[d.peringkat] : CONFIG.KALAH_IP_PERINGKAT[d.peringkat])
                                 : (menang ? CONFIG.MENANG_IP.perwakilan : CONFIG.KALAH_IP.perwakilan);
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
    if (!p) { return []; }
    if (peringkat === 'pau') { peringkat = 'pusat'; }
    if (peringkat === 'bahagian' && adalahTahunPemilihan(p.tahun)) {          // v6.6: blok sayap mengalih undi dalam pemilihan Ketua Bahagian (NPC)
      var bm = blokMod(); if (bm && bm.selesaikanPerlumbaan) { bm.selesaikanPerlumbaan(opts); p = S.loadPlayer(); }
    }
    var st = getKeadaanPemilihan(p);
    var kod = Object.keys(st.daftar).filter(function (k) { return !st.keputusan[k] && st.daftar[k].peringkat === peringkat; });
    var pg = function (k) { var df = J.cariDef(k); return df ? df.pangkat || 0 : 0; };
    kod.sort(function (a, b) { var ja = st.daftar[a].jenis === 'perwakilan' ? 0 : 1, jb = st.daftar[b].jenis === 'perwakilan' ? 0 : 1; var ga = (J.cariDef(a) || {}).kumpulan === 'sayap' ? 1 : 0, gb = (J.cariDef(b) || {}).kumpulan === 'sayap' ? 1 : 0; return ja - jb || ga - gb || pg(b) - pg(a); });   // perwakilan dahulu, jawatan utama sebelum sayap, kemudian pangkat tertinggi dahulu (v6.8)
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
      kiraTindakan: false, patch: { tahun: baru, bulan: 1, pemilihan: st },
      log: { tindakan: 'tahun_baharu', nama: 'Tahun ' + baru + ' bermula', peringkat: 'tahun' }
    });
    if (!r.ok) { return r; }
    var fokus = getFokusTahun(baru), peristiwa = [];
    peristiwa.push(fokus.fasa === 'pemilihan'
      ? { jenis: 'pemilihan_dibuka', mesej: 'Tahun ' + baru + ' ialah tahun pemilihan. Pertandingan jawatan (Cawangan, Bahagian, Pusat), pemilihan perwakilan dan kempen dibuka. Mandat perwakilan tahun lalu sudah luput.' }
      : { jenis: 'tahun_pentadbiran', mesej: 'Tahun ' + baru + ' ialah tahun pentadbiran. Pertandingan jawatan ditutup (pemilihan seterusnya ' + tahunPemilihanSeterusnya(baru) + '), tetapi mandat perwakilan tahun lalu sudah luput: bertanding semula di Cawangan.' });
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
    kuotaCawangan: kuotaCawangan, kuotaBahagian: kuotaBahagian, kuotaSayapCawangan: kuotaSayapCawangan, ahliSayap: ahliSayap,
    daftarBertanding: daftarBertanding,
    tarikBalik: tarikBalik,
    senaraiKempen: senaraiKempen,
    jalankanKempen: jalankanKempen,
    anggarkanPeluang: anggarkanPeluang,
    jalankanPemilihan: jalankanPemilihan,
    jalankanPemilihanPeringkat: jalankanPemilihanPeringkat,
    J: J,
    majuTahun: majuTahun
  };
});
