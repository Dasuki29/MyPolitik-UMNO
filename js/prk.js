/* ==========================================================================
   Nusa Politik — js/prk.js   (v7.6)
   Sistem Pilihan Raya Kecil (PRK / By-Election):
     1. triggerByElection: kekosongan kerusi DUN / Parlimen pertengahan penggal (kematian atau peletakan jawatan penyandang).
     2. byElectionCampaign: kempen kilat 7 hari, kos dana tinggi, Stress naik pantas (kenaikan harian tetap + kos tindakan).
     3. Keputusan PRK dipengaruhi sentimen nasional semasa (reputasi anda, prestasi kerajaan, hanyutan rawak).
        Menang = ganjaran besar (IP, reputasi, sokongan akar umbi, kestabilan jawatan kerajaan).
        Kalah = penalti berat (lebih berat jika kerusi dipertahankan oleh parti).
   Andaian (semua boleh dilaras dalam CONFIG): kerusi kosong ialah kerusi DUN / Parlimen kawasan pemain; kelayakan calon sama seperti PRU
   (IP & jawatan); lawan hanya label simulasi; tiada rundingan 3-penjuru dalam PRK.
   State: p.prk = { sentimen, aktif, sejarah }.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikPRK = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  function modul(nama, fail) {
    if (root[nama]) { return root[nama]; }
    try { if (typeof require === 'function') { return require('./' + fail); } } catch (e) { /* tidak dimuatkan */ }
    return null;
  }
  function S() { return modul('MyPolitikSave', 'save.js'); }
  function ST() { return modul('MyPolitikStres', 'stress.js'); }
  function PRU() { return modul('MyPolitikPRU', 'pru.js'); }
  function KB() { return modul('MyPolitikKabinet', 'kabinet.js'); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function idx(p) { return (parseInt(p.tahun, 10) || 0) * 12 + (parseInt(p.bulan, 10) || 1); }
  var rngLalai = Math.random;
  function rng(o) { return (o && o.rng) || rngLalai; }
  function antara(r, a, b) { return a + r() * (b - a); }

  var CONFIG = {
    HARI: 7,
    PELUANG_BULAN: 0.02,                 // peluang kekosongan setiap bulan dalam tetingkap yang dibenarkan
    MIN_BULAN_SELEPAS_PRU: 12, MIN_BULAN_SEBELUM_PRU: 6,
    PELUANG_DUN: 0.6, PELUANG_KEMATIAN: 0.6, PELUANG_PERTAHAN: 0.65,
    DUN:      { minPeruntukan: 4000, pengundi: [22000, 34000], ganjaranIp: 250, penaltiIp: 180 },
    PARLIMEN: { minPeruntukan: 8000, pengundi: [60000, 95000], ganjaranIp: 350, penaltiIp: 250 },
    TERIMA_BONUS: 0.10,                  // Majlis Tertinggi lebih mudah meluluskan calon PRK
    STRESS_HARIAN: 2,                    // Stress naik pantas setiap hari kempen (selain kos tindakan)
    TEKANAN_LAWAN_HARIAN: 1.5, SKALA_GAIN: 0.85, DERMA_MAKS: 2, JENTERA_MIN: 35,
    STRESS_LETIH: 70, FAKTOR_LETIH: 0.7, // Stress tinggi melemahkan keberkesanan kempen
    SENTIMEN_MAKS: 20, SENTIMEN_KESAN: 0.25, SENTIMEN_SUSUT: 0.9, SENTIMEN_RAWAK: 3,
    MENANG: { reputasi: 4, akarUmbi: 5, ajk: 3, kabRating: 10, kabRombak: -15, kabPop: 5, stress: -4 },
    KALAH: { reputasi: -4, akarUmbi: -8, ajk: -5, kabRating: -12, kabRombak: 20, kabPop: -8, kabTekanan: 10, stress: 10, penaltiPertahan: 1.3 }
  };

  /* tindakan kempen kilat: lebih mahal, lebih intensif dan lebih memenatkan daripada PRU */
  var TINDAKAN = {
    ceramah: { id: 'ceramah', ikon: '🎤', nama: 'Ceramah Kilat', dana: 4500, jentera: -25, gain: [6, 14], stress: 8, pengganda: 'ceramah', perluJentera: true },
    ziarah:  { id: 'ziarah',  ikon: '🤝', nama: 'Ziarah Maraton', dana: 1200, jentera: -12, gain: [4, 9], stress: 4, pengganda: 'ziarah', perluJentera: true },
    digital: { id: 'digital', ikon: '📱', nama: 'Blitz Media Digital', dana: 2200, jentera: -10, gain: [5, 11], stress: 6, pengganda: 'digital' },
    rehat:   { id: 'rehat',   ikon: '⛺', nama: 'Rehatkan Jentera', dana: 0, jentera: 25, gain: [0, 0], stress: -4 },
    derma:   { id: 'derma',   ikon: '💰', nama: 'Kutip Derma Penyokong', dana: 0, jentera: 0, gain: [0, 0], stress: 2 }
  };
  var SEBAB = { kematian: 'Penyandang meninggal dunia', peletakan: 'Penyandang meletakkan jawatan' };

  /* ---------------------------------------------------------------- STATE */
  function dasar() { return { sentimen: 0, aktif: null, sejarah: [] }; }
  function getPRK(p) {
    var b = dasar(), x = p && p.prk && typeof p.prk === 'object' ? p.prk : {};
    for (var k in b) { if (x[k] === undefined) { x[k] = b[k]; } }
    return x;
  }
  function simpan(prk, kesan, opts) {
    opts = opts || {};
    var patch = { prk: prk };
    if (opts.patch) { for (var f in opts.patch) { patch[f] = opts.patch[f]; } }
    return S().applyEffects(kesan || {}, { kiraTindakan: false, patch: patch, log: opts.log });
  }
  function laras(d) { var s = ST(); return s && s.laras ? s.laras(d) : null; }

  /* ----------------------------------------------------- SENTIMEN NASIONAL */
  /** Sentimen nasional semasa (-20..+20): reputasi anda + prestasi kerajaan (jika ada jawatan) + hanyutan rawak bulanan. */
  function sentimenNasional(p) {
    var prk = getPRK(p), kb = KB() && KB().getKabinet ? KB().getKabinet(p) : null, s = (Number(prk.sentimen) || 0) + ((Number(p.reputasi) || 50) - 50) * 0.2;
    if (kb && kb.hasGovernmentRole) { s += (kb.popularitiNasional - 50) * 0.2 + (kb.governanceRating - 50) * 0.1; }
    return r1(clamp(s, -CONFIG.SENTIMEN_MAKS, CONFIG.SENTIMEN_MAKS));
  }

  /* ----------------------------------------------- 1. PENCETUS KEKOSONGAN */
  /** Jenis kerusi yang boleh kosong: bukan kerusi yang sedang anda pegang. */
  function jenisBoleh(p) {
    var st = PRU().getPRU(p).status, senarai = ['DUN', 'PARLIMEN'];
    if (!p.dun) { senarai = ['PARLIMEN']; }                                  // v7.14: Wilayah Persekutuan tiada DUN
    if (st && st.jenis === 'ADUN') { senarai = senarai.filter(function (x) { return x !== 'DUN'; }); }
    if (st && st.jenis === 'MP') { senarai = senarai.filter(function (x) { return x !== 'PARLIMEN'; }); }
    return senarai;
  }
  /**
   * Cetuskan kekosongan kerusi. o.paksa melangkau syarat tetingkap/peluang (untuk ujian & peristiwa khas);
   * o.jenis ('DUN'|'PARLIMEN') dan o.sebab ('kematian'|'peletakan') boleh ditetapkan.
   */
  function triggerByElection(o) {
    o = o || {};
    var p = S().loadPlayer(), prk = getPRK(p), pru = PRU().getPRU(p), r = rng(o);
    if (!p || p.tamat) { return { ok: false, peristiwa: [] }; }
    if (pru.aktif || prk.aktif) { return { ok: false, peristiwa: [], ralat: 'Pilihan raya lain sedang berlangsung.' }; }
    if (!o.paksa) {
      var now = idx(p), jadual = pru.tahunPRU * 12 + pru.bulanPRU;
      if (now - pru.mulaIdx < CONFIG.MIN_BULAN_SELEPAS_PRU || now > jadual - CONFIG.MIN_BULAN_SEBELUM_PRU) { return { ok: false, peristiwa: [] }; }
      if (r() >= CONFIG.PELUANG_BULAN) { return { ok: false, peristiwa: [] }; }
    }
    var boleh = jenisBoleh(p);
    var jenis = o.jenis && boleh.indexOf(o.jenis) >= 0 ? o.jenis : (boleh.length === 1 ? boleh[0] : (r() < CONFIG.PELUANG_DUN ? 'DUN' : 'PARLIMEN'));
    if (boleh.indexOf(jenis) < 0) { return { ok: false, peristiwa: [], ralat: 'Jenis kerusi tidak sah.' }; }
    var sebab = o.sebab === 'kematian' || o.sebab === 'peletakan' ? o.sebab : (r() < CONFIG.PELUANG_KEMATIAN ? 'kematian' : 'peletakan');
    var pertahan = o.pertahan !== undefined ? !!o.pertahan : r() < CONFIG.PELUANG_PERTAHAN;
    var profil = PRU().profilKawasan(p);
    var lawanSenarai = { RURAL: ['PAS', 'Bersatu'], URBAN: ['DAP', 'PKR'], MIXED: ['PKR', 'PAS'] }[profil] || ['PKR', 'PAS'];
    prk.aktif = {
      fasa: 'isytihar', jenis: jenis, sebab: sebab, pertahan: pertahan, constituencyType: profil, lawan: lawanSenarai[0],
      nama: jenis === 'DUN' ? (p.dun || 'DUN') : (p.bahagian || 'Parlimen'), kod: jenis === 'DUN' ? ((p.kod && p.kod.dun) || p.dun || '') : ((p.kod && p.kod.parlimen) || p.bahagian || ''),
      hari: 0, hariBaki: CONFIG.HARI, voterSupport: 0, campaignFunds: 0, jentera: 70, dermaGuna: 0, log: [],
      partiPopulariti: clamp(Math.round(45 + ((Number(p.reputasi) || 50) - 50) * 0.3 + sentimenNasional(p) * 0.3), 25, 75), sentimenSemasa: sentimenNasional(p)
    };
    var kes = simpan(prk, {}, { log: { tindakan: 'prk_isytihar', nama: 'Kekosongan kerusi ' + (jenis === 'DUN' ? 'DUN ' : 'Parlimen ') + prk.aktif.nama + ': ' + SEBAB[sebab], peringkat: 'bulan' } });
    var mesej = SEBAB[sebab] + ' (kerusi ' + (jenis === 'DUN' ? 'DUN ' : 'Parlimen ') + prk.aktif.nama + '). Pilihan Raya Kecil diadakan dalam 7 hari' + (pertahan ? '; kerusi ini dipertahankan oleh parti anda.' : '; kerusi ini dimenangi pihak lawan sebelum ini.');
    return { ok: !!(kes && kes.ok), peristiwa: [{ jenis: 'prk_isytihar', mesej: mesej }], aktif: prk.aktif };
  }

  /** Dipanggil setiap bulan baharu oleh Calendar.majuBulan. */
  function prosesBulan(o) {
    var p = S() && S().loadPlayer();
    if (!p || p.tamat) { return { peristiwa: [] }; }
    var prk = getPRK(p), r = rng(o);
    prk.sentimen = r1(clamp((Number(prk.sentimen) || 0) * CONFIG.SENTIMEN_SUSUT + antara(r, -CONFIG.SENTIMEN_RAWAK, CONFIG.SENTIMEN_RAWAK), -CONFIG.SENTIMEN_MAKS, CONFIG.SENTIMEN_MAKS));
    simpan(prk, {});
    return { peristiwa: triggerByElection(o).peristiwa };
  }

  /* --------------------------------------------------------- PENCALONAN */
  function kelayakan(p) {
    var prk = getPRK(p), a = prk.aktif;
    if (!a) { return null; }
    var kl = PRU().kelayakan(p)[a.jenis], c = CONFIG[a.jenis];
    return { boleh: kl.boleh, sebab: kl.sebab, ipMin: kl.ipMin, minPeruntukan: c.minPeruntukan, peluang: clamp(kl.peluang + Math.round(CONFIG.TERIMA_BONUS * 100), 20, 95) };
  }
  function mohonCalon(o) {
    var p = S().loadPlayer(), prk = getPRK(p), a = prk.aktif;
    if (!a || a.fasa !== 'isytihar') { return { ok: false, ralat: 'Tiada fasa pencalonan.' }; }
    var kl = kelayakan(p);
    if (!kl.boleh) { return { ok: false, ralat: kl.sebab.join('; ') }; }
    if ((Number(p.myr) || 0) < kl.minPeruntukan) { return { ok: false, ralat: 'Dana tidak cukup (minimum RM ' + kl.minPeruntukan.toLocaleString('ms-MY') + ').' }; }
    if (rng(o)() * 100 < kl.peluang) {
      a.fasa = 'calon';
      simpan(prk, {}, { log: { tindakan: 'prk_calon', nama: 'Dicalonkan PRK ' + a.nama, peringkat: 'ahli' } });
      return { ok: true, diluluskan: true, mesej: 'Anda dicalonkan untuk PRK ' + a.nama + '. Tetapkan peruntukan kempen kilat.' };
    }
    var rek = { jenis: a.jenis, kerusi: a.nama, hasil: 'ditolak', tahun: p.tahun, bulan: p.bulan };
    prk.sejarah = (prk.sejarah || []).concat([rek]).slice(-10); prk.aktif = null;
    simpan(prk, { reputasi: -1 }, { log: { tindakan: 'prk_tolak', nama: 'Pencalonan PRK ditolak', peringkat: 'ahli' } });
    return { ok: true, diluluskan: false, mesej: 'Majlis Tertinggi memilih calon lain untuk PRK ' + a.nama + '.' };
  }
  function tidakBertanding() {
    var p = S().loadPlayer(), prk = getPRK(p), a = prk.aktif;
    if (!a || (a.fasa !== 'isytihar' && a.fasa !== 'calon')) { return { ok: false, ralat: 'Tidak boleh ditarik balik.' }; }
    prk.sejarah = (prk.sejarah || []).concat([{ jenis: a.jenis, kerusi: a.nama, hasil: 'tidak_bertanding', tahun: p.tahun, bulan: p.bulan }]).slice(-10); prk.aktif = null;
    simpan(prk, {}, { log: { tindakan: 'prk_tamat', nama: 'Tidak bertanding PRK', peringkat: 'bulan' } });
    return { ok: true, mesej: 'Anda tidak bertanding dalam PRK ini.' };
  }

  /* ----------------------------------------------- 2. KEMPEN KILAT 7 HARI */
  function peruntukanPilihan(p) {
    var prk = getPRK(p), a = prk.aktif;
    if (!a) { return { min: 0, pilihan: [] }; }
    var min = CONFIG[a.jenis].minPeruntukan, myr = Number(p.myr) || 0, s = [];
    [min, 8000, 15000, 25000].forEach(function (n) { if (n >= min && n <= myr && s.indexOf(n) < 0) { s.push(n); } });
    if (myr >= min && s.indexOf(myr) < 0) { s.push(myr); }
    return { min: min, pilihan: s.sort(function (x, y) { return x - y; }) };
  }
  /** Mulakan kempen kilat 7 hari dengan peruntukan dana. */
  function byElectionCampaign(peruntukan) {
    var p = S().loadPlayer(), prk = getPRK(p), a = prk.aktif;
    if (!a || a.fasa !== 'calon') { return { ok: false, ralat: 'Belum dicalonkan.' }; }
    var pil = peruntukanPilihan(p), dana = Math.round(Number(peruntukan) || 0);
    if (dana < pil.min) { return { ok: false, ralat: 'Peruntukan minimum RM ' + pil.min.toLocaleString('ms-MY') + '.' }; }
    if (dana > (Number(p.myr) || 0)) { return { ok: false, ralat: 'Dana tidak mencukupi.' }; }
    var akar = Number(p.kesetiaan && p.kesetiaan.akarUmbi) || 50;
    var asas = 0.35 * a.partiPopulariti + 15 + Math.min(10, (Number(p.ip) || 0) / 90) + (akar - 50) * 0.1 + ((Number(p.reputasi) || 50) - 50) * 0.04 + a.sentimenSemasa * 0.1;
    a.voterSupport = clamp(Math.round(asas * 0.85), 15, 65);
    a.campaignFunds = dana; a.jentera = clamp(60 + Math.round(akar * 0.25), 40, 85);
    a.hari = 0; a.hariBaki = CONFIG.HARI; a.fasa = 'kempen';
    a.log = [{ hari: 0, teks: 'Kempen kilat 7 hari bermula. Peruntukan RM ' + dana.toLocaleString('ms-MY') + '. Sentimen nasional ' + (a.sentimenSemasa > 0 ? '+' : '') + a.sentimenSemasa + '.' }];
    var res = simpan(prk, { myr: -dana }, { log: { tindakan: 'prk_kempen', nama: 'Kempen kilat PRK (RM ' + dana + ')', peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    return { ok: true, mesej: 'Kempen kilat 7 hari bermula.' };
  }

  function faktorJentera(j) { return 0.6 + 0.4 * (clamp(j, 0, 100) / 100); }
  function faktorTurun(vs) { return clamp(1 - Math.max(0, vs - 60) / 80, 0.35, 1); }
  function statusTindakan(a, t) {
    if (a.hariBaki <= 0) { return { boleh: false, sebab: 'Kempen tamat.' }; }
    if (t.dana > a.campaignFunds) { return { boleh: false, sebab: 'Dana tidak cukup (RM ' + t.dana.toLocaleString('ms-MY') + ').' }; }
    if (t.perluJentera && a.jentera < CONFIG.JENTERA_MIN) { return { boleh: false, sebab: 'Jentera terlalu letih (min ' + CONFIG.JENTERA_MIN + '%).' }; }
    if (t.id === 'derma' && a.dermaGuna >= CONFIG.DERMA_MAKS) { return { boleh: false, sebab: 'Had derma (' + CONFIG.DERMA_MAKS + ' kali) dicapai.' }; }
    return { boleh: true, sebab: '' };
  }
  function keadaanKempen(p) {
    var a = getPRK(p).aktif;
    if (!a || a.fasa !== 'kempen') { return null; }
    var pg = PRU().PENGGANDA[a.constituencyType];
    var sent = a.sentimenSemasa * CONFIG.SENTIMEN_KESAN * (a.pertahan ? 1 : 0.8), s1 = clamp(30 + a.voterSupport * 0.4 + sent, 5, 95);      // v7.46: anggaran undi semasa (tanpa unsur rawak hari mengundi)
    return { aktif: a, hariSemasa: a.hari, hariBaki: a.hariBaki, sentimen: a.sentimenSemasa, profil: a.constituencyType,
      pecahan: [{ nama: 'Anda (UMNO)', nilai: Math.round(s1 * 10) / 10, ke: 'anda' }, { nama: a.lawan, nilai: Math.round((100 - s1) * 10) / 10, ke: 'lawan' }],
      tindakan: ['ceramah', 'ziarah', 'digital', 'rehat', 'derma'].map(function (k) {
        var t = TINDAKAN[k], st = statusTindakan(a, t);
        return { id: t.id, ikon: t.ikon, nama: t.nama, dana: t.dana, jentera: t.jentera, gain: t.gain, stress: t.stress + CONFIG.STRESS_HARIAN, pengganda: t.pengganda ? pg[t.pengganda] : 1, boleh: st.boleh, sebab: st.sebab };
      }) };
  }
  function tindakanKilat(id, o) {
    var p = S().loadPlayer(), prk = getPRK(p), a = prk.aktif, t = TINDAKAN[id], r = rng(o);
    if (!a || a.fasa !== 'kempen') { return { ok: false, ralat: 'Tiada kempen kilat aktif.' }; }
    if (!t) { return { ok: false, ralat: 'Tindakan tidak dikenali.' }; }
    var st = statusTindakan(a, t);
    if (!st.boleh) { return { ok: false, ralat: st.sebab }; }
    var pg = PRU().PENGGANDA[a.constituencyType], m = t.pengganda ? pg[t.pengganda] : 1, mesej, gain = 0;
    var letih = (Number(p.stress) || 0) >= CONFIG.STRESS_LETIH ? CONFIG.FAKTOR_LETIH : 1;
    a.campaignFunds -= t.dana;
    if (t.gain[1] > 0) { gain = r1(antara(r, t.gain[0], t.gain[1]) * m * faktorJentera(a.jentera) * faktorTurun(a.voterSupport) * CONFIG.SKALA_GAIN * letih); }
    a.jentera = clamp(a.jentera + t.jentera, 0, 100);
    a.voterSupport = clamp(r1(a.voterSupport + gain), 0, 100);
    if (t.id === 'derma') { var d = Math.round(antara(r, 1000, 3000) * (0.5 + a.partiPopulariti / 100) / 50) * 50; a.campaignFunds += d; a.dermaGuna += 1; mesej = 'Derma terkumpul RM ' + d.toLocaleString('ms-MY') + '.'; }
    else if (t.id === 'rehat') { mesej = 'Jentera berehat (+' + t.jentera + '%).'; }
    else { mesej = t.nama + ': sokongan +' + gain + '%' + (m !== 1 ? ' (×' + m + ')' : '') + (letih < 1 ? ' (keletihan mengurangkan kesan)' : '') + '.'; }
    a.hari += 1; a.hariBaki = CONFIG.HARI - a.hari;
    a.voterSupport = clamp(r1(a.voterSupport - CONFIG.TEKANAN_LAWAN_HARIAN), 0, 100);
    a.log.unshift({ hari: a.hari, teks: mesej }); a.log = a.log.slice(0, 10);
    var res = simpan(prk, {}, { log: { tindakan: 'prk_hari', nama: t.nama + ' (hari ' + a.hari + ')', peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    laras({ stress: t.stress + CONFIG.STRESS_HARIAN });                  // Stress naik pantas: kos tindakan + kenaikan harian
    return { ok: true, mesej: mesej, gain: gain, tamat: a.hariBaki <= 0 };
  }

  /* ------------------------------------------- 3. KEPUTUSAN & IMPAK PRK */
  /** Undi PRK: sokongan kempen + sentimen nasional (ayunan protes lebih besar daripada PRU) + isu rawak. */
  function hitungKeputusan(p, a, o) {
    var r = rng(o), rawak = (r() + r() + r() - 1.5) * 5;                         // +/- ~7.5: PRK lebih tidak menentu
    var sentimen = a.sentimenSemasa * CONFIG.SENTIMEN_KESAN * (a.pertahan ? 1 : 0.8);    // kerusi lawan kurang terkesan sentimen parti
    var s1 = clamp(30 + a.voterSupport * 0.4 + sentimen + rawak * 0.5, 5, 95);
    var lawan = 100 - s1, menang = s1 > lawan, c = CONFIG[a.jenis];
    var jumlah = Math.round(antara(r, c.pengundi[0], c.pengundi[1]) * 0.7 / 100) * 100;     // keluar mengundi PRK lebih rendah
    var majPct = Math.abs(s1 - lawan);
    return { menang: menang, anda: r1(s1), lawan: r1(lawan), lawanNama: a.lawan, sentimen: r1(sentimen), majoritiPct: r1(majPct), jumlahUndi: jumlah, majoriti: Math.round(majPct / 100 * jumlah / 10) * 10 };
  }
  function selesaikan(o) {
    var p = S().loadPlayer(), prk = getPRK(p), a = prk.aktif;
    if (!a || a.fasa !== 'kempen') { return { ok: false, ralat: 'Tiada kempen untuk diselesaikan.' }; }
    if (a.hariBaki > 0) { return { ok: false, ralat: 'Kempen belum tamat (' + a.hariBaki + ' hari lagi).' }; }
    var k = hitungKeputusan(p, a, o), c = CONFIG[a.jenis], kes = { myr: Math.max(0, a.campaignFunds || 0) }, ipD, patch = {}, kab = KB(), kb = kab && kab.getKabinet ? kab.getKabinet(p) : null;
    var pru = PRU().getPRU(p);
    if (k.menang) {
      var bonus = clamp(c.ganjaranIp + Math.round(Math.min(60, k.majoritiPct * 3)), c.ganjaranIp, c.ganjaranIp + 60) + (a.pertahan ? 0 : 40);   // merampas kerusi lawan = bonus tambahan
      ipD = bonus; k.bonusIp = bonus;
      kes.reputasi = CONFIG.MENANG.reputasi;
      var kes2 = p.kesetiaan || {};
      patch.kesetiaan = Object.assign({}, kes2, { akarUmbi: clamp((Number(kes2.akarUmbi) || 50) + CONFIG.MENANG.akarUmbi, 0, 100), ajk: clamp((Number(kes2.ajk) || 50) + CONFIG.MENANG.ajk, 0, 100) });
      pru.status = { jenis: a.jenis === 'DUN' ? 'ADUN' : 'MP', kerusi: a.nama, sejakTahun: p.tahun, sejakBulan: p.bulan, kerajaan: !!(pru.status && pru.status.kerajaan), prk: true };
      k.stabil = kb && kb.hasGovernmentRole ? 'KPI Portfolio +' + CONFIG.MENANG.kabRating + '%, risiko rombakan ' + CONFIG.MENANG.kabRombak : 'Sokongan akar umbi & AJK kukuh';
    } else {
      var f = a.pertahan ? CONFIG.KALAH.penaltiPertahan : 1;
      ipD = -Math.min(Number(p.ip) || 0, Math.round(c.penaltiIp * f)); k.penaltiIp = -ipD;
      kes.reputasi = Math.round(CONFIG.KALAH.reputasi * f);
      var ks = p.kesetiaan || {};
      patch.kesetiaan = Object.assign({}, ks, { akarUmbi: clamp((Number(ks.akarUmbi) || 50) + Math.round(CONFIG.KALAH.akarUmbi * f), 0, 100), ajk: clamp((Number(ks.ajk) || 50) + Math.round(CONFIG.KALAH.ajk * f), 0, 100) });
      k.stabil = kb && kb.hasGovernmentRole ? 'KPI Portfolio ' + CONFIG.KALAH.kabRating + '%, risiko rombakan +' + CONFIG.KALAH.kabRombak + ', tekanan +' + CONFIG.KALAH.kabTekanan : 'Sokongan akar umbi & AJK merosot';
    }
    patch.ip = Math.max(0, (Number(p.ip) || 0) + ipD);
    var rek = { jenis: a.jenis, kerusi: a.nama, hasil: k.menang ? 'menang' : 'kalah', anda: k.anda, majoriti: k.majoriti, pertahan: a.pertahan, tahun: p.tahun, bulan: p.bulan };
    prk.sejarah = (prk.sejarah || []).concat([rek]).slice(-10);
    k.rekod = rek; a.fasa = 'keputusan'; a.keputusan = k; a.campaignFunds = 0;
    var res = S().applyEffects(kes, { kiraTindakan: false, patch: Object.assign({ prk: prk, pru: pru }, patch), log: { tindakan: 'prk_keputusan', nama: (k.menang ? 'MENANG PRK ' : 'KALAH PRK ') + a.nama, peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    laras({ stress: k.menang ? CONFIG.MENANG.stress : CONFIG.KALAH.stress });
    if (kab && kab.getKabinet && kb && kb.hasGovernmentRole) {                       // kestabilan jawatan kerajaan
      var p2 = S().loadPlayer(), k2 = kab.getKabinet(p2), m = k.menang ? CONFIG.MENANG : CONFIG.KALAH;
      k2.governanceRating = clamp(k2.governanceRating + m.kabRating, 0, 100);
      k2.risikoRombak = clamp(k2.risikoRombak + m.kabRombak, 0, 100);
      k2.popularitiNasional = clamp(k2.popularitiNasional + m.kabPop, 0, 100);
      if (!k.menang) { k2.tekananPolitik = clamp(k2.tekananPolitik + CONFIG.KALAH.kabTekanan, 0, 100); }
      S().applyEffects({}, { kiraTindakan: false, patch: { kabinet: k2 } });
    }
    return { ok: true, keputusan: k };
  }
  function tutupKeputusan() {
    var p = S().loadPlayer(), prk = getPRK(p), a = prk.aktif;
    if (!a || a.fasa !== 'keputusan') { return { ok: false }; }
    prk.aktif = null;
    var res = simpan(prk, {}, { log: { tindakan: 'prk_tamat', nama: 'PRK ditutup', peringkat: 'bulan' } });
    return { ok: !!(res && res.ok) };
  }

  function ringkasan(p) {
    var prk = getPRK(p), a = prk.aktif;
    return { aktif: a, fasa: a ? a.fasa : null, sentimen: sentimenNasional(p), sejarah: prk.sejarah, kelayakan: a ? kelayakan(p) : null, sebab: a ? SEBAB[a.sebab] : '', peruntukan: a ? peruntukanPilihan(p) : null };
  }

  return {
    CONFIG: CONFIG, TINDAKAN: TINDAKAN, SEBAB: SEBAB,
    setRng: function (f) { rngLalai = f || Math.random; },
    getPRK: getPRK, sentimenNasional: sentimenNasional, triggerByElection: triggerByElection, prosesBulan: prosesBulan,
    kelayakan: kelayakan, mohonCalon: mohonCalon, tidakBertanding: tidakBertanding, peruntukanPilihan: peruntukanPilihan,
    byElectionCampaign: byElectionCampaign, keadaanKempen: keadaanKempen, tindakanKilat: tindakanKilat,
    hitungKeputusan: hitungKeputusan, selesaikan: selesaikan, tutupKeputusan: tutupKeputusan, ringkasan: ringkasan
  };
});
