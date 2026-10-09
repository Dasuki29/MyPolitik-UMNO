/* ==========================================================================
   MyPolitik: UMNO — js/meeting.js
   Simulasi Mesyuarat Tahunan dan Usul.

   Tiga peringkat dalam satu tahun, mengikut urutan:
     1. Mesyuarat Cawangan   Usul Lokaliti. Pada tahun pemilihan: undi 5 perwakilan ke Bahagian.
     2. Mesyuarat Bahagian   Usul Kerusi PRU / Politik. Pada tahun pemilihan: undi 10 perwakilan ke PAU.
     3. PAU                  Usul Dasar Nasional dan Ucapan Dasar.

   Bagi setiap usul pemain memilih satu peranan:
     Pembawa Usul   membawa usul (kos 2 AP). Kredit penuh dan risiko terbesar.
     Pembahas       berbahas menyokong atau membantah (kos 1 AP).
     Mengundi       mengundi sokong, bantah atau berkecuali (percuma).
   Peranan, pendirian, pengaruh (IP) dan kesetiaan menentukan sama ada usul lulus
   serta perubahan IP dan Reputasi Parti pemain.

   Hanya perwakilan yang dipilih (atau pemegang jawatan yang berkaitan) menghadiri
   mesyuarat Bahagian dan PAU. Usul Lokaliti mengambil isu daripada Sembang Warung.

   Disimpan dalam profil.mesyuarat (localStorage) melalui MyPolitikSave.applyEffects().
   Perlu dimuatkan selepas js/save.js. js/election.js adalah pilihan tetapi diperlukan
   untuk pemilihan perwakilan dan penentuan kelayakan hadir.

   Cara guna dalam dashboard.html:
     var M = MyPolitikMeeting;
     M.getKeadaanMesyuarat();                       // status tiga peringkat
     M.mulaMesyuarat('cawangan');                   // jana agenda
     M.pilihPeranan('cawangan', usulId, 'pembawa'); // 'pembahas' + 'sokong', 'undi' + 'bantah'
     M.tutupMesyuarat('cawangan');                  // selesaikan baki dan pemilihan perwakilan
   ========================================================================== */
