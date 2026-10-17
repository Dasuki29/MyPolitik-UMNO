/* ==========================================================================
   Nusa Politik — js/dun.js   (v7.56)
   Sidang Dewan Undangan Negeri (DUN) untuk ADUN / EXCO Negeri. API sama dengan js/dewan.js supaya UI dikongsi.
     - Kerusi DUN negeri anda (majoriti = separuh + 1; cth 29/56);
     - Bentang Enakmen (12, 6 kategori) dan Bajet Negeri oleh EXCO; lobi ADUN; undian;
     - Usul Undi Tidak Percaya terhadap Menteri Besar (3 hari; gagal = DUN dibubar, PRN mengejut);
     - Soal Jawab Lisan bulanan kepada EXCO.
   State: p.dunSidang. Semua angka ialah anggaran permainan, bukan data DUN sebenar.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikDUN = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  function modul(nama, fail) {
    if (root[nama]) { return root[nama]; }
    try { if (typeof require === 'function') { return require('./' + fail); } } catch (e) { /* tiada */ }
    return null;
  }
  function S() { return modul('MyPolitikSave', 'save.js'); }
  function KB() { return modul('MyPolitikKabinet', 'kabinet.js'); }
  function PRU() { return modul('MyPolitikPRU', 'pru.js'); }
  function ST() { return modul('MyPolitikStres', 'stress.js'); }
  function DW() { return modul('MyPolitikDewan', 'dewan.js'); }
  function PAP() { return root.NusaPaparan || null; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  var rngLalai = Math.random;
  function rng(o) { return (o && o.rng) || rngLalai; }
  function antara(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }

  var CONFIG = {
    SESI: [4, 9], BULAN_BAJET: 11, LOBI_MAKS: 6, AP_LOBI: 1, ATAS_SOKONG: 0.30,
    LULUS: { ip: 120, rating: 12, kestabilan: 5 },
    GAGAL: { rating: -15, kestabilan: -12, tekanan: 6 },
    GAGAL_BAJET: { rating: -25, kestabilan: -20, tekanan: 12 },
    TP: { AMBANG: 30, HARI: 3, JEDA_BULAN: 12, GOYAH_ASAS: 0.42, BAHAGIAN_GOYAH: 0.25, SELAMAT: { rating: 10, kestabilan: 25, tekanan: -10 } },
    SOALAN_PELUANG: 0.6, SOALAN_DIAM: { rating: -4, tekanan: 5 }, KESTABILAN_SUSUT: 3
  };

  var LOBI = {
    atas_pagar:  { id: 'atas_pagar',  nama: 'Lobi ADUN atas pagar', huraian: 'RM 3,000 · tambah undi · tiada risiko', myr: 3000, ip: 0 },
    cdf:         { id: 'cdf',         nama: 'Tawar projek DUN kepada ADUN yang goyah', huraian: '-25 IP · tambah undi · 20% dilihat berpolitik (Reputasi -2)', myr: 0, ip: 25 },
    pembangkang: { id: 'pembangkang', nama: 'Rundingan dengan pembangkang negeri', huraian: 'RM 5,000 · peluang 35%', myr: 5000, ip: 0 }
  };
  var TP_TINDAK = {
    pujuk: { id: 'pujuk', nama: 'Pujuk ADUN gabungan yang goyah', huraian: 'RM 6,000 · tambah undi setia', myr: 6000, ip: 0 },
    janji: { id: 'janji', nama: 'Janji jawatan EXCO / GLC', huraian: '-40 IP · undi setia · risiko rombakan +10', myr: 0, ip: 40 },
    rayu:  { id: 'rayu',  nama: 'Rayuan kepada Pengerusi Badan Perhubungan & rakan gabungan', huraian: 'Mengikut hubungan gabungan', myr: 0, ip: 0 },
    tunggu: { id: 'tunggu', nama: 'Tunggu (tiada tindakan hari ini)', huraian: 'Hari berlalu', myr: 0, ip: 0 },
    bubar: { id: 'bubar', nama: 'Menasihatkan pembubaran DUN', huraian: 'Elak undian: PRN Mengejut', myr: 0, ip: 0 }
  };
  var JAWAPAN = (DW() && DW().JAWAPAN) || {};

  function enakmenSenarai() {
    var d = DW(); if (!d) { return []; }
    return d.RUU.map(function (r) { return { id: 'en_' + r.id.replace(/^ruu_/, ''), kategori: r.kategori, tajuk: r.tajuk.replace(/^RUU/, 'Enakmen'), huraian: r.huraian, asas: r.asas, silang: r.silang, ekstra: r.ekstra }; });
  }
  function bajet(tahun) { return { id: 'bajet', kategori: 'bajet', tajuk: 'Bajet Negeri ' + (Number(tahun) + 1), huraian: 'Peruntukan tahunan negeri.', asas: 0.82, silang: 0.04, ekstra: {}, jenis: 'bajet' }; }
  function cariEnakmen(id, tahun) { if (id === 'bajet') { return bajet(tahun); } var l = enakmenSenari(); for (var i = 0; i < l.length; i++) { if (l[i].id === id) { return l[i]; } } return null; }
  function enakmenSenari() { return enakmenSenarai(); }

  function dasar() { return { undi: null, tp: null, soalan: null, laras: 0, sesi: 0, bajetTahun: 0, tpTerakhir: -999, sejarah: [] }; }
  function getSidang(p) {
    var b = dasar(), d = p && p.dunSidang && typeof p.dunSidang === 'object' ? p.dunSidang : {};
    for (var f in b) { if (d[f] === undefined) { d[f] = b[f]; } }
    return d;
  }
  function simpan(d, kesan, opts) {
    opts = opts || {};
    return S().applyEffects(kesan || {}, { kiraTindakan: false, patch: { dunSidang: d }, log: opts.log });
  }
  function idx(p) { return (parseInt(p.tahun, 10) || 0) * 12 + (parseInt(p.bulan, 10) || 1); }
  function sejarahTambah(d, x) { d.sejarah = (d.sejarah || []).concat([x]).slice(-12); }
  function terapRating(kes) { var K = KB(); if (K && K.laras && (kes.rating || kes.tekanan || kes.rombak)) { K.laras({ rating: kes.rating || 0, tekanan: kes.tekanan || 0, pop: 0, rombak: kes.rombak || 0 }); } }

  /* ---------- Status ---------- */
  function peranKabinet(p) { var K = KB(); return K ? K.getKabinet(p) : { hasGovernmentRole: false, roleLevel: 'NONE' }; }
  function statusADUN(p) { var P = PRU(); return !!(P && p && P.pegang && P.pegang(p, 'ADUN')); }
  function exco(p) { var k = peranKabinet(p); return !!(k.hasGovernmentRole && k.roleLevel === 'EXCO_NEGERI'); }
  /** Dewan DUN: ADUN atau EXCO Negeri. Jika turut Ahli Parlimen/Menteri, UI memberi butang tukar antara dua dewan. */
  function aktif(p) { return !!p && !p.tamat && (statusADUN(p) || exco(p)); }
  function bolehBentang(p) { return exco(p); }
  function kerusi(p) {
    var A = PAP(); if (!A || !A.kerusiGabungan) { return null; }
    var k = A.kerusiGabungan(p); if (!k && A.kemaskiniKerusi) { try { A.kemaskiniKerusi(p); k = A.kerusiGabungan(S().loadPlayer()); } catch (e) { /* abaikan */ } }
    var d = k && k.dun; if (!d) { return null; }
    return { jumlah: d.jumlah, ambang: d.ambang, BN: d.BN, PH: d.PH, PN: d.PN, LAIN: d.LAIN, kerajaanBN: d.kerajaanBN, tahun: k.tahun, bulan: k.bulan };
  }
  function adaKerajaan(p) { var k = kerusi(p); return !!(k && k.kerajaanBN && aktif(p)); }
  function kestabilan(p) {
    var k = kerusi(p), d = getSidang(p), P = PRU(), K = KB(), hub = 50, pop = 50;
    if (P) { hub = Number(P.getPRU(p).hubunganGabungan) || 50; }
    if (K) { var kb = K.getKabinet(p); if (kb.hasGovernmentRole) { pop = Number(kb.popularitiNasional) || 50; } }
    var margin = k ? (k.BN - k.ambang) : 0, skala = k ? 222 / k.jumlah : 1;
    return Math.round(clamp(50 + margin * 0.30 * Math.min(skala, 4) + (hub - 50) * 0.30 + (pop - 50) * 0.20 + (Number(d.laras) || 0), 0, 100));
  }
  function rating(p) { var k = peranKabinet(p); return k.hasGovernmentRole ? Number(k.governanceRating) : null; }

  function sesiKunci(p) { return CONFIG.SESI.indexOf(parseInt(p.bulan, 10)) >= 0 ? (parseInt(p.tahun, 10) || 0) * 100 + parseInt(p.bulan, 10) : 0; }
  function senaraiBentang(p) {
    var d = getSidang(p), sebab = '', k = kerusi(p);
    if (!aktif(p)) { sebab = 'Anda bukan ADUN atau EXCO Negeri.'; }
    else if (!k) { sebab = 'Belum ada keputusan PRN.'; }
    else if (!bolehBentang(p)) { sebab = 'Hanya EXCO Negeri boleh membentang Enakmen dan Bajet Negeri.'; }
    else if (!k.kerajaanBN) { sebab = 'Parti anda bukan kerajaan negeri.'; }
    else if (d.undi) { sebab = 'Satu undian sedang berjalan.'; }
    else if (d.tp) { sebab = 'Usul Undi Tidak Percaya sedang berlangsung.'; }
    var kunci = sesiKunci(p), adaSesi = !!kunci, sudah = adaSesi && d.sesi === kunci, kat = DW() ? DW().kategoriPemain(p) : [];
    var senarai = enakmenSenarai().filter(function (r) { return kat.indexOf(r.kategori) >= 0; }).map(function (r) { return { id: r.id, tajuk: r.tajuk, kategori: r.kategori, kategoriNama: DW().KATEGORI[r.kategori].nama, huraian: r.huraian, asas: r.asas }; });
    var bajetBoleh = parseInt(p.bulan, 10) === CONFIG.BULAN_BAJET && d.bajetTahun !== p.tahun;
    return { sebab: sebab, ruu: sebab ? [] : (adaSesi && !sudah ? senarai : []), bajet: !sebab && bajetBoleh ? bajet(p.tahun) : null, sesiSekarang: adaSesi, sesiSudah: sudah,
      sebabRUU: sebab || (!adaSesi ? 'Enakmen dibentang semasa sidang DUN (bulan ' + CONFIG.SESI.join(', ') + ').' : (sudah ? 'Enakmen sesi ini sudah dibentang.' : '')) };
  }

  /* ---------- Undian ---------- */
  function bahagiUndi(k, asas, silang) {
    var G = k.BN, opp = k.PH + k.PN, sokong = Math.round(G * asas), atas = Math.round((G - sokong) * 0.6) + Math.round(k.LAIN * 0.7) + Math.round(opp * silang);
    atas = Math.min(atas, k.jumlah - sokong);
    return { sokong: sokong, atas: atas, bantah: k.jumlah - sokong - atas };
  }
  function skala(k) { return Math.max(1, Math.round(2 * k.jumlah / 222 * 4) / 4); }       // lobi lebih kecil kerana DUN kecil
  function tambahLobi(r, k, a, b) { return Math.max(1, Math.round(antara(r, a, b) * k.jumlah / 222 * 2)); }
  function mulaBentang(id) {
    var p = S().loadPlayer(), sb = senaraiBentang(p), r = null;
    if (sb.sebab) { return { ok: false, ralat: sb.sebab }; }
    if (id === 'bajet') { if (!sb.bajet) { return { ok: false, ralat: 'Bajet hanya dibentang bulan ' + CONFIG.BULAN_BAJET + ', sekali setahun.' }; } r = sb.bajet; }
    else { if (!sb.ruu.length) { return { ok: false, ralat: sb.sebabRUU || 'Tiada enakmen boleh dibentang.' }; } if (!sb.ruu.some(function (x) { return x.id === id; })) { return { ok: false, ralat: 'Enakmen tidak sah untuk portfolio anda.' }; } r = cariEnakmen(id, p.tahun); }
    var k = kerusi(p), b = bahagiUndi(k, r.asas, r.silang), d = getSidang(p);
    d.undi = { id: r.id, jenis: r.jenis === 'bajet' ? 'bajet' : 'ruu', tajuk: r.tajuk, kategori: r.kategori, sokong: b.sokong, atas: b.atas, bantah: b.bantah, lobi: 0, tahun: p.tahun, bulan: p.bulan };
    if (d.undi.jenis === 'bajet') { d.bajetTahun = p.tahun; } else { d.sesi = sesiKunci(p); }
    var res = simpan(d, {}, { log: { tindakan: 'dun_bentang', nama: 'Membentang ' + r.tajuk, peringkat: 'ahli' } });
    return res.ok ? { ok: true, undi: d.undi, mesej: r.tajuk + ' dibentang di DUN.' } : { ok: false, ralat: res.ralat };
  }
  function kebarangkalian(u, ambang) { var j = u.sokong + u.atas * CONFIG.ATAS_SOKONG; return j >= ambang + 4 ? 'tinggi' : j >= ambang ? 'sederhana' : j >= ambang - 3 ? 'tipis' : 'rendah'; }
  function undiSemasa(p) {
    var d = getSidang(p), u = d.undi; if (!u) { return null; }
    var k = kerusi(p);
    return { undi: u, ambang: k.ambang, kebarangkalian: kebarangkalian(u, k.ambang), baki: Math.max(0, CONFIG.LOBI_MAKS - u.lobi), tindakan: Object.keys(LOBI).map(function (id) {
      var t = LOBI[id], sebab = '';
      if (u.lobi >= CONFIG.LOBI_MAKS) { sebab = 'Had lobi dicapai.'; } else if ((Number(p.ap) || 0) < CONFIG.AP_LOBI) { sebab = 'AP tidak mencukupi.'; }
      else if (t.myr && (Number(p.myr) || 0) < t.myr) { sebab = 'Dana tidak mencukupi.'; } else if (t.ip && (Number(p.ip) || 0) < t.ip) { sebab = 'IP tidak mencukupi.'; }
      return { id: t.id, nama: t.nama, huraian: t.huraian, boleh: !sebab, sebab: sebab };
    }) };
  }
  function pindah(u, dari, ke, n) { n = Math.max(0, Math.min(n, u[dari])); u[dari] -= n; u[ke] += n; return n; }
  function lobi(id, o) {
    var p = S().loadPlayer(), d = getSidang(p), u = d.undi, t = LOBI[id], r = rng(o);
    if (!u) { return { ok: false, ralat: 'Tiada undian sedang berjalan.' }; }
    if (!t) { return { ok: false, ralat: 'Tindakan lobi tidak sah.' }; }
    var sem = undiSemasa(p).tindakan.filter(function (x) { return x.id === id; })[0];
    if (!sem.boleh) { return { ok: false, ralat: sem.sebab }; }
    var k = kerusi(p), n = 0, mesej = '', kesan = { ap: -CONFIG.AP_LOBI };
    if (t.myr) { kesan.myr = -t.myr; } if (t.ip) { kesan.ip = -t.ip; }
    if (id === 'atas_pagar') { n = pindah(u, 'atas', 'sokong', tambahLobi(r, k, 6, 10)); mesej = 'Lobi ADUN atas pagar: +' + n + ' undi sokong.'; }
    else if (id === 'cdf') { var w = tambahLobi(r, k, 5, 5); n = pindah(u, 'atas', 'sokong', w); if (n < w) { n += pindah(u, 'bantah', 'sokong', w - n); } mesej = 'Projek DUN ditawarkan: +' + n + ' undi sokong.'; if (r() < 0.2) { kesan.reputasi = -2; mesej += ' Anda dilihat berpolitik (Reputasi -2).'; } }
    else if (r() < 0.35) { n = pindah(u, 'bantah', 'sokong', tambahLobi(r, k, 3, 6)); mesej = 'Pembangkang bersetuju memberi sokongan: +' + n + ' undi.'; } else { mesej = 'Rundingan dengan pembangkang tidak membuahkan hasil.'; }
    u.lobi += 1;
    var res = simpan(d, kesan, { log: { tindakan: 'dun_lobi', nama: t.nama + ' (' + u.tajuk + ')', peringkat: 'ahli' } });
    return res.ok ? { ok: true, mesej: mesej, undi: u, tambah: n } : { ok: false, ralat: res.ralat };
  }
  function undi(o) {
    var p = S().loadPlayer(), d = getSidang(p), u = d.undi, r = rng(o), k = kerusi(p);
    if (!u) { return { ok: false, ralat: 'Tiada undian sedang berjalan.' }; }
    var q = clamp(CONFIG.ATAS_SOKONG + (r() - 0.5) * 0.2, 0.2, 0.4), sokong = u.sokong + Math.round(u.atas * q), bantah = k.jumlah - sokong, lulus = sokong >= k.ambang, bj = u.jenis === 'bajet', kes, kesanP = {}, mesej;
    if (lulus) {
      var e = (cariEnakmen(u.id, u.tahun) || {}).ekstra || {};
      kesanP = { ip: CONFIG.LULUS.ip }; if (e.reputasi) { kesanP.reputasi = e.reputasi; } if (e.akarUmbi) { kesanP.kesetiaan = { akarUmbi: e.akarUmbi }; }
      d.laras = clamp((Number(d.laras) || 0) + CONFIG.LULUS.kestabilan, -60, 60);
      mesej = u.tajuk + ' LULUS (' + sokong + ' sokong, ' + bantah + ' bantah). IP +' + CONFIG.LULUS.ip + ', Tadbir Urus +' + CONFIG.LULUS.rating + '%.'; kes = { rating: CONFIG.LULUS.rating };
    } else {
      var g = bj ? CONFIG.GAGAL_BAJET : CONFIG.GAGAL; d.laras = clamp((Number(d.laras) || 0) + g.kestabilan, -60, 60);
      mesej = u.tajuk + ' GAGAL (' + sokong + ' sokong, perlu ' + k.ambang + '). Tadbir Urus ' + g.rating + '%, kestabilan gabungan ' + g.kestabilan + '%.'; kes = { rating: g.rating, tekanan: g.tekanan };
    }
    sejarahTambah(d, { jenis: bj ? 'bajet' : 'ruu', tajuk: u.tajuk, lulus: lulus, sokong: sokong, tahun: p.tahun, bulan: p.bulan });
    d.undi = null;
    var res = simpan(d, kesanP, { log: { tindakan: 'dun_undi', nama: (lulus ? 'Lulus: ' : 'Gagal: ') + u.tajuk, peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    terapRating(kes);
    return { ok: true, lulus: lulus, sokong: sokong, bantah: bantah, mesej: mesej, kestabilan: kestabilan(S().loadPlayer()) };
  }
  function tarikBalik() {
    var p = S().loadPlayer(), d = getSidang(p); if (!d.undi) { return { ok: false, ralat: 'Tiada undian sedang berjalan.' }; }
    var t = d.undi.tajuk; d.undi = null;
    var res = simpan(d, {}, { log: { tindakan: 'dun_tarik', nama: 'Menarik balik ' + t, peringkat: 'ahli' } });
    return res.ok ? { ok: true, mesej: t + ' ditarik balik.' } : { ok: false, ralat: res.ralat };
  }

  /* ---------- Undi Tidak Percaya terhadap Menteri Besar ---------- */
  function bolehPicuTP(p) {
    var d = getSidang(p), P = PRU(), pr = P ? P.getPRU(p) : null;
    if (!aktif(p) || !adaKerajaan(p) || d.tp) { return false; }
    if ((pr && pr.aktif) || (p.prk && p.prk.aktif)) { return false; }
    if (idx(p) - d.tpTerakhir < CONFIG.TP.JEDA_BULAN) { return false; }
    var rt = rating(p);
    return kestabilan(p) < CONFIG.TP.AMBANG || (rt !== null && rt < CONFIG.TP.AMBANG);
  }
  function mulaTP(p) {
    var d = getSidang(p), k = kerusi(p), s = Math.min(kestabilan(p), rating(p) !== null ? rating(p) : 100, 100);
    var frac = clamp(CONFIG.TP.GOYAH_ASAS + (CONFIG.TP.AMBANG - s) / 100, 0.35, 0.65), goyah = Math.round(k.BN * frac);
    d.tp = { hari: 1, setia: k.BN - goyah, goyah: goyah, tentang: k.jumlah - k.BN, mulaTahun: p.tahun, mulaBulan: p.bulan, log: [] };
    d.undi = null; return d;
  }
  function tpSemasa(p) {
    var d = getSidang(p), t = d.tp; if (!t) { return null; }
    var k = kerusi(p), hub = Number(PRU() ? PRU().getPRU(p).hubunganGabungan : 50) || 50;
    return { tp: t, ambang: k.ambang, hariMaks: CONFIG.TP.HARI, kestabilan: kestabilan(p), rating: rating(p), hubungan: hub, tindakan: ['pujuk', 'janji', 'rayu', 'tunggu', 'bubar'].map(function (id) {
      var a = TP_TINDAK[id], sebab = '';
      if (id !== 'tunggu' && id !== 'bubar' && (Number(p.ap) || 0) < CONFIG.AP_LOBI) { sebab = 'AP tidak mencukupi.'; }
      else if (a.myr && (Number(p.myr) || 0) < a.myr) { sebab = 'Dana tidak mencukupi.'; } else if (a.ip && (Number(p.ip) || 0) < a.ip) { sebab = 'IP tidak mencukupi.'; }
      return { id: id, nama: a.nama, huraian: a.huraian, boleh: !sebab, sebab: sebab };
    }) };
  }
  function bubarDUN(o) { var P = PRU(); return P && P.isytihar ? P.isytihar('krisis', o) : null; }
  function selesaikanTP(o) {
    var p = S().loadPlayer(), d = getSidang(p), t = d.tp, k = kerusi(p);
    if (!t) { return { ok: false, ralat: 'Tiada usul undi tidak percaya.' }; }
    var sokong = t.setia + Math.round(t.goyah * CONFIG.TP.BAHAGIAN_GOYAH), selamat = sokong >= k.ambang, mesej, ev = [];
    sejarahTambah(d, { jenis: 'tp', lulus: selamat, sokong: sokong, tahun: p.tahun, bulan: p.bulan });
    d.tp = null; d.tpTerakhir = idx(p);
    if (selamat) {
      d.laras = clamp((Number(d.laras) || 0) + CONFIG.TP.SELAMAT.kestabilan, -60, 60);
      mesej = 'Menteri Besar SELAMAT daripada Usul Undi Tidak Percaya dengan ' + sokong + ' undi (perlu ' + k.ambang + '). Tadbir Urus +' + CONFIG.TP.SELAMAT.rating + '%.';
      simpan(d, {}, { log: { tindakan: 'dun_tp', nama: 'Selamat daripada undi tidak percaya (' + sokong + ')', peringkat: 'ahli' } });
      terapRating({ rating: CONFIG.TP.SELAMAT.rating, tekanan: CONFIG.TP.SELAMAT.tekanan });
      return { ok: true, selamat: true, sokong: sokong, mesej: mesej, peristiwa: [{ jenis: 'dewan', mesej: mesej }] };
    }
    d.laras = 0;
    simpan(d, { reputasi: -3 }, { log: { tindakan: 'dun_tp', nama: 'Kerajaan negeri tumbang: undi tidak percaya (' + sokong + ')', peringkat: 'ahli' } });
    var snap = bubarDUN(o);
    mesej = 'Kerajaan negeri TUMBANG: hanya ' + sokong + ' undi sokong (perlu ' + k.ambang + '). DUN dibubarkan; Pilihan Raya Negeri Mengejut diisytiharkan.';
    ev.push({ jenis: 'dewan', mesej: mesej }); if (snap && snap.peristiwa) { ev = ev.concat(snap.peristiwa); }
    return { ok: true, selamat: false, sokong: sokong, mesej: mesej, peristiwa: ev, snap: !!snap };
  }
  function tindakTP(id, o) {
    var p = S().loadPlayer(), d = getSidang(p), t = d.tp, r = rng(o), a = TP_TINDAK[id], k = kerusi(p);
    if (!t) { return { ok: false, ralat: 'Tiada usul undi tidak percaya.' }; }
    if (!a) { return { ok: false, ralat: 'Tindakan tidak sah.' }; }
    var sem = tpSemasa(p).tindakan.filter(function (x) { return x.id === id; })[0];
    if (!sem.boleh) { return { ok: false, ralat: sem.sebab }; }
    if (id === 'bubar') {
      d.tp = null; d.tpTerakhir = idx(p); d.laras = 0; simpan(d, {}, { log: { tindakan: 'dun_bubar', nama: 'Menasihatkan pembubaran DUN', peringkat: 'ahli' } });
      var snap = bubarDUN(o); return { ok: true, tamat: true, snap: true, mesej: 'DUN dibubarkan atas nasihat anda. PRN Mengejut diisytiharkan.', peristiwa: snap && snap.peristiwa ? snap.peristiwa : [] };
    }
    var kesan = {}, n = 0, mesej = '', kk = null, w = Math.max(1, Math.round(k.jumlah / 222 * 2 * 100) / 100);
    if (id !== 'tunggu') { kesan.ap = -CONFIG.AP_LOBI; } if (a.myr) { kesan.myr = -a.myr; } if (a.ip) { kesan.ip = -a.ip; }
    if (id === 'pujuk') { n = pindah(t, 'goyah', 'setia', Math.max(1, Math.round(antara(r, 4, 9) * k.jumlah / 222 * 2))); mesej = 'ADUN gabungan dipujuk: +' + n + ' undi setia.'; }
    else if (id === 'janji') { n = pindah(t, 'goyah', 'setia', Math.max(1, Math.round(8 * k.jumlah / 222 * 2))); mesej = 'Jawatan dijanjikan: +' + n + ' undi setia. Risiko rombakan meningkat.'; kk = { rombak: 10, tekanan: 4 }; }
    else if (id === 'rayu') { var hub = Number(PRU() ? PRU().getPRU(p).hubunganGabungan : 50) || 50; n = pindah(t, 'goyah', 'setia', Math.max(1, Math.round(clamp(3 + hub / 20, 3, 8) * k.jumlah / 222 * 2))); mesej = 'Rayuan kepada rakan gabungan: +' + n + ' undi setia.'; }
    else { mesej = 'Hari ' + t.hari + ' berlalu tanpa tindakan.'; }
    t.log.push('Hari ' + t.hari + ': ' + mesej); t.hari += 1;
    var tamat = t.hari > CONFIG.TP.HARI, res = simpan(d, kesan, { log: { tindakan: 'dun_tp_tindak', nama: a.nama, peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    if (kk) { terapRating(kk); }
    if (tamat) { var z = selesaikanTP(o); z.tamat = true; return z; }
    return { ok: true, mesej: mesej, tp: t, tamat: false };
  }

  /* ---------- Soal Jawab Lisan (kepada EXCO) ---------- */
  function janaSoalan(p, o) {
    var dw = DW(), r = rng(o), kat = dw.kategoriPemain(p), pool = dw.SOALAN.filter(function (q) { return q.kategori === null || kat.indexOf(q.kategori) >= 0; });
    var q = pool[Math.floor(r() * pool.length)], yb = ['YB Pembangkang (PN)', 'YB Pembangkang (PH)'][Math.floor(r() * 2)];
    return { id: q.id, soal: q.soal, isu: q.isu, yb: yb, bulan: p.bulan, tahun: p.tahun };
  }
  function soalanSemasa(p) {
    var q = getSidang(p).soalan; if (!q) { return null; }
    return { id: q.id, soal: q.soal, isu: q.isu, yb: q.yb, jawapan: Object.keys(JAWAPAN).map(function (k) { var j = JAWAPAN[k]; return { id: k, nama: j.nama, ikon: j.ikon, teks: j.teks.replace('{isu}', q.isu), kesan: j.kesan || null, rawak: j.rawak || null }; }) };
  }
  function jawabSoalan(jid, o) {
    var p = S().loadPlayer(), d = getSidang(p), q = d.soalan, r = rng(o), j = JAWAPAN[jid];
    if (!q) { return { ok: false, ralat: 'Tiada soalan menunggu.' }; } if (!j) { return { ok: false, ralat: 'Jawapan tidak sah.' }; }
    var x, jaya = null, mesej = j.nama + '.';
    if (j.rawak) { jaya = r() < j.rawak.p; x = jaya ? j.rawak.jaya : j.rawak.gagal; mesej += jaya ? ' Jawapan meyakinkan.' : ' Dibidas balas oleh pembangkang.'; } else { x = j.kesan; }
    var kesan = {}; if (x.ip) { kesan.ip = x.ip; } if (x.rep) { kesan.reputasi = x.rep; }
    if (x.kestabilan) { d.laras = clamp((Number(d.laras) || 0) + x.kestabilan, -60, 60); }
    d.soalan = null;
    var res = simpan(d, kesan, { log: { tindakan: 'dun_soalan', nama: 'Soal jawab lisan DUN: ' + q.isu + ' (' + j.nama + ')', peringkat: 'ahli' } });
    if (!res.ok) { return { ok: false, ralat: res.ralat }; }
    terapRating({ rating: x.rating || 0, tekanan: x.tekanan || 0 });
    if (x.stress) { var st = ST(); if (st && st.laras) { st.laras({ stress: x.stress }); } }
    return { ok: true, mesej: mesej, stress: x.stress || 0, ip: x.ip || 0, rating: x.rating || 0, reputasi: x.rep || 0, jaya: jaya };
  }

  /* ---------- Denyut bulanan ---------- */
  function prosesBulan(o) {
    var ev = [], p = S() && S().loadPlayer();
    if (!p || p.tamat || !aktif(p)) { return { peristiwa: ev }; }
    var d = getSidang(p), r = rng(o), ubah = false;
    if (d.laras) { d.laras = d.laras > 0 ? Math.max(0, d.laras - CONFIG.KESTABILAN_SUSUT) : Math.min(0, d.laras + CONFIG.KESTABILAN_SUSUT); ubah = true; }
    if (d.undi && !bolehBentang(p)) { d.undi = null; ubah = true; }
    if (ubah) { simpan(d, {}); p = S().loadPlayer(); d = getSidang(p); }
    if (d.tp) { var z = selesaikanTP(o); ev = ev.concat(z.peristiwa || []); p = S().loadPlayer(); d = getSidang(p); if (!z.selamat) { return { peristiwa: ev }; } }
    if (CONFIG.SESI.indexOf(parseInt(p.bulan, 10)) >= 0) { ev.push({ jenis: 'dewan_sesi', mesej: 'Sidang DUN dibuka' + (parseInt(p.bulan, 10) === CONFIG.BULAN_BAJET ? ' (Bajet Negeri dibentangkan bulan ini).' : '.') }); }
    if (bolehPicuTP(p)) {
      var k = kerusi(p); d = mulaTP(p); simpan(d, {}, { log: { tindakan: 'dun_tp_mula', nama: 'Usul Undi Tidak Percaya terhadap Menteri Besar', peringkat: 'ahli' } });
      ev.push({ jenis: 'dewan_tp', mesej: 'Pembangkang mengemukakan Usul Undi Tidak Percaya terhadap Menteri Besar! Anda ada ' + CONFIG.TP.HARI + ' hari untuk mengumpul ' + k.ambang + ' kerusi.' });
      return { peristiwa: ev };
    }
    if (exco(p) && adaKerajaan(p)) {
      if (d.soalan) { simpan(d, {}); terapRating({ rating: CONFIG.SOALAN_DIAM.rating, tekanan: CONFIG.SOALAN_DIAM.tekanan }); ev.push({ jenis: 'dewan', mesej: 'Soalan lisan pembangkang tidak dijawab: dianggap mengelak (Tadbir Urus ' + CONFIG.SOALAN_DIAM.rating + '%).' }); d.soalan = null; }
      if (r() < CONFIG.SOALAN_PELUANG) { d.soalan = janaSoalan(p, o); simpan(d, {}); ev.push({ jenis: 'dewan_soalan', mesej: 'Waktu Pertanyaan: ' + d.soalan.yb + ' mengemukakan soalan kepada anda di DUN.' }); } else { simpan(d, {}); }
    }
    return { peristiwa: ev };
  }

  function ringkasan(p) {
    var d = getSidang(p), k = kerusi(p), sb = senaraiBentang(p);
    return { aktif: aktif(p), dun: true, peranan2: statusADUN(p) ? 'ADUN' : 'EXCO', kerusi: k, ambang: k ? k.ambang : 0, kerajaan: adaKerajaan(p), kestabilan: aktif(p) ? kestabilan(p) : null, rating: rating(p),
      menteri: exco(p), bolehBentang: bolehBentang(p), bentang: sb, undi: undiSemasa(p), tp: tpSemasa(p), soalan: soalanSemasa(p), sejarah: d.sejarah || [],
      peranan: statusADUN(p) ? 'ADUN' : 'EXCO', portfolio: exco(p) ? (peranKabinet(p).portfolioName || '') : '',
      label: { dewan: 'Dewan Undangan Negeri', usul: 'Enakmen', ketua: 'Menteri Besar', tab: 'DUN', negeri: p.negeri || '' } };
  }

  return {
    CONFIG: CONFIG, LOBI: LOBI, TP_TINDAK: TP_TINDAK, ENAKMEN: enakmenSenarai,
    setRng: function (f) { rngLalai = f || Math.random; },
    getDewan: getSidang, aktif: aktif, kerusi: kerusi, kestabilan: kestabilan, senaraiBentang: senaraiBentang,
    mulaBentang: mulaBentang, undiSemasa: undiSemasa, lobi: lobi, undi: undi, tarikBalik: tarikBalik,
    tpSemasa: tpSemasa, tindakTP: tindakTP, selesaikanTP: selesaikanTP, bolehPicuTP: bolehPicuTP,
    soalanSemasa: soalanSemasa, jawabSoalan: jawabSoalan, prosesBulan: prosesBulan, ringkasan: ringkasan
  };
});
