/* ==========================================================================
   Nusa Politik — js/pru.js   (v7.3)
   Sistem Pilihan Raya Umum & Negeri (PRU / PRN) - logik dan data.
     1. Data & state pilihan raya (p.pru) dan profil kawasan (RURAL / URBAN / MIXED).
     2. Pengisytiharan (setiap 60 bulan atau Krisis Pembubaran Dewan), pencalonan DUN / Parlimen.
     3. Rundingan kerusi dengan rakan gabungan; gagal = pertandingan 3-penjuru.
     4. Manifesto (pemain pilih 3 janji sekali gus), dinilai semula 12 bulan selepas menang.
     5. Kempen 14 hari: tindakan (Ceramah / Ziarah / Digital / Rehat / Derma), had Dana & Tenaga Jentera,
        kejutan rawak, War Room hari 13-14 (Final Push, boleh dua kali = double jeopardy).
     6. Enjin keputusan FPTP, ganjaran dan kesan.

   Struktur data (disimpan dalam p.pru):
     { tahunPRU, bulanPRU, mulaIdx, krisisSudah, hubunganGabungan, sejarah:[], status, manifesto, siasatan, aktif }
     aktif (ada semasa musim pilihan raya) = {
       isElectionSeason, fasa('isytihar'|'calon'|'runding'|'manifesto'|'kempen'|'keputusan'),
       sebab, candidateType('NONE'|'DUN'|'PARLIMEN'), constituencyType('RURAL'|'URBAN'|'MIXED'),
       campaignDaysLeft, voterSupport, campaignFunds, jentera, isThreeCorneredFight,
       manifestoChoice:[id,id,id], ... }

   Andaian (laras dalam CONFIG): semua nombor ialah anggaran permainan. Nama parti lawan ialah label
   simulasi sahaja; tiada peristiwa fiksyen dikaitkan secara khusus dengan mana-mana parti sebenar.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikPRU = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  function modul(nama, fail) {
    if (root[nama]) { return root[nama]; }
    try { if (typeof require === 'function') { return require('./' + fail); } } catch (e) { /* tidak dimuatkan */ }
    return null;
  }
  function S() { return modul('MyPolitikSave', 'save.js'); }
  function ST() { return modul('MyPolitikStres', 'stress.js'); }
  function ET() { return modul('MyPolitikEtika', 'etika.js'); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function salin(o) { return JSON.parse(JSON.stringify(o)); }
  function idx(p) { return (parseInt(p.tahun, 10) || 0) * 12 + (parseInt(p.bulan, 10) || 1); }
  var rngLalai = Math.random;
  function rng(o) { return (o && o.rng) || rngLalai; }
  function antara(r, a, b) { return a + r() * (b - a); }
  function bulat(n) { return Math.round(n); }
  function hash(teks) { var h = 7; teks = String(teks || ''); for (var i = 0; i < teks.length; i++) { h = (h * 31 + teks.charCodeAt(i)) >>> 0; } return h; }

  var CONFIG = {
    TAHUN_MULA: 2031, BULAN_PRU: 3, KITARAN_TAHUN: 5,
    KRISIS: { minBulan: 24, peluang: 0.02 },
    HARI: 14, HARI_FINAL: 2,
    KEJUTAN_BILANGAN: [3, 4],
    DUN:      { ipMin: 300, minPeruntukan: 2000, pengundi: [22000, 34000], bonusIp: 150 },
    PARLIMEN: { ipMin: 600, minPeruntukan: 5000, pengundi: [60000, 95000], bonusIp: 220 },
    GABUNGAN: { awal: 50, peluangRunding: 0.5 },
    NASIONAL: { JUMLAH: 222, MAJORITI: 112, GAGAL_PM_HUBUNGAN: -10 },    // v7.22: keputusan nasional (anggaran permainan) untuk Presiden parti
    PECAH_3: 0.8,                       // bahagian undi 1-lawan-1 yang kekal pada anda dalam 3-penjuru (selebihnya ke rakan gabungan)
    SKALA_GAIN: 0.6,                    // penyesuaian keseimbangan kesan tindakan kempen
    TEKANAN_LAWAN_HARIAN: 1.0,          // voterSupport susut sedikit setiap hari (lawan juga berkempen)
    JENTERA_MIN: 40,
    DERMA_MAKS: 3,
    KALAH: { ip: -100, reputasi: -2, stress: 6 },
    MENANG: { reputasi: 3 },
    BULAN_NILAI_JANJI: 12,
    TERIMA_MIN: 0.2, TERIMA_MAKS: 0.95
  };

  /* ------------------------------------------------------------------------
     DATA
     ------------------------------------------------------------------------ */
  var PROFIL = { RURAL: 'Luar Bandar', URBAN: 'Bandar', MIXED: 'Campuran' };
  var IKON_PROFIL = { RURAL: '🌾', URBAN: '🏙️', MIXED: '🏘️' };
  var PENGGANDA = {                      // keberkesanan tindakan mengikut profil kawasan
    RURAL: { ceramah: 1.3, ziarah: 1.5, digital: 0.5 },
    URBAN: { ceramah: 1.0, ziarah: 0.7, digital: 1.5 },
    MIXED: { ceramah: 1.2, ziarah: 1.0, digital: 1.0 }
  };
  var LAWAN = {                          // label simulasi parti lawan (mengikut profil)
    RURAL: ['PAS', 'Bersatu'], URBAN: ['DAP', 'PKR'], MIXED: ['PKR', 'PAS']
  };
  var KOS_RUNDING = { berdepan: { ip: 80, jaya: 0.60 }, ganti: { ip: 40, jaya: 0.75 }, abai: { ip: 0 } };

  var JANJI = [
    { id: 'jalan_air',   ikon: '🛣️', nama: 'Jalan raya & bekalan air', sesuai: { RURAL: 3, MIXED: 1.5, URBAN: 0.5 }, kosBulan: 1500, ingkar: 0.25 },
    { id: 'kerja_belia', ikon: '🎓', nama: 'Biasiswa & peluang kerja belia', sesuai: { URBAN: 3, MIXED: 2, RURAL: 1 }, kosBulan: 2000, ingkar: 0.40 },
    { id: 'klinik_warga', ikon: '🏥', nama: 'Klinik & bantuan warga emas', sesuai: { RURAL: 2, MIXED: 2, URBAN: 2 }, kosBulan: 1000, ingkar: 0.15 },
    { id: 'harga_barang', ikon: '🛒', nama: 'Kawal harga barang & subsidi', sesuai: { MIXED: 3, URBAN: 2, RURAL: 2 }, kosBulan: 2500, ingkar: 0.45 },
    { id: 'perumahan',   ikon: '🏠', nama: 'Rumah mampu milik', sesuai: { URBAN: 3, MIXED: 2, RURAL: 1 }, kosBulan: 3000, ingkar: 0.50 },
    { id: 'pertanian',   ikon: '🌱', nama: 'Pertanian & kebajikan petani', sesuai: { RURAL: 3, MIXED: 1.5, URBAN: 0 }, kosBulan: 1500, ingkar: 0.30 }
  ];
  function janjiId(id) { for (var i = 0; i < JANJI.length; i++) { if (JANJI[i].id === id) { return JANJI[i]; } } return null; }

  /* tindakan kempen. gain = [min,max]; sasaran = pengganda profil */
  var TINDAKAN = {
    ceramah: { id: 'ceramah', ikon: '🎤', nama: 'Ceramah Perdana', dana: 3000, jentera: -20, gain: [5, 12], stress: 5, pengganda: 'ceramah', perluJentera: true },
    ziarah:  { id: 'ziarah',  ikon: '🤝', nama: 'Ziarah Mesra / Kebajikan', dana: 800, jentera: -10, gain: [3, 8], stress: -3, pengganda: 'ziarah', perluJentera: true },
    digital: { id: 'digital', ikon: '📱', nama: 'Kempen Media Digital', dana: 1500, jentera: -8, gain: [4, 10], stress: 0, pengganda: 'digital' },
    rehat:   { id: 'rehat',   ikon: '⛺', nama: 'Rehatkan Jentera', dana: 0, jentera: 25, gain: [0, 0], stress: -2, khas: true },
    derma:   { id: 'derma',   ikon: '💰', nama: 'Kutip Derma Penyokong', dana: 0, jentera: 0, gain: [0, 0], stress: 2, khas: true }
  };
  var FINAL = {
    jelajah: { id: 'jelajah', ikon: '🔥', nama: 'Jelajah Maraton 24 Jam', dana: 2500, jentera: -30, gain: [6, 10], stress: 8, risiko: 0 },
    bantuan: { id: 'bantuan', ikon: '🎁', nama: 'Edaran Bantuan Segera Pengundi', dana: 4000, jentera: -10, gain: [8, 14], stress: 4, risiko: 0.35, jenisRisiko: 'sprm' },
    media:   { id: 'media',   ikon: '📰', nama: 'Serangan Media Terakhir', dana: 2000, jentera: -10, gain: [5, 9], stress: 3, risiko: 0.20, jenisRisiko: 'fitnah' }
  };

  /* kejutan rawak: pilihan = { id, label, kesan:{dana,jentera,vs,stress,rep,ip}, rawak:{p, jaya:{...}, gagal:{...}}, etika } */
  var KEJUTAN = [
    { id: 'video_tular', jenis: 'kontroversi', ikon: '📱', tajuk: 'Video lama tular',
      huraian: 'Klip ucapan lama anda dipotong dan tular di media sosial, dituduh menghina pengundi kawasan.', sensitif: 'URBAN',
      pilihan: [
        { id: 'maaf', label: 'Minta maaf secara terbuka', kesan: { dana: -500, vs: -2, stress: 4 } },
        { id: 'sangkal', label: 'Sangkal & balas dengan fakta', rawak: { p: 0.55, jaya: { vs: 3, stress: 4 }, gagal: { vs: -9, stress: 6 } } },
        { id: 'abai', label: 'Abaikan', kesan: { vs: -6, stress: 2 } }] },
    { id: 'isu_tempatan', jenis: 'kontroversi', ikon: '🗞️', tajuk: 'Isu projek tertangguh',
      huraian: 'Media tempatan membongkar projek di kawasan anda yang tertangguh bertahun-tahun. Penduduk marah.', sensitif: 'RURAL',
      pilihan: [
        { id: 'janji', label: 'Umumkan jadual baharu & tinjau tapak', kesan: { dana: -800, jentera: -5, vs: 1, stress: 3 } },
        { id: 'salah', label: 'Salahkan pentadbiran terdahulu', rawak: { p: 0.5, jaya: { vs: 2, stress: 2 }, gagal: { vs: -7, stress: 4 } } },
        { id: 'diam', label: 'Berdiam diri', kesan: { vs: -5, stress: 1 } }] },
    { id: 'presiden_singgah', jenis: 'lawatan', ikon: '🎖️', tajuk: 'Pemimpin pusat singgah',
      huraian: 'Pemimpin pusat parti menawarkan ceramah bersama di kawasan anda esok.', sensitif: null,
      pilihan: [
        { id: 'besar', label: 'Sambut dengan perhimpunan besar', kesan: { dana: -4000, jentera: -25, vsMin: 8, vsMaks: 12, stress: 3 } },
        { id: 'ringkas', label: 'Sambutan ringkas', kesan: { dana: -1000, vs: 4 } },
        { id: 'tolak', label: 'Tolak sopan (kawasan sensitif)', kesan: { ip: -10, stress: -2 } }] },
    { id: 'menteri_ziarah', jenis: 'lawatan', ikon: '🚐', tajuk: 'Rombongan tokoh parti',
      huraian: 'Sekumpulan tokoh parti ingin menyertai ziarah anda di kampung dan taman perumahan.', sensitif: null,
      pilihan: [
        { id: 'sertai', label: 'Sertakan mereka dalam jelajah', kesan: { dana: -1500, jentera: -10, vsMin: 4, vsMaks: 8, stress: 2 } },
        { id: 'asing', label: 'Beri kawasan berasingan', kesan: { dana: -600, vs: 3, jentera: -5 } },
        { id: 'tolak', label: 'Tolak, fokus jentera sendiri', kesan: { jentera: 5, stress: -1 } }] },
    { id: 'poster_rosak', jenis: 'sabotaj', ikon: '🪧', tajuk: 'Sabotaj jentera',
      huraian: 'Poster dan bendera di beberapa cawangan dirosakkan. Sukarelawan tertekan dan sebahagian mahu berhenti.', sensitif: null,
      pilihan: [
        { id: 'lapor', label: 'Lapor polis & pasang semula', kesan: { dana: -1200, jentera: 5, stress: 3 } },
        { id: 'semangat', label: 'Bangkitkan semangat di media', rawak: { p: 0.6, jaya: { vs: 4, stress: 5 }, gagal: { jentera: -15, stress: 5 } } },
        { id: 'balas', label: 'Balas dengan cara kotor', kesan: { vs: 3, stress: 7 }, etika: { risiko: 8, lapor: { peluang: 25, berat: 1, perkara: 'Tindakan kempen tidak beretika', fasal: 'Fasal 20.13' } } }] },
    { id: 'sukarelawan', jenis: 'sabotaj', ikon: '🧑‍🤝‍🧑', tajuk: 'Sukarelawan ditarik pihak lawan',
      huraian: 'Beberapa ketua sukarelawan didekati pihak lawan dan mahu menukar pihak.', sensitif: null,
      pilihan: [
        { id: 'pujuk', label: 'Pujuk dengan makan malam', kesan: { dana: -900, jentera: 3, stress: 2 } },
        { id: 'tawar', label: 'Tawarkan insentif', kesan: { dana: -2000, jentera: 8 }, etika: { risiko: 6, lapor: { peluang: 20, berat: 1, perkara: 'Insentif kepada sukarelawan', fasal: 'Fasal 20.13' } } },
        { id: 'biar', label: 'Biarkan mereka pergi', kesan: { jentera: -12, stress: 1 } }] }
  ];
  function kejutanId(id) { for (var i = 0; i < KEJUTAN.length; i++) { if (KEJUTAN[i].id === id) { return KEJUTAN[i]; } } return null; }

  var ISU_TEMPATAN = ['jalan_air', 'kerja_belia', 'klinik_warga', 'harga_barang', 'perumahan', 'pertanian'];

  /* ------------------------------------------------------------------------
     STATE
     ------------------------------------------------------------------------ */
  function dasar() {
    return { tahunPRU: CONFIG.TAHUN_MULA, bulanPRU: CONFIG.BULAN_PRU, mulaIdx: 2026 * 12 + 1, krisisSudah: false,
      hubunganGabungan: CONFIG.GABUNGAN.awal, sejarah: [], status: null, manifesto: null, siasatan: null, aktif: null };
  }
  function getPRU(p) {
    var b = dasar(), x = p && p.pru && typeof p.pru === 'object' ? p.pru : {};
    for (var k in b) { if (x[k] === undefined) { x[k] = b[k]; } }
    return x;
  }
  function simpanPRU(pru, kesan, opts) {
    opts = opts || {};
    var patch = { pru: pru };
    if (opts.patch) { for (var f in opts.patch) { patch[f] = opts.patch[f]; } }
    return S().applyEffects(kesan || {}, { kiraTindakan: false, patch: patch, log: opts.log });
  }
  function laras(d) { var s = ST(); if (s && s.laras) { return s.laras(d); } return null; }

  /** Profil kawasan: ditentukan secara tetap daripada negeri, bahagian dan DUN pemain. */
  function profilKawasan(p) {
    var nama = ((p.bahagian || '') + ' ' + (p.dun || '') + ' ' + (p.negeri || '')).toLowerCase();
    if (/kuala lumpur|putrajaya|labuan|petaling|shah alam|klang|subang|johor bahru|george town|georgetown|ipoh|kuching|kota kinabalu|seremban|melaka|bangi|cheras|kepong|setiawangsa|lembah pantai|bandar|selayang|ampang|puchong|damansara/.test(nama)) { return 'URBAN'; }
    var h = hash(p.bahagian + '|' + p.dun) % 10;
    return h < 4 ? 'RURAL' : h < 7 ? 'MIXED' : 'URBAN';
  }
  function lawanPool(profil) { return LAWAN[profil] || LAWAN.MIXED; }

  /* ------------------------------------------------------------------------
     KELAYAKAN & PERMOHONAN
     ------------------------------------------------------------------------ */
  function pangkatTertinggi(p) {
    return (p.jawatanList || []).reduce(function (m, j) { return Math.max(m, Number(j.pangkat) || 0); }, 0);
  }
  /** Parlimen: Ketua Bahagian (utama pangkat 7) atau ketua sayap Bahagian ke atas (pangkat 5+); DUN: sebarang jawatan dari AJK Cawangan. */
  function ketuaBahagianKeAtas(p) {
    return (p.jawatanList || []).some(function (j) {
      var pg = Number(j.pangkat) || 0;
      return (j.kumpulan === 'sayap' ? pg >= 5 : pg >= 7) || j.peringkat === 'pusat';
    });
  }
  function kelayakan(p) {
    var ip = Number(p.ip) || 0, ada = (p.jawatanList || []).length > 0;
    function semak(jenis) {
      var c = CONFIG[jenis], sebab = [];
      if (ip < c.ipMin) { sebab.push('Perlu IP ' + c.ipMin + ' (anda ' + ip + ')'); }
      if (jenis === 'DUN' && !p.dun) { sebab.push('Wilayah Persekutuan tiada DUN'); }
      if (jenis === 'DUN' && !ada) { sebab.push('Perlu pegang jawatan Cawangan atau lebih'); }
      if (jenis === 'PARLIMEN' && !ketuaBahagianKeAtas(p)) { sebab.push('Perlu Ketua Bahagian atau lebih'); }
      var ratio = ip / c.ipMin;
      var peluang = clamp(0.45 + (ratio - 1) * 0.25 + ((Number(p.reputasi) || 50) - 50) * 0.004 + (jenis === 'DUN' ? 0.1 : 0), CONFIG.TERIMA_MIN, CONFIG.TERIMA_MAKS);
      return { boleh: sebab.length === 0, sebab: sebab, ipMin: c.ipMin, minPeruntukan: c.minPeruntukan, peluang: Math.round(peluang * 100) };
    }
    return { DUN: semak('DUN'), PARLIMEN: semak('PARLIMEN') };
  }

  function partiPopulariti(p, o) {
    return clamp(bulat(45 + ((Number(p.reputasi) || 50) - 50) * 0.3 + antara(rng(o), -6, 6)), 30, 70);
  }

  /* ------------------------------------------------------------------------
     PENGISYTIHARAN
     ------------------------------------------------------------------------ */
  function isytihar(sebab, o) {
    var p = S().loadPlayer(), pru = getPRU(p), K = modul('MyPolitikKabinet', 'kabinet.js'), r = rng(o);
    var profil = pru.profil || profilKawasan(p);
    var isu = ISU_TEMPATAN[Math.floor(r() * ISU_TEMPATAN.length)];
    pru.profil = profil;
    pru.aktif = {
      isElectionSeason: true, fasa: 'isytihar', sebab: sebab, candidateType: 'NONE', constituencyType: profil,
      campaignDaysLeft: CONFIG.HARI, hari: 0, voterSupport: 0, campaignFunds: 0, jentera: 70,
      isThreeCorneredFight: false, manifestoChoice: [], partiPopulariti: partiPopulariti(p, o), isuTempatan: isu,
      perluRunding: false, runding: null, kerusi: null, kejutanHari: {}, kejutanAktif: null, finalDigunakan: {},
      dermaGuna: 0, risikoSprm: 0, risikoFitnah: 0, log: [], lawan: lawanPool(profil), ditolak: {}, baki3: false
    };
    pru.krisisSudah = true;
    var tamatKab = K && K.tamatPenggal ? K.tamatPenggal() : null;       // Parlimen / Dewan dibubarkan: peranan kerajaan tamat
    p = S().loadPlayer();
    var kes = simpanPRU(pru, {}, { log: { tindakan: 'pru_isytihar', nama: 'Pilihan raya diisytiharkan (' + (sebab === 'krisis' ? 'Krisis Pembubaran Dewan' : 'tamat penggal') + ')', peringkat: 'bulan' } });
    var ev = [{ jenis: 'pru_isytihar', mesej: sebab === 'krisis' ? 'Krisis politik memaksa pembubaran Dewan. Pilihan raya dalam 14 hari!' : 'Penggal tamat. Pilihan raya diisytiharkan; hari mengundi dalam 14 hari.' }];
    if (tamatKab && tamatKab.mesej) { ev.push({ jenis: 'kabinet', mesej: tamatKab.mesej }); }
    return { ok: !!(kes && kes.ok), peristiwa: ev };
  }

  /** Dipanggil setiap bulan baharu oleh Calendar.majuBulan. */
  function prosesBulan(o) {
    var p = S() && S().loadPlayer();
    if (!p || p.tamat) { return { peristiwa: [] }; }
    var pru = getPRU(p), ev = [], now = idx(p), r = rng(o);
    var sj = pru.sejarah && pru.sejarah[pru.sejarah.length - 1];                // v7.49: baiki simpanan lama: status ADUN/MP yang kekal selepas tidak bertanding
    if (pru.status && sj && sj.hasil === 'tidak_bertanding' && (sj.tahun * 12 + sj.bulan) >= ((Number(pru.status.sejakTahun) || 0) * 12 + (Number(pru.status.sejakBulan) || 0)) && !pru.aktif) { pru.status = null; simpanPRU(pru, {}, {}); p = S().loadPlayer(); pru = getPRU(p); }
    var ev2 = prosesJanji(p, pru, o);
    if (ev2.length) { ev = ev.concat(ev2); p = S().loadPlayer(); pru = getPRU(p); }
    if (pru.aktif) { return { peristiwa: ev }; }
    var jadual = pru.tahunPRU * 12 + pru.bulanPRU;
    if (now >= jadual) { var a = isytihar('tamat_penggal', o); return { peristiwa: ev.concat(a.peristiwa) }; }
    if (!pru.krisisSudah && now - pru.mulaIdx >= CONFIG.KRISIS.minBulan && now < jadual - 3 && r() < CONFIG.KRISIS.peluang) {
      var b = isytihar('krisis', o); return { peristiwa: ev.concat(b.peristiwa) };
    }
    return { peristiwa: ev };
  }

  /* ------------------------------------------------------------------------
     PENCALONAN
     ------------------------------------------------------------------------ */
  function pilihKerusi(jenis, o) {
    var p = S().loadPlayer(), pru = getPRU(p), a = pru.aktif;
    if (!a || (a.fasa !== 'isytihar' && a.fasa !== 'calon')) { return { ok: false, ralat: 'Tiada fasa pencalonan.' }; }
    if (jenis !== 'DUN' && jenis !== 'PARLIMEN') { return { ok: false, ralat: 'Jenis kerusi tidak sah.' }; }
    if (a.ditolak[jenis]) { return { ok: false, ralat: 'Permohonan ' + jenis + ' sudah ditolak.' }; }
    var kl = kelayakan(p)[jenis];
    if (!kl.boleh) { return { ok: false, ralat: kl.sebab.join('; ') }; }
    var lulus = rng(o)() * 100 < kl.peluang;
    if (!lulus) {
      a.ditolak[jenis] = true; a.fasa = 'calon';
      var semuaTolak = a.ditolak.DUN && a.ditolak.PARLIMEN;
      simpanPRU(pru, { reputasi: -1 }, { log: { tindakan: 'pru_tolak', nama: 'Permohonan ' + jenis + ' tidak diluluskan', peringkat: 'ahli' } });
      return { ok: true, diluluskan: false, mesej: 'Permohonan ' + (jenis === 'DUN' ? 'kerusi DUN' : 'kerusi Parlimen') + ' tidak diluluskan oleh Majlis Tertinggi (peluang ' + kl.peluang + '%).' + (semuaTolak ? '' : ' Anda boleh memohon jenis lain.') };
    }
    var kod = jenis === 'DUN' ? ((p.kod && p.kod.dun) || p.dun) : ((p.kod && p.kod.parlimen) || p.bahagian);
    a.candidateType = jenis;
    a.kerusi = { jenis: jenis, nama: jenis === 'DUN' ? (p.dun || 'DUN') : (p.bahagian || 'Parlimen'), kod: kod || '' };
    a.perluRunding = jenis === 'PARLIMEN' ? rng(o)() < CONFIG.GABUNGAN.peluangRunding + 0.1 : rng(o)() < CONFIG.GABUNGAN.peluangRunding - 0.15;
    a.fasa = a.perluRunding ? 'runding' : 'manifesto';
    simpanPRU(pru, {}, { log: { tindakan: 'pru_calon', nama: 'Dicalonkan: ' + a.kerusi.nama + ' (' + jenis + ')', peringkat: 'ahli' } });
    return { ok: true, diluluskan: true, perluRunding: a.perluRunding, mesej: 'Dicalonkan bertanding kerusi ' + a.kerusi.nama + ' (' + (jenis === 'DUN' ? 'DUN' : 'Parlimen') + ').' };
  }

  function tidakBertanding() {
    var p = S().loadPlayer(), pru = getPRU(p), a = pru.aktif;
    if (!a) { return { ok: false, ralat: 'Tiada pilihan raya aktif.' }; }
    if (a.fasa === 'kempen' || a.fasa === 'keputusan') { return { ok: false, ralat: 'Kempen sudah bermula.' }; }
    var tarik = a.candidateType !== 'NONE' && a.fasa !== 'isytihar';        // v7.18: menarik diri selepas dicalonkan menjejas reputasi
    pru.status = null;                                                      // v7.49: tidak bertanding/menarik diri = penggal lama tamat; status ADUN/MP dilucutkan
    var jadi = tamatMusim(pru, p, { jenis: a.candidateType === 'NONE' ? 'NONE' : a.candidateType, hasil: 'tidak_bertanding', kerusi: a.kerusi ? a.kerusi.nama : '' });
    if (tarik) { S().applyEffects({ reputasi: -3 }, { kiraTindakan: false, log: { tindakan: 'pru_tarik', nama: 'Menarik diri selepas dicalonkan', peringkat: 'ahli' } }); }
    var nas = null;
    if (adalahPresiden(p)) { var p2 = S().loadPlayer(), pr2 = getPRU(p2); pr2.nasional = janaNasional(p2, pr2, a, null, false); simpanPRU(pr2, {}, {}); nas = true; }   // v7.22
    return { ok: true, tarik: tarik, nasional: nas, mesej: tarik ? 'Anda menarik diri daripada pilihan raya. Reputasi Parti -3 kerana menarik diri selepas dicalonkan.' : 'Anda tidak bertanding pada pilihan raya kali ini. Fokus pada jawatan parti.', hasil: jadi };
  }

  /* ------------------------------------------------------------------------
     RUNDINGAN KERUSI
     ------------------------------------------------------------------------ */
  function runding(opsi, o) {
    var p = S().loadPlayer(), pru = getPRU(p), a = pru.aktif, k = KOS_RUNDING[opsi];
    if (!a || a.fasa !== 'runding' || !k) { return { ok: false, ralat: 'Rundingan tidak tersedia.' }; }
    if (opsi === 'ganti' && !p.dun) { return { ok: false, ralat: 'Wilayah Persekutuan tiada kerusi DUN.' }; }
    if (opsi === 'ganti' && a.candidateType !== 'PARLIMEN') { return { ok: false, ralat: 'Tawaran ganti hanya bagi kerusi Parlimen.' }; }
    if ((Number(p.ip) || 0) < k.ip) { return { ok: false, ralat: 'IP tidak mencukupi (perlu ' + k.ip + ').' }; }
    var r = rng(o), hub = pru.hubunganGabungan, bonus = (hub - 50) * 0.004, kes = { ip: -k.ip }, mesej = '';
    if (opsi === 'abai') {
      a.isThreeCorneredFight = true; pru.hubunganGabungan = clamp(hub - 15, 0, 100); kes.reputasi = -3;
      mesej = 'Anda bertanding juga tanpa mengendahkan rakan gabungan. Pertandingan 3-penjuru dipastikan; hubungan gabungan merosot.';
    } else if (opsi === 'berdepan') {
      var j = r() < clamp(k.jaya + bonus, 0.1, 0.9);
      a.isThreeCorneredFight = !j;
      mesej = j ? 'Rundingan berjaya. Rakan gabungan menarik diri; pertandingan 1-lawan-1.' : 'Rundingan gagal. Rakan gabungan bertanding juga: pertandingan 3-penjuru.';
      pru.hubunganGabungan = clamp(hub + (j ? 3 : -5), 0, 100);
    } else {
      var j2 = r() < clamp(k.jaya + bonus, 0.1, 0.95);
      if (j2) {
        a.candidateType = 'DUN'; a.kerusi = { jenis: 'DUN', nama: p.dun || 'DUN', kod: (p.kod && p.kod.dun) || p.dun };
        a.isThreeCorneredFight = false; pru.hubunganGabungan = clamp(hub + 5, 0, 100);
        mesej = 'Tawaran diterima. Anda melepaskan kerusi Parlimen dan bertanding DUN ' + a.kerusi.nama + ' (1-lawan-1).';
      } else { a.isThreeCorneredFight = true; pru.hubunganGabungan = clamp(hub - 5, 0, 100); mesej = 'Tawaran ditolak. Kerusi Parlimen dipertahankan dalam pertandingan 3-penjuru.'; }
    }
    a.fasa = 'manifesto'; a.runding = { opsi: opsi, penjuru3: a.isThreeCorneredFight };
    var res = simpanPRU(pru, kes, { log: { tindakan: 'pru_runding', nama: 'Rundingan kerusi: ' + opsi, peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    return { ok: true, mesej: mesej, penjuru3: a.isThreeCorneredFight };
  }

  /* ------------------------------------------------------------------------
     MANIFESTO & PERMULAAN KEMPEN
     ------------------------------------------------------------------------ */
  function bonusManifesto(profil, ids) {
    return ids.reduce(function (t, id) { var j = janjiId(id); return t + (j ? (j.sesuai[profil] || 0) : 0); }, 0);
  }
  function peruntukanPilihan(p, a) {
    var min = CONFIG[a.candidateType].minPeruntukan, myr = Number(p.myr) || 0, senarai = [];
    if (myr < min) {                                            // v7.18: dana kurang daripada minimum: boleh bertanding dengan semua dana, tetapi kempen lemah (elak pemain tersekat)
      var s0 = 1 - myr / min;
      return { min: min, pilihan: [myr], bawahMin: true, penalti: { sokongan: Math.round(10 * s0), jentera: Math.round(15 * s0) } };
    }
    [min, 5000, 10000, 20000].forEach(function (n) { if (n >= min && n <= myr && senarai.indexOf(n) < 0) { senarai.push(n); } });
    if (myr >= min && senarai.indexOf(myr) < 0) { senarai.push(myr); }
    return { min: min, pilihan: senarai.sort(function (x, y) { return x - y; }) };
  }

  function mulaKempen(ids, peruntukan, o) {
    var p = S().loadPlayer(), pru = getPRU(p), a = pru.aktif;
    if (!a || a.fasa !== 'manifesto') { return { ok: false, ralat: 'Belum sampai fasa manifesto.' }; }
    ids = (ids || []).filter(function (x, i, ar) { return janjiId(x) && ar.indexOf(x) === i; });
    if (ids.length !== 3) { return { ok: false, ralat: 'Pilih tepat 3 janji manifesto.' }; }
    var pil = peruntukanPilihan(p, a), dana = Math.round(Number(peruntukan) || 0);
    if (dana < pil.min && !(pil.bawahMin && dana === Math.round(Number(p.myr) || 0))) { return { ok: false, ralat: 'Peruntukan kempen minimum RM ' + pil.min.toLocaleString('ms-MY') + '.' }; }
    if (dana > p.myr) { return { ok: false, ralat: 'Dana tidak mencukupi.' }; }
    var r = rng(o), profil = a.constituencyType, mb = bonusManifesto(profil, ids);
    var asas = 0.40 * a.partiPopulariti + 8 + Math.min(11, (Number(p.ip) || 0) / 80) + ((p.kesetiaan && p.kesetiaan.akarUmbi || 50) - 50) * 0.12 + ((Number(p.reputasi) || 50) - 50) * 0.05 + mb;
    a.manifestoChoice = ids.slice();
    a.voterSupport = clamp(bulat(asas * 0.8), 15, 70);
    a.campaignFunds = dana; a.jentera = clamp(60 + bulat((Number(p.kesetiaan && p.kesetiaan.akarUmbi) || 50) * 0.25), 40, 85);
    if (pil.bawahMin) { a.voterSupport = clamp(a.voterSupport - pil.penalti.sokongan, 10, 70); a.jentera = clamp(a.jentera - pil.penalti.jentera, 25, 85); a.bajetRendah = true; }
    a.hari = 0; a.campaignDaysLeft = CONFIG.HARI; a.fasa = 'kempen';
    var n = CONFIG.KEJUTAN_BILANGAN[0] + Math.floor(r() * (CONFIG.KEJUTAN_BILANGAN[1] - CONFIG.KEJUTAN_BILANGAN[0] + 1)), hariSedia = [], h;
    for (h = 2; h <= CONFIG.HARI - CONFIG.HARI_FINAL - 1; h++) { hariSedia.push(h); }
    a.kejutanHari = {};
    while (n-- > 0 && hariSedia.length) {
      var i = Math.floor(r() * hariSedia.length), hr = hariSedia.splice(i, 1)[0];
      a.kejutanHari[hr] = KEJUTAN[Math.floor(r() * KEJUTAN.length)].id;
    }
    a.log = [{ hari: 0, teks: 'Kempen bermula. Peruntukan RM ' + dana.toLocaleString('ms-MY') + '; manifesto: ' + ids.map(function (x) { return janjiId(x).nama; }).join(', ') + '.' }];
    var res = simpanPRU(pru, { myr: -dana }, { log: { tindakan: 'pru_kempen', nama: 'Kempen bermula (peruntukan RM ' + dana + ')', peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    return { ok: true, mesej: 'Kempen 14 hari bermula.' };
  }

  /* ------------------------------------------------------------------------
     KEMPEN
     ------------------------------------------------------------------------ */
  function faktorJentera(j) { return 0.6 + 0.4 * (clamp(j, 0, 100) / 100); }
  function faktorTurun(vs) { return clamp(1 - Math.max(0, vs - 60) / 80, 0.35, 1); }
  function hariFinal(a) { return a.hari >= CONFIG.HARI - CONFIG.HARI_FINAL && a.hari < CONFIG.HARI; }

  function statusTindakan(a, t, final) {
    if (a.kejutanAktif) { return { boleh: false, sebab: 'Selesaikan kejutan kempen dahulu.' }; }
    if (a.campaignDaysLeft <= 0) { return { boleh: false, sebab: 'Kempen tamat.' }; }
    if (final && !hariFinal(a)) { return { boleh: false, sebab: 'Dibuka pada hari ke-13 dan ke-14.' }; }
    if (t.dana > a.campaignFunds) { return { boleh: false, sebab: 'Dana tidak cukup (RM ' + t.dana.toLocaleString('ms-MY') + ').' }; }
    if (t.perluJentera && a.jentera < CONFIG.JENTERA_MIN) { return { boleh: false, sebab: 'Jentera terlalu letih (min ' + CONFIG.JENTERA_MIN + '%).' }; }
    if (t.jentera < 0 && a.jentera < -t.jentera / 2 && !t.perluJentera) { return { boleh: false, sebab: 'Jentera terlalu letih.' }; }
    if (t.id === 'derma' && a.dermaGuna >= CONFIG.DERMA_MAKS) { return { boleh: false, sebab: 'Had derma (' + CONFIG.DERMA_MAKS + ' kali) dicapai.' }; }
    if (final && a.finalDigunakan['h' + a.hari]) { return { boleh: false, sebab: 'Final Push hari ini sudah digunakan.' }; }
    return { boleh: true, sebab: '' };
  }

  function keadaanKempen(p) {
    var pru = getPRU(p), a = pru.aktif;
    if (!a || a.fasa !== 'kempen') { return null; }
    var pg = PENGGANDA[a.constituencyType];
    function baris(t, final) {
      var st = statusTindakan(a, t, final), m = t.pengganda ? pg[t.pengganda] : 1;
      return { id: t.id, ikon: t.ikon, nama: t.nama, dana: t.dana, jentera: t.jentera, gain: t.gain, stress: t.stress, pengganda: m, final: !!final,
        risiko: t.risiko || 0, jenisRisiko: t.jenisRisiko || null, boleh: st.boleh, sebab: st.sebab,
        hasil: t.id === 'derma' ? [1000, 3000] : null };
    }
    var biasa = ['ceramah', 'ziarah', 'digital', 'rehat', 'derma'].map(function (k) { return baris(TINDAKAN[k], false); });
    var fin = hariFinal(a) ? ['jelajah', 'bantuan', 'media'].map(function (k) { return baris(FINAL[k], true); }) : [];
    var lw = lawanPool(a.constituencyType), pk = pecahan(a);
    return { aktif: a, hariSemasa: a.hari, hariBaki: a.campaignDaysLeft, hariFinal: hariFinal(a), biasa: biasa, final: fin, pecahan: pk, lawan: lw,
      profil: a.constituencyType, profilNama: PROFIL[a.constituencyType], ikonProfil: IKON_PROFIL[a.constituencyType], kejutan: a.kejutanAktif ? kejutanPapar(a) : null,
      janji: a.manifestoChoice.map(janjiId) };
  }

  /** Pecahan undi semasa (anggaran) untuk paparan. */
  function pecahan(a) {
    var s1 = clamp(30 + a.voterSupport * 0.4, 5, 95), lw = lawanPool(a.constituencyType);
    if (!a.isThreeCorneredFight) { return [{ nama: 'Anda (UMNO)', nilai: round1(s1), ke: 'anda' }, { nama: lw[0], nilai: round1(100 - s1), ke: 'lawan' }]; }
    var anda = s1 * CONFIG.PECAH_3;
    return [{ nama: 'Anda (UMNO)', nilai: round1(anda), ke: 'anda' }, { nama: 'Rakan Gabungan', nilai: round1(s1 - anda), ke: 'rakan' }, { nama: lw[0], nilai: round1(100 - s1), ke: 'lawan' }];
  }
  function round1(n) { return Math.round(n * 10) / 10; }

  function guna(a, t, final, o) {
    var r = rng(o), pg = PENGGANDA[a.constituencyType], m = t.pengganda ? pg[t.pengganda] : 1, mesej;
    a.campaignFunds -= t.dana; a.jentera = clamp(a.jentera + t.jentera, 0, 100);
    var gain = 0;
    if (t.gain[1] > 0) { gain = antara(r, t.gain[0], t.gain[1]) * m * faktorJentera(a.jentera - t.jentera) * faktorTurun(a.voterSupport) * CONFIG.SKALA_GAIN; }
    gain = Math.round(gain * 10) / 10;
    a.voterSupport = clamp(Math.round((a.voterSupport + gain) * 10) / 10, 0, 100);
    if (t.id === 'derma') {
      var d = Math.round(antara(r, 1000, 3000) * (0.5 + a.partiPopulariti / 100) / 50) * 50;
      a.campaignFunds += d; a.dermaGuna += 1; mesej = 'Derma terkumpul RM ' + d.toLocaleString('ms-MY') + '.';
    } else if (t.id === 'rehat') { mesej = 'Jentera berehat (+' + t.jentera + '%).'; }
    else { mesej = t.nama + ': sokongan +' + gain + '%' + (m !== 1 ? ' (×' + m + ' kawasan ' + PROFIL[a.constituencyType] + ')' : '') + '.'; }
    return { gain: gain, mesej: mesej };
  }

  function lanjutHari(pru, a, kes, patchStress, o) {
    var r = rng(o), pesan = [];
    a.hari += 1; a.campaignDaysLeft = CONFIG.HARI - a.hari;
    a.voterSupport = clamp(Math.round((a.voterSupport - CONFIG.TEKANAN_LAWAN_HARIAN) * 10) / 10, 0, 100);
    var kid = a.kejutanHari[a.hari];
    if (kid && a.campaignDaysLeft > 0) { a.kejutanAktif = { id: kid, hari: a.hari }; delete a.kejutanHari[a.hari]; pesan.push('Kejutan kempen hari ke-' + a.hari + '!'); }
    return pesan;
  }

  function tindakanKempen(id, o) {
    var p = S().loadPlayer(), pru = getPRU(p), a = pru.aktif;
    if (!a || a.fasa !== 'kempen') { return { ok: false, ralat: 'Tiada kempen aktif.' }; }
    var t = TINDAKAN[id] || FINAL[id], final = !!FINAL[id];
    if (!t) { return { ok: false, ralat: 'Tindakan tidak dikenali.' }; }
    var st = statusTindakan(a, t, final);
    if (!st.boleh) { return { ok: false, ralat: st.sebab }; }
    var hasil = guna(a, t, final, o), pesan = [], patch = {}, kes = {}, ev = [], r = rng(o), risiko = null;
    if (final) {
      a.finalDigunakan['h' + a.hari] = id;
      if (t.risiko) {                                      // double jeopardy: risiko bertambah bagi setiap penggunaan jenis risiko yang sama
        var kira = (t.jenisRisiko === 'sprm' ? a.risikoSprm : a.risikoFitnah), peluang = clamp(t.risiko + 0.15 * kira, 0, 0.9);
        if (t.jenisRisiko === 'sprm') { a.risikoSprm += 1; } else { a.risikoFitnah += 1; }
        if (r() < peluang) { risiko = t.jenisRisiko; if (t.jenisRisiko === 'sprm') { a.siasatSprm = (a.siasatSprm || 0) + 1; } else { a.fitnah = (a.fitnah || 0) + 1; } }
        var Et = ET();
        if (Et && Et.selepasAcara) {
          var eo = Et.selepasAcara(p, { risiko: t.jenisRisiko === 'sprm' ? 14 : 8 }, { rng: r });
          patch.etika = eo.etika;
        }
      }
    }
    a.log.unshift({ hari: a.hari, teks: hasil.mesej + (risiko ? (risiko === 'sprm' ? ' Risiko: pihak berkuasa mula memerhati edaran ini.' : ' Risiko: dakwaan fitnah dibuat terhadap anda.') : '') });
    a.log = a.log.slice(0, 20);
    pesan = lanjutHari(pru, a, kes, null, o);
    var res = simpanPRU(pru, kes, { patch: patch, log: { tindakan: 'pru_hari', nama: t.nama + ' (hari ' + a.hari + ')', peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    if (t.stress) { laras({ stress: t.stress }); }
    var tamat = a.campaignDaysLeft <= 0 && !a.kejutanAktif;
    return { ok: true, mesej: hasil.mesej, gain: hasil.gain, risiko: risiko, kejutan: !!a.kejutanAktif, pesan: pesan, tamat: tamat };
  }

  function kejutanPapar(a) {
    var d = kejutanId(a.kejutanAktif.id);
    if (!d) { return null; }
    return { id: d.id, jenis: d.jenis, ikon: d.ikon, tajuk: d.tajuk, huraian: d.huraian, hari: a.kejutanAktif.hari, sensitif: d.sensitif,
      pilihan: d.pilihan.map(function (c) {
        return { id: c.id, label: c.label, kesan: c.kesan || null, rawak: c.rawak || null, etika: !!c.etika, boleh: !(c.kesan && c.kesan.dana && a.campaignFunds + c.kesan.dana < 0), sebab: 'Dana tidak cukup.' };
      }) };
  }

  function jawabKejutan(pilihanId, o) {
    var p = S().loadPlayer(), pru = getPRU(p), a = pru.aktif;
    if (!a || !a.kejutanAktif) { return { ok: false, ralat: 'Tiada kejutan menunggu.' }; }
    var d = kejutanId(a.kejutanAktif.id), c = d && d.pilihan.filter(function (x) { return x.id === pilihanId; })[0];
    if (!c) { return { ok: false, ralat: 'Pilihan tidak sah.' }; }
    var r = rng(o), k = {}, mesej = c.label + '.', jaya = null;
    if (c.rawak) { jaya = r() < c.rawak.p; k = jaya ? c.rawak.jaya : c.rawak.gagal; mesej += jaya ? ' Berjaya!' : ' Gagal.'; }
    else { k = c.kesan || {}; }
    if (k.dana && a.campaignFunds + k.dana < 0) { return { ok: false, ralat: 'Dana kempen tidak mencukupi.' }; }
    var sens = d.sensitif && a.constituencyType === d.sensitif && k.vs && k.vs < 0 ? 1.3 : 1;
    var vs = k.vs ? k.vs * sens : (k.vsMin ? antara(r, k.vsMin, k.vsMaks) : 0);
    vs = Math.round(vs * 10) / 10;
    a.campaignFunds += k.dana || 0; a.jentera = clamp(a.jentera + (k.jentera || 0), 0, 100);
    a.voterSupport = clamp(Math.round((a.voterSupport + vs) * 10) / 10, 0, 100);
    var kes = {}, patch = {};
    if (k.ip) { kes.ip = k.ip; }
    if (k.rep) { kes.reputasi = k.rep; }
    if (c.etika) { var Et = ET(); if (Et && Et.selepasAcara) { var eo = Et.selepasAcara(p, c.etika, { rng: r }); patch.etika = eo.etika; if (eo.mesej) { mesej += eo.mesej; } } }
    a.log.unshift({ hari: a.kejutanAktif.hari, teks: d.tajuk + ': ' + mesej + (vs ? ' Sokongan ' + (vs > 0 ? '+' : '') + vs + '%.' : '') });
    a.log = a.log.slice(0, 20);
    a.kejutanAktif = null;
    var res = simpanPRU(pru, kes, { patch: patch, log: { tindakan: 'pru_kejutan', nama: d.tajuk + ': ' + c.label, peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    if (k.stress) { laras({ stress: k.stress }); }
    return { ok: true, mesej: mesej, vs: vs, jaya: jaya, tamat: a.campaignDaysLeft <= 0 };
  }

  /* ------------------------------------------------------------------------
     KEPUTUSAN (FPTP)
     ------------------------------------------------------------------------ */
  function hitungKeputusan(p, a, o) {
    var r = rng(o), prof = a.constituencyType, ids = a.manifestoChoice;
    var isuTepat = ids.indexOf(a.isuTempatan) >= 0;
    var rawak = (r() + r() + r() - 1.5) * 4;                       // sehingga lebih kurang +/-6
    var isu = (isuTepat ? 2 : -1) + antara(r, -2, 2);
    var s1 = clamp(30 + a.voterSupport * 0.4 + rawak * 0.5 + isu * 0.5, 5, 95);
    var anda, rakan = 0, lawan;
    if (a.isThreeCorneredFight) { anda = s1 * CONFIG.PECAH_3; rakan = s1 - anda; lawan = 100 - s1; }
    else { anda = s1; lawan = 100 - s1; }
    var menang = anda > Math.max(rakan, lawan);
    var pecah = [{ nama: 'Anda (UMNO)', nilai: round1(anda), ke: 'anda' }];
    if (a.isThreeCorneredFight) { pecah.push({ nama: 'Rakan Gabungan', nilai: round1(rakan), ke: 'rakan' }); }
    pecah.push({ nama: lawanPool(prof)[0], nilai: round1(lawan), ke: 'lawan' });
    var c = CONFIG[a.candidateType], jumlah = Math.round(antara(r, c.pengundi[0], c.pengundi[1]) / 100) * 100;
    var lawanTertinggi = Math.max(rakan, lawan);
    var majoritiPct = Math.abs(anda - lawanTertinggi);
    return { menang: menang, pecah: pecah, anda: round1(anda), tertinggiLain: round1(lawanTertinggi), majoritiPct: round1(majoritiPct),
      majoriti: Math.round(majoritiPct / 100 * jumlah / 10) * 10, jumlahUndi: jumlah, isuTempatan: a.isuTempatan, isuTepat: isuTepat, penjuru3: a.isThreeCorneredFight };
  }

  function tamatMusim(pru, p, rekod) {
    rekod.tahun = p.tahun; rekod.bulan = p.bulan;
    pru.sejarah = (pru.sejarah || []).concat([rekod]).slice(-10);
    var tahun = (parseInt(p.tahun, 10) || pru.tahunPRU);
    pru.tahunPRU = tahun + CONFIG.KITARAN_TAHUN; pru.bulanPRU = parseInt(p.bulan, 10) || CONFIG.BULAN_PRU; pru.mulaIdx = idx(p); pru.krisisSudah = false;
    pru.aktif = null;
    simpanPRU(pru, {}, { log: { tindakan: 'pru_tamat', nama: 'Pilihan raya tamat: ' + rekod.hasil, peringkat: 'bulan' } });
    return rekod;
  }

  /** Selesai kempen: kira keputusan, kenakan ganjaran. Fasa menjadi 'keputusan' sehingga pemain menutupnya. */
  function selesaikan(o) {
    var p = S().loadPlayer(), pru = getPRU(p), a = pru.aktif, r = rng(o);
    if (!a || a.fasa !== 'kempen') { return { ok: false, ralat: 'Tiada kempen untuk diselesaikan.' }; }
    if (a.kejutanAktif) { return { ok: false, ralat: 'Selesaikan kejutan kempen dahulu.' }; }
    if (a.campaignDaysLeft > 0) { return { ok: false, ralat: 'Kempen belum tamat (' + a.campaignDaysLeft + ' hari lagi).' }; }
    var k = hitungKeputusan(p, a, o), c = CONFIG[a.candidateType], kes = {}, ipD = 0, extra = {}, ev = [], pGov, kerajaan = false, kabinetBuka = false, petisyen = false, siasatMsg = '';
    kes.myr = Math.max(0, a.campaignFunds || 0);                                // baki dana kempen dipulangkan
    if (k.menang) {
      var bonus = Math.min(300, c.bonusIp + Math.round(Math.min(80, k.majoritiPct * 4)) + (a.candidateType === 'PARLIMEN' ? 0 : 0));
      bonus = a.candidateType === 'DUN' ? clamp(bonus, 150, 250) : clamp(bonus, 220, 300);
      ipD = bonus; kes.reputasi = CONFIG.MENANG.reputasi; k.bonusIp = bonus;
      pGov = clamp((a.partiPopulariti + 5) / 100, 0.25, 0.8); kerajaan = r() < pGov; k.kerajaan = kerajaan;
      var siasat = a.siasatSprm || 0;
      if (siasat > 0 && r() < clamp(0.5 + 0.2 * (siasat - 1), 0.5, 0.9)) { petisyen = true; }
      if (petisyen) {
        k.petisyen = true; ipD = Math.round(bonus * 0.3) - 150; kes.reputasi = -8; siasatMsg = 'Siasatan SPRM disusuli petisyen pilihan raya: kerusi dibatalkan.';
      } else if (siasat > 0) { kes.reputasi = (kes.reputasi || 0) - 1; siasatMsg = 'Siasatan SPRM selesai tanpa tindakan terhadap anda.'; }
      if (a.fitnah && r() < 0.5) { kes.reputasi = (kes.reputasi || 0) - 4; siasatMsg += ' Dakwaan fitnah menjejas nama anda (Reputasi -4).'; }
      if (!petisyen) {
        pru.status = { jenis: a.candidateType === 'DUN' ? 'ADUN' : 'MP', kerusi: a.kerusi ? a.kerusi.nama : '', sejakTahun: p.tahun, sejakBulan: p.bulan, kerajaan: kerajaan };
        pru.manifesto = { ids: a.manifestoChoice.slice(), sejakIdx: idx(p), kemajuan: {}, dinilai: false };
        a.manifestoChoice.forEach(function (id) { pru.manifesto.kemajuan[id] = 0; });
        kabinetBuka = kerajaan;
      } else { pru.status = null; }
    } else {
      ipD = -Math.min(Number(p.ip) || 0, Math.abs(CONFIG.KALAH.ip)); kes.reputasi = CONFIG.KALAH.reputasi;
      pru.status = null;
    }
    if (adalahPresiden(p)) {                                                  // v7.22: Presiden melihat keputusan nasional; kerajaan ditentukan di sana (bukan lambungan syiling)
      pru.nasional = janaNasional(p, pru, a, o, k.menang && !petisyen && a.candidateType === 'PARLIMEN'); kabinetBuka = false; k.nasional = true;
    }
    var rekod = { jenis: a.candidateType, kerusi: a.kerusi ? a.kerusi.nama : '', hasil: k.menang && !petisyen ? 'menang' : (k.menang ? 'batal' : 'kalah'), anda: k.anda, penjuru3: k.penjuru3, majoriti: k.majoriti, tahun: p.tahun, bulan: p.bulan };
    pru.sejarah = (pru.sejarah || []).concat([rekod]).slice(-10);
    k.siasatMsg = siasatMsg; k.rekod = rekod; k.kabinetBuka = kabinetBuka;
    a.fasa = 'keputusan'; a.keputusan = k; a.campaignFunds = 0; a.finalDigunakan = a.finalDigunakan || {};
    var res = simpanPRU(pru, kes, { patch: { ip: Math.max(0, (Number(p.ip) || 0) + ipD) }, log: { tindakan: 'pru_keputusan', nama: (k.menang && !petisyen ? 'MENANG ' : 'KALAH ') + (a.kerusi ? a.kerusi.nama : ''), peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    if (!k.menang) { laras({ stress: CONFIG.KALAH.stress }); }
    if (kabinetBuka) { var Kb = modul('MyPolitikKabinet', 'kabinet.js'); if (Kb && Kb.bukaLobi) { Kb.bukaLobi(a.candidateType); } }
    return { ok: true, keputusan: k };
  }


  /* ------------------------------------------------------------------------
     KEPUTUSAN NASIONAL & RUNDINGAN KERAJAAN (v7.22) — hanya untuk Presiden parti.
     Andaian: jumlah kerusi ialah anggaran permainan daripada populariti parti; bukan data pilihan raya sebenar.
     Hanya Ahli Parlimen yang menang boleh dilantik Perdana Menteri.
     ------------------------------------------------------------------------ */
  function adalahPresiden(p) {
    var l = Array.isArray(p.jawatanList) ? p.jawatanList : [];
    return /^Presiden$/i.test(String(p.jawatan || '')) || l.some(function (j) { return /^Presiden$/i.test(String(j && j.jawatan || '')); });
  }
  function janaNasional(p, pru, a, o, adaMP) {
    var r = rng(o), N = CONFIG.NASIONAL, pop = a && a.partiPopulariti != null ? a.partiPopulariti : partiPopulariti(p, o);
    var parti = bulat(N.JUMLAH * (0.18 + (pop - 30) / 40 * 0.42) + antara(r, -8, 8));
    parti = clamp(parti, 30, 150);
    var rakan = Math.min(N.JUMLAH - parti, bulat(N.JUMLAH * antara(r, 0.14, 0.26)));
    var status = parti >= N.MAJORITI ? 'MAJORITI' : (parti + rakan >= N.MAJORITI ? 'GABUNGAN' : 'PEMBANGKANG');
    var kongsi = rakan > 0 ? parti / (parti + rakan) : 1;
    var peluangPM = status === 'GABUNGAN' && adaMP ? clamp(0.4 + (kongsi - 0.5) * 1.2 + ((Number(pru.hubunganGabungan) || 50) - 50) * 0.004 + ((Number(p.reputasi) || 50) - 50) * 0.002, 0.1, 0.9) : 0;
    return { tahun: p.tahun, bulan: p.bulan, jumlah: N.JUMLAH, majoriti: N.MAJORITI, parti: parti, rakan: rakan, pembangkang: N.JUMLAH - parti - rakan,
      status: status, bolehPM: !!adaMP, peluangPM: Math.round(peluangPM * 100), hubungan: Number(pru.hubunganGabungan) || 50, selesai: false, hasil: null };
  }
  /** Keputusan nasional yang menunggu keputusan Presiden (null jika tiada). */
  function nasionalTertunggak(p) {
    var n = getPRU(p).nasional;
    return n && !n.selesai ? n : null;
  }
  /** pilihan: 'PM' | 'TPM' | 'KABINET' | 'PEMBANGKANG' (juga 'TUTUP' bagi parti pembangkang). */
  function rundingKerajaan(pilihan, o) {
    var p = S().loadPlayer(), pru = getPRU(p), n = pru.nasional, K = modul('MyPolitikKabinet', 'kabinet.js'), r = rng(o);
    if (!n || n.selesai) { return { ok: false, ralat: 'Tiada rundingan kerajaan.' }; }
    var mesej = '', hasil = '', buka = false, kes = {};
    if (n.status === 'PEMBANGKANG') { pilihan = 'PEMBANGKANG'; }
    if (pilihan === 'PM') {
      if (!n.bolehPM) { return { ok: false, ralat: 'Hanya Ahli Parlimen yang menang boleh menjadi Perdana Menteri.' }; }
      if (n.status === 'PEMBANGKANG') { return { ok: false, ralat: 'Parti anda tidak membentuk kerajaan.' }; }
      var lulus = n.status === 'MAJORITI' || r() * 100 < n.peluangPM;
      if (lulus) { K.lantikKanan('PERDANA_MENTERI'); hasil = 'PM'; mesej = 'Anda dilantik sebagai Perdana Menteri.'; kes.reputasi = 3; }
      else { pru.hubunganGabungan = clamp(pru.hubunganGabungan + CONFIG.NASIONAL.GAGAL_PM_HUBUNGAN, 0, 100); K.lantikKanan('TIMBALAN_PM'); hasil = 'TPM'; mesej = 'Rakan gabungan enggan melepaskan jawatan Perdana Menteri. Hubungan gabungan ' + CONFIG.NASIONAL.GAGAL_PM_HUBUNGAN + '. Anda menerima jawatan Timbalan Perdana Menteri.'; }
    } else if (pilihan === 'TPM') {
      if (n.status === 'PEMBANGKANG') { return { ok: false, ralat: 'Parti anda tidak membentuk kerajaan.' }; }
      K.lantikKanan('TIMBALAN_PM'); hasil = 'TPM'; mesej = 'Anda menerima jawatan Timbalan Perdana Menteri.';
    } else if (pilihan === 'KABINET') {
      if (n.status === 'PEMBANGKANG') { return { ok: false, ralat: 'Parti anda tidak membentuk kerajaan.' }; }
      K.bukaLobi('PARLIMEN'); buka = true; hasil = 'KABINET'; mesej = 'Lobi portfolio kabinet dibuka.';
    } else {
      hasil = 'PEMBANGKANG'; mesej = n.status === 'PEMBANGKANG' ? 'Parti anda menjadi pembangkang.' : 'Anda menolak gabungan. Parti menjadi pembangkang.';
    }
    n.selesai = true; n.hasil = hasil;
    pru.nasional = n;
    pru.sejarahNasional = (pru.sejarahNasional || []).concat([{ tahun: n.tahun, bulan: n.bulan, parti: n.parti, rakan: n.rakan, status: n.status, hasil: hasil }]).slice(-5);
    var res = simpanPRU(pru, kes, { log: { tindakan: 'pru_kerajaan', nama: 'Rundingan kerajaan: ' + hasil, peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    return { ok: true, hasil: hasil, mesej: mesej, bukaLobi: buka };
  }

  /** Tutup skrin keputusan dan tamatkan musim; jadualkan PRU seterusnya. */
  function tutupKeputusan() {
    var p = S().loadPlayer(), pru = getPRU(p), a = pru.aktif;
    if (!a || a.fasa !== 'keputusan') { return { ok: false }; }
    var tahun = parseInt(p.tahun, 10);
    pru.tahunPRU = tahun + CONFIG.KITARAN_TAHUN; pru.bulanPRU = parseInt(p.bulan, 10) || CONFIG.BULAN_PRU; pru.mulaIdx = idx(p); pru.krisisSudah = false;
    pru.aktif = null;
    var res = simpanPRU(pru, {}, { log: { tindakan: 'pru_tamat', nama: 'Musim pilihan raya ditutup', peringkat: 'bulan' } });
    return { ok: !!(res && res.ok) };
  }

  /* ------------------------------------------------------------------------
     MANIFESTO: PENILAIAN SEMULA
     ------------------------------------------------------------------------ */
  function janjiStatus(p) {
    var pru = getPRU(p), m = pru.manifesto;
    if (!m) { return null; }
    var baki = Math.max(0, CONFIG.BULAN_NILAI_JANJI - (idx(p) - m.sejakIdx));
    return { baki: baki, dinilai: !!m.dinilai, senarai: m.ids.map(function (id) { var j = janjiId(id); return { id: id, ikon: j.ikon, nama: j.nama, kos: j.kosBulan, kemajuan: m.kemajuan[id] || 0 }; }), hasil: m.hasil || null };
  }
  function majukanJanji(id, o) {
    var p = S().loadPlayer(), pru = getPRU(p), m = pru.manifesto, j = janjiId(id);
    if (!m || m.dinilai || !j || m.ids.indexOf(id) < 0) { return { ok: false, ralat: 'Janji tidak boleh dimajukan.' }; }
    if ((m.kemajuan[id] || 0) >= 100) { return { ok: false, ralat: 'Janji sudah dipenuhi sepenuhnya.' }; }
    var kos = j.kosBulan * 2, res = S().applyEffects({ myr: -kos }, { kiraTindakan: false, patch: {}, log: { tindakan: 'janji_maju', nama: 'Majukan janji: ' + j.nama, peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    var p2 = S().loadPlayer(), pru2 = getPRU(p2);
    pru2.manifesto.kemajuan[id] = clamp((pru2.manifesto.kemajuan[id] || 0) + 34, 0, 100);
    simpanPRU(pru2, {});
    return { ok: true, mesej: j.nama + ': kemajuan ' + pru2.manifesto.kemajuan[id] + '%. (-RM ' + kos.toLocaleString('ms-MY') + ')' };
  }
  function prosesJanji(p, pru, o) {
    var m = pru.manifesto, ev = [], Kb = modul('MyPolitikKabinet', 'kabinet.js');
    if (!m || m.dinilai) { return ev; }
    var r = rng(o), role = Kb && Kb.getKabinet ? Kb.getKabinet(p).hasGovernmentRole : false;
    if (role) { m.ids.forEach(function (id) { m.kemajuan[id] = clamp((m.kemajuan[id] || 0) + 3, 0, 100); }); }     // pentadbir menyumbang kemajuan bulanan
    if (idx(p) - m.sejakIdx < CONFIG.BULAN_NILAI_JANJI) { simpanPRU(pru, {}); return ev; }
    var kekal = 0, ingkar = 0, kes = { ip: 0, reputasi: 0, kesetiaan: { akarUmbi: 0 } }, ringkas = [];
    m.ids.forEach(function (id) {
      var j = janjiId(id), k = m.kemajuan[id] || 0, puas = k >= 60 || (k >= 30 && r() > j.ingkar);
      if (puas) { kekal++; kes.reputasi += 2; kes.ip += 30; kes.kesetiaan.akarUmbi += 3; ringkas.push('✓ ' + j.nama); }
      else { ingkar++; kes.reputasi -= 3; kes.ip -= 20; kes.kesetiaan.akarUmbi -= 5; ringkas.push('✗ ' + j.nama); }
    });
    m.dinilai = true; m.hasil = { kekal: kekal, ingkar: ingkar, ringkas: ringkas };
    var ipJ = kes.ip; delete kes.ip;
    var res = simpanPRU(pru, kes, { patch: { ip: Math.max(0, (Number(p.ip) || 0) + ipJ) }, log: { tindakan: 'janji_nilai', nama: 'Penilaian manifesto: ' + kekal + ' ditunai, ' + ingkar + ' dimungkiri', peringkat: 'ahli' } });
    if (Kb && Kb.laras) { Kb.laras({ rating: kekal * 6 - ingkar * 9 }); }
    ev.push({ jenis: 'janji_nilai', mesej: 'Penilaian manifesto: ' + ringkas.join(' · ') + '. ' + kekal + ' janji ditunai, ' + ingkar + ' dimungkiri.' });
    return ev;
  }

  /* ------------------------------------------------------------------------
     RINGKASAN UNTUK UI
     ------------------------------------------------------------------------ */
  function ringkasan(p) {
    var pru = getPRU(p), a = pru.aktif, kl = kelayakan(p);
    return { tahunPRU: pru.tahunPRU, bulanPRU: pru.bulanPRU, aktif: a, fasa: a ? a.fasa : null, status: pru.status, sejarah: pru.sejarah,
      kelayakan: kl, hubunganGabungan: pru.hubunganGabungan, profil: pru.profil || profilKawasan(p), profilNama: PROFIL[pru.profil || profilKawasan(p)], ikonProfil: IKON_PROFIL[pru.profil || profilKawasan(p)],
      bulanKePRU: pru.tahunPRU * 12 + pru.bulanPRU - idx(p), janji: janjiStatus(p) };
  }

  return {
    CONFIG: CONFIG, PROFIL: PROFIL, IKON_PROFIL: IKON_PROFIL, PENGGANDA: PENGGANDA, JANJI: JANJI, TINDAKAN: TINDAKAN, FINAL: FINAL, KEJUTAN: KEJUTAN, KOS_RUNDING: KOS_RUNDING,
    setRng: function (f) { rngLalai = f || Math.random; },
    getPRU: getPRU, profilKawasan: profilKawasan, kelayakan: kelayakan, ringkasan: ringkasan, prosesBulan: prosesBulan, isytihar: isytihar,
    pilihKerusi: pilihKerusi, tidakBertanding: tidakBertanding, adalahPresiden: adalahPresiden, nasionalTertunggak: nasionalTertunggak, rundingKerajaan: rundingKerajaan, runding: runding, peruntukanPilihan: peruntukanPilihan, bonusManifesto: bonusManifesto,
    mulaKempen: mulaKempen, keadaanKempen: keadaanKempen, tindakanKempen: tindakanKempen, jawabKejutan: jawabKejutan, selesaikan: selesaikan, tutupKeputusan: tutupKeputusan,
    janjiStatus: janjiStatus, majukanJanji: majukanJanji, pecahan: pecahan, hitungKeputusan: hitungKeputusan
  };
});