(function (root, factory) {
  function muat(fail, nama) {
    if (root[nama]) { return root[nama]; }
    if (typeof module === 'object' && typeof require === 'function') {
      try { return require('./' + fail); } catch (e) { return null; }
    }
    return null;
  }
  var S = muat('save.js', 'MyPolitikSave');
  if (!S) { throw new Error('meeting.js memerlukan js/save.js dimuatkan dahulu.'); }
  var E = muat('election.js', 'MyPolitikElection');   // pilihan
  var api = factory(S, E);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikMeeting = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (S, E) {
  'use strict';

  var CONFIG = {
    BIL_USUL: 3,
    ASAS_LULUS: 50,                                   // sokongan (0 hingga 100) untuk lulus
    SISIHAN_RAWAK: 8,
    KOS_AP: { pembawa: 2, pembahas: 1, undi: 0 },
    KREDIT: { pembawa: 1, pembahas: 0.5, undi: 0.25 }, // bahagian kredit Reputasi Parti
    GANJARAN_IP: {
      pembawa: { lulus: 12, ditolak: -4 },
      pembahas: { padan: 6, tidakPadan: 2 },
      undi: { padan: 2, tidakPadan: 0 }
    },
    HADIR: { cawangan: null, bahagian: 125, pau: 1500 }, // pengundi simulasi (cawangan = 35% ahli, min 30)
    TAHAP_HADIR_CAWANGAN: 0.35
  };

  var URUTAN = ['cawangan', 'bahagian', 'pau'];

  var PERINGKAT = {
    cawangan: { kod: 'cawangan', nama: 'Mesyuarat Cawangan', jenisUsul: 'Usul Lokaliti', kesetiaan: ['akarUmbi', 'ketuaCawangan'], perwakilan: { kerusi: 5, ke: 'Bahagian', kod: 'perwakilan_cawangan' } },
    bahagian: { kod: 'bahagian', nama: 'Mesyuarat Bahagian', jenisUsul: 'Usul Kerusi PRU dan Politik', kesetiaan: ['perwakilan'], perwakilan: { kerusi: 10, ke: 'PAU', kod: 'perwakilan_bahagian' } },
    pau: { kod: 'pau', nama: 'Perhimpunan Agung UMNO (PAU)', jenisUsul: 'Usul Dasar Nasional', kesetiaan: ['perwakilan'], perwakilan: null }
  };

  /* ------------------------------------------------------------------------
     1. KOLAM USUL
     populariti: sokongan asas (0 hingga 100). nilai: kesan pada Reputasi Parti jika diluluskan.
     ------------------------------------------------------------------------ */
  var KOLAM = {
    cawangan: [
      { kod: 'jalan_longkang',  tajuk: 'Baik pulih jalan dan longkang kawasan lokaliti', penerangan: 'Memohon peruntukan segera bagi jalan berlubang dan longkang tersumbat.', populariti: 70, nilai: 3 },
      { kod: 'dewan_surau',     tajuk: 'Naik taraf dewan komuniti dan surau', penerangan: 'Membaiki bumbung dan kemudahan asas untuk kegunaan majlis dan kenduri.', populariti: 65, nilai: 2 },
      { kod: 'latihan_belia',   tajuk: 'Program latihan kemahiran untuk belia lokaliti', penerangan: 'Bekerjasama dengan institusi latihan bagi belia yang menganggur.', populariti: 60, nilai: 4 },
      { kod: 'bantuan_warga',   tajuk: 'Bantuan bulanan tambahan untuk warga emas', penerangan: 'Menyalurkan bantuan kepada warga emas yang tinggal bersendirian.', populariti: 62, nilai: 3 },
      { kod: 'lampu_cctv',      tajuk: 'Pasang lampu jalan dan CCTV di taman perumahan', penerangan: 'Mengurangkan kes kecurian dan meningkatkan keselamatan.', populariti: 66, nilai: 3 },
      { kod: 'naik_yuran',      tajuk: 'Naikkan yuran keahlian cawangan', penerangan: 'Menaikkan yuran bagi menampung kos aktiviti cawangan.', populariti: 30, nilai: -3 },
      { kod: 'sumbangan_wajib', tajuk: 'Wajibkan sumbangan dana tahunan setiap ahli', penerangan: 'Setiap ahli diwajibkan menyumbang kepada dana kempen cawangan.', populariti: 28, nilai: -4 },
      { kod: 'had_gerai',       tajuk: 'Hadkan waktu operasi gerai malam', penerangan: 'Gerai ditutup awal bagi mengurangkan aduan kebisingan.', populariti: 35, nilai: -2 }
    ],
    bahagian: [
      { kod: 'calon_muda',      tajuk: 'Tampilkan calon muda untuk kerusi PRU bahagian', penerangan: 'Memberi ruang kepada pemimpin muda yang aktif di peringkat cawangan.', populariti: 55, nilai: 4 },
      { kod: 'kerusi_adil',     tajuk: 'Tuntut rundingan agihan kerusi PRU yang adil dalam gabungan', penerangan: 'Bahagian mahu pendirian jelas mengenai agihan kerusi sebelum PRU.', populariti: 60, nilai: 2 },
      { kod: 'pusat_khidmat',   tajuk: 'Wujudkan pusat khidmat penduduk di setiap DUN', penerangan: 'Pusat khidmat tetap untuk aduan dan bantuan penduduk.', populariti: 68, nilai: 4 },
      { kod: 'jentera_cawangan', tajuk: 'Mantapkan jentera pilihan raya peringkat cawangan', penerangan: 'Latihan dan pemetaan pengundi dibuat lebih awal.', populariti: 64, nilai: 3 },
      { kod: 'calon_luar',      tajuk: 'Terima calon luar bahagian untuk kerusi DUN', penerangan: 'Calon dibawa dari luar walaupun ada pemimpin setempat.', populariti: 32, nilai: -3 },
      { kod: 'kempen_awal',     tajuk: 'Mulakan kempen PRU 18 bulan lebih awal', penerangan: 'Kempen awal berisiko meletihkan jentera dan membazir dana.', populariti: 40, nilai: -1 }
    ],
    pau: [
      { kod: 'sara_hidup',      tajuk: 'Bantuan sara hidup bersasar untuk isi rumah berpendapatan rendah', penerangan: 'Bantuan diberi kepada kumpulan yang paling terkesan oleh kos sara hidup.', populariti: 70, nilai: 4 },
      { kod: 'latihan_teknikal', tajuk: 'Perluas biasiswa dan latihan teknikal untuk anak muda', penerangan: 'Menambah tempat latihan teknikal dan biasiswa di luar bandar.', populariti: 66, nilai: 4 },
      { kod: 'rumah_belia',     tajuk: 'Skim pemilikan rumah mampu milik untuk belia', penerangan: 'Skim pembiayaan dengan bayaran awal rendah untuk pembeli pertama.', populariti: 64, nilai: 3 },
      { kod: 'digital_luar',    tajuk: 'Pendigitalan perkhidmatan kerajaan di luar bandar', penerangan: 'Menambah akses internet dan kaunter digital di kawasan luar bandar.', populariti: 62, nilai: 3 },
      { kod: 'had_tempoh',      tajuk: 'Had tempoh memegang jawatan utama parti', penerangan: 'Pemegang jawatan utama dihadkan kepada dua penggal berturut-turut.', populariti: 45, nilai: 2 },
      { kod: 'cukai_baharu',    tajuk: 'Perkenalkan cukai baharu bagi menampung subsidi', penerangan: 'Cukai baharu dicadang untuk membiayai bantuan, dengan risiko bantahan awam.', populariti: 30, nilai: -3 }
    ]
  };

  var TEMA_UCAPAN = ['Perpaduan dan Pembangunan', 'Ekonomi Rakyat', 'Kesinambungan dan Pembaharuan', 'Parti Dekat dengan Akar Umbi'];

  /* ------------------------------------------------------------------------
     2. PEMBANTU
     ------------------------------------------------------------------------ */
  function salin(o) { return JSON.parse(JSON.stringify(o)); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function gagal(kod, ralat) { return { ok: false, kod: kod, ralat: ralat }; }

  function normal(rng, min, sd) {
    var u = 1 - rng(), v = rng();
    return min + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function peringkatJawatan(jawatan) {
    var j = String(jawatan || '');
    if (/Bahagian/i.test(j)) { return 'bahagian'; }
    if (/Cawangan/i.test(j)) { return 'cawangan'; }
    return 'pusat';
  }

  function keadaanMesyuarat(p) {
    var m = p.mesyuarat;
    if (!m || m.tahun !== p.tahun) { return { tahun: p.tahun, cawangan: null, bahagian: null, pau: null }; }
    return salin(m);
  }

  function pemilihanAktif(p) { return !!(E && E.adalahTahunPemilihan(p.tahun)); }

  /** Siapa boleh hadir. Bahagian dan PAU hanya untuk perwakilan atau pemegang jawatan berkaitan. */
  function bolehHadir(p, peringkat) {
    if (peringkat === 'cawangan') { return { ok: true }; }
    var perw = E ? E.getKeadaanPemilihan(p).perwakilan : { cawangan: false, bahagian: false };
    var per = p.jawatan === 'Ahli Biasa' ? 'ahli' : peringkatJawatan(p.jawatan);
    if (peringkat === 'bahagian') {
      var ok = perw.cawangan || p.jawatan === 'Ketua Cawangan' || per === 'bahagian' || per === 'pusat';
      return ok ? { ok: true } : { ok: false, sebab: 'Hanya Perwakilan Cawangan yang terpilih, Ketua Cawangan dan pemegang jawatan lebih tinggi boleh hadir.' };
    }
    var ok2 = perw.bahagian || p.jawatan === 'Ketua Bahagian' || per === 'pusat';
    return ok2 ? { ok: true } : { ok: false, sebab: 'Hanya Perwakilan Bahagian yang terpilih, Ketua Bahagian dan pemegang jawatan pusat boleh hadir PAU.' };
  }

  function statusPeringkat(p, ms, peringkat) {
    var s = ms[peringkat];
    if (s && s.status === 'selesai') { return { status: 'selesai', sebab: '' }; }
    if (s && s.status === 'sedang') { return { status: 'sedang', sebab: '' }; }
    var h = bolehHadir(p, peringkat);
    if (!h.ok) { return { status: 'tidak_layak', sebab: h.sebab }; }
    for (var i = 0; i < URUTAN.indexOf(peringkat); i++) {
      var sebelum = URUTAN[i], ss = ms[sebelum];
      if (bolehHadir(p, sebelum).ok && !(ss && ss.status === 'selesai')) {
        return { status: 'terkunci', sebab: 'Selesaikan ' + PERINGKAT[sebelum].nama + ' dahulu.' };
      }
    }
    return { status: 'boleh_mula', sebab: '' };
  }

  function bilHadir(p, peringkat) {
    if (peringkat === 'cawangan') {
      var jumlah = p.cawanganInfo && p.cawanganInfo.jumlahAhli ? p.cawanganInfo.jumlahAhli : 100;
      return Math.max(30, Math.round(jumlah * CONFIG.TAHAP_HADIR_CAWANGAN));
    }
    return CONFIG.HADIR[peringkat];
  }

  /* ------------------------------------------------------------------------
     3. AGENDA
     ------------------------------------------------------------------------ */
  function janaAgenda(p, peringkat) {
    var rng = S.rngBerbenih(p.id + '|' + p.tahun + '|mesyuarat|' + peringkat);
    var agenda = [], pool = KOLAM[peringkat].slice(), dipakai = {};

    // Usul Lokaliti bermula daripada isu tempatan yang dicatat melalui Sembang Warung.
    if (peringkat === 'cawangan') {
      (p.isu || []).filter(function (i) { return !i.selesai; }).slice(0, 2).forEach(function (i) {
        agenda.push({
          id: 'cawangan-' + p.tahun + '-isu-' + i.kod, jenis: 'usul', kod: 'isu_' + i.kod, sumber: 'sembang_warung',
          tajuk: 'Atasi isu: ' + i.tajuk, penerangan: i.penerangan,
          populariti: clamp(55 + i.tahap * 5, 0, 100), nilai: i.tahap, status: 'terbuka', pilihan: null, keputusan: null
        });
        dipakai['isu_' + i.kod] = true;
      });
    }

    // Isi baki daripada kolam, susunan berbenih supaya tetap sepanjang tahun.
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    for (var k = 0; k < pool.length && agenda.length < CONFIG.BIL_USUL; k++) {
      var u = pool[k];
      agenda.push({
        id: peringkat + '-' + p.tahun + '-' + u.kod, jenis: 'usul', kod: u.kod, sumber: 'kolam',
        tajuk: u.tajuk, penerangan: u.penerangan,
        populariti: clamp(Math.round(u.populariti + (rng() * 16 - 8)), 5, 95), nilai: u.nilai,
        status: 'terbuka', pilihan: null, keputusan: null
      });
    }

    if (peringkat === 'pau') {
      agenda.push({
        id: 'pau-' + p.tahun + '-ucapan', jenis: 'ucapan_dasar', kod: 'ucapan_dasar', sumber: 'presiden',
        tajuk: 'Ucapan Dasar Presiden: ' + TEMA_UCAPAN[Math.floor(rng() * TEMA_UCAPAN.length)],
        penerangan: 'Presiden menyampaikan hala tuju parti. Perwakilan berbahas dan mengundi sokongan terhadap ucapan.',
        populariti: 72, nilai: 3, status: 'terbuka', pilihan: null, keputusan: null
      });
    }

    var perw = PERINGKAT[peringkat].perwakilan;
    if (perw && pemilihanAktif(p)) {
      agenda.push({
        id: peringkat + '-' + p.tahun + '-pemilihan', jenis: 'pemilihan', kod: perw.kod, sumber: 'pemilihan',
        tajuk: 'Undi ' + perw.kerusi + ' perwakilan ke ' + perw.ke,
        penerangan: 'Pengundian dijalankan apabila mesyuarat ditutup. Daftar pencalonan anda melalui modul pemilihan sebelum itu.',
        kerusi: perw.kerusi, status: 'menunggu', keputusan: null
      });
    }
    return agenda;
  }

  /* ------------------------------------------------------------------------
     4. MODEL KEPUTUSAN USUL
     ------------------------------------------------------------------------ */
  function pengaruhPemain(p, peringkat, peranan, pendirian) {
    if (pendirian !== 'sokong' && pendirian !== 'bantah') { return 0; }
    var tanda = pendirian === 'sokong' ? 1 : -1, ipN = Math.min(100, p.ip) / 100;
    var kes = PERINGKAT[peringkat].kesetiaan.map(function (k) { return p.kesetiaan[k]; });
    var lyl = kes.reduce(function (a, b) { return a + b; }, 0) / kes.length / 100;   // 0 hingga 1
    var asas = peranan === 'pembawa' ? 6 + 24 * ipN : (peranan === 'pembahas' ? 3 + 14 * ipN : 2);
    return tanda * asas * (0.6 + 0.8 * lyl);
  }

  function selesaikanUsul(usul, pengaruh, hadir, rng) {
    var sokongan = clamp(Math.round(usul.populariti + pengaruh + normal(rng, 0, CONFIG.SISIHAN_RAWAK)), 0, 100);
    var sokong = Math.round(hadir * clamp(sokongan / 100, 0.02, 0.98));
    return { lulus: sokong > hadir - sokong, sokongan: sokongan, hadir: hadir, undiSokong: sokong, undiBantah: hadir - sokong };
  }

  function kesanPeranan(peranan, pendirian, lulus, usul) {
    var padan = pendirian === 'sokong' || pendirian === 'bantah' ? ((pendirian === 'sokong') === lulus) : false;
    var ip = 0, reputasi = 0, g = CONFIG.GANJARAN_IP[peranan];
    if (peranan === 'pembawa') { ip = lulus ? g.lulus : g.ditolak; }
    else if (pendirian === 'berkecuali') { ip = 0; }
    else { ip = padan ? g.padan : g.tidakPadan; }
    if (padan) { reputasi = Math.round((pendirian === 'sokong' ? 1 : -1) * usul.nilai * CONFIG.KREDIT[peranan]); }
    return { ip: ip, reputasi: reputasi, padan: padan };
  }

  /* ------------------------------------------------------------------------
     5. API
     ------------------------------------------------------------------------ */

  /** Senarai peranan dan kos untuk melukis butang. */
  function senaraiPeranan() {
    return [
      { id: 'pembawa', nama: 'Pembawa Usul', kosAP: CONFIG.KOS_AP.pembawa, pendirian: ['sokong'], penerangan: 'Membawa usul. Kredit penuh jika lulus, IP berkurang jika ditolak.' },
      { id: 'pembahas', nama: 'Pembahas', kosAP: CONFIG.KOS_AP.pembahas, pendirian: ['sokong', 'bantah'], penerangan: 'Berbahas menyokong atau membantah. Kredit separuh.' },
      { id: 'undi', nama: 'Mengundi', kosAP: CONFIG.KOS_AP.undi, pendirian: ['sokong', 'bantah', 'berkecuali'], penerangan: 'Mengundi sahaja. Kesan kecil dan percuma.' }
    ];
  }

  /** Status ketiga-tiga peringkat. Untuk lukisan dashboard. */
  function getKeadaanMesyuarat(profil) {
    var p = profil || S.loadPlayer();
    if (!p) { return null; }
    var ms = keadaanMesyuarat(p);
    return {
      tahun: p.tahun, pemilihan: pemilihanAktif(p),
      peringkat: URUTAN.map(function (k) {
        var st = statusPeringkat(p, ms, k), m = ms[k], agenda = m ? m.agenda : null;
        return {
          kod: k, nama: PERINGKAT[k].nama, jenisUsul: PERINGKAT[k].jenisUsul,
          status: st.status, sebab: st.sebab,
          bilUsul: agenda ? agenda.filter(function (a) { return a.jenis !== 'pemilihan'; }).length : null,
          bilSelesai: agenda ? agenda.filter(function (a) { return a.jenis !== 'pemilihan' && a.status === 'selesai'; }).length : null,
          agenda: agenda, ringkasan: m && m.ringkasan ? m.ringkasan : null
        };
      })
    };
  }

  function mulaMesyuarat(peringkat) {
    if (!PERINGKAT[peringkat]) { return gagal('tidak_dikenali', 'Peringkat tidak dikenali: ' + peringkat); }
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    var ms = keadaanMesyuarat(p), st = statusPeringkat(p, ms, peringkat);
    if (st.status === 'selesai') { return gagal('selesai', PERINGKAT[peringkat].nama + ' tahun ' + p.tahun + ' sudah selesai.'); }
    if (st.status === 'sedang') { return gagal('sedang', PERINGKAT[peringkat].nama + ' sedang berjalan.'); }
    if (st.status !== 'boleh_mula') { return gagal(st.status, st.sebab); }

    ms[peringkat] = { status: 'sedang', mula: new Date().toISOString(), agenda: janaAgenda(p, peringkat), ringkasan: null };
    var r = S.applyEffects({}, {
      kiraTindakan: false, patch: { mesyuarat: ms },
      log: { tindakan: 'mula_mesyuarat', nama: PERINGKAT[peringkat].nama + ' ' + p.tahun, peringkat: peringkat }
    });
    if (!r.ok) { return r; }
    return { ok: true, mesej: PERINGKAT[peringkat].nama + ' dimulakan. ' + ms[peringkat].agenda.length + ' perkara dalam agenda.', mesyuarat: ms[peringkat], profil: r.profil };
  }

  /**
   * Pilih peranan bagi satu usul dan selesaikan usul itu serta-merta.
   * peranan: 'pembawa' | 'pembahas' | 'undi'
   * pendirian: 'sokong' | 'bantah' | 'berkecuali' (berkecuali hanya untuk peranan 'undi').
   * Pembawa sentiasa menyokong. Pembawa tidak boleh dipilih untuk Ucapan Dasar.
   * opts: { rng } untuk ujian.
   */
  function pilihPeranan(peringkat, usulId, peranan, pendirian, opts) {
    opts = opts || {};
    if (!PERINGKAT[peringkat]) { return gagal('tidak_dikenali', 'Peringkat tidak dikenali: ' + peringkat); }
    if (!CONFIG.KOS_AP.hasOwnProperty(peranan)) { return gagal('peranan', 'Peranan tidak sah: ' + peranan); }
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    var ms = keadaanMesyuarat(p), m = ms[peringkat];
    if (!m || m.status !== 'sedang') { return gagal('belum_mula', 'Mulakan ' + PERINGKAT[peringkat].nama + ' dahulu.'); }

    var usul = null;
    m.agenda.forEach(function (a) { if (a.id === usulId) { usul = a; } });
    if (!usul || usul.jenis === 'pemilihan') { return gagal('tiada_usul', 'Usul tidak ditemui: ' + usulId); }
    if (usul.status === 'selesai') { return gagal('sudah_selesai', 'Usul ini sudah diputuskan.'); }
    if (peranan === 'pembawa' && usul.jenis === 'ucapan_dasar') { return gagal('peranan', 'Ucapan Dasar disampaikan oleh Presiden. Pilih Pembahas atau Mengundi.'); }

    if (peranan === 'pembawa') { pendirian = 'sokong'; }
    var sah = peranan === 'pembahas' ? ['sokong', 'bantah'] : ['sokong', 'bantah', 'berkecuali'];
    if (sah.indexOf(pendirian) < 0) { return gagal('pendirian', 'Pendirian tidak sah untuk ' + peranan + ': ' + pendirian); }
    if (p.ap < CONFIG.KOS_AP[peranan]) { return gagal('ap', 'AP tidak mencukupi (perlu ' + CONFIG.KOS_AP[peranan] + ').'); }

    var rng = opts.rng || Math.random;
    var hasil = selesaikanUsul(usul, pengaruhPemain(p, peringkat, peranan, pendirian), bilHadir(p, peringkat), rng);
    var kesan = kesanPeranan(peranan, pendirian, hasil.lulus, usul);

    usul.status = 'selesai';
    usul.pilihan = { peranan: peranan, pendirian: pendirian };
    usul.keputusan = { lulus: hasil.lulus, sokongan: hasil.sokongan, hadir: hasil.hadir, undiSokong: hasil.undiSokong, undiBantah: hasil.undiBantah, padan: kesan.padan, ip: kesan.ip, reputasi: kesan.reputasi };

    var r = S.applyEffects({ ap: -CONFIG.KOS_AP[peranan], ip: kesan.ip, reputasi: kesan.reputasi }, {
      patch: { mesyuarat: ms },
      log: { tindakan: 'usul_' + peranan, nama: usul.tajuk + ' (' + peranan + ', ' + pendirian + ')', peringkat: peringkat }
    });
    if (!r.ok) { return r; }

    var nama = { pembawa: 'Pembawa', pembahas: 'Pembahas', undi: 'Mengundi' }[peranan];
    var mesej = nama + ' (' + pendirian + '): usul ' + (hasil.lulus ? 'LULUS' : 'DITOLAK') + ' dengan ' + hasil.undiSokong + ' sokong dan ' +
                hasil.undiBantah + ' bantah. ' + S.ringkasPerubahan(r.perubahan) + '.';
    return { ok: true, mesej: mesej, keputusan: usul.keputusan, usul: usul, perubahan: r.perubahan, profil: r.profil };
  }

  /**
   * Tutup mesyuarat: usul yang tidak disertai diputuskan tanpa kesan pada pemain,
   * kemudian pemilihan perwakilan peringkat itu dijalankan (tahun pemilihan sahaja).
   * opts: { rng }
   */
  function tutupMesyuarat(peringkat, opts) {
    opts = opts || {};
    if (!PERINGKAT[peringkat]) { return gagal('tidak_dikenali', 'Peringkat tidak dikenali: ' + peringkat); }
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    var ms = keadaanMesyuarat(p), m = ms[peringkat];
    if (!m || m.status !== 'sedang') { return gagal('belum_mula', PERINGKAT[peringkat].nama + ' tidak sedang berjalan.'); }

    // 1. Pemilihan dijalankan dahulu kerana ia mengubah profil (jawatan, perwakilan).
    var pemilihan = [];
    if (E && pemilihanAktif(p) && PERINGKAT[peringkat].perwakilan) {
      pemilihan = E.jalankanPemilihanPeringkat(peringkat, { rng: opts.rng });
    }

    // 2. Muat semula profil dan putuskan baki usul.
    p = S.loadPlayer();
    ms = keadaanMesyuarat(p); m = ms[peringkat];
    var rng = opts.rng || Math.random, hadir = bilHadir(p, peringkat), tanpaPenyertaan = [];
    m.agenda.forEach(function (a) {
      if (a.jenis === 'pemilihan') {
        var h = pemilihan.filter(function (x) { return x.ok && x.keputusan.kod === a.kod; })[0];
        a.status = 'selesai';
        a.keputusan = h ? { dijalankan: true, menang: h.keputusan.menang, kedudukan: h.keputusan.kedudukan } : { dijalankan: false };
      } else if (a.status !== 'selesai') {
        var k = selesaikanUsul(a, 0, hadir, rng);
        a.status = 'selesai'; a.pilihan = null;
        a.keputusan = { lulus: k.lulus, sokongan: k.sokongan, hadir: k.hadir, undiSokong: k.undiSokong, undiBantah: k.undiBantah, padan: false, ip: 0, reputasi: 0 };
        tanpaPenyertaan.push(a.tajuk);
      }
    });

    var usulList = m.agenda.filter(function (a) { return a.jenis !== 'pemilihan'; });
    var ringkasan = {
      lulus: usulList.filter(function (a) { return a.keputusan.lulus; }).length,
      ditolak: usulList.filter(function (a) { return !a.keputusan.lulus; }).length,
      disertai: usulList.filter(function (a) { return a.pilihan; }).length,
      tanpaPenyertaan: tanpaPenyertaan.length,
      pemilihan: pemilihan.filter(function (x) { return x.ok; }).map(function (x) { return { kod: x.keputusan.kod, menang: x.keputusan.menang, kedudukan: x.keputusan.kedudukan }; })
    };
    m.status = 'selesai'; m.tamat = new Date().toISOString(); m.ringkasan = ringkasan;

    var r = S.applyEffects({}, {
      kiraTindakan: false, patch: { mesyuarat: ms },
      log: { tindakan: 'tutup_mesyuarat', nama: PERINGKAT[peringkat].nama + ' ' + p.tahun + ' ditutup', peringkat: peringkat }
    });
    if (!r.ok) { return r; }

    var peristiwa = [];
    pemilihan.forEach(function (x) { if (x.ok) { x.peristiwa.forEach(function (e) { peristiwa.push(e); }); } });
    var mesej = PERINGKAT[peringkat].nama + ' ditutup. ' + ringkasan.lulus + ' usul lulus, ' + ringkasan.ditolak + ' ditolak.';
    pemilihan.forEach(function (x) { if (x.ok) { mesej += ' ' + x.mesej; } else { mesej += ' ' + x.ralat; } });
    return { ok: true, mesej: mesej, ringkasan: ringkasan, pemilihan: pemilihan, peristiwa: peristiwa, profil: r.profil };
  }

  return {
    CONFIG: CONFIG,
    PERINGKAT: PERINGKAT,
    KOLAM: KOLAM,
    senaraiPeranan: senaraiPeranan,
    getKeadaanMesyuarat: getKeadaanMesyuarat,
    mulaMesyuarat: mulaMesyuarat,
    pilihPeranan: pilihPeranan,
    tutupMesyuarat: tutupMesyuarat
  };
});