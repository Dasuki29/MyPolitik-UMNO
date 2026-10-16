/* ==========================================================================
   Nusa Politik — js/negeri.js   (v7.34)  Badan Perhubungan UMNO Negeri (lantikan Presiden)
   Peringkat negeri TIDAK dipilih melalui undian. Pengerusi Badan Perhubungan Negeri dilantik oleh Presiden
   daripada Ketua-Ketua Bahagian di negeri itu; Pengerusi kemudian melantik AJK (Timbalan, Naib, Setiausaha,
   Bendahari, Ketua Penerangan) daripada Ketua-Ketua Bahagian yang sama.

     p.negeriBP = { tahunLantik, negeri, dekat:0-100, dekatBulan:'T-B', bil, pengerusi:{id,nama,bahagian,pemain},
                    ajk:[{jawatan,id,nama,bahagian}], menunggu:null|'pilih_pengerusi'|'lantik_ajk', calon:[...], sejarah:[] }

   Kelayakan pemain: mesti memegang jawatan Ketua Bahagian di negeri sendiri.
   Kedekatan dengan Presiden (0-100): tindakan "Dekati Presiden" (2 AP + RM1,500, maks 2 kali sebulan) dan susut perlahan.
   Skor pemain = 45% kedekatan + 20% sokongan (AJK, Perwakilan) + 20% IP + 15% Reputasi (+ bonus penyandang).
   Skor Ketua Bahagian NPC dijana berbenih. Presiden memilih skor tertinggi (+/- sedikit rawak).
   Lantikan: bulan 9 tahun pemilihan (selepas PAU bulan 8). Pertengahan penggal: Pengerusi boleh digugurkan (rawak) lalu diganti.
   Kuasa Pengerusi (pemain): lantik AJK, +3 IP dan +1 sokongan AJK setiap bulan, boleh digugurkan jika sokongan Perwakilan < 25.
   Jika pemain ialah Presiden: pemain memilih Pengerusi negerinya sendiri; negeri lain automatik.
   ANDAIAN: bilangan bahagian per negeri ikut data parlimen sebenar; nama bahagian NPC dipaparkan sebagai nombor sahaja.
   ========================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikNegeri = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  var CONFIG = {
    BULAN_LANTIK: 9, KOS_AP: 2, KOS_MYR: 1500, DEKAT_NAIK: 10, DEKAT_MAKS_BULAN: 2, DEKAT_SUSUT: 1, DEKAT_LANTAI: 10,
    PELUANG_GUGUR: { EASY: 0.01, NORMAL: 0.025, HARDCORE: 0.05 }, BONUS_PENYANDANG: 8, GUGUR_PERWAKILAN: 25,
    BONUS_IP: 3, BONUS_AJK: 1, KESAN_AJK: 1
  };
  var JAWATAN_AJK = ['Timbalan Pengerusi', 'Naib Pengerusi', 'Setiausaha', 'Bendahari', 'Ketua Penerangan'];
  var BIL_BAHAGIAN = { johor: 26, kedah: 15, kelantan: 14, melaka: 6, 'negeri sembilan': 8, pahang: 14, 'pulau pinang': 13, perak: 24, perlis: 3,
    selangor: 22, terengganu: 8, sabah: 25, sarawak: 31, 'kuala lumpur': 11, labuan: 1, putrajaya: 1 };
  var NAMA_L = ['Ismail', 'Faizal', 'Rosli', 'Hafiz', 'Azman', 'Kamarul', 'Zulkifli', 'Razak', 'Shahrul', 'Mazlan', 'Fadzil', 'Hisham', 'Nasir', 'Amran', 'Jamal', 'Idris'];
  var NAMA_2 = ['Harun', 'Rahman', 'Hamid', 'Yusof', 'Ahmad', 'Daud', 'Ibrahim', 'Othman', 'Jaafar', 'Salleh', 'Mansor', 'Abdullah', 'Zakaria', 'Hashim'];

  function S() { return root.MyPolitikSave || (typeof require === 'function' ? tryReq('./save.js') : null); }
  function tryReq(f) { try { return require(f); } catch (e) { return null; } }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function salin(o) { return JSON.parse(JSON.stringify(o)); }
  function adaJawatan(p, kod) { return ((p && p.jawatanList) || []).some(function (j) { return j.kod === kod; }); }
  function layak(p) { return adaJawatan(p, 'ketua_bahagian'); }
  function sayaPresiden(p) { return adaJawatan(p, 'presiden'); }
  function tahunPemilihan(p) { var E = root.MyPolitikElection || (typeof require === 'function' ? tryReq('./election.js') : null); return !!(E && E.adalahTahunPemilihan && E.adalahTahunPemilihan(p.tahun)); }
  function tahap(p) { var k = p && p.settings && p.settings.difficultyLevel; return CONFIG.PELUANG_GUGUR[k] ? k : 'NORMAL'; }

  function bilBahagian(p) {
    var n = String(p.negeri || '').toLowerCase().replace(/^w\.?p\.?\s*/, '').replace(/^wilayah persekutuan\s*/, '').replace(/^n\.\s*/, 'negeri ').trim();
    var kunci = Object.keys(BIL_BAHAGIAN).filter(function (k) { return n.indexOf(k) >= 0 || k.indexOf(n) >= 0; })[0];
    return Math.max(2, kunci ? BIL_BAHAGIAN[kunci] : 12);       // sekurang-kurangnya 2 supaya ada calon & persaingan
  }

  /* ---- Presiden (nama sama seperti paparan Struktur) ---- */
  function namaPresiden(p) {
    if (sayaPresiden(p)) { return p.nama || 'Anda'; }
    var OG = root.MyPolitikOrganisasi;
    try { if (OG && OG.getStruktur) { return OG.getStruktur(p).induk.pusat.ketua.nama; } } catch (e) { /* jatuh ke lalai */ }
    return 'Presiden Parti';
  }

  /* ---- Senarai Ketua Bahagian negeri (NPC berbenih + pemain jika layak) ---- */
  function skorPemain(p, bp) {
    var k = p.kesetiaan || {}, sokong = ((Number(k.ajk) || 0) + (Number(k.perwakilan) || 0)) / 2;
    var ip = Math.min(100, 100 * (Number(p.ip) || 0) / 250), rep = clamp(Number(p.reputasi) || 0, 0, 100);
    var s = 0.45 * (bp ? bp.dekat : 0) + 0.2 * sokong + 0.2 * ip + 0.15 * rep;
    if (bp && bp.pengerusi && bp.pengerusi.pemain) { s += CONFIG.BONUS_PENYANDANG; }
    return Math.round(clamp(s, 0, 100) * 10) / 10;
  }
  function janaNama(rng) { return NAMA_L[Math.floor(rng() * NAMA_L.length)] + ' ' + NAMA_2[Math.floor(rng() * NAMA_2.length)]; }

  /** Senarai calon (Ketua Bahagian) dengan skor. musim = benih (tahun lantikan) supaya NPC stabil dalam satu kitaran. */
  function senaraiCalon(p, bp, musim) {
    var n = bilBahagian(p), rng = S().rngBerbenih(String(p.id) + '|negeriBP|' + musim), out = [], ada = layak(p), pemainDi = Math.floor(rng() * n);
    for (var i = 0; i < n; i++) {
      var nama = "Dato' " + janaNama(rng), skor = 25 + rng() * 40;
      if (bp && bp.pengerusi && !bp.pengerusi.pemain && bp.pengerusi.id === 'b' + (i + 1)) { skor += CONFIG.BONUS_PENYANDANG; }
      if (ada && i === pemainDi) { out.push({ id: 'pemain', nama: p.nama || 'Anda', bahagian: p.bahagian || ('Bahagian ' + (i + 1)), pemain: true, skor: skorPemain(p, bp) }); }
      else { out.push({ id: 'b' + (i + 1), nama: nama, bahagian: 'Bahagian ' + (i + 1), pemain: false, skor: Math.round(skor * 10) / 10 }); }
    }
    return out.sort(function (a, b) { return b.skor - a.skor; });
  }

  function keadaan(p) {
    var bp = p.negeriBP && typeof p.negeriBP === 'object' ? p.negeriBP : null;
    if (!bp) { bp = { tahunLantik: 0, negeri: p.negeri || '', dekat: 15, dekatBulan: '', pengerusi: null, ajk: [], menunggu: null, calon: [], sejarah: [] }; }
    if (!bp.pengerusi) {                                           // permulaan: Pengerusi NPC sedia ada (bukan pemain)
      var c = senaraiCalon(p, bp, 'mula').filter(function (x) { return !x.pemain; })[0];
      bp.pengerusi = { id: c.id, nama: c.nama, bahagian: c.bahagian, pemain: false }; bp.tahunLantik = p.tahun; bp.musimLantik = 0;
      bp.ajk = ajkNpc(p, bp, c.id);
    }
    return bp;
  }

  function ajkNpc(p, bp, kecuali) {
    var rng = S().rngBerbenih(String(p.id) + '|ajkNPC|' + (bp.tahunLantik || 0) + '|' + kecuali);
    var c = senaraiCalon(p, bp, 'ajk' + (bp.tahunLantik || 0)).filter(function (x) { return !x.pemain && x.id !== kecuali; });
    return JAWATAN_AJK.slice(0, Math.min(JAWATAN_AJK.length, c.length)).map(function (j, i) { var x = c[Math.floor(rng() * c.length)] || c[0]; c = c.filter(function (y) { return y !== x; }); return { jawatan: j, id: x.id, nama: x.nama, bahagian: x.bahagian }; });
  }

  function simpan(bp, kesan, log) {
    return S().applyEffects(kesan || {}, { kiraTindakan: false, patch: { negeriBP: bp }, log: log || undefined });
  }

  /* ---- Lantikan oleh Presiden ---- */
  function lantik(p, bp, sebab) {
    var ev = [], calon = senaraiCalon(p, bp, 'lantik' + p.tahun + (sebab || '')), rng = S().rngBerbenih(String(p.id) + '|pilih|' + p.tahun + '|' + (sebab || '')), menang;
    if (sayaPresiden(p)) {                                         // pemain ialah Presiden: pilih Pengerusi negeri sendiri
      bp.menunggu = 'pilih_pengerusi'; bp.calon = calon.filter(function (c) { return !c.pemain; }).slice(0, 6);
      bp.tahunLantik = p.tahun; bp.musimLantik = p.tahun; return { ev: [{ jenis: 'lantikan_negeri', mesej: 'Sebagai Presiden, anda perlu melantik Pengerusi Badan Perhubungan ' + (p.negeri || 'negeri') + ' daripada Ketua-Ketua Bahagian.' }] };
    }
    menang = calon.map(function (c) { return { c: c, n: c.skor + (rng() * 12 - 6) }; }).sort(function (a, b) { return b.n - a.n; })[0].c;
    var lama = bp.pengerusi, kedudukan = calon.findIndex(function (c) { return c.pemain; }) + 1;
    bp.sejarah = (bp.sejarah || []).concat([{ tahun: p.tahun, nama: menang.nama }]).slice(-6);
    bp.pengerusi = { id: menang.id, nama: menang.nama, bahagian: menang.bahagian, pemain: menang.pemain }; bp.tahunLantik = p.tahun; bp.musimLantik = p.tahun; bp.menunggu = null; bp.calon = [];
    if (menang.pemain) {
      bp.menunggu = 'lantik_ajk'; bp.calon = calon.filter(function (c) { return !c.pemain; }); bp.ajk = []; bp.maksAjk = Math.min(JAWATAN_AJK.length, bp.calon.length);
      ev.push({ jenis: 'lantikan_negeri', mesej: 'Presiden ' + namaPresiden(p) + ' melantik anda sebagai Pengerusi Badan Perhubungan UMNO ' + (p.negeri || 'negeri') + '. Anda kini boleh melantik AJK daripada Ketua-Ketua Bahagian.' });
    } else {
      bp.ajk = ajkNpc(p, bp, menang.id);
      var pesan = lama && lama.pemain ? 'Anda tidak lagi dilantik sebagai Pengerusi.' : (layak(p) ? 'Anda berada di kedudukan #' + kedudukan + ' daripada ' + calon.length + ' Ketua Bahagian.' : 'Anda tidak layak kerana bukan Ketua Bahagian.');
      ev.push({ jenis: 'lantikan_negeri', mesej: 'Presiden ' + namaPresiden(p) + ' melantik ' + menang.nama + ' (' + menang.bahagian + ') sebagai Pengerusi Badan Perhubungan UMNO ' + (p.negeri || 'negeri') + '. ' + pesan });
    }
    return { ev: ev, menang: menang };
  }

  /** Denyut bulanan (dipanggil oleh Calendar.majuBulan). Pulang { peristiwa }. */
  function prosesBulan(opts) {
    opts = opts || {};
    var s = S(), p = s && s.loadPlayer(), ev = [];
    if (!p || p.tamat) { return { peristiwa: ev }; }
    var bp = keadaan(p), rng = opts.rng || s.rngBerbenih(String(p.id) + '|negeriTick|' + p.tahun + '|' + p.bulan), kesan = {};
    var baru = (Number(p.bulan) === CONFIG.BULAN_LANTIK && tahunPemilihan(p) && bp.musimLantik !== p.tahun);
    if (baru) { ev = ev.concat(lantik(p, bp, '').ev); }
    else if (bp.pengerusi.pemain && !layak(p)) {                    // hilang jawatan Ketua Bahagian
      ev = ev.concat(gugur(p, bp, 'Anda tidak lagi memegang jawatan Ketua Bahagian, maka Presiden menamatkan lantikan anda sebagai Pengerusi.'));
    } else if (bp.pengerusi.pemain && (Number((p.kesetiaan || {}).perwakilan) || 0) < CONFIG.GUGUR_PERWAKILAN) {
      ev = ev.concat(gugur(p, bp, 'Sokongan Perwakilan anda jatuh di bawah ' + CONFIG.GUGUR_PERWAKILAN + '%. Presiden menggugurkan anda sebagai Pengerusi.'));
    } else if (!bp.menunggu && rng() < CONFIG.PELUANG_GUGUR[tahap(p)]) {   // pertengahan penggal: NPC (atau pemain berskor rendah) diganti
      var sasarPemain = bp.pengerusi.pemain && skorPemain(p, bp) < 45 && rng() < 0.5;
      if (!bp.pengerusi.pemain || sasarPemain) { ev = ev.concat(gugur(p, bp, bp.pengerusi.pemain ? 'Presiden kurang yakin dengan prestasi anda dan menggantikan anda.' : bp.pengerusi.nama + ' meletak jawatan sebagai Pengerusi Badan Perhubungan ' + (p.negeri || 'negeri') + '.')); }
    }
    if (bp.pengerusi.pemain && !bp.menunggu) { kesan = { ip: CONFIG.BONUS_IP, kesetiaan: { ajk: CONFIG.BONUS_AJK } }; }
    if (bp.dekat > CONFIG.DEKAT_LANTAI) { bp.dekat = Math.max(CONFIG.DEKAT_LANTAI, bp.dekat - CONFIG.DEKAT_SUSUT); }
    simpan(bp, kesan, bp.pengerusi.pemain && !bp.menunggu ? { tindakan: 'pengerusi_negeri', nama: 'Elaun Pengerusi Badan Perhubungan Negeri', peringkat: 'negeri' } : null);
    return { peristiwa: ev };
  }

  function gugur(p, bp, mesej) {
    var lama = bp.pengerusi, calon = senaraiCalon(p, bp, 'ganti' + p.tahun + p.bulan).filter(function (c) { return !c.pemain && (!lama || c.id !== lama.id); });
    var ganti = calon[0];
    if (sayaPresiden(p)) { bp.menunggu = 'pilih_pengerusi'; bp.calon = calon.slice(0, 6); return [{ jenis: 'lantikan_negeri', mesej: mesej + ' Sila lantik pengganti.' }]; }
    bp.pengerusi = { id: ganti.id, nama: ganti.nama, bahagian: ganti.bahagian, pemain: false }; bp.tahunLantik = p.tahun; bp.ajk = ajkNpc(p, bp, ganti.id); bp.menunggu = null; bp.calon = [];
    return [{ jenis: 'lantikan_negeri', mesej: mesej + ' Presiden ' + namaPresiden(p) + ' melantik ' + ganti.nama + ' sebagai pengganti.' }];
  }

  /* ---- Tindakan pemain ---- */
  function dekatiPresiden() {
    var s = S(), p = s.loadPlayer(); if (!p) { return { ok: false, ralat: 'Tiada profil.' }; }
    if (sayaPresiden(p)) { return { ok: false, ralat: 'Anda ialah Presiden.' }; }
    if (!layak(p)) { return { ok: false, ralat: 'Hanya Ketua Bahagian layak dilantik sebagai Pengerusi Badan Perhubungan Negeri.' }; }
    var bp = keadaan(p), kunci = p.tahun + '-' + p.bulan, kali = bp.dekatBulan && bp.dekatBulan.indexOf(kunci + ':') === 0 ? parseInt(bp.dekatBulan.split(':')[1], 10) : 0;
    if (kali >= CONFIG.DEKAT_MAKS_BULAN) { return { ok: false, ralat: 'Had ' + CONFIG.DEKAT_MAKS_BULAN + ' kali bulan ini telah dicapai.' }; }
    bp.dekat = clamp(bp.dekat + CONFIG.DEKAT_NAIK, 0, 100); bp.dekatBulan = kunci + ':' + (kali + 1);
    var r = s.applyEffects({ ap: -CONFIG.KOS_AP, myr: -CONFIG.KOS_MYR }, { kiraTindakan: true, patch: { negeriBP: bp }, log: { tindakan: 'dekati_presiden', nama: 'Dekati Presiden ' + namaPresiden(p), peringkat: 'negeri' } });
    if (!r.ok) { return { ok: false, ralat: r.ralat }; }
    return { ok: true, mesej: 'Anda mendekati Presiden ' + namaPresiden(p) + '. Kedekatan kini ' + bp.dekat + '%.' };
  }

  function pilihPengerusi(id) {
    var s = S(), p = s.loadPlayer(), bp = p && keadaan(p);
    if (!bp || bp.menunggu !== 'pilih_pengerusi') { return { ok: false, ralat: 'Tiada lantikan menunggu.' }; }
    var c = (bp.calon || []).filter(function (x) { return x.id === id; })[0] || bp.calon[0];
    bp.pengerusi = { id: c.id, nama: c.nama, bahagian: c.bahagian, pemain: false }; bp.menunggu = null; bp.calon = []; bp.ajk = ajkNpc(p, bp, c.id); bp.tahunLantik = p.tahun;
    var r = simpan(bp, { kesetiaan: { perwakilan: 2 } }, { tindakan: 'lantik_pengerusi', nama: 'Melantik ' + c.nama + ' (Pengerusi ' + (p.negeri || 'negeri') + ')', peringkat: 'negeri' });
    return r.ok ? { ok: true, mesej: c.nama + ' dilantik sebagai Pengerusi Badan Perhubungan ' + (p.negeri || 'negeri') + '.' } : { ok: false, ralat: r.ralat };
  }

  /** Lantik AJK (jawatan, id calon). Jika id kosong: cadangan automatik bagi semua jawatan yang tinggal. */
  function lantikAjk(jawatan, id) {
    var s = S(), p = s.loadPlayer(), bp = p && keadaan(p);
    if (!bp || bp.menunggu !== 'lantik_ajk') { return { ok: false, ralat: 'Tiada lantikan AJK menunggu.' }; }
    var maks = bp.maksAjk || JAWATAN_AJK.length, sudah = bp.ajk.map(function (a) { return a.id; }), baki = JAWATAN_AJK.slice(0, maks).filter(function (j) { return !bp.ajk.some(function (a) { return a.jawatan === j; }); });
    var bil = 0, sasar = id ? [[jawatan || baki[0], id]] : baki.map(function (j) { return [j, null]; });
    sasar.forEach(function (x) {
      var c = (bp.calon || []).filter(function (y) { return (x[1] ? y.id === x[1] : sudah.indexOf(y.id) < 0) && sudah.indexOf(y.id) < 0; })[0];
      if (!c || bp.ajk.some(function (a) { return a.jawatan === x[0]; })) { return; }
      bp.ajk.push({ jawatan: x[0], id: c.id, nama: c.nama, bahagian: c.bahagian }); sudah.push(c.id); bil++;
    });
    if (!bil) { return { ok: false, ralat: 'Calon tidak sah atau jawatan sudah diisi.' }; }
    if (bp.ajk.length >= maks) { bp.menunggu = null; bp.calon = []; }
    var r = simpan(bp, { kesetiaan: { perwakilan: CONFIG.KESAN_AJK * bil } }, { tindakan: 'lantik_ajk', nama: 'Melantik ' + bil + ' AJK Badan Perhubungan', peringkat: 'negeri' });
    return r.ok ? { ok: true, mesej: bil + ' AJK dilantik.', selesai: !bp.menunggu } : { ok: false, ralat: r.ralat };
  }

  /** Keputusan menunggu pemain (untuk pop-up): null | { jenis, jawatan?, calon[] }. */
  function menunggu(p) {
    p = p || (S() && S().loadPlayer()); if (!p || !p.negeriBP) { return null; }
    var bp = p.negeriBP;
    if (bp.menunggu === 'pilih_pengerusi') { return { jenis: 'pilih_pengerusi', calon: bp.calon || [] }; }
    if (bp.menunggu === 'lantik_ajk') {
      var j = JAWATAN_AJK.slice(0, bp.maksAjk || JAWATAN_AJK.length).filter(function (x) { return !bp.ajk.some(function (a) { return a.jawatan === x; }); })[0];
      if (!j) { return null; }
      var dipakai = bp.ajk.map(function (a) { return a.id; });
      return { jenis: 'lantik_ajk', jawatan: j, calon: (bp.calon || []).filter(function (c) { return dipakai.indexOf(c.id) < 0; }).slice(0, 8) };
    }
    return null;
  }

  /** Ringkasan status untuk UI. */
  function status(p) {
    var bp = keadaan(p), calon = senaraiCalon(p, bp, 'lantik' + bp.tahunLantik), kedudukan = calon.findIndex(function (c) { return c.pemain; }) + 1;
    return { bp: bp, presiden: namaPresiden(p), layak: layak(p), skor: layak(p) ? skorPemain(p, bp) : null, kedudukan: kedudukan, jumlah: calon.length, sayaPengerusi: !!(bp.pengerusi && bp.pengerusi.pemain), sayaPresiden: sayaPresiden(p) };
  }

  function htmlKad(p) {
    if (!p) { return ''; }
    var st = status(p), bp = st.bp, h = '<div class="card pp-negeri"><h3>Badan Perhubungan UMNO ' + esc(p.negeri || 'Negeri') + '</h3>';
    h += '<p class="note">Peringkat negeri tiada pengundian: Pengerusi dilantik oleh Presiden daripada Ketua-Ketua Bahagian (lantikan baharu bulan ' + CONFIG.BULAN_LANTIK + ' tahun pemilihan).</p>';
    h += '<div class="kv"><span>Presiden</span><b>' + esc(st.presiden) + '</b></div>';
    h += '<div class="kv"><span>Pengerusi</span><b>' + esc(bp.pengerusi.nama) + (bp.pengerusi.pemain ? ' (anda)' : '') + ' &middot; ' + esc(bp.pengerusi.bahagian) + '</b></div>';
    if (st.layak && !st.sayaPresiden) {
      h += '<div class="kv"><span>Kedekatan dengan Presiden</span><b>' + bp.dekat + '%</b></div><div class="rv-m"><i class="a" style="width:' + bp.dekat + '%"></i><i class="b" style="width:' + (100 - bp.dekat) + '%"></i></div>';
      h += '<div class="kv"><span>Kedudukan anda</span><b>#' + st.kedudukan + ' / ' + st.jumlah + ' Ketua Bahagian (skor ' + st.skor + ')</b></div>';
      h += '<button type="button" class="btn btn--gold" data-act="dekati-presiden">Dekati Presiden (' + CONFIG.KOS_AP + ' AP, RM ' + CONFIG.KOS_MYR.toLocaleString('ms-MY') + ')</button>';
    } else if (!st.sayaPresiden) { h += '<p class="note">Anda belum layak dilantik: hanya <b>Ketua Bahagian</b> negeri ini layak menjadi Pengerusi.</p>'; }
    var m = menunggu(p);
    if (m) { h += '<button type="button" class="btn btn--gold" data-act="urus-negeri" style="margin-top:.5rem">' + (m.jenis === 'pilih_pengerusi' ? 'Lantik Pengerusi' : 'Lantik AJK (' + esc(m.jawatan) + ')') + '</button>'; }
    if (bp.ajk && bp.ajk.length) {
      h += '<details class="org-ajk"><summary>AJK Badan Perhubungan (' + bp.ajk.length + ')</summary>' + bp.ajk.map(function (a) {
        return '<div class="org-baris"><span>' + esc(a.jawatan) + '</span><span>' + esc(a.nama) + ' &middot; ' + esc(a.bahagian) + '</span></div>'; }).join('') + '</details>';
    }
    return h + '</div>';
  }

  return { CONFIG: CONFIG, JAWATAN_AJK: JAWATAN_AJK, prosesBulan: prosesBulan, dekatiPresiden: dekatiPresiden, pilihPengerusi: pilihPengerusi, lantikAjk: lantikAjk,
    menunggu: menunggu, status: status, htmlKad: htmlKad, layak: layak, _senaraiCalon: senaraiCalon, _keadaan: keadaan };
});
