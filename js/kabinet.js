/* ==========================================================================
   Nusa Politik — js/kabinet.js   (v7.5)
   Sistem Pembentukan Kabinet & EXCO Negeri:
     1. State p.kabinet: hasGovernmentRole, roleLevel ('NONE'|'EXCO_NEGERI'|'TIMBALAN_MENTERI'|'MENTERI_PENUH'),
        portfolioName, governanceRating (0-100) dan tekananPolitik.
     2. Lobi Portfolio selepas menang kerusi (DUN -> EXCO; Parlimen -> Timbalan Menteri / Menteri Penuh),
        menggunakan Pengaruh (IP) dan Dana. Hanya dibuka jika parti membentuk kerajaan (diputuskan oleh pru.js).
     3. v2.0: KPI Portfolio (label & arah), Dilema Menteri/EXCO (Tindakan Tegas vs Jalan Pintas Politik) yang menjejaskan
        populariti nasional dan risiko rombakan, serta Peruntukan Projek Pembangunan (CDF) ke kawasan sendiri -> IP.
     4. Acara pentadbiran bulanan: elaun (Dana & IP), isu kementerian, penarafan tadbir urus dan tekanan politik.
        Penarafan di bawah 30% dua bulan berturut-turut = rombakan kabinet (jawatan hilang).
   Andaian (laras dalam CONFIG): semua nilai ialah anggaran permainan. Tiada sistem kerajaan sebenar;
   jawatan kerajaan hanya memberi elaun dan acara pentadbiran.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikKabinet = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  function modul(nama, fail) {
    if (root[nama]) { return root[nama]; }
    try { if (typeof require === 'function') { return require('./' + fail); } } catch (e) { /* tidak dimuatkan */ }
    return null;
  }
  function DATA() { return modul('MyPolitikKabinetData', 'kabinet-data.js'); }
  function S() { return modul('MyPolitikSave', 'save.js'); }
  function ST() { return modul('MyPolitikStres', 'stress.js'); }
  function ET() { return modul('MyPolitikEtika', 'etika.js'); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  var rngLalai = Math.random;
  function rng(o) { return (o && o.rng) || rngLalai; }
  function antara(r, a, b) { return a + r() * (b - a); }

  var CONFIG = {
    LOBI_PERCUBAAN: 3, LOBI_GAGAL_PULANG: 0.5, HAD_PILIHAN: 5,                          // v7.42: had pilihan portfolio Parlimen dipaparkan
    RATING_AWAL: 50, TEKANAN_AWAL: 20,
    RATING_RENDAH: 30, BULAN_RENDAH_ROMBAK: 2,
    TEKANAN_TINGGI: 80, TEKANAN_SUSUT: 2,
    PELUANG_ACARA: 0.7,
    ROMBAK: { reputasi: -5 },
    POP_AWAL: 50, POP_RENDAH: 30, POP_IP_BAGI: 10, POP_IP_MIN: -3, POP_IP_MAKS: 5,       // populariti nasional -> bonus IP bulanan
    ROMBAK_AMBANG: 60, ROMBAK_SUSUT: 3, ROMBAK_POP_RENDAH: 4, ROMBAK_PELUANG_MIN: 0.1, ROMBAK_PELUANG_MAKS: 0.6,
    DILEMA_PELUANG: 0.5,                                                                  // sebahagian acara bulanan ialah dilema
    CDF: { BULANAN: { EXCO_NEGERI: 3000, TIMBALAN_MENTERI: 5000, MENTERI_PENUH: 8000, TIMBALAN_PM: 9000, PERDANA_MENTERI: 12000 }, TOPI_BULAN: 2, HAD_KALI: 2, RM_SEIP: 200,
           PILIHAN: [2000, 5000, 10000], KECIL: 2000, RATING_BESAR: -2, TEKANAN_BESAR: 3, ROMBAK_BESAR: 4, TERSADAI_RATING: -2 }
  };

  var TAHAP = {
    EXCO_NEGERI: { nama: 'EXCO Negeri', elaun: { myr: 1500, ip: 8 } },
    TIMBALAN_MENTERI: { nama: 'Timbalan Menteri', elaun: { myr: 2500, ip: 12 } },
    MENTERI_PENUH: { nama: 'Menteri Penuh', elaun: { myr: 4000, ip: 20 } },
    TIMBALAN_PM: { nama: 'Timbalan Perdana Menteri', elaun: { myr: 6000, ip: 25 } },        // v7.22: hanya melalui rundingan kerajaan (Presiden)
    PERDANA_MENTERI: { nama: 'Perdana Menteri', elaun: { myr: 8000, ip: 30 } }
  };
  var PORTFOLIO = {
    DUN: [
      { id: 'exco_kesihatan', tahap: 'EXCO_NEGERI', nama: 'EXCO Kesihatan & Kebajikan', ip: 100, myr: 1500, asas: 0.75, risiko: 'rendah' },
      { id: 'exco_pertanian', tahap: 'EXCO_NEGERI', nama: 'EXCO Pertanian & Industri Asas Tani', ip: 100, myr: 1500, asas: 0.75, risiko: 'rendah' },
      { id: 'exco_infra',     tahap: 'EXCO_NEGERI', nama: 'EXCO Infrastruktur & Kemudahan Awam', ip: 120, myr: 2000, asas: 0.65, risiko: 'sederhana' },
      { id: 'exco_pelancong', tahap: 'EXCO_NEGERI', nama: 'EXCO Pelancongan & Kebudayaan', ip: 120, myr: 2000, asas: 0.65, risiko: 'sederhana' },
      { id: 'exco_kewangan',  tahap: 'EXCO_NEGERI', nama: 'EXCO Kewangan Negeri', ip: 250, myr: 5000, asas: 0.35, risiko: 'tinggi' }
    ],
    PARLIMEN: [
      { id: 'tm_pendidikan', tahap: 'TIMBALAN_MENTERI', nama: 'Timbalan Menteri Pendidikan', ip: 250, myr: 4000, asas: 0.80, risiko: 'rendah' },
      { id: 'tm_kesihatan',  tahap: 'TIMBALAN_MENTERI', nama: 'Timbalan Menteri Kesihatan', ip: 280, myr: 4500, asas: 0.70, risiko: 'sederhana' },
      { id: 'tm_kewangan',   tahap: 'TIMBALAN_MENTERI', nama: 'Timbalan Menteri Kewangan', ip: 350, myr: 6000, asas: 0.60, risiko: 'tinggi' },
      { id: 'm_luarbandar',  tahap: 'MENTERI_PENUH', nama: 'Menteri Pembangunan Luar Bandar', ip: 550, myr: 9000, asas: 0.40, risiko: 'sederhana' },
      { id: 'm_pertanian',   tahap: 'MENTERI_PENUH', nama: 'Menteri Pertanian', ip: 600, myr: 10000, asas: 0.35, risiko: 'sederhana' }
    ]
  };
  /** v7.42: senarai portfolio Parlimen daripada data/kabinet-persekutuan.csv (IP perlu = lajur IP).
      Menteri Penuh = nilai CSV. Timbalan Menteri dijana daripada setiap Menteri (andaian: IP perlu = IP Menteri - 250, minimum 250).
      Kos IP = IP perlu; Dana, peluang asas dan risiko ditentukan oleh IP (andaian, laras di sini). */
  function jenisDariIP(ip) { return { myr: Math.round(ip * 16 / 500) * 500, asas: clamp(1.05 - ip * 0.0011, 0.3, 0.85), risiko: ip <= 350 ? 'rendah' : ip <= 550 ? 'sederhana' : 'tinggi' }; }
  function binaParlimen() {
    var D = DATA(); if (!D || !D.menteri || !D.menteri.length) { return null; }
    var out = [];
    D.menteri.forEach(function (m, i) {
      var tm = Math.max(250, m.ip - 250), a = jenisDariIP(m.ip), b = jenisDariIP(tm);
      out.push({ id: 'm_' + i, tahap: 'MENTERI_PENUH', nama: m.nama, ip: m.ip, myr: a.myr, asas: a.asas, risiko: a.risiko });
      out.push({ id: 'tm_' + i, tahap: 'TIMBALAN_MENTERI', nama: m.nama.replace(/^Menteri /, 'Timbalan Menteri '), ip: tm, myr: b.myr, asas: b.asas, risiko: b.risiko });
    });
    return out;
  }
  var DARI_CSV = binaParlimen(); if (DARI_CSV) { PORTFOLIO.PARLIMEN = DARI_CSV; }
  function cariPortfolio(id) {
    var s = PORTFOLIO.DUN.concat(PORTFOLIO.PARLIMEN);
    for (var i = 0; i < s.length; i++) { if (s[i].id === id) { return s[i]; } }
    return null;
  }

  /* acara pentadbiran: kesan = { rating, tekanan, myr, ip, stress, rep } ; rawak = { p, jaya, gagal } */
  var ACARA = [
    { id: 'tender', ikon: '📑', tajuk: 'Isu Tender Projek', huraian: 'Sebuah syarikat berkaitan rakan parti menawarkan "terima kasih" jika projek pembinaan sekolah diberikan tanpa tender terbuka.',
      pilihan: [
        { id: 'beri', label: 'Beri tanpa tender', kesan: { myr: 8000, rating: -12, tekanan: 6 }, etika: { risiko: 12, lapor: { peluang: 35, berat: 2, perkara: 'Pemberian projek tanpa tender terbuka', fasal: 'Fasal 20.13' } } },
        { id: 'terbuka', label: 'Tender terbuka', kesan: { rating: 8, tekanan: 5 } },
        { id: 'sprm', label: 'Rujuk SPRM', kesan: { rating: 5, tekanan: 3, rep: 2 } }] },
    { id: 'krisis', ikon: '🚨', tajuk: 'Krisis Kementerian', huraian: 'Isu besar di bawah portfolio anda tular di media sosial. Rakyat menuntut jawapan.',
      pilihan: [
        { id: 'sidang', label: 'Tampil sidang media', kesan: { myr: -500, rating: 6, stress: 6 } },
        { id: 'salah', label: 'Salahkan pegawai bawahan', kesan: { rating: -10, rep: -3 } },
        { id: 'diam', label: 'Berdiam diri', kesan: { rating: -6, tekanan: 10 } }] },
    { id: 'lawatan', ikon: '✈️', tajuk: 'Lawatan Rasmi', huraian: 'Anda dijemput mewakili kerajaan dalam lawatan rasmi bagi memperkukuh kerjasama.',
      pilihan: [
        { id: 'pergi', label: 'Sertai rombongan penuh', kesan: { myr: -3000, ip: 25, rating: 3 } },
        { id: 'ringkas', label: 'Wakil ringkas', kesan: { myr: -1000, ip: 10, rating: 1 } },
        { id: 'tolak', label: 'Tolak, fokus kerja dalam negara', kesan: { rating: 2, stress: -2 } }] },
    { id: 'projek', ikon: '🏗️', tajuk: 'Merasmikan Projek', huraian: 'Satu projek komuniti di bawah kementerian anda siap dan menunggu perasmian.',
      pilihan: [
        { id: 'besar', label: 'Majlis besar-besaran', kesan: { myr: -2500, rating: 6, ip: 15 } },
        { id: 'sederhana', label: 'Majlis ringkas bersama penduduk', kesan: { myr: -600, rating: 4 } },
        { id: 'wakil', label: 'Serah kepada pegawai', kesan: { rating: 0, tekanan: 3 } }] },
    { id: 'audit', ikon: '🔎', tajuk: 'Laporan Ketua Audit Negara', huraian: 'Laporan audit mendedahkan kelemahan tadbir urus dalam beberapa projek kementerian.',
      pilihan: [
        { id: 'baiki', label: 'Umum pelan pemulihan', kesan: { myr: -1500, rating: 5, tekanan: 2 } },
        { id: 'jawab', label: 'Pertahankan keputusan', rawak: { p: 0.5, jaya: { rating: 3 }, gagal: { rating: -10, tekanan: 8 } } },
        { id: 'abai', label: 'Abaikan laporan', kesan: { rating: -8, tekanan: 8 } }] },
    { id: 'banjir', ikon: '🌊', tajuk: 'Bantuan Banjir', huraian: 'Banjir melanda sebahagian kawasan. Rakyat menunggu bantuan segera.',
      pilihan: [
        { id: 'turun', label: 'Turun padang & kerah bantuan', kesan: { myr: -2000, rating: 7, stress: 5 } },
        { id: 'arah', label: 'Arahkan jabatan dari pejabat', kesan: { rating: 1 } },
        { id: 'lewat', label: 'Lewat bertindak', kesan: { rating: -9, tekanan: 9 } }] },
    { id: 'media', ikon: '📰', tajuk: 'Tekanan Media', huraian: 'Media memetik dakwaan pembangkang bahawa prestasi anda mengecewakan.',
      pilihan: [
        { id: 'temuramah', label: 'Beri temu ramah terbuka', rawak: { p: 0.6, jaya: { rating: 5, tekanan: -4 }, gagal: { rating: -5, tekanan: 5 } } },
        { id: 'kenyataan', label: 'Keluarkan kenyataan bertulis', kesan: { rating: 2 } },
        { id: 'abai', label: 'Abaikan', kesan: { tekanan: 5 } }] },
    { id: 'ngo', ikon: '🤝', tajuk: 'Kerjasama NGO', huraian: 'Sebuah NGO menawarkan kerjasama untuk program kebajikan dalam kawasan anda.',
      pilihan: [
        { id: 'sokong', label: 'Terima & sumbang peruntukan', kesan: { myr: -1500, rating: 5, rep: 1 } },
        { id: 'terima', label: 'Terima tanpa peruntukan', kesan: { rating: 2 } },
        { id: 'tolak', label: 'Tolak kerjasama', kesan: { rating: -2 } }] },
    /* --- DILEMA v2.0: pop = populariti nasional, rombak = risiko rombakan kabinet --- */
    { id: 'dilema_subsidi', dilema: true, ikon: '⚖️', tajuk: 'Dilema: Subsidi Tidak Tepat Sasaran', huraian: 'Kajian dalaman mendapati sebahagian subsidi kementerian dinikmati golongan berkemampuan. Menyusunnya semula pasti mengundang rungutan.',
      pilihan: [
        { id: 'tegas', label: 'Tindakan Tegas: sasarkan semula subsidi', kesan: { myr: 3000, rating: 7, pop: -6, rombak: 6, tekanan: 4 } },
        { id: 'pintas', label: 'Jalan Pintas Politik: kekalkan subsidi demi undi', kesan: { myr: -3000, rating: -5, pop: 5, rombak: -3 } }] },
    { id: 'dilema_kontraktor', dilema: true, ikon: '⚖️', tajuk: 'Dilema: Projek Terbengkalai', huraian: 'Sebuah projek kementerian lewat berbulan-bulan. Kontraktornya mempunyai hubungan rapat dengan pemimpin kanan parti.',
      pilihan: [
        { id: 'tegas', label: 'Tindakan Tegas: saman & ambil alih projek', kesan: { rating: 9, pop: 3, rombak: 10, tekanan: 5, stress: 4 } },
        { id: 'pintas', label: 'Jalan Pintas Politik: beri lanjutan tanpa denda', kesan: { rating: -6, pop: -2, rombak: -3 } }] },
    { id: 'dilema_kroni', dilema: true, ikon: '⚖️', tajuk: 'Dilema: Arahan Pelantikan', huraian: 'Seorang pemimpin kanan "mencadangkan" seorang rakan rapat dilantik mengetuai agensi di bawah anda, walaupun calon lain lebih layak.',
      pilihan: [
        { id: 'tegas', label: 'Tindakan Tegas: lantik mengikut merit', kesan: { rating: 6, pop: 5, rombak: 12, tekanan: 6 } },
        { id: 'pintas', label: 'Jalan Pintas Politik: lantik rakan pemimpin itu', rawak: { p: 0.6, jaya: { rating: -2, rombak: -8 }, gagal: { rating: -10, pop: -10, rombak: 15, tekanan: 6 } } }] },
    { id: 'dilema_keselamatan', dilema: true, ikon: '⚖️', tajuk: 'Dilema: Insiden Keselamatan Awam', huraian: 'Satu kes keselamatan awam di bawah selia kementerian mula dihidu media. Mendedahkannya segera boleh memalukan kerajaan.',
      pilihan: [
        { id: 'tegas', label: 'Tindakan Tegas: umum terbuka & ambil tindakan', kesan: { myr: -1000, rating: 6, pop: 4, rombak: 5, stress: 4 } },
        { id: 'pintas', label: 'Jalan Pintas Politik: tutup cerita senyap-senyap', rawak: { p: 0.5, jaya: { rating: -2, rombak: -3 }, gagal: { rating: -12, pop: -12, rombak: 18, tekanan: 8 } } }] },
    { id: 'dilema_lebihan', dilema: true, ikon: '⚖️', tajuk: 'Dilema: Peruntukan Lebihan', huraian: 'Terdapat lebihan peruntukan hujung tahun. Perbendaharaan mahu ia dipulangkan; penyokong anda mahu ia disalurkan ke kawasan sendiri.',
      pilihan: [
        { id: 'tegas', label: 'Tindakan Tegas: pulangkan ke Perbendaharaan', kesan: { rating: 5, pop: 2, rombak: -2 } },
        { id: 'pintas', label: 'Jalan Pintas Politik: salur ke kawasan sendiri', kesan: { ip: 30, rating: -5, pop: -3, rombak: 6, tekanan: 3 } }] }
  ];
  function acaraId(id) { for (var i = 0; i < ACARA.length; i++) { if (ACARA[i].id === id) { return ACARA[i]; } } return null; }

  function dasar() {
    return { hasGovernmentRole: false, roleLevel: 'NONE', portfolioName: '', portfolioId: '', governanceRating: CONFIG.RATING_AWAL, tekananPolitik: CONFIG.TEKANAN_AWAL,
      bulanBerjawatan: 0, ratingRendah: 0, lobi: null, acara: null, sejarah: [],
      popularitiNasional: CONFIG.POP_AWAL, risikoRombak: 0, ratingLalu: CONFIG.RATING_AWAL, cdfBaki: 0, cdfBulan: 0, cdfJumlah: 0 };
  }
  function getKabinet(p) {
    var b = dasar(), k = p && p.kabinet && typeof p.kabinet === 'object' ? p.kabinet : {};
    for (var f in b) { if (k[f] === undefined) { k[f] = b[f]; } }
    return k;
  }
  function simpan(k, kesan, opts) {
    opts = opts || {};
    var patch = { kabinet: k };
    if (opts.patch) { for (var f in opts.patch) { patch[f] = opts.patch[f]; } }
    return S().applyEffects(kesan || {}, { kiraTindakan: false, patch: patch, log: opts.log });
  }

  /* ---------- Lobi ---------- */
  function bukaLobi(sumber) {
    var p = S().loadPlayer(), k = getKabinet(p);
    if (k.hasGovernmentRole) { return { ok: false, ralat: 'Sudah memegang jawatan kerajaan.' }; }
    k.lobi = { sumber: sumber === 'DUN' ? 'DUN' : 'PARLIMEN', baki: CONFIG.LOBI_PERCUBAAN };
    var r = simpan(k, {}, { log: { tindakan: 'lobi_buka', nama: 'Lobi Portfolio Kerajaan dibuka', peringkat: 'ahli' } });
    return { ok: !!(r && r.ok) };
  }
  function peluang(p, def) {
    return clamp(def.asas + ((Number(p.ip) || 0) - def.ip) / (def.ip * 8) + ((Number(p.reputasi) || 50) - 50) * 0.003, 0.1, 0.95);
  }
  /** v7.42: Parlimen: hanya portfolio dengan IP perlu <= IP pemain; paling HAMPIR dengan IP pemain dahulu, maks HAD_PILIHAN (rawak tetap bagi IP sama). */
  function kolamPaparan(p, sumber) {
    var semua = PORTFOLIO[sumber];
    if (sumber !== 'PARLIMEN' || !DARI_CSV) { return semua; }
    var ip = Number(p.ip) || 0, rg = S().rngBerbenih(String(p.id) + '|kabinet|' + p.tahun), kunci = {};
    semua.forEach(function (d) { kunci[d.id] = rg(); });
    return semua.filter(function (d) { return d.ip <= ip; })
      .sort(function (x, y) { return (y.ip - x.ip) || (kunci[x.id] - kunci[y.id]); })
      .slice(0, CONFIG.HAD_PILIHAN);
  }
  function senaraiPortfolio(p) {
    var k = getKabinet(p);
    if (!k.lobi) { return []; }
    return kolamPaparan(p, k.lobi.sumber).map(function (d) {
      var sebab = [];
      if ((Number(p.ip) || 0) < d.ip) { sebab.push('IP tidak cukup (perlu ' + d.ip + ')'); }
      if ((Number(p.myr) || 0) < d.myr) { sebab.push('Dana tidak cukup (perlu RM ' + d.myr.toLocaleString('ms-MY') + ')'); }
      return { id: d.id, nama: d.nama, tahap: d.tahap, tahapNama: TAHAP[d.tahap].nama, ip: d.ip, myr: d.myr, peluang: Math.round(peluang(p, d) * 100),
        elaun: TAHAP[d.tahap].elaun, risiko: d.risiko, boleh: !sebab.length, sebab: sebab.join('; ') };
    });
  }
  function lobiPortfolio(id, o) {
    var p = S().loadPlayer(), k = getKabinet(p), d = cariPortfolio(id), r = rng(o);
    if (!k.lobi || k.lobi.baki <= 0) { return { ok: false, ralat: 'Lobi tidak tersedia.' }; }
    if (!d || PORTFOLIO[k.lobi.sumber].indexOf(d) < 0) { return { ok: false, ralat: 'Portfolio tidak tersedia.' }; }
    var s = senaraiPortfolio(p).filter(function (x) { return x.id === id; })[0];
    if (!s) { return { ok: false, ralat: 'Portfolio tidak tersedia pada IP anda sekarang.' }; }
    if (!s.boleh) { return { ok: false, ralat: s.sebab }; }
    var lulus = r() < peluang(p, d), kes;
    k.lobi.baki -= 1;
    if (lulus) {
      kes = { ip: -d.ip, myr: -d.myr };
      k.hasGovernmentRole = true; k.roleLevel = d.tahap; k.portfolioName = d.nama; k.portfolioId = d.id; k.governanceRating = CONFIG.RATING_AWAL; k.tekananPolitik = CONFIG.TEKANAN_AWAL;
      k.bulanBerjawatan = 0; k.ratingRendah = 0; k.lobi = null; k.acara = null;
      k.popularitiNasional = CONFIG.POP_AWAL; k.risikoRombak = 0; k.ratingLalu = CONFIG.RATING_AWAL; k.cdfBaki = CONFIG.CDF.BULANAN[d.tahap]; k.cdfBulan = 0; k.cdfJumlah = 0;
      k.sejarah = (k.sejarah || []).concat([{ tahun: p.tahun, bulan: p.bulan, nama: d.nama, hasil: 'dilantik' }]).slice(-10);
      var res = simpan(k, kes, { log: { tindakan: 'lobi_jaya', nama: 'Dilantik: ' + d.nama, peringkat: 'ahli' } });
      if (!res.ok) { return { ok: false, ralat: res.ralat }; }
      return { ok: true, dilantik: true, mesej: 'Dilantik sebagai ' + d.nama + '. Elaun bulanan bermula.', portfolio: d.nama };
    }
    var h = CONFIG.LOBI_GAGAL_PULANG;
    kes = { ip: -Math.round(d.ip * (1 - h)), myr: -Math.round(d.myr * (1 - h)) };
    var tutup = k.lobi.baki <= 0;
    if (tutup) { k.lobi = null; }
    var rs = simpan(k, kes, { log: { tindakan: 'lobi_gagal', nama: 'Lobi gagal: ' + d.nama, peringkat: 'ahli' } });
    if (!rs.ok) { return { ok: false, ralat: rs.ralat }; }
    return { ok: true, dilantik: false, tutup: tutup, mesej: 'Lobi ' + d.nama + ' gagal. Separuh kos hilang.' + (tutup ? ' Peluang lobi penggal ini habis.' : ' Baki percubaan: ' + k.lobi.baki + '.') };
  }
  /** v7.22: Presiden parti dilantik terus ke jawatan tertinggi kerajaan (tanpa lobi/kos). tahap: 'PERDANA_MENTERI' | 'TIMBALAN_PM'. */
  function lantikKanan(tahap) {
    var t = TAHAP[tahap];
    if (tahap !== 'PERDANA_MENTERI' && tahap !== 'TIMBALAN_PM') { return { ok: false, ralat: 'Jawatan tidak sah.' }; }
    var p = S().loadPlayer(), k = getKabinet(p);
    k.hasGovernmentRole = true; k.roleLevel = tahap; k.portfolioName = t.nama; k.portfolioId = ''; k.governanceRating = CONFIG.RATING_AWAL; k.tekananPolitik = CONFIG.TEKANAN_AWAL;
    k.bulanBerjawatan = 0; k.ratingRendah = 0; k.lobi = null; k.acara = null;
    k.popularitiNasional = CONFIG.POP_AWAL; k.risikoRombak = 0; k.ratingLalu = CONFIG.RATING_AWAL; k.cdfBaki = CONFIG.CDF.BULANAN[tahap]; k.cdfBulan = 0; k.cdfJumlah = 0;
    k.sejarah = (k.sejarah || []).concat([{ tahun: p.tahun, bulan: p.bulan, nama: t.nama, hasil: 'dilantik' }]).slice(-10);
    var res = simpan(k, {}, { log: { tindakan: 'lantik_kanan', nama: 'Dilantik: ' + t.nama, peringkat: 'ahli' } });
    return { ok: !!(res && res.ok), ralat: res && res.ralat, mesej: 'Dilantik sebagai ' + t.nama + '. Elaun bulanan bermula.' };
  }
  function lepaskanLobi() {
    var p = S().loadPlayer(), k = getKabinet(p);
    if (!k.lobi) { return { ok: false }; }
    k.lobi = null;
    return { ok: !!simpan(k, {}, { log: { tindakan: 'lobi_lepas', nama: 'Tidak melobi portfolio', peringkat: 'ahli' } }).ok };
  }

  /* ---------- Tadbir urus bulanan ---------- */
  function laras(d) {
    var p = S() && S().loadPlayer();
    if (!p) { return { ok: false }; }
    var k = getKabinet(p);
    if (!k.hasGovernmentRole) { return { ok: false }; }
    k.governanceRating = clamp(k.governanceRating + (d.rating || 0), 0, 100);
    k.tekananPolitik = clamp(k.tekananPolitik + (d.tekanan || 0), 0, 100);
    if (d.pop) { k.popularitiNasional = clamp(k.popularitiNasional + d.pop, 0, 100); }          // v7.55: Dewan Rakyat
    if (d.rombak) { k.risikoRombak = clamp(k.risikoRombak + d.rombak, 0, 100); }
    simpan(k, {});
    return { ok: true };
  }
  function tamatPenggal() {
    var p = S() && S().loadPlayer();
    if (!p) { return null; }
    var k = getKabinet(p);
    if (!k.hasGovernmentRole && !k.lobi) { return null; }
    var nama = k.portfolioName;
    k.hasGovernmentRole = false; k.roleLevel = 'NONE'; k.portfolioName = ''; k.portfolioId = ''; k.acara = null; k.lobi = null; k.bulanBerjawatan = 0; k.ratingRendah = 0;
    simpan(k, {}, { log: { tindakan: 'kabinet_tamat', nama: 'Penggal tamat' + (nama ? ': ' + nama : ''), peringkat: 'ahli' } });
    return { mesej: nama ? 'Parlimen/Dewan dibubarkan. Jawatan ' + nama + ' tamat bersama penggal.' : '' };
  }
  function jana(k, o) {
    var r = rng(o);
    if (r() > CONFIG.PELUANG_ACARA) { return null; }
    var dilema = ACARA.filter(function (a) { return a.dilema; }), biasa = ACARA.filter(function (a) { return !a.dilema; });
    var kolam = r() < CONFIG.DILEMA_PELUANG ? dilema : biasa;
    return { id: kolam[Math.floor(r() * kolam.length)].id };
  }
  /* ---------- KPI ---------- */
  function labelKPI(n) { return n >= 80 ? 'Cemerlang' : n >= 60 ? 'Baik' : n >= 40 ? 'Sederhana' : n >= CONFIG.RATING_RENDAH ? 'Lemah' : 'Kritikal'; }
  function gugurkan(p, k, sebab) {
    var nama = k.portfolioName;
    k.sejarah = (k.sejarah || []).concat([{ tahun: p.tahun, bulan: p.bulan, nama: nama, hasil: 'digugurkan' }]).slice(-10);
    k.hasGovernmentRole = false; k.roleLevel = 'NONE'; k.portfolioName = ''; k.portfolioId = ''; k.bulanBerjawatan = 0; k.ratingRendah = 0; k.acara = null; k.risikoRombak = 0; k.cdfBaki = 0; k.cdfBulan = 0;
    simpan(k, { reputasi: CONFIG.ROMBAK.reputasi }, { log: { tindakan: 'rombakan', nama: 'Rombakan kabinet: digugurkan daripada ' + nama, peringkat: 'ahli' } });
    return { jenis: 'kabinet_rombak', mesej: 'Rombakan kabinet! ' + sebab + ' Anda digugurkan daripada ' + nama + '. Elaun dihentikan dan Reputasi -5.' };
  }
  function prosesBulan(o) {
    var p = S() && S().loadPlayer(), ev = [];
    if (!p || p.tamat) { return { peristiwa: ev }; }
    var k = getKabinet(p);
    if (!k.hasGovernmentRole) { return { peristiwa: ev }; }
    var tahap = TAHAP[k.roleLevel], kes = { myr: tahap.elaun.myr, ip: tahap.elaun.ip };
    var cdf = CONFIG.CDF, cdfHad = cdf.BULANAN[k.roleLevel] * cdf.TOPI_BULAN;
    k.bulanBerjawatan += 1; k.ratingLalu = k.governanceRating; k.cdfBulan = 0;
    if (k.cdfBaki >= cdfHad) { k.governanceRating = clamp(k.governanceRating + cdf.TERSADAI_RATING, 0, 100); ev.push({ jenis: 'kabinet', mesej: 'Peruntukan projek (CDF) tersadai tanpa digunakan (Tadbir Urus ' + cdf.TERSADAI_RATING + '%).' }); }
    else { k.cdfBaki = Math.min(cdfHad, k.cdfBaki + cdf.BULANAN[k.roleLevel]); }
    k.popularitiNasional = k.popularitiNasional + Math.sign(CONFIG.POP_AWAL - k.popularitiNasional);          // populariti beransur pulih ke 50
    k.risikoRombak = clamp(k.risikoRombak - CONFIG.ROMBAK_SUSUT + (k.popularitiNasional < CONFIG.POP_RENDAH ? CONFIG.ROMBAK_POP_RENDAH : 0), 0, 100);
    kes.ip += clamp(Math.round((k.popularitiNasional - CONFIG.POP_AWAL) / CONFIG.POP_IP_BAGI), CONFIG.POP_IP_MIN, CONFIG.POP_IP_MAKS);
    if (k.acara) {                                                   // acara bulan lepas tidak dijawab: dianggap berdiam diri
      k.governanceRating = clamp(k.governanceRating - 6, 0, 100); k.tekananPolitik = clamp(k.tekananPolitik + 10, 0, 100);
      ev.push({ jenis: 'kabinet', mesej: 'Isu kementerian tidak dijawab: dianggap berdiam diri (Tadbir Urus -6%, Tekanan +10).' });
      k.acara = null;
    }
    k.tekananPolitik = clamp(k.tekananPolitik - CONFIG.TEKANAN_SUSUT, 0, 100);
    if (k.tekananPolitik >= CONFIG.TEKANAN_TINGGI) { k.governanceRating = clamp(k.governanceRating - 3, 0, 100); ev.push({ jenis: 'kabinet', mesej: 'Tekanan politik tinggi menjejas penarafan anda (-3%).' }); }
    if (k.governanceRating < CONFIG.RATING_RENDAH) { k.ratingRendah += 1; } else { k.ratingRendah = 0; }
    if (k.ratingRendah >= CONFIG.BULAN_RENDAH_ROMBAK) {
      ev.push(gugurkan(p, k, 'Penarafan tadbir urus terlalu rendah.'));
      return { peristiwa: ev };
    }
    if (k.risikoRombak >= CONFIG.ROMBAK_AMBANG && rng(o)() < clamp((k.risikoRombak - 50) / 100, CONFIG.ROMBAK_PELUANG_MIN, CONFIG.ROMBAK_PELUANG_MAKS)) {
      ev.push(gugurkan(p, k, 'Risiko rombakan memuncak akibat keputusan politik anda.'));
      return { peristiwa: ev };
    }
    else if (k.risikoRombak >= CONFIG.ROMBAK_AMBANG) { ev.push({ jenis: 'kabinet', mesej: 'Desas-desus rombakan kabinet semakin kuat (risiko ' + Math.round(k.risikoRombak) + '%).' }); }
    k.acara = jana(k, o);
    var ipE = kes.ip; delete kes.ip;
    var res = simpan(k, kes, { patch: { ip: Math.max(0, (Number(p.ip) || 0) + ipE) }, log: { tindakan: 'elaun_kerajaan', nama: 'Elaun ' + tahap.nama + ': +RM ' + tahap.elaun.myr + ', +' + tahap.elaun.ip + ' IP', peringkat: 'bulan' } });
    if (k.acara) { ev.push({ jenis: 'kabinet_acara', mesej: 'Isu kementerian baharu menunggu keputusan anda.' }); }
    return { peristiwa: ev };
  }
  function acaraSemasa(p) {
    var k = getKabinet(p);
    if (!k.hasGovernmentRole || !k.acara) { return null; }
    var d = acaraId(k.acara.id);
    if (!d) { return null; }
    return { id: d.id, ikon: d.ikon, tajuk: d.tajuk, huraian: d.huraian, pilihan: d.pilihan.map(function (c) {
      return { id: c.id, label: c.label, kesan: c.kesan || null, rawak: c.rawak || null, boleh: !(c.kesan && c.kesan.myr && (Number(p.myr) || 0) + c.kesan.myr < 0), sebab: 'Dana tidak cukup.' };
    }) };
  }
  function jawabAcara(pilihanId, o) {
    var p = S().loadPlayer(), k = getKabinet(p), r = rng(o);
    if (!k.hasGovernmentRole || !k.acara) { return { ok: false, ralat: 'Tiada isu menunggu.' }; }
    var d = acaraId(k.acara.id), c = d && d.pilihan.filter(function (x) { return x.id === pilihanId; })[0];
    if (!c) { return { ok: false, ralat: 'Pilihan tidak sah.' }; }
    var kes = {}, patch = {}, mesej = c.label + '.', jaya = null, x;
    if (c.rawak) { jaya = r() < c.rawak.p; x = jaya ? c.rawak.jaya : c.rawak.gagal; mesej += jaya ? ' Berjaya!' : ' Gagal.'; } else { x = c.kesan || {}; }
    if (x.myr && (Number(p.myr) || 0) + x.myr < 0) { return { ok: false, ralat: 'Dana tidak mencukupi.' }; }
    if (x.myr) { kes.myr = x.myr; }
    var ipX = x.ip || 0;
    if (x.rep) { kes.reputasi = x.rep; }
    k.governanceRating = clamp(k.governanceRating + (x.rating || 0), 0, 100);
    k.tekananPolitik = clamp(k.tekananPolitik + (x.tekanan || 0), 0, 100);
    k.popularitiNasional = clamp(k.popularitiNasional + (x.pop || 0), 0, 100);
    k.risikoRombak = clamp(k.risikoRombak + (x.rombak || 0), 0, 100);
    if (c.etika) { var Et = ET(); if (Et && Et.selepasAcara) { var eo = Et.selepasAcara(p, c.etika, { rng: r }); patch.etika = eo.etika; if (eo.mesej) { mesej += eo.mesej; } } }
    k.acara = null;
    if (ipX) { patch.ip = Math.max(0, (Number(p.ip) || 0) + ipX); }
    var res = simpan(k, kes, { patch: patch, log: { tindakan: 'acara_kabinet', nama: d.tajuk + ': ' + c.label, peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    if (x.stress) { var s = ST(); if (s && s.laras) { s.laras({ stress: x.stress }); } }
    return { ok: true, mesej: mesej, rating: x.rating || 0, tekanan: x.tekanan || 0, pop: x.pop || 0, rombak: x.rombak || 0, jaya: jaya };
  }

  /* ---------- Peruntukan Projek Pembangunan (CDF) ---------- */
  function pilihanCDF(p) {
    var k = getKabinet(p), c = CONFIG.CDF;
    return c.PILIHAN.map(function (n) {
      var sebab = !k.hasGovernmentRole ? 'Tiada jawatan kerajaan.' : k.cdfBulan >= c.HAD_KALI ? 'Had ' + c.HAD_KALI + ' kali sebulan dicapai.' : n > k.cdfBaki ? 'Baki peruntukan tidak cukup.' : '';
      return { jumlah: n, ip: Math.round(n / c.RM_SEIP), besar: n > c.KECIL, boleh: !sebab, sebab: sebab };
    });
  }
  function salurCDF(jumlah, o) {
    var p = S().loadPlayer(), k = getKabinet(p), c = CONFIG.CDF, pil = pilihanCDF(p).filter(function (x) { return x.jumlah === Number(jumlah); })[0];
    if (!pil) { return { ok: false, ralat: 'Jumlah tidak sah.' }; }
    if (!pil.boleh) { return { ok: false, ralat: pil.sebab }; }
    k.cdfBaki -= pil.jumlah; k.cdfBulan += 1; k.cdfJumlah = (k.cdfJumlah || 0) + pil.jumlah;
    var kes = {}, mesej = 'RM ' + pil.jumlah.toLocaleString('ms-MY') + ' disalurkan ke kawasan anda: IP +' + pil.ip + '.';
    if (pil.besar) {
      k.governanceRating = clamp(k.governanceRating + c.RATING_BESAR, 0, 100); k.tekananPolitik = clamp(k.tekananPolitik + c.TEKANAN_BESAR, 0, 100); k.risikoRombak = clamp(k.risikoRombak + c.ROMBAK_BESAR, 0, 100);
      mesej += ' Peruntukan besar menjolok mata (Tadbir Urus ' + c.RATING_BESAR + '%, risiko rombakan +' + c.ROMBAK_BESAR + ').';
    }
    var res = simpan(k, kes, { patch: { ip: Math.max(0, (Number(p.ip) || 0) + pil.ip) }, log: { tindakan: 'cdf_salur', nama: 'Peruntukan CDF RM ' + pil.jumlah + ' ke kawasan: +' + pil.ip + ' IP', peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    return { ok: true, mesej: mesej, ip: pil.ip, jumlah: pil.jumlah };
  }

  function ringkasan(p) {
    var k = getKabinet(p), t = TAHAP[k.roleLevel] || null;
    return { hasGovernmentRole: k.hasGovernmentRole, roleLevel: k.roleLevel, tahapNama: t ? t.nama : '', portfolioName: k.portfolioName, governanceRating: k.governanceRating,
      tekananPolitik: k.tekananPolitik, elaun: t ? t.elaun : null, bulanBerjawatan: k.bulanBerjawatan, ratingRendah: k.ratingRendah, lobi: k.lobi, acara: acaraSemasa(p),
      sejarah: k.sejarah, portfolio: senaraiPortfolio(p),
      kpiLabel: labelKPI(k.governanceRating), ratingLalu: k.ratingLalu, arah: k.governanceRating - k.ratingLalu, popularitiNasional: k.popularitiNasional, risikoRombak: k.risikoRombak,
      cdfBaki: k.cdfBaki, cdfBulan: k.cdfBulan, cdfHad: CONFIG.CDF.HAD_KALI, cdfPilihan: pilihanCDF(p) };
  }

  return {
    CONFIG: CONFIG, TAHAP: TAHAP, PORTFOLIO: PORTFOLIO, ACARA: ACARA,
    setRng: function (f) { rngLalai = f || Math.random; },
    getKabinet: getKabinet, lantikKanan: lantikKanan, bukaLobi: bukaLobi, senaraiPortfolio: senaraiPortfolio, lobiPortfolio: lobiPortfolio, lepaskanLobi: lepaskanLobi, salurCDF: salurCDF, pilihanCDF: pilihanCDF, labelKPI: labelKPI,
    laras: laras, tamatPenggal: tamatPenggal, prosesBulan: prosesBulan, acaraSemasa: acaraSemasa, jawabAcara: jawabAcara, ringkasan: ringkasan
  };
});
