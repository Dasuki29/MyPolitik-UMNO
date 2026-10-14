/* ==========================================================================
   Nusa Politik — js/kabinet.js   (v7.4)
   Sistem Pembentukan Kabinet & EXCO Negeri:
     1. State p.kabinet: hasGovernmentRole, roleLevel ('NONE'|'EXCO_NEGERI'|'TIMBALAN_MENTERI'|'MENTERI_PENUH'),
        portfolioName, governanceRating (0-100) dan tekananPolitik.
     2. Lobi Portfolio selepas menang kerusi (DUN -> EXCO; Parlimen -> Timbalan Menteri / Menteri Penuh),
        menggunakan Pengaruh (IP) dan Dana. Hanya dibuka jika parti membentuk kerajaan (diputuskan oleh pru.js).
     3. Acara pentadbiran bulanan: elaun (Dana & IP), isu kementerian, penarafan tadbir urus dan tekanan politik.
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
  function S() { return modul('MyPolitikSave', 'save.js'); }
  function ST() { return modul('MyPolitikStres', 'stress.js'); }
  function ET() { return modul('MyPolitikEtika', 'etika.js'); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  var rngLalai = Math.random;
  function rng(o) { return (o && o.rng) || rngLalai; }
  function antara(r, a, b) { return a + r() * (b - a); }

  var CONFIG = {
    LOBI_PERCUBAAN: 3, LOBI_GAGAL_PULANG: 0.5,
    RATING_AWAL: 50, TEKANAN_AWAL: 20,
    RATING_RENDAH: 30, BULAN_RENDAH_ROMBAK: 2,
    TEKANAN_TINGGI: 80, TEKANAN_SUSUT: 2,
    PELUANG_ACARA: 0.7,
    ROMBAK: { reputasi: -5 }
  };

  var TAHAP = {
    EXCO_NEGERI: { nama: 'EXCO Negeri', elaun: { myr: 1500, ip: 8 } },
    TIMBALAN_MENTERI: { nama: 'Timbalan Menteri', elaun: { myr: 2500, ip: 12 } },
    MENTERI_PENUH: { nama: 'Menteri Penuh', elaun: { myr: 4000, ip: 20 } }
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
        { id: 'tolak', label: 'Tolak kerjasama', kesan: { rating: -2 } }] }
  ];
  function acaraId(id) { for (var i = 0; i < ACARA.length; i++) { if (ACARA[i].id === id) { return ACARA[i]; } } return null; }

  function dasar() {
    return { hasGovernmentRole: false, roleLevel: 'NONE', portfolioName: '', portfolioId: '', governanceRating: CONFIG.RATING_AWAL, tekananPolitik: CONFIG.TEKANAN_AWAL,
      bulanBerjawatan: 0, ratingRendah: 0, lobi: null, acara: null, sejarah: [] };
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
  function senaraiPortfolio(p) {
    var k = getKabinet(p);
    if (!k.lobi) { return []; }
    return PORTFOLIO[k.lobi.sumber].map(function (d) {
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
    if (!s.boleh) { return { ok: false, ralat: s.sebab }; }
    var lulus = r() < peluang(p, d), kes;
    k.lobi.baki -= 1;
    if (lulus) {
      kes = { ip: -d.ip, myr: -d.myr };
      k.hasGovernmentRole = true; k.roleLevel = d.tahap; k.portfolioName = d.nama; k.portfolioId = d.id; k.governanceRating = CONFIG.RATING_AWAL; k.tekananPolitik = CONFIG.TEKANAN_AWAL;
      k.bulanBerjawatan = 0; k.ratingRendah = 0; k.lobi = null; k.acara = null;
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
    return { id: ACARA[Math.floor(r() * ACARA.length)].id };
  }
  function prosesBulan(o) {
    var p = S() && S().loadPlayer(), ev = [];
    if (!p || p.tamat) { return { peristiwa: ev }; }
    var k = getKabinet(p);
    if (!k.hasGovernmentRole) { return { peristiwa: ev }; }
    var tahap = TAHAP[k.roleLevel], kes = { myr: tahap.elaun.myr, ip: tahap.elaun.ip };
    k.bulanBerjawatan += 1;
    if (k.acara) {                                                   // acara bulan lepas tidak dijawab: dianggap berdiam diri
      k.governanceRating = clamp(k.governanceRating - 6, 0, 100); k.tekananPolitik = clamp(k.tekananPolitik + 10, 0, 100);
      ev.push({ jenis: 'kabinet', mesej: 'Isu kementerian tidak dijawab: dianggap berdiam diri (Tadbir Urus -6%, Tekanan +10).' });
      k.acara = null;
    }
    k.tekananPolitik = clamp(k.tekananPolitik - CONFIG.TEKANAN_SUSUT, 0, 100);
    if (k.tekananPolitik >= CONFIG.TEKANAN_TINGGI) { k.governanceRating = clamp(k.governanceRating - 3, 0, 100); ev.push({ jenis: 'kabinet', mesej: 'Tekanan politik tinggi menjejas penarafan anda (-3%).' }); }
    if (k.governanceRating < CONFIG.RATING_RENDAH) { k.ratingRendah += 1; } else { k.ratingRendah = 0; }
    if (k.ratingRendah >= CONFIG.BULAN_RENDAH_ROMBAK) {
      var nama = k.portfolioName;
      k.sejarah = (k.sejarah || []).concat([{ tahun: p.tahun, bulan: p.bulan, nama: nama, hasil: 'digugurkan' }]).slice(-10);
      k.hasGovernmentRole = false; k.roleLevel = 'NONE'; k.portfolioName = ''; k.portfolioId = ''; k.bulanBerjawatan = 0; k.ratingRendah = 0; k.acara = null;
      simpan(k, { reputasi: CONFIG.ROMBAK.reputasi }, { log: { tindakan: 'rombakan', nama: 'Rombakan kabinet: digugurkan daripada ' + nama, peringkat: 'ahli' } });
      ev.push({ jenis: 'kabinet_rombak', mesej: 'Rombakan kabinet! Penarafan tadbir urus terlalu rendah; anda digugurkan daripada ' + nama + '. Elaun dihentikan dan Reputasi -5.' });
      return { peristiwa: ev };
    }
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
    if (c.etika) { var Et = ET(); if (Et && Et.selepasAcara) { var eo = Et.selepasAcara(p, c.etika, { rng: r }); patch.etika = eo.etika; if (eo.mesej) { mesej += eo.mesej; } } }
    k.acara = null;
    if (ipX) { patch.ip = Math.max(0, (Number(p.ip) || 0) + ipX); }
    var res = simpan(k, kes, { patch: patch, log: { tindakan: 'acara_kabinet', nama: d.tajuk + ': ' + c.label, peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    if (x.stress) { var s = ST(); if (s && s.laras) { s.laras({ stress: x.stress }); } }
    return { ok: true, mesej: mesej, rating: x.rating || 0, tekanan: x.tekanan || 0, jaya: jaya };
  }

  function ringkasan(p) {
    var k = getKabinet(p), t = TAHAP[k.roleLevel] || null;
    return { hasGovernmentRole: k.hasGovernmentRole, roleLevel: k.roleLevel, tahapNama: t ? t.nama : '', portfolioName: k.portfolioName, governanceRating: k.governanceRating,
      tekananPolitik: k.tekananPolitik, elaun: t ? t.elaun : null, bulanBerjawatan: k.bulanBerjawatan, ratingRendah: k.ratingRendah, lobi: k.lobi, acara: acaraSemasa(p),
      sejarah: k.sejarah, portfolio: senaraiPortfolio(p) };
  }

  return {
    CONFIG: CONFIG, TAHAP: TAHAP, PORTFOLIO: PORTFOLIO, ACARA: ACARA,
    setRng: function (f) { rngLalai = f || Math.random; },
    getKabinet: getKabinet, bukaLobi: bukaLobi, senaraiPortfolio: senaraiPortfolio, lobiPortfolio: lobiPortfolio, lepaskanLobi: lepaskanLobi,
    laras: laras, tamatPenggal: tamatPenggal, prosesBulan: prosesBulan, acaraSemasa: acaraSemasa, jawabAcara: jawabAcara, ringkasan: ringkasan
  };
});
