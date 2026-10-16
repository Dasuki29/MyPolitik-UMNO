/* ==========================================================================
   Nusa Politik — js/dewan.js   (v7.55)
   Enjin Sistem Dewan Rakyat & Usul Parlimen:
     1. Kerusi Dewan Rakyat (222; majoriti 112) mengikut gabungan; kestabilan gabungan kerajaan;
     2. Bentang RUU (12 RUU dalam 6 kategori) dan Bajet Negara; lobi MP; undian;
     3. Usul Undi Tidak Percaya (3 hari; gagal = kerajaan tumbang, PRU mengejut);
     4. Soal Jawab Lisan bulanan (diplomatik / defensif / agresif).
   State: p.dewan = { undi, tp, soalan, laras, sesi, bajetTahun, tpTerakhir, sejarah }
   Andaian (laras dalam CONFIG): semua angka ialah anggaran permainan; bukan data Parlimen sebenar.
   Versi DUN (Dewan Undangan Negeri) menyusul.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikDewan = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  function modul(nama, fail) {
    if (root[nama]) { return root[nama]; }
    try { if (typeof require === 'function') { return require('./' + fail); } } catch (e) { /* tidak dimuatkan */ }
    return null;
  }
  function S() { return modul('MyPolitikSave', 'save.js'); }
  function KB() { return modul('MyPolitikKabinet', 'kabinet.js'); }
  function PRU() { return modul('MyPolitikPRU', 'pru.js'); }
  function ST() { return modul('MyPolitikStres', 'stress.js'); }
  function PAP() { return root.NusaPaparan || null; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  var rngLalai = Math.random;
  function rng(o) { return (o && o.rng) || rngLalai; }
  function antara(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function salin(o) { return JSON.parse(JSON.stringify(o)); }

  var CONFIG = {
    JUMLAH: 222, AMBANG: 112,
    SESI: [3, 7, 10], BULAN_BAJET: 10,                       // bulan sidang Dewan; Bajet dibentang bulan 10
    LOBI_MAKS: 6, AP_LOBI: 1,
    ATAS_SOKONG: 0.30,                                        // anggaran bahagian MP atas pagar yang mengundi sokong
    LULUS: { ip: 200, rating: 15, kestabilan: 5 },
    GAGAL: { rating: -20, kestabilan: -15, tekanan: 8 },
    GAGAL_BAJET: { rating: -30, kestabilan: -25, tekanan: 15 },
    TP: { AMBANG: 30, HARI: 3, JEDA_BULAN: 12, GOYAH_ASAS: 0.42, BAHAGIAN_GOYAH: 0.25, SELAMAT: { rating: 10, kestabilan: 25, tekanan: -10 } },
    SOALAN_PELUANG: 0.6, SOALAN_DIAM: { rating: -4, tekanan: 5 },
    KESTABILAN_SUSUT: 3
  };

  /* ---------- Data: kategori & RUU ---------- */
  var KATEGORI = {
    ekonomi:    { nama: 'Ekonomi & Kewangan', kata: /Kewangan|Ekonomi|Pelaburan|Perdagangan|Usahawan|Perladangan|Komoditi|Pertanian|Sumber Manusia|Kos Sara/i },
    pendidikan: { nama: 'Pendidikan & Belia', kata: /Pendidikan|Belia|Digital|Sains|Komunikasi|Teknologi/i },
    kesihatan:  { nama: 'Kesihatan & Kebajikan', kata: /Kesihatan|Wanita|Keluarga|Perpaduan|Agama|Masyarakat|Kebajikan/i },
    alam:       { nama: 'Alam Sekitar & Tenaga', kata: /Sumber Asli|Alam|Tenaga|Kelestarian/i },
    infra:      { nama: 'Infrastruktur & Pengangkutan', kata: /Pengangkutan|Kerja Raya|Tempatan|Luar Bandar|Pelancongan|Wilayah|Sabah/i },
    integriti:  { nama: 'Integriti & Tadbir Urus', kata: /Undang|Reformasi|Dalam Negeri|Luar Negeri|Pertahanan|JPM|Integriti/i }
  };
  var ORDER_KATEGORI = ['ekonomi', 'pendidikan', 'kesihatan', 'alam', 'infra', 'integriti'];

  /* asas = bahagian MP kerajaan yang sokong sejak awal; silang = bahagian MP pembangkang yang berminat (atas pagar); ekstra = ganjaran kecil jika lulus */
  var RUU = [
    { id: 'ruu_cukai',        kategori: 'ekonomi',    tajuk: 'RUU Cukai Barang dan Perkhidmatan (Pindaan)', huraian: 'Pindaan kadar dan pengecualian cukai.', asas: 0.72, silang: 0.02, ekstra: { akarUmbi: -2 } },
    { id: 'ruu_dana',         kategori: 'ekonomi',    tajuk: 'RUU Dana Pelaburan Strategik', huraian: 'Dana pelaburan kerajaan untuk sektor strategik.', asas: 0.78, silang: 0.05, ekstra: {} },
    { id: 'ruu_digital',      kategori: 'pendidikan', tajuk: 'RUU Pendidikan Digital', huraian: 'Kurikulum dan infrastruktur digital sekolah.', asas: 0.82, silang: 0.06, ekstra: {} },
    { id: 'ruu_pinjaman',     kategori: 'pendidikan', tajuk: 'RUU Skim Pinjaman Belia', huraian: 'Pinjaman pendidikan dan usahawan belia.', asas: 0.85, silang: 0.10, ekstra: { akarUmbi: 2 } },
    { id: 'ruu_wargaemas',    kategori: 'kesihatan',  tajuk: 'RUU Skim Perlindungan Kesihatan Warga Emas', huraian: 'Perlindungan kesihatan untuk warga emas.', asas: 0.88, silang: 0.15, ekstra: { akarUmbi: 3 } },
    { id: 'ruu_tembakau',     kategori: 'kesihatan',  tajuk: 'RUU Kawalan Tembakau', huraian: 'Had penjualan dan pengiklanan.', asas: 0.80, silang: 0.08, ekstra: { reputasi: 1 } },
    { id: 'ruu_awam',         kategori: 'infra',      tajuk: 'RUU Pengangkutan Awam Bersepadu', huraian: 'Penyelarasan pengangkutan awam seluruh negara.', asas: 0.86, silang: 0.10, ekstra: {} },
    { id: 'ruu_jalan',        kategori: 'infra',      tajuk: 'RUU Projek Jalan Luar Bandar', huraian: 'Peruntukan khas jalan luar bandar.', asas: 0.90, silang: 0.12, ekstra: { akarUmbi: 2 } },
    { id: 'ruu_tenaga',       kategori: 'alam',       tajuk: 'RUU Tenaga Boleh Baharu', huraian: 'Insentif tenaga solar dan hidro.', asas: 0.82, silang: 0.07, ekstra: {} },
    { id: 'ruu_sisa',         kategori: 'alam',       tajuk: 'RUU Pengurusan Sisa Pepejal', huraian: 'Pengasingan dan pelupusan sisa.', asas: 0.84, silang: 0.08, ekstra: {} },
    { id: 'ruu_politik',      kategori: 'integriti',  tajuk: 'RUU Pembiayaan Politik', huraian: 'Kawalan sumbangan dan perbelanjaan parti.', asas: 0.62, silang: 0.12, ekstra: { reputasi: 3 } },
    { id: 'ruu_sprm',         kategori: 'integriti',  tajuk: 'RUU Pindaan Akta SPRM', huraian: 'Memperkukuh kuasa dan kebebasan SPRM.', asas: 0.66, silang: 0.15, ekstra: { reputasi: 3 } }
  ];
  function bajet(tahun) { return { id: 'bajet', kategori: 'bajet', tajuk: 'Bajet Negara ' + (Number(tahun) + 1), huraian: 'Peruntukan tahunan negara.', asas: 0.80, silang: 0.04, ekstra: {}, jenis: 'bajet' }; }
  function cariRUU(id, tahun) { if (id === 'bajet') { return bajet(tahun); } for (var i = 0; i < RUU.length; i++) { if (RUU[i].id === id) { return RUU[i]; } } return null; }

  /* ---------- Data: tindakan lobi ---------- */
  var LOBI = {
    atas_pagar:  { id: 'atas_pagar',  nama: 'Lobi MP atas pagar', huraian: 'RM 6,000 · +6 hingga +10 undi · tiada risiko', myr: 6000, ip: 0 },
    cdf:         { id: 'cdf',         nama: 'Tawar projek CDF kepada MP yang goyah', huraian: '-40 IP · +5 undi · 20% dilihat berpolitik (Reputasi -2)', myr: 0, ip: 40 },
    pembangkang: { id: 'pembangkang', nama: 'Rundingan dengan pembangkang (PH/PN)', huraian: 'RM 10,000 · +3 hingga +6 undi · peluang 35%', myr: 10000, ip: 0 }
  };
  var TP_TINDAK = {
    pujuk: { id: 'pujuk', nama: 'Pujuk MP gabungan yang goyah', huraian: 'RM 12,000 · +4 hingga +9 undi', myr: 12000, ip: 0 },
    janji: { id: 'janji', nama: 'Janji jawatan / portfolio', huraian: '-60 IP · +8 undi · risiko rombakan +10', myr: 0, ip: 60 },
    rayu:  { id: 'rayu',  nama: 'Rayuan kepada Presiden parti & rakan gabungan', huraian: '+3 hingga +8 undi mengikut hubungan gabungan', myr: 0, ip: 0 },
    tunggu: { id: 'tunggu', nama: 'Tunggu (tiada tindakan hari ini)', huraian: 'Hari berlalu', myr: 0, ip: 0 },
    bubar: { id: 'bubar', nama: 'Nasihatkan pembubaran Parlimen', huraian: 'Elak undian: Pilihan Raya Mengejut', myr: 0, ip: 0 }
  };

  /* ---------- Data: Soal Jawab Lisan ---------- */
  var SOALAN = [
    { id: 'q_kewangan', kategori: 'ekonomi', isu: 'kos sara hidup', soal: 'Yang Berhormat Menteri, mengapa harga barang terus naik sedangkan kerajaan berjanji mengawalnya? Adakah kementerian hilang kawalan?' },
    { id: 'q_pelaburan', kategori: 'ekonomi', isu: 'pelaburan asing', soal: 'Pelaburan asing dikatakan jatuh tahun ini. Apakah bukti dasar kementerian berjaya menarik pelabur?' },
    { id: 'q_pendidikan', kategori: 'pendidikan', isu: 'pendidikan luar bandar', soal: 'Mengapa peruntukan pendidikan luar bandar dipotong sedangkan prestasi sekolah di sana merosot? Adakah kementerian mengutamakan projek bandar?' },
    { id: 'q_belia', kategori: 'pendidikan', isu: 'pengangguran belia', soal: 'Ramai graduan masih menganggur. Apakah rancangan konkrit kementerian dan bila ia akan berhasil?' },
    { id: 'q_kesihatan', kategori: 'kesihatan', isu: 'waktu menunggu hospital', soal: 'Pesakit menunggu berjam-jam di hospital kerajaan. Adakah Menteri bersedia mengaku sistem gagal?' },
    { id: 'q_kebajikan', kategori: 'kesihatan', isu: 'bantuan kebajikan lewat', soal: 'Warga emas mengadu bantuan bulanan lewat berminggu-minggu. Siapa yang patut bertanggungjawab?' },
    { id: 'q_alam', kategori: 'alam', isu: 'pencemaran sungai', soal: 'Pencemaran sungai semakin teruk. Mengapa penguatkuasaan lemah terhadap kilang yang mencemar?' },
    { id: 'q_infra', kategori: 'infra', isu: 'projek tertangguh', soal: 'Beberapa projek jalan dan pengangkutan awam tertangguh bertahun-tahun. Apa alasan dan bila siap?' },
    { id: 'q_integriti', kategori: 'integriti', isu: 'integriti dan salah laku', soal: 'Terdapat dakwaan salah laku dalam agensi di bawah kementerian Yang Berhormat. Adakah Menteri akan meminta siasatan bebas?' },
    { id: 'q_projek', kategori: null, isu: 'pemberian projek', soal: 'Adakah benar projek diberi kepada syarikat berkaitan pemimpin kerajaan tanpa tender terbuka?' },
    { id: 'q_belanjawan', kategori: null, isu: 'perbelanjaan kementerian', soal: 'Mengapa perbelanjaan kementerian melebihi bajet sebanyak sepuluh peratus tahun lalu?' },
    { id: 'q_peruntukan', kategori: null, isu: 'peruntukan kawasan pembangkang', soal: 'Mengapa kawasan pembangkang menerima peruntukan jauh lebih sedikit daripada kawasan kerajaan?' },
    { id: 'q_kepimpinan', kategori: null, isu: 'kestabilan kerajaan', soal: 'Gabungan kerajaan dilihat retak. Adakah Menteri yakin kerajaan masih mempunyai majoriti?' },
    { id: 'q_rakyat', kategori: null, isu: 'bebanan rakyat', soal: 'Rakyat tertekan dengan kos hidup, sedangkan menteri menikmati elaun lumayan. Bagaimana Menteri mewajarkannya?' }
  ];
  var JAWAPAN = {
    diplomatik: { nama: 'Diplomatik', ikon: '🕊️', teks: 'Akui kebimbangan mengenai {isu} dan umum kajian semula.', kesan: { stress: 3, ip: 10, rating: 4 } },
    defensif:   { nama: 'Defensif',   ikon: '🛡️', teks: 'Pertahankan keputusan dengan angka dan rekod kementerian.', rawak: { p: 0.5, jaya: { stress: 6, rating: 2 }, gagal: { stress: 6, rating: -8 } } },
    agresif:    { nama: 'Agresif',    ikon: '🔥', teks: 'Serang balik rekod pembangkang semasa memerintah.', kesan: { stress: 9, ip: 30, rep: -3, kestabilan: -3 } }
  };
  var YB = ['YB Pembangkang (PN)', 'YB Pembangkang (PH)', 'YB Pembangkang (PN)', 'YB Pembangkang (PH)'];

  /* ---------- Keadaan ---------- */
  function dasar() { return { undi: null, tp: null, soalan: null, laras: 0, sesi: 0, bajetTahun: 0, tpTerakhir: -999, sejarah: [] }; }
  function getDewan(p) {
    var b = dasar(), d = p && p.dewan && typeof p.dewan === 'object' ? p.dewan : {};
    for (var f in b) { if (d[f] === undefined) { d[f] = b[f]; } }
    return d;
  }
  function simpan(d, kesan, opts) {
    opts = opts || {};
    var patch = { dewan: d };
    if (opts.patch) { for (var f in opts.patch) { patch[f] = opts.patch[f]; } }
    return S().applyEffects(kesan || {}, { kiraTindakan: false, patch: patch, log: opts.log });
  }
  function idx(p) { return (parseInt(p.tahun, 10) || 0) * 12 + (parseInt(p.bulan, 10) || 1); }
  function sejarahTambah(d, rekod) { d.sejarah = (d.sejarah || []).concat([rekod]).slice(-12); }

  /* ---------- Status pemain ---------- */
  var TAHAP_PARLIMEN = ['TIMBALAN_MENTERI', 'MENTERI_PENUH', 'TIMBALAN_PM', 'PERDANA_MENTERI'];
  var TAHAP_BENTANG = ['MENTERI_PENUH', 'TIMBALAN_PM', 'PERDANA_MENTERI'];
  function statusMP(p) { var P = PRU(), st = P && p ? P.getPRU(p).status : null; return !!(st && st.jenis === 'MP'); }
  function peranKabinet(p) { var K = KB(); return K ? K.getKabinet(p) : { hasGovernmentRole: false, roleLevel: 'NONE' }; }
  function menteriParlimen(p) { var k = peranKabinet(p); return !!(k.hasGovernmentRole && TAHAP_PARLIMEN.indexOf(k.roleLevel) >= 0); }
  /** Tab Dewan Rakyat dibuka untuk Ahli Parlimen atau Menteri/Timbalan Menteri persekutuan. */
  function aktif(p) { return !!p && !p.tamat && (statusMP(p) || menteriParlimen(p)); }
  function bolehBentang(p) { var k = peranKabinet(p); return !!(k.hasGovernmentRole && TAHAP_BENTANG.indexOf(k.roleLevel) >= 0); }

  /** Kerusi mengikut gabungan; null jika belum ada keputusan PRU. */
  function kerusi(p) {
    var A = PAP(); if (!A || !A.kerusiGabungan) { return fallbackKerusi(p); }
    var k = A.kerusiGabungan(p);
    if (!k && A.kemaskiniKerusi) { try { A.kemaskiniKerusi(p); p = S().loadPlayer(); k = A.kerusiGabungan(p); } catch (e) { /* abaikan */ } }
    return k || fallbackKerusi(p);
  }
  function fallbackKerusi(p) {
    var k = p && p.kerusiNasional; if (!k || typeof k.parti !== 'number') { return null; }
    var ph = Math.round(k.pembangkang * 0.6);
    return { jumlah: CONFIG.JUMLAH, ambang: CONFIG.AMBANG, BN: k.parti + k.rakan, rakan: k.rakan, PH: ph, PN: k.pembangkang - ph, LAIN: k.bebas, kerajaanBN: (k.parti + k.rakan) >= CONFIG.AMBANG, tahun: k.tahun, bulan: k.bulan };
  }
  function adaKerajaan(p) { var k = kerusi(p); return !!(k && k.kerajaanBN && (statusMP(p) || menteriParlimen(p))); }

  /** Kestabilan gabungan kerajaan (0-100): jurang majoriti, hubungan rakan gabungan, populariti, ditambah laras acara. */
  function kestabilan(p) {
    var k = kerusi(p), d = getDewan(p), P = PRU(), hub = 50, pop = 50, K = KB();
    if (P) { var pr = P.getPRU(p); hub = Number(pr.hubunganGabungan) || 50; }
    if (K) { var kb = K.getKabinet(p); if (kb.hasGovernmentRole) { pop = Number(kb.popularitiNasional) || 50; } }
    var margin = k ? (k.BN - CONFIG.AMBANG) : 0;
    return Math.round(clamp(50 + margin * 0.30 + (hub - 50) * 0.30 + (pop - 50) * 0.20 + (Number(d.laras) || 0), 0, 100));
  }
  function rating(p) { var k = peranKabinet(p); return k.hasGovernmentRole ? Number(k.governanceRating) : null; }

  /* ---------- Kategori & RUU boleh dibentang ---------- */
  function kategoriPemain(p) {
    var k = peranKabinet(p);
    if (k.roleLevel === 'PERDANA_MENTERI' || k.roleLevel === 'TIMBALAN_PM') { return ORDER_KATEGORI.slice(); }
    var nama = String(k.portfolioName || '');
    for (var i = 0; i < ORDER_KATEGORI.length; i++) { if (KATEGORI[ORDER_KATEGORI[i]].kata.test(nama)) { return [ORDER_KATEGORI[i]]; } }
    return ORDER_KATEGORI.slice();                                // portfolio tidak dikenali: semua kategori
  }
  function sesiKunci(p) { return CONFIG.SESI.indexOf(parseInt(p.bulan, 10)) >= 0 ? (parseInt(p.tahun, 10) || 0) * 100 + parseInt(p.bulan, 10) : 0; }
  /** Senarai yang boleh dibentang sekarang + sebab jika tidak boleh. */
  function senaraiBentang(p) {
    var d = getDewan(p), sebab = '', k = kerusi(p);
    if (!aktif(p)) { sebab = 'Anda bukan Ahli Parlimen atau Menteri.'; }
    else if (!k) { sebab = 'Belum ada keputusan PRU.'; }
    else if (!bolehBentang(p)) { sebab = 'Hanya Menteri Penuh, Timbalan Perdana Menteri atau Perdana Menteri boleh membentang RUU.'; }
    else if (!k.kerajaanBN) { sebab = 'Parti anda bukan kerajaan.'; }
    else if (d.undi) { sebab = 'Satu undian sedang berjalan.'; }
    else if (d.tp) { sebab = 'Usul Undi Tidak Percaya sedang berlangsung.'; }
    var kunci = sesiKunci(p), adaSesi = !!kunci, sudah = adaSesi && d.sesi === kunci;
    var kat = kategoriPemain(p), senarai = RUU.filter(function (r) { return kat.indexOf(r.kategori) >= 0; }).map(function (r) { return { id: r.id, tajuk: r.tajuk, kategori: r.kategori, kategoriNama: KATEGORI[r.kategori].nama, huraian: r.huraian, asas: r.asas }; });
    var bajetBoleh = parseInt(p.bulan, 10) === CONFIG.BULAN_BAJET && d.bajetTahun !== p.tahun;
    return { sebab: sebab, ruu: sebab ? [] : (adaSesi && !sudah ? senarai : []), bajet: !sebab && bajetBoleh ? bajet(p.tahun) : null,
      sesiSekarang: adaSesi, sesiSudah: sudah, sebabRUU: sebab || (!adaSesi ? 'RUU dibentang semasa sidang Dewan (bulan ' + CONFIG.SESI.join(', ') + ').' : (sudah ? 'RUU sesi ini sudah dibentang.' : '')) };
  }

  /* ---------- Undian RUU / Bajet ---------- */
  function bahagiUndi(k, asas, silang) {
    var G = k.BN, opp = k.PH + k.PN, sokong = Math.round(G * asas), atas = Math.round((G - sokong) * 0.6) + Math.round(k.LAIN * 0.7) + Math.round(opp * silang);
    atas = Math.min(atas, k.jumlah - sokong);
    return { sokong: sokong, atas: atas, bantah: k.jumlah - sokong - atas };
  }
  function anggaranKebarangkalian(u) {
    var jangka = u.sokong + u.atas * CONFIG.ATAS_SOKONG;
    return jangka >= CONFIG.AMBANG + 10 ? 'tinggi' : jangka >= CONFIG.AMBANG ? 'sederhana' : jangka >= CONFIG.AMBANG - 8 ? 'tipis' : 'rendah';
  }
  function mulaBentang(id, o) {
    var p = S().loadPlayer(), sb = senaraiBentang(p), r = null;
    if (sb.sebab) { return { ok: false, ralat: sb.sebab }; }
    if (id === 'bajet') { if (!sb.bajet) { return { ok: false, ralat: 'Bajet hanya dibentang bulan ' + CONFIG.BULAN_BAJET + ', sekali setahun.' }; } r = sb.bajet; }
    else { if (!sb.ruu.length) { return { ok: false, ralat: sb.sebabRUU || 'Tiada RUU boleh dibentang.' }; } r = cariRUU(id, p.tahun); if (!r || !sb.ruu.some(function (x) { return x.id === id; })) { return { ok: false, ralat: 'RUU tidak sah untuk portfolio anda.' }; } }
    var k = kerusi(p), b = bahagiUndi(k, r.asas, r.silang), d = getDewan(p);
    d.undi = { id: r.id, jenis: r.jenis === 'bajet' ? 'bajet' : 'ruu', tajuk: r.tajuk, kategori: r.kategori, sokong: b.sokong, atas: b.atas, bantah: b.bantah, lobi: 0, tahun: p.tahun, bulan: p.bulan };
    if (d.undi.jenis === 'bajet') { d.bajetTahun = p.tahun; } else { d.sesi = sesiKunci(p); }
    var res = simpan(d, {}, { log: { tindakan: 'dewan_bentang', nama: 'Membentang ' + r.tajuk, peringkat: 'ahli' } });
    return res.ok ? { ok: true, undi: d.undi, mesej: r.tajuk + ' dibentang di Dewan Rakyat.' } : { ok: false, ralat: res.ralat };
  }
  function undiSemasa(p) {
    var d = getDewan(p), u = d.undi; if (!u) { return null; }
    var cat = LOBI;
    return { undi: u, ambang: CONFIG.AMBANG, kebarangkalian: anggaranKebarangkalian(u), baki: Math.max(0, CONFIG.LOBI_MAKS - u.lobi), tindakan: Object.keys(cat).map(function (k) {
      var t = cat[k], sebab = '';
      if (u.lobi >= CONFIG.LOBI_MAKS) { sebab = 'Had lobi dicapai.'; }
      else if ((Number(p.ap) || 0) < CONFIG.AP_LOBI) { sebab = 'AP tidak mencukupi.'; }
      else if (t.myr && (Number(p.myr) || 0) < t.myr) { sebab = 'Dana tidak mencukupi.'; }
      else if (t.ip && (Number(p.ip) || 0) < t.ip) { sebab = 'IP tidak mencukupi.'; }
      return { id: t.id, nama: t.nama, huraian: t.huraian, boleh: !sebab, sebab: sebab };
    }) };
  }
  function pindah(u, dari, ke, n) { n = Math.max(0, Math.min(n, u[dari])); u[dari] -= n; u[ke] += n; return n; }
  function lobi(tindakId, o) {
    var p = S().loadPlayer(), d = getDewan(p), u = d.undi, t = LOBI[tindakId], r = rng(o);
    if (!u) { return { ok: false, ralat: 'Tiada undian sedang berjalan.' }; }
    if (!t) { return { ok: false, ralat: 'Tindakan lobi tidak sah.' }; }
    var sem = undiSemasa(p).tindakan.filter(function (x) { return x.id === tindakId; })[0];
    if (!sem.boleh) { return { ok: false, ralat: sem.sebab }; }
    var n = 0, mesej = '', kesan = { ap: -CONFIG.AP_LOBI }, rep = 0;
    if (t.myr) { kesan.myr = -t.myr; }
    if (t.ip) { kesan.ip = -t.ip; }
    if (tindakId === 'atas_pagar') { n = pindah(u, 'atas', 'sokong', antara(r, 6, 10)); mesej = 'Lobi MP atas pagar: +' + n + ' undi sokong.'; }
    else if (tindakId === 'cdf') {
      n = pindah(u, 'atas', 'sokong', 5); if (n < 5) { n += pindah(u, 'bantah', 'sokong', 5 - n); }
      mesej = 'Projek CDF ditawarkan: +' + n + ' undi sokong.';
      if (r() < 0.2) { kesan.reputasi = -2; mesej += ' Anda dilihat berpolitik (Reputasi -2).'; }
    } else {
      if (r() < 0.35) { n = pindah(u, 'bantah', 'sokong', antara(r, 3, 6)); mesej = 'Pembangkang bersetuju memberi sokongan: +' + n + ' undi.'; }
      else { mesej = 'Rundingan dengan pembangkang tidak membuahkan hasil.'; }
    }
    u.lobi += 1; rep = kesan.reputasi || 0;
    var res = simpan(d, kesan, { log: { tindakan: 'dewan_lobi', nama: t.nama + ' (' + u.tajuk + ')', peringkat: 'ahli' } });
    return res.ok ? { ok: true, mesej: mesej, undi: u, tambah: n, reputasi: rep } : { ok: false, ralat: res.ralat };
  }
  function terapRating(d, kes, p) {
    var K = KB(); if (K && K.laras && (kes.rating || kes.tekanan || kes.pop || kes.rombak)) { K.laras({ rating: kes.rating || 0, tekanan: kes.tekanan || 0, pop: kes.pop || 0, rombak: kes.rombak || 0 }); }
  }
  function undi(o) {
    var p = S().loadPlayer(), d = getDewan(p), u = d.undi, r = rng(o);
    if (!u) { return { ok: false, ralat: 'Tiada undian sedang berjalan.' }; }
    var q = clamp(CONFIG.ATAS_SOKONG + (r() - 0.5) * 0.2, 0.2, 0.4), sokong = u.sokong + Math.round(u.atas * q), bantah = CONFIG.JUMLAH - sokong, lulus = sokong >= CONFIG.AMBANG;
    var bajetJenis = u.jenis === 'bajet', kes = {}, kesanP = {}, mesej;
    if (lulus) {
      var e = (cariRUU(u.id, u.tahun) || {}).ekstra || {};
      kesanP = { ip: CONFIG.LULUS.ip }; if (e.reputasi) { kesanP.reputasi = e.reputasi; } if (e.akarUmbi) { kesanP.kesetiaan = { akarUmbi: e.akarUmbi }; }
      d.laras = clamp((Number(d.laras) || 0) + CONFIG.LULUS.kestabilan, -60, 60);
      mesej = u.tajuk + ' LULUS (' + sokong + ' sokong, ' + bantah + ' bantah). IP +' + CONFIG.LULUS.ip + ', Tadbir Urus +' + CONFIG.LULUS.rating + '%.';
      kes = { rating: CONFIG.LULUS.rating };
    } else {
      var g = bajetJenis ? CONFIG.GAGAL_BAJET : CONFIG.GAGAL;
      d.laras = clamp((Number(d.laras) || 0) + g.kestabilan, -60, 60);
      mesej = u.tajuk + ' GAGAL (' + sokong + ' sokong, perlu ' + CONFIG.AMBANG + '). Tadbir Urus ' + g.rating + '%, kestabilan gabungan ' + g.kestabilan + '%.';
      kes = { rating: g.rating, tekanan: g.tekanan };
    }
    sejarahTambah(d, { jenis: bajetJenis ? 'bajet' : 'ruu', tajuk: u.tajuk, lulus: lulus, sokong: sokong, tahun: p.tahun, bulan: p.bulan });
    d.undi = null;
    var res = simpan(d, kesanP, { log: { tindakan: 'dewan_undi', nama: (lulus ? 'Lulus: ' : 'Gagal: ') + u.tajuk, peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    terapRating(d, kes, p);
    return { ok: true, lulus: lulus, sokong: sokong, bantah: bantah, mesej: mesej, kestabilan: kestabilan(S().loadPlayer()) };
  }
  function tarikBalik() {
    var p = S().loadPlayer(), d = getDewan(p);
    if (!d.undi) { return { ok: false, ralat: 'Tiada undian sedang berjalan.' }; }
    var t = d.undi.tajuk; d.undi = null;
    var res = simpan(d, {}, { log: { tindakan: 'dewan_tarik', nama: 'Menarik balik ' + t, peringkat: 'ahli' } });
    return res.ok ? { ok: true, mesej: t + ' ditarik balik.' } : { ok: false, ralat: res.ralat };
  }

  /* ---------- Usul Undi Tidak Percaya ---------- */
  function bolehPicuTP(p) {
    var d = getDewan(p), P = PRU(), pr = P ? P.getPRU(p) : null;
    if (!aktif(p) || !adaKerajaan(p) || d.tp) { return false; }
    if ((pr && pr.aktif) || (p.prk && p.prk.aktif)) { return false; }
    if (idx(p) - d.tpTerakhir < CONFIG.TP.JEDA_BULAN) { return false; }
    var rt = rating(p);
    return kestabilan(p) < CONFIG.TP.AMBANG || (rt !== null && rt < CONFIG.TP.AMBANG);
  }
  function mulaTP(p) {
    var d = getDewan(p), k = kerusi(p), s = Math.min(kestabilan(p), (rating(p) !== null ? rating(p) : 100), 100);
    var frac = clamp(CONFIG.TP.GOYAH_ASAS + (CONFIG.TP.AMBANG - s) / 100, 0.35, 0.65), goyah = Math.round(k.BN * frac);
    d.tp = { hari: 1, setia: k.BN - goyah, goyah: goyah, tentang: k.jumlah - k.BN, mulaTahun: p.tahun, mulaBulan: p.bulan, log: [] };
    d.undi = null;                                                     // undian RUU dibatalkan
    return d;
  }
  function tpSemasa(p) {
    var d = getDewan(p), t = d.tp; if (!t) { return null; }
    var hub = Number((PRU() ? PRU().getPRU(p).hubunganGabungan : 50)) || 50;
    return { tp: t, ambang: CONFIG.AMBANG, hariMaks: CONFIG.TP.HARI, kestabilan: kestabilan(p), rating: rating(p), hubungan: hub, tindakan: ['pujuk', 'janji', 'rayu', 'tunggu', 'bubar'].map(function (id) {
      var a = TP_TINDAK[id], sebab = '';
      if (id !== 'tunggu' && id !== 'bubar' && (Number(p.ap) || 0) < CONFIG.AP_LOBI) { sebab = 'AP tidak mencukupi.'; }
      else if (a.myr && (Number(p.myr) || 0) < a.myr) { sebab = 'Dana tidak mencukupi.'; }
      else if (a.ip && (Number(p.ip) || 0) < a.ip) { sebab = 'IP tidak mencukupi.'; }
      return { id: id, nama: a.nama, huraian: a.huraian, boleh: !sebab, sebab: sebab };
    }) };
  }
  function selesaikanTP(o, auto) {
    var p = S().loadPlayer(), d = getDewan(p), t = d.tp, r = rng(o);
    if (!t) { return { ok: false, ralat: 'Tiada usul undi tidak percaya.' }; }
    var sokong = t.setia + Math.round(t.goyah * CONFIG.TP.BAHAGIAN_GOYAH), selamat = sokong >= CONFIG.AMBANG, kkesan = {}, ev = [], mesej, snap = null;
    sejarahTambah(d, { jenis: 'tp', lulus: selamat, sokong: sokong, tahun: p.tahun, bulan: p.bulan });
    d.tp = null; d.tpTerakhir = idx(p);
    if (selamat) {
      d.laras = clamp((Number(d.laras) || 0) + CONFIG.TP.SELAMAT.kestabilan, -60, 60);
      mesej = 'Kerajaan SELAMAT daripada Usul Undi Tidak Percaya dengan ' + sokong + ' undi (perlu ' + CONFIG.AMBANG + '). Tadbir Urus +' + CONFIG.TP.SELAMAT.rating + '%.';
      kkesan = { rating: CONFIG.TP.SELAMAT.rating, tekanan: CONFIG.TP.SELAMAT.tekanan };
      simpan(d, {}, { log: { tindakan: 'dewan_tp', nama: 'Selamat daripada undi tidak percaya (' + sokong + ')', peringkat: 'ahli' } });
      terapRating(d, kkesan, p);
      ev.push({ jenis: 'dewan', mesej: mesej });
      return { ok: true, selamat: true, sokong: sokong, mesej: mesej, peristiwa: ev };
    }
    d.laras = 0;
    simpan(d, { reputasi: -3 }, { log: { tindakan: 'dewan_tp', nama: 'Kerajaan tumbang: undi tidak percaya (' + sokong + ')', peringkat: 'ahli' } });
    var P = PRU(); snap = P && P.isytihar ? P.isytihar('krisis', o) : null;
    mesej = 'Kerajaan TUMBANG: hanya ' + sokong + ' undi sokong (perlu ' + CONFIG.AMBANG + '). Parlimen dibubarkan; Pilihan Raya Mengejut diisytiharkan.';
    ev.push({ jenis: 'dewan', mesej: mesej });
    if (snap && snap.peristiwa) { ev = ev.concat(snap.peristiwa); }
    return { ok: true, selamat: false, sokong: sokong, mesej: mesej, peristiwa: ev, snap: !!snap };
  }
  function tindakTP(id, o) {
    var p = S().loadPlayer(), d = getDewan(p), t = d.tp, r = rng(o), a = TP_TINDAK[id];
    if (!t) { return { ok: false, ralat: 'Tiada usul undi tidak percaya.' }; }
    if (!a) { return { ok: false, ralat: 'Tindakan tidak sah.' }; }
    var sem = tpSemasa(p).tindakan.filter(function (x) { return x.id === id; })[0];
    if (!sem.boleh) { return { ok: false, ralat: sem.sebab }; }
    if (id === 'bubar') {
      d.tp = null; d.tpTerakhir = idx(p); d.laras = 0; simpan(d, {}, { log: { tindakan: 'dewan_bubar', nama: 'Menasihatkan pembubaran Parlimen', peringkat: 'ahli' } });
      var P = PRU(), snap = P && P.isytihar ? P.isytihar('krisis', o) : null;
      return { ok: true, tamat: true, snap: true, mesej: 'Parlimen dibubarkan atas nasihat anda. Pilihan Raya Mengejut diisytiharkan.', peristiwa: snap && snap.peristiwa ? snap.peristiwa : [] };
    }
    var kesan = {}, n = 0, mesej = '', kk = null;
    if (id !== 'tunggu') { kesan.ap = -CONFIG.AP_LOBI; }
    if (a.myr) { kesan.myr = -a.myr; }
    if (a.ip) { kesan.ip = -a.ip; }
    if (id === 'pujuk') { n = pindah(t, 'goyah', 'setia', antara(r, 4, 9)); mesej = 'MP gabungan dipujuk: +' + n + ' undi setia.'; }
    else if (id === 'janji') { n = pindah(t, 'goyah', 'setia', 8); mesej = 'Jawatan dijanjikan: +' + n + ' undi setia. Risiko rombakan meningkat.'; kk = { rombak: 10, tekanan: 4 }; }
    else if (id === 'rayu') { var hub = Number(PRU() ? PRU().getPRU(p).hubunganGabungan : 50) || 50; n = pindah(t, 'goyah', 'setia', clamp(Math.round(3 + hub / 20), 3, 8)); mesej = 'Rayuan kepada rakan gabungan: +' + n + ' undi setia.'; }
    else { mesej = 'Hari ' + t.hari + ' berlalu tanpa tindakan.'; }
    t.log.push('Hari ' + t.hari + ': ' + mesej); t.hari += 1;
    var tamat = t.hari > CONFIG.TP.HARI;
    var res = simpan(d, kesan, { log: { tindakan: 'dewan_tp_tindak', nama: a.nama, peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    if (kk) { terapRating(d, kk, p); }
    if (tamat) { var z = selesaikanTP(o); z.tamat = true; z.mesejHari = mesej; return z; }
    return { ok: true, mesej: mesej, tp: t, tamat: false };
  }

  /* ---------- Soal Jawab Lisan ---------- */
  function janaSoalan(p, o) {
    var r = rng(o), kat = kategoriPemain(p), pool = SOALAN.filter(function (q) { return q.kategori === null || kat.indexOf(q.kategori) >= 0; });
    var q = pool[Math.floor(r() * pool.length)], yb = YB[Math.floor(r() * YB.length)];
    return { id: q.id, soal: q.soal, isu: q.isu, yb: yb, bulan: p.bulan, tahun: p.tahun };
  }
  function soalanSemasa(p) {
    var d = getDewan(p), q = d.soalan; if (!q) { return null; }
    return { id: q.id, soal: q.soal, isu: q.isu, yb: q.yb, jawapan: Object.keys(JAWAPAN).map(function (k) {
      var j = JAWAPAN[k];
      return { id: k, nama: j.nama, ikon: j.ikon, teks: j.teks.replace('{isu}', q.isu), kesan: j.kesan || null, rawak: j.rawak || null };
    }) };
  }
  function jawabSoalan(jawapanId, o) {
    var p = S().loadPlayer(), d = getDewan(p), q = d.soalan, r = rng(o), j = JAWAPAN[jawapanId];
    if (!q) { return { ok: false, ralat: 'Tiada soalan menunggu.' }; }
    if (!j) { return { ok: false, ralat: 'Jawapan tidak sah.' }; }
    var x, jaya = null, mesej = j.nama + '.';
    if (j.rawak) { jaya = r() < j.rawak.p; x = jaya ? j.rawak.jaya : j.rawak.gagal; mesej += jaya ? ' Jawapan meyakinkan.' : ' Dibidas balas oleh pembangkang.'; } else { x = j.kesan; }
    var kesan = {}; if (x.ip) { kesan.ip = x.ip; } if (x.rep) { kesan.reputasi = x.rep; }
    if (x.kestabilan) { d.laras = clamp((Number(d.laras) || 0) + x.kestabilan, -60, 60); }
    d.soalan = null;
    var res = simpan(d, kesan, { log: { tindakan: 'dewan_soalan', nama: 'Soal jawab lisan: ' + q.isu + ' (' + j.nama + ')', peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    terapRating(d, { rating: x.rating || 0, tekanan: x.tekanan || 0 }, p);
    if (x.stress) { var st = ST(); if (st && st.laras) { st.laras({ stress: x.stress }); } }
    return { ok: true, mesej: mesej, stress: x.stress || 0, ip: x.ip || 0, rating: x.rating || 0, reputasi: x.rep || 0, jaya: jaya };
  }

  /* ---------- Denyut bulanan (Calendar.majuBulan) ---------- */
  function prosesBulan(o) {
    var ev = [], p = S() && S().loadPlayer();
    if (!p || p.tamat || !aktif(p)) { return { peristiwa: ev }; }
    var d = getDewan(p), r = rng(o), ubah = false;
    if (d.laras) { d.laras = d.laras > 0 ? Math.max(0, d.laras - CONFIG.KESTABILAN_SUSUT) : Math.min(0, d.laras + CONFIG.KESTABILAN_SUSUT); ubah = true; }
    if (d.undi && !bolehBentang(p)) { d.undi = null; ubah = true; }
    if (ubah) { simpan(d, {}); p = S().loadPlayer(); d = getDewan(p); }
    if (d.tp) {                                                          // usul belum selesai ketika bulan berganti: dikira tanpa tindakan lanjut
      var z = selesaikanTP(o, true); ev = ev.concat(z.peristiwa || []); p = S().loadPlayer(); d = getDewan(p);
      if (!z.selamat) { return { peristiwa: ev }; }
    }
    if (CONFIG.SESI.indexOf(parseInt(p.bulan, 10)) >= 0) { ev.push({ jenis: 'dewan_sesi', mesej: 'Sidang Dewan Rakyat dibuka' + (parseInt(p.bulan, 10) === CONFIG.BULAN_BAJET ? ' (Bajet Negara dibentangkan bulan ini).' : '.') }); }
    if (bolehPicuTP(p)) {
      d = mulaTP(p); simpan(d, {}, { log: { tindakan: 'dewan_tp_mula', nama: 'Usul Undi Tidak Percaya dikemukakan', peringkat: 'ahli' } });
      ev.push({ jenis: 'dewan_tp', mesej: 'Pembangkang mengemukakan Usul Undi Tidak Percaya! Anda ada ' + CONFIG.TP.HARI + ' hari untuk mengumpul ' + CONFIG.AMBANG + ' kerusi.' });
      return { peristiwa: ev };
    }
    if (menteriParlimen(p) && adaKerajaan(p)) {
      if (d.soalan) {                                                    // soalan bulan lepas tidak dijawab
        simpan(d, {}, {}); terapRating(d, { rating: CONFIG.SOALAN_DIAM.rating, tekanan: CONFIG.SOALAN_DIAM.tekanan }, p);
        ev.push({ jenis: 'dewan', mesej: 'Soalan lisan pembangkang tidak dijawab: dianggap mengelak (Tadbir Urus ' + CONFIG.SOALAN_DIAM.rating + '%).' });
        d.soalan = null;
      }
      if (r() < CONFIG.SOALAN_PELUANG) {
        d.soalan = janaSoalan(p, o); simpan(d, {});
        ev.push({ jenis: 'dewan_soalan', mesej: 'Waktu Pertanyaan Menteri: ' + d.soalan.yb + ' mengemukakan soalan kepada anda.' });
      } else { simpan(d, {}); }
    }
    return { peristiwa: ev };
  }

  /* ---------- Ringkasan untuk UI ---------- */
  function ringkasan(p) {
    var d = getDewan(p), k = kerusi(p), sb = senaraiBentang(p);
    return { aktif: aktif(p), kerusi: k, ambang: CONFIG.AMBANG, kerajaan: adaKerajaan(p), kestabilan: aktif(p) ? kestabilan(p) : null, rating: rating(p),
      menteri: menteriParlimen(p), bolehBentang: bolehBentang(p), bentang: sb, undi: undiSemasa(p), tp: tpSemasa(p), soalan: soalanSemasa(p), sejarah: d.sejarah || [],
      peranan: statusMP(p) ? 'MP' : 'MENTERI', portfolio: peranKabinet(p).portfolioName || '' };
  }

  return {
    CONFIG: CONFIG, KATEGORI: KATEGORI, RUU: RUU, LOBI: LOBI, TP_TINDAK: TP_TINDAK, SOALAN: SOALAN, JAWAPAN: JAWAPAN,
    setRng: function (f) { rngLalai = f || Math.random; },
    getDewan: getDewan, aktif: aktif, kerusi: kerusi, kestabilan: kestabilan, kategoriPemain: kategoriPemain, senaraiBentang: senaraiBentang,
    mulaBentang: mulaBentang, undiSemasa: undiSemasa, lobi: lobi, undi: undi, tarikBalik: tarikBalik,
    tpSemasa: tpSemasa, tindakTP: tindakTP, selesaikanTP: selesaikanTP, bolehPicuTP: bolehPicuTP,
    soalanSemasa: soalanSemasa, jawabSoalan: jawabSoalan, prosesBulan: prosesBulan, ringkasan: ringkasan
  };
});
