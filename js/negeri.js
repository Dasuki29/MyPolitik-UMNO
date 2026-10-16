/* ==========================================================================
   Nusa Politik — js/negeri.js   (v7.34)  Badan Perhubungan UMNO Negeri (lantikan Presiden)
   Peringkat negeri TIDAK dipilih melalui undian. Pengerusi Badan Perhubungan Negeri dilantik oleh Presiden daripada
   Ketua-Ketua Bahagian di negeri itu; Pengerusi kemudian melantik AJK.

     p.negeriBP = { tahunLantik, musimLantik, dekat:0-100, dekatBulan, lobiTahun, bonusTahun, bonusSkor, guna:{kunci:tempoh},
                    pengerusi:{id,nama,bahagian,pemain}, wajib:[{id,nama,bahagian}], ajk:[{jawatan,id,nama,bahagian,kategori}],
                    menunggu:null|'pilih_pengerusi'|'lantik_ajk', calon:[...], luar:[...], posts:[...], langkau:[...], sejarah:[], pruDilihat }

   SAYAP (v7.36): mekanik SAMA untuk Pemuda/Puteri/Wanita melalui MyPolitikNegeri.sayap (p.negeriSayap). Pemberi lantikan = Ketua Sayap Pusat;
   layak = Ketua Sayap Bahagian (sayap_bahagian_<sayap>); Pengerusi = Ketua <Sayap> Negeri. Istilah diterjemah pada sempadan output (tr()).

   NEGERI: Wilayah Persekutuan = Kuala Lumpur + Putrajaya + Labuan (13 bahagian, satu Badan Perhubungan).
   NEGERI KECIL (6 bahagian atau kurang, cth Perlis, Melaka): semua Ketua Bahagian automatik menjadi ahli (WAJIB, bukan lantikan).
     Pengerusi memilih Timbalan & Naib daripada mereka, dan melantik LUAR (Setiausaha, Bendahari, Ketua Penerangan, AJK) daripada
     Ketua Sayap negeri, Tokoh/ADUN dan Naib Ketua Bahagian.
   NEGERI LAIN: 5 jawatan daripada Ketua Bahagian + sehingga 2 lantikan luar pilihan (AJK Tambahan).

   LOBI (pemain Ketua Bahagian sahaja): selepas keputusan pemilihan Bahagian (bulan 7) pop-up menawarkan 4 pendekatan.
   Kedekatan dengan Presiden (0-100) juga naik dengan tindakan "Dekati Presiden".
   Skor pemain = 45% kedekatan + 20% sokongan (AJK, Perwakilan) + 20% IP + 15% Reputasi (+ penyandang, + laporan prestasi).
   Lantikan: bulan 9 tahun pemilihan. Pertengahan penggal: Pengerusi boleh digugurkan (rawak). Pemain Presiden memilih sendiri.

   KUASA PENGERUSI (pemain): ex-officio MKT (dikira pangkat 8 untuk syarat jawatan pusat), +3 IP & +1 sokongan AJK sebulan,
     Lawatan Negeri, Kenyataan Media Negeri, Syor Calon, Runding Kerusi BN. NOTA: Syor Calon & Runding Kerusi menambah IP/Reputasi/
     sokongan; ia TIDAK mengubah kiraan kerusi PRU secara langsung. Digugurkan jika Perwakilan < 25%, tidak lagi Ketua Bahagian,
     atau kalah dalam pilihan raya (50%).
   ========================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikNegeri = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  var SUMBER_BHG = null;                                          // fungsi(p) -> [nama bahagian dalam negeri pemain] (dipasang oleh app.js)
  var CONFIG = {
    BULAN_LANTIK: 9, BULAN_LOBI_MULA: 7, BULAN_LOBI_TAMAT: 8, KOS_AP: 2, KOS_MYR: 1500, DEKAT_NAIK: 10, DEKAT_MAKS_BULAN: 2, DEKAT_SUSUT: 1, DEKAT_LANTAI: 10,
    PELUANG_GUGUR: { EASY: 0.01, NORMAL: 0.025, HARDCORE: 0.05 }, BONUS_PENYANDANG: 8, GUGUR_PERWAKILAN: 25, GUGUR_KALAH: 0.5,
    BONUS_IP: 3, BONUS_AJK: 1, KESAN_AJK: 1, KESAN_LAIN: 1, NEGERI_KECIL: 6
  };
  var JAWATAN_KB = ['Timbalan Pengerusi', 'Naib Pengerusi'];
  var JAWATAN_LUAR_KECIL = ['Setiausaha', 'Bendahari', 'Ketua Penerangan', 'AJK'];
  var JAWATAN_BESAR = ['Timbalan Pengerusi', 'Naib Pengerusi', 'Setiausaha', 'Bendahari', 'Ketua Penerangan'];
  var BIL_BAHAGIAN = { johor: 26, kedah: 15, kelantan: 14, melaka: 6, 'negeri sembilan': 8, pahang: 14, 'pulau pinang': 13, perak: 24, perlis: 3,
    selangor: 22, terengganu: 8, sabah: 25, sarawak: 31, 'wilayah persekutuan': 13 };
  var KEY_NAMA = { johor: 'Johor', kedah: 'Kedah', kelantan: 'Kelantan', melaka: 'Melaka', 'negeri sembilan': 'Negeri Sembilan', pahang: 'Pahang', 'pulau pinang': 'Pulau Pinang', perak: 'Perak', perlis: 'Perlis',
    selangor: 'Selangor', terengganu: 'Terengganu', sabah: 'Sabah', sarawak: 'Sarawak', 'wilayah persekutuan': 'Wilayah Persekutuan' };
  var NAMA_SAYAP = { pemuda: 'Pemuda', puteri: 'Puteri', wanita: 'Wanita' };
  var NAMA_L = ['Ismail', 'Faizal', 'Rosli', 'Hafiz', 'Azman', 'Kamarul', 'Zulkifli', 'Razak', 'Shahrul', 'Mazlan', 'Fadzil', 'Hisham', 'Nasir', 'Amran', 'Jamal', 'Idris'];
  var NAMA_P = ['Norhayati', 'Salmah', 'Rohana', 'Zaleha', 'Aminah', 'Faridah', 'Suraya', 'Marlina', 'Haslinda', 'Rosnah'];
  var NAMA_2 = ['Harun', 'Rahman', 'Hamid', 'Yusof', 'Ahmad', 'Daud', 'Ibrahim', 'Othman', 'Jaafar', 'Salleh', 'Mansor', 'Abdullah', 'Zakaria', 'Hashim'];
  var KATEGORI_LUAR = {
    sayap: { label: 'Ketua Sayap', kesan: { kesetiaan: { akarUmbi: 1 } }, ringkas: 'Akar Umbi +1' },
    tokoh: { label: 'Tokoh / ADUN', kesan: { reputasi: 1 }, ringkas: 'Reputasi +1' },
    naib:  { label: 'Naib Ketua Bahagian', kesan: { kesetiaan: { ajk: 1 } }, ringkas: 'AJK +1' }
  };
  var LOBI = {
    mengadap:  { label: 'Mengadap Presiden', ap: 2, myr: 0,     dekat: 15, huraian: '2 AP · Kedekatan +15 · Tiada risiko' },
    mkt:       { label: 'Lobi Naib Presiden & Ahli MKT', ap: 3, myr: 3000,  dekat: 20, huraian: '3 AP · RM3,000 · Kedekatan +20 · 25% dilihat berpolitik (Reputasi -3)' },
    sumbangan: { label: 'Sumbangan besar ke dana parti negeri', ap: 0, myr: 10000, dekat: 25, huraian: 'RM10,000 · Kedekatan +25 · 15% aduan etika' },
    laporan:   { label: 'Bawa laporan prestasi bahagian', ap: 1, myr: 0, dekat: 8, huraian: '1 AP · Kedekatan +8 · Skor prestasi +5' }
  };
  var TINDAKAN = {
    lawatan: { label: 'Lawatan Negeri', ap: 2, myr: 2000, had: 'bulan', kesan: { kesetiaan: { akarUmbi: 3, ketuaCawangan: 2 } }, mesej: 'Anda mengadakan lawatan ke bahagian-bahagian di seluruh negeri.' },
    media:   { label: 'Kenyataan Media Negeri', ap: 1, myr: 0, had: 'bulan', kesan: { reputasi: 2, ip: 2 }, mesej: 'Kenyataan media anda mendapat liputan meluas di negeri.' },
    syor:    { label: 'Syor Calon kepada Presiden', ap: 3, myr: 0, had: 'tahun', kesan: { kesetiaan: { perwakilan: 3 }, ip: 5 }, mesej: 'Syor calon anda diterima baik oleh bahagian-bahagian sekutu.' },
    runding: { label: 'Runding Kerusi BN Negeri', ap: 4, myr: 5000, had: 'tahun', kesan: { reputasi: 3, ip: 6 }, mesej: 'Rundingan kerusi dengan rakan komponen berjalan lancar.' }
  };

  function bina(ctx) {
  /* terjemah istilah induk -> sayap pada sempadan output sahaja (data tersimpan kekal istilah induk) */
  function WN() { var p0 = S() && S().loadPlayer(); return (p0 && NAMA_SAYAP[p0.sayap]) || 'Sayap'; }
  function tr(t) {
    if (!ctx.sayap || typeof t !== 'string') { return t; }
    var W = WN(), K = 'Ketua ' + W;
    return t.replace(/Lobi Naib Presiden & Ahli MKT/g, 'Lobi Naib ' + K + ' & Majlis Tertinggi').replace(/Naib Ketua Bahagian/g, 'Naib ' + K + ' Bahagian')
      .replace(/Ketua-Ketua Bahagian/g, 'Ketua-Ketua ' + W + ' Bahagian').replace(/Ketua Bahagian/g, K + ' Bahagian')
      .replace(/Pengerusi Badan Perhubungan UMNO/g, K + ' Negeri UMNO').replace(/Pengerusi Badan Perhubungan Negeri/g, K + ' Negeri').replace(/Pengerusi Badan Perhubungan/g, K + ' Negeri')
      .replace(/Badan Perhubungan UMNO/g, W + ' UMNO Negeri').replace(/Badan Perhubungan/g, W + ' Negeri').replace(/Pengerusi/g, K + ' Negeri')
      .replace(/Presiden/g, K).replace(/MKT/g, 'Majlis Tertinggi ' + W).replace(/PAU/g, 'Perhimpunan Sayap');
  }
  function trObj(o) {
    if (!ctx.sayap) { return o; }
    if (typeof o === 'string') { return tr(o); }
    if (Array.isArray(o)) { return o.map(trObj); }
    if (o && typeof o === 'object') { var r = {}; Object.keys(o).forEach(function (k) { r[k] = (k === 'id' || k === 'jawatan' || k === 'jenis' || k === 'kategori' || k === 'sumber') ? o[k] : trObj(o[k]); }); return r; }
    return o;
  }

  function S() { return root.MyPolitikSave || (typeof require === 'function' ? tryReq('./save.js') : null); }
  function tryReq(f) { try { return require(f); } catch (e) { return null; } }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function adaJawatan(p, kod) { return ((p && p.jawatanList) || []).some(function (j) { return j.kod === kod; }); }
  function layak(p) { return ctx.aktif(p) && adaJawatan(p, ctx.kodKB(p)); }
  function sayaPresiden(p) { return ctx.aktif(p) && adaJawatan(p, ctx.kodPemberi(p)); }
  function tahunPemilihan(p) { var E = root.MyPolitikElection || (typeof require === 'function' ? tryReq('./election.js') : null); return !!(E && E.adalahTahunPemilihan && E.adalahTahunPemilihan(p.tahun)); }
  function tahap(p) { var k = p && p.settings && p.settings.difficultyLevel; return CONFIG.PELUANG_GUGUR[k] ? k : 'NORMAL'; }

  /** Kunci negeri: Kuala Lumpur, Putrajaya dan Labuan digabung sebagai Wilayah Persekutuan. */
  function kunciNegeri(p) {
    var n = String(p.negeri || '').toLowerCase();
    if (/kuala lumpur|putrajaya|labuan|wilayah/.test(n)) { return 'wilayah persekutuan'; }
    n = n.replace(/^n\.\s*/, 'negeri ').trim();
    return Object.keys(BIL_BAHAGIAN).filter(function (k) { return n.indexOf(k) >= 0 || k.indexOf(n) >= 0; })[0] || null;
  }
  function namaNegeri(p) { var k = kunciNegeri(p); return k === 'wilayah persekutuan' ? 'Wilayah Persekutuan' : (p.negeri || 'Negeri'); }
  function bilBahagian(p) { var k = kunciNegeri(p); return Math.max(2, k ? BIL_BAHAGIAN[k] : 12); }
  /* ---- Nama bahagian sebenar (sumber: app.js, daripada data geo) ---- */
  function norm(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function kolamBhg(p, termasukSendiri, negeriNama) {
    var senarai = [];
    try { senarai = (SUMBER_BHG && SUMBER_BHG(p, negeriNama)) || []; } catch (e) { senarai = []; }
    var sendiri = norm(p.bahagian), rng = S().rngBerbenih(String(p.id) + '|namaBhg' + (negeriNama || '')), a = senarai.filter(function (x) { return termasukSendiri || norm(x) !== sendiri; });
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  /** Nama bahagian untuk slot ke-i (0-asas); pemainDi = slot pemain (dilangkau). Jatuh ke 'Bahagian N' jika data tiada. */
  function namaBhg(p, i, pemainDi) {
    var ada = pemainDi !== undefined && pemainDi !== null, k = kolamBhg(p, !ada), idx = (pemainDi !== undefined && pemainDi !== null && i > pemainDi) ? i - 1 : i;
    return k.length > idx ? k[idx] : 'Bahagian ' + (i + 1);
  }
  /** Paparan: tukar 'Bahagian N' lama (simpanan sedia ada) kepada nama sebenar. */
  function labelBhg(p, t) {
    var m = /^Bahagian (\d+)$/.exec(String(t || '')); if (!m) { return t; }
    var k = kolamBhg(p, true); return k.length ? k[(parseInt(m[1], 10) - 1) % k.length] : t;
  }
  function negeriKecil(p) { return bilBahagian(p) <= CONFIG.NEGERI_KECIL; }
  function jawatanLuar(p) { return negeriKecil(p) ? JAWATAN_LUAR_KECIL : ['AJK Tambahan 1', 'AJK Tambahan 2']; }
  function jawatanKB(p) { return negeriKecil(p) ? JAWATAN_KB : JAWATAN_BESAR; }

  /* ---- Presiden (nama sama seperti paparan Struktur) ---- */
  function namaPresiden(p) {
    if (sayaPresiden(p)) { return p.nama || 'Anda'; }
    var OG = root.MyPolitikOrganisasi;
    try { if (OG && OG.getStruktur) { var st = OG.getStruktur(p); return (ctx.sayap ? st.sayap[p.sayap].peringkat.pusat : st.induk.pusat).ketua.nama; } } catch (e) { /* jatuh ke lalai */ }
    return ctx.sayap ? 'Ketua Sayap' : 'Presiden Parti';
  }

  /* ---- Calon ---- */
  function skorPemain(p, bp) {
    var k = p.kesetiaan || {}, sokong = ((Number(k.ajk) || 0) + (Number(k.perwakilan) || 0)) / 2;
    var ip = Math.min(100, 100 * (Number(p.ip) || 0) / 250), rep = clamp(Number(p.reputasi) || 0, 0, 100);
    var s = 0.45 * (bp ? bp.dekat : 0) + 0.2 * sokong + 0.2 * ip + 0.15 * rep;
    if (bp && bp.pengerusi && bp.pengerusi.pemain) { s += CONFIG.BONUS_PENYANDANG; }
    if (bp && bp.bonusTahun === p.tahun) { s += bp.bonusSkor || 0; }
    return Math.round(clamp(s, 0, 100) * 10) / 10;
  }
  function wanitaCtx() { return !!ctx.sayap && WN() !== 'Pemuda'; }                  // v7.41: Puteri/Wanita = nama perempuan
  function janaNama(rng, wanita) {
    var a = wanita ? NAMA_P[Math.floor(rng() * NAMA_P.length)] : NAMA_L[Math.floor(rng() * NAMA_L.length)];
    return (wanita ? '' : "Dato' ") + a + ' ' + NAMA_2[Math.floor(rng() * NAMA_2.length)];
  }

  /** Senarai Ketua Bahagian dengan skor. musim = benih supaya NPC stabil. */
  function senaraiCalon(p, bp, musim) {
    var n = bilBahagian(p), rng = S().rngBerbenih(String(p.id) + ctx.kunci + '|negeriBP|' + musim), out = [], ada = layak(p), pemainDi = Math.floor(rng() * n);
    for (var i = 0; i < n; i++) {
      var nama = janaNama(rng, wanitaCtx()), skor = 25 + rng() * 40;
      if (bp && bp.pengerusi && !bp.pengerusi.pemain && bp.pengerusi.id === 'b' + (i + 1)) { skor += CONFIG.BONUS_PENYANDANG; }
      if (ada && i === pemainDi) { out.push({ id: 'pemain', nama: p.nama || 'Anda', bahagian: p.bahagian || namaBhg(p, i, pemainDi), pemain: true, skor: skorPemain(p, bp) }); }
      else { out.push({ id: 'b' + (i + 1), nama: nama, bahagian: namaBhg(p, i, ada ? pemainDi : null), pemain: false, skor: Math.round(skor * 10) / 10 }); }
    }
    return out.sort(function (a, b) { return b.skor - a.skor; });
  }

  /** Calon lantikan luar (bukan Ketua Bahagian). */
  function calonLuar(p, benih) {
    var rng = S().rngBerbenih(String(p.id) + ctx.kunci + '|luar|' + benih), out = [], sayap = ['Ketua Pemuda Negeri', 'Ketua Wanita Negeri', 'Ketua Puteri Negeri'];
    if (ctx.sayap) { for (var q = 0; q < 3; q++) { out.push({ id: 'l-s' + q, nama: janaNama(rng, WN() !== 'Pemuda'), bahagian: 'Ketua Sayap Cawangan', kategori: 'sayap' }); } }
    else { sayap.forEach(function (s, i) { out.push({ id: 'l-s' + i, nama: janaNama(rng, i > 0), bahagian: s, kategori: 'sayap' }); }); }
    for (var t = 0; t < 3; t++) { out.push({ id: 'l-t' + t, nama: janaNama(rng, wanitaCtx() || t === 2), bahagian: ['ADUN', 'Bekas Exco', 'Tokoh Parti'][t], kategori: 'tokoh' }); }
    var kolam = kolamBhg(p, true);
    for (var k = 0; k < 3; k++) { out.push({ id: 'l-n' + k, nama: janaNama(rng, wanitaCtx()), bahagian: 'Naib Ketua Bahagian ' + (kolam.length ? kolam[Math.floor(rng() * kolam.length)] : (k + 1)), kategori: 'naib' }); }
    return out;
  }

  function wajibKB(p, bp, kecualiId) { return senaraiCalon(p, bp, 'wajib').filter(function (c) { return !c.pemain && c.id !== kecualiId; }).map(function (c) { return { id: c.id, nama: c.nama, bahagian: c.bahagian }; }); }

  function ajkNpc(p, bp, kecuali) {
    var rng = S().rngBerbenih(String(p.id) + ctx.kunci + '|ajkNPC|' + (bp.tahunLantik || 0) + '|' + kecuali), kb = wajibKB(p, bp, kecuali), luar = calonLuar(p, 'npc' + (bp.tahunLantik || 0)), out = [];
    function ambil(arr) { var x = arr[Math.floor(rng() * arr.length)] || arr[0]; arr.splice(arr.indexOf(x), 1); return x; }
    jawatanKB(p).forEach(function (j) { if (kb.length) { var x = ambil(kb); out.push({ jawatan: j, id: x.id, nama: x.nama, bahagian: x.bahagian }); } });
    if (negeriKecil(p)) { JAWATAN_LUAR_KECIL.forEach(function (j) { if (luar.length) { var x = ambil(luar); out.push({ jawatan: j, id: x.id, nama: x.nama, bahagian: x.bahagian, kategori: x.kategori }); } }); }
    return out;
  }

  function keadaan(p) {
    var bp = p[ctx.kunci] && typeof p[ctx.kunci] === 'object' ? p[ctx.kunci] : null;
    if (!bp) { bp = { tahunLantik: 0, musimLantik: 0, dekat: 15, dekatBulan: '', lobiTahun: 0, bonusTahun: 0, bonusSkor: 0, guna: {}, pengerusi: null, wajib: [], ajk: [], menunggu: null, calon: [], luar: [], posts: [], langkau: [], sejarah: [], pruDilihat: ((p.pru && p.pru.sejarah) || []).length }; }
    if (!bp.guna) { bp.guna = {}; }
    if (!bp.pengerusi) {                                           // permulaan: Pengerusi NPC sedia ada (bukan pemain)
      var c = senaraiCalon(p, bp, 'mula').filter(function (x) { return !x.pemain; })[0];
      bp.pengerusi = { id: c.id, nama: c.nama, bahagian: c.bahagian, pemain: false }; bp.tahunLantik = p.tahun; bp.musimLantik = 0;
      bp.ajk = ajkNpc(p, bp, c.id); bp.wajib = negeriKecil(p) ? wajibKB(p, bp, c.id) : [];
    }
    if (wanitaCtx() && !bp.namaP) {                                // v7.41: simpanan lama sayap perempuan menyimpan nama lelaki (Dato' ...): jana semula nama NPC secara tetap
      var baiki = function (e) { if (e && !e.pemain && /^Dato' /.test(e.nama || '')) { e.nama = janaNama(S().rngBerbenih(String(p.id) + ctx.kunci + '|nmP|' + e.id), true); } };
      baiki(bp.pengerusi); (bp.ajk || []).forEach(baiki); (bp.wajib || []).forEach(baiki); bp.namaP = 1;
    }
    return bp;
  }

  function patchBP(bp) { var o = {}; o[ctx.kunci] = bp; return o; }
  function simpan(bp, kesan, log, patchLain) {
    if (log && log.nama) { log = JSON.parse(JSON.stringify(log)); log.nama = tr(log.nama); }
    var patch = {}; patch[ctx.kunci] = bp; if (patchLain) { Object.keys(patchLain).forEach(function (k) { patch[k] = patchLain[k]; }); }
    return S().applyEffects(kesan || {}, { kiraTindakan: false, patch: patch, log: log || undefined });
  }

  /* ---- Lantikan oleh Presiden ---- */
  function tetapkanPengerusi(p, bp, c) {
    bp.pengerusi = { id: c.id, nama: c.nama, bahagian: c.bahagian, pemain: !!c.pemain };
    bp.wajib = negeriKecil(p) ? wajibKB(p, bp, c.id) : [];
  }

  function lantik(p, bp, sebab) {
    var ev = [], calon = senaraiCalon(p, bp, 'lantik' + p.tahun + (sebab || '')), rng = S().rngBerbenih(String(p.id) + ctx.kunci + '|pilih|' + p.tahun + '|' + (sebab || '')), menang;
    if (sayaPresiden(p)) {                                         // pemain ialah Presiden: pilih Pengerusi negeri sendiri
      bp.menunggu = 'pilih_pengerusi'; bp.calon = calon.filter(function (c) { return !c.pemain; }).slice(0, 6);
      bp.tahunLantik = p.tahun; bp.musimLantik = p.tahun;
      return { ev: [{ jenis: 'lantikan_negeri', mesej: 'Sebagai Presiden, anda perlu melantik Pengerusi Badan Perhubungan ' + namaNegeri(p) + ' daripada Ketua-Ketua Bahagian.' }] };
    }
    menang = calon.map(function (c) { return { c: c, n: c.skor + (rng() * 12 - 6) }; }).sort(function (a, b) { return b.n - a.n; })[0].c;
    var lama = bp.pengerusi, kedudukan = calon.findIndex(function (c) { return c.pemain; }) + 1;
    bp.sejarah = (bp.sejarah || []).concat([{ tahun: p.tahun, nama: menang.nama }]).slice(-6);
    tetapkanPengerusi(p, bp, menang); bp.tahunLantik = p.tahun; bp.musimLantik = p.tahun; bp.menunggu = null; bp.calon = [];
    if (menang.pemain) {
      mulaLantikAjk(p, bp, calon);
      ev.push({ jenis: 'lantikan_negeri', mesej: 'Presiden ' + namaPresiden(p) + ' melantik anda sebagai Pengerusi Badan Perhubungan UMNO ' + namaNegeri(p) + '. Anda juga menjadi ahli MKT secara ex-officio. ' + (negeriKecil(p) ? 'Semua Ketua Bahagian menjadi ahli wajib; anda boleh melantik AJK dari luar.' : 'Anda kini boleh melantik AJK daripada Ketua-Ketua Bahagian.') });
    } else {
      bp.ajk = ajkNpc(p, bp, menang.id);
      var pesan = lama && lama.pemain ? 'Anda tidak lagi dilantik sebagai Pengerusi.' : (layak(p) ? 'Anda berada di kedudukan #' + kedudukan + ' daripada ' + calon.length + ' Ketua Bahagian.' : 'Anda tidak layak kerana bukan Ketua Bahagian.');
      ev.push({ jenis: 'lantikan_negeri', mesej: 'Presiden ' + namaPresiden(p) + ' melantik ' + menang.nama + ' (' + menang.bahagian + ') sebagai Pengerusi Badan Perhubungan UMNO ' + namaNegeri(p) + '. ' + pesan });
    }
    return { ev: ev, menang: menang };
  }

  /** Sediakan senarai jawatan AJK yang pemain perlu isi. posts: [{jawatan, sumber:'kb'|'luar', pilihan}] */
  function mulaLantikAjk(p, bp, calon) {
    var kb = (calon || senaraiCalon(p, bp, 'ajk' + p.tahun)).filter(function (c) { return !c.pemain; });
    var posts = jawatanKB(p).map(function (j) { return { jawatan: j, sumber: 'kb', pilihan: false }; });
    posts = posts.concat(jawatanLuar(p).map(function (j) { return { jawatan: j, sumber: 'luar', pilihan: !negeriKecil(p) }; }));
    bp.menunggu = 'lantik_ajk'; bp.calon = kb; bp.luar = calonLuar(p, 'pemain' + p.tahun); bp.ajk = []; bp.posts = posts; bp.langkau = [];
    bp.wajib = negeriKecil(p) ? kb.map(function (c) { return { id: c.id, nama: c.nama, bahagian: c.bahagian }; }) : [];
  }

  /* ---- v7.43: Presiden melantik Pengerusi SEMUA negeri (bukan negeri sendiri sahaja) ---- */
  function kunciLain() { return ctx.kunci + 'Lain'; }
  function keadaanLain(p) { var o = p && p[kunciLain()]; return o && typeof o === 'object' ? o : { musim: 0, menunggu: [], ada: {} }; }
  function senaraiNegeriLain(p) { var sendiri = kunciNegeri(p); return Object.keys(KEY_NAMA).filter(function (k) { return k !== sendiri; }); }
  function simpanLain(lain, kesan, log) { var patch = {}; patch[kunciLain()] = lain; return S().applyEffects(kesan || {}, { kiraTindakan: false, patch: patch, log: log || undefined }); }
  /** Calon Pengerusi bagi negeri lain: Ketua-Ketua Bahagian NPC negeri itu (skor menurun). */
  function calonNegeri(p, key, benih) {
    var n = BIL_BAHAGIAN[key], rng = S().rngBerbenih(String(p.id) + ctx.kunci + '|lain|' + key + '|' + benih), kolam = kolamBhg(p, true, KEY_NAMA[key]), out = [];
    for (var i = 0; i < n; i++) {
      out.push({ id: 'l' + (i + 1), nama: janaNama(rng, wanitaCtx()), bahagian: kolam[i] || ('Bahagian ' + (i + 1)), skor: Math.round((25 + rng() * 40) * 10) / 10 });
    }
    return out.sort(function (a, b) { return b.skor - a.skor; });
  }
  function pengerusiLain(p, key) {
    var lain = keadaanLain(p), a = lain.ada && lain.ada[key];
    if (a) { return a; }
    var c = calonNegeri(p, key, 'mula')[0]; return { id: c.id, nama: c.nama, bahagian: c.bahagian };
  }
  /** Senarai Pengerusi semua negeri (untuk paparan Struktur). */
  function senaraiPengerusiNegeri(p) {
    return Object.keys(KEY_NAMA).map(function (k) {
      var sendiri = k === kunciNegeri(p), b = sendiri ? keadaan(p).pengerusi : pengerusiLain(p, k);
      return { negeri: KEY_NAMA[k], nama: b.nama, bahagian: b.bahagian, pemain: !!(b && b.pemain), sendiri: sendiri };
    });
  }
  function sediaLain(p) {
    if (!sayaPresiden(p)) { return null; }
    var lain = keadaanLain(p);
    if (lain.musim === p.tahun) { return null; }
    lain.musim = p.tahun; lain.menunggu = senaraiNegeriLain(p); lain.ada = lain.ada || {};
    simpanLain(lain);
    return { jenis: 'lantikan_negeri', mesej: 'Sebagai Presiden, anda juga perlu melantik Pengerusi Badan Perhubungan bagi ' + lain.menunggu.length + ' negeri lain.' };
  }
  function menungguLain(p) {
    var lain = keadaanLain(p); if (!sayaPresiden(p) || !lain.menunggu || !lain.menunggu.length) { return null; }
    var key = lain.menunggu[0];
    return { jenis: 'pilih_negeri_lain', negeri: key, negeriNama: KEY_NAMA[key], baki: lain.menunggu.length, calon: calonNegeri(p, key, 'lantik' + lain.musim).slice(0, 6) };
  }
  function tetapLain(p, lain, key, c) {
    lain.ada[key] = { id: c.id, nama: c.nama, bahagian: c.bahagian, tahun: p.tahun };
    lain.menunggu = lain.menunggu.filter(function (k) { return k !== key; });
  }
  function pilihLain(id) {
    var p = S().loadPlayer(), m = p && menungguLain(p); if (!m) { return { ok: false, ralat: 'Tiada lantikan menunggu.' }; }
    var lain = keadaanLain(p), c = m.calon.filter(function (x) { return x.id === id; })[0] || m.calon[0];
    tetapLain(p, lain, m.negeri, c);
    var r = simpanLain(lain, { kesetiaan: { perwakilan: CONFIG.KESAN_LAIN } }, { tindakan: 'lantik_pengerusi_lain', nama: 'Melantik ' + c.nama + ' (Pengerusi ' + m.negeriNama + ')', peringkat: 'negeri' });
    return r.ok ? { ok: true, mesej: c.nama + ' dilantik sebagai Pengerusi Badan Perhubungan ' + m.negeriNama + '.' + (lain.menunggu.length ? ' ' + lain.menunggu.length + ' negeri lagi.' : ' Semua negeri selesai.') } : { ok: false, ralat: r.ralat };
  }
  function lantikSemuaLain() {
    var p = S().loadPlayer(), lain = keadaanLain(p), bil = 0;
    if (!sayaPresiden(p) || !lain.menunggu.length) { return { ok: false, ralat: 'Tiada lantikan menunggu.' }; }
    lain.menunggu.slice().forEach(function (k) { tetapLain(p, lain, k, calonNegeri(p, k, 'lantik' + lain.musim)[0]); bil++; });
    var r = simpanLain(lain, { kesetiaan: { perwakilan: CONFIG.KESAN_LAIN * bil } }, { tindakan: 'lantik_pengerusi_lain', nama: 'Melantik Pengerusi ' + bil + ' negeri (automatik)', peringkat: 'negeri' });
    return r.ok ? { ok: true, mesej: 'Pengerusi bagi ' + bil + ' negeri dilantik (calon terbaik).' } : { ok: false, ralat: r.ralat };
  }

  /** Denyut bulanan (dipanggil oleh Calendar.majuBulan). Pulang { peristiwa }. */
  function prosesBulan(opts) {
    opts = opts || {};
    var s = S(), p = s && s.loadPlayer(), ev = [];
    if (!p || p.tamat || !ctx.aktif(p)) { return { peristiwa: ev }; }
    var bp = keadaan(p), rng = opts.rng || s.rngBerbenih(String(p.id) + ctx.kunci + '|negeriTick|' + p.tahun + '|' + p.bulan), kesan = {};
    var baru = (Number(p.bulan) === CONFIG.BULAN_LANTIK && tahunPemilihan(p) && bp.musimLantik !== p.tahun);
    var sej = (p.pru && p.pru.sejarah) || [], kalahBaru = sej.length > (bp.pruDilihat || 0) && sej[sej.length - 1].hasil === 'kalah';
    bp.pruDilihat = sej.length;
    if (baru) { ev = ev.concat(lantik(p, bp, '').ev); var el = sediaLain(p); if (el) { ev.push(el); } }
    else if (bp.pengerusi.pemain && !layak(p)) {                    // hilang jawatan Ketua Bahagian
      ev = ev.concat(gugur(p, bp, 'Anda tidak lagi memegang jawatan Ketua Bahagian, maka Presiden menamatkan lantikan anda sebagai Pengerusi.'));
    } else if (bp.pengerusi.pemain && (Number((p.kesetiaan || {}).perwakilan) || 0) < CONFIG.GUGUR_PERWAKILAN) {
      ev = ev.concat(gugur(p, bp, 'Sokongan Perwakilan anda jatuh di bawah ' + CONFIG.GUGUR_PERWAKILAN + '%. Presiden menggugurkan anda sebagai Pengerusi.'));
    } else if (bp.pengerusi.pemain && kalahBaru && rng() < CONFIG.GUGUR_KALAH) {
      ev = ev.concat(gugur(p, bp, 'Kekalahan anda dalam pilihan raya mengecewakan Presiden. Anda digugurkan sebagai Pengerusi.'));
    } else if (!bp.menunggu && rng() < CONFIG.PELUANG_GUGUR[tahap(p)]) {   // pertengahan penggal
      var sasarPemain = bp.pengerusi.pemain && skorPemain(p, bp) < 45 && rng() < 0.5;
      if (!bp.pengerusi.pemain || sasarPemain) { ev = ev.concat(gugur(p, bp, bp.pengerusi.pemain ? 'Presiden kurang yakin dengan prestasi anda dan menggantikan anda.' : bp.pengerusi.nama + ' meletak jawatan sebagai Pengerusi Badan Perhubungan ' + namaNegeri(p) + '.')); }
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
    tetapkanPengerusi(p, bp, ganti); bp.tahunLantik = p.tahun; bp.ajk = ajkNpc(p, bp, ganti.id); bp.menunggu = null; bp.calon = []; bp.posts = [];
    return [{ jenis: 'lantikan_negeri', mesej: mesej + ' Presiden ' + namaPresiden(p) + ' melantik ' + ganti.nama + ' sebagai pengganti.' }];
  }

  /* ---- Lobi Presiden (pop-up selepas keputusan Bahagian) ---- */
  /** Pulang tawaran jika pemain Ketua Bahagian belum membuat keputusan lobi tahun ini; selain itu null. */
  function tawaranLobi(p) {
    p = p || (S() && S().loadPlayer());
    if (!p || p.tamat || sayaPresiden(p) || !layak(p) || !tahunPemilihan(p)) { return null; }
    var b = Number(p.bulan) || 1, bp = p[ctx.kunci] || {};
    if (b < CONFIG.BULAN_LOBI_MULA || b > CONFIG.BULAN_LOBI_TAMAT || bp.lobiTahun === p.tahun) { return null; }
    var W0 = ctx.sayap ? WN() : '', tajuk = ctx.sayap ? 'Anda Ketua ' + W0 + ' Bahagian ' + (p.bahagian || '') : 'Anda Ketua Bahagian ' + (p.bahagian || '');
    var teks = ctx.sayap ? 'Keputusan pemilihan sayap Bahagian telah selesai. Sebagai Ketua ' + W0 + ' Bahagian, anda layak dilantik <b>Ketua ' + W0 + ' Negeri ' + namaNegeri(p) + '</b>. Ketua ' + W0 + ' akan membuat lantikan selepas Perhimpunan Sayap (bulan 9).'
      : 'Keputusan pemilihan Bahagian telah selesai. Sebagai Ketua Bahagian, anda layak dilantik <b>Pengerusi Badan Perhubungan UMNO ' + namaNegeri(p) + '</b>. Presiden akan membuat lantikan selepas PAU (bulan 9).';
    return { jenis: 'lobi', tajuk: tajuk, teks: teks, negeri: namaNegeri(p), dekat: bp.dekat === undefined ? 15 : bp.dekat, presiden: namaPresiden(p), bahagian: p.bahagian || '',
      pilihan: Object.keys(LOBI).map(function (k) { return { id: k, label: LOBI[k].label, huraian: LOBI[k].huraian }; }) };
  }

  var DIALOG = {
    mengadap: ['"Duduklah, {nama}. Saya dengar bahagian anda bergerak dengan baik."', '"Selepas PAU nanti kita bincang soal negeri. Teruskan kerja akar umbi."'],
    mkt: ['"Ada orang MKT menyebut nama anda. Saya hargai usaha anda."', '"Jangan terlalu terburu-buru. Parti menilai kesetiaan."'],
    sumbangan: ['"Sumbangan anda untuk dana negeri saya catat."', '"Pastikan semua urusan mengikut peraturan parti."'],
    laporan: ['"Laporan prestasi bahagian anda kemas. Saya suka pemimpin yang berdata."', '"Statistik ahli dan kutipan yuran anda cemerlang."']
  };

  /** jenis: 'mengadap' | 'mkt' | 'sumbangan' | 'laporan' | 'tidak'. Pulang { ok, mesej, babak:[{siapa,teks}] }. */
  function lobi(jenis, opts) {
    opts = opts || {};
    var s = S(), p = s.loadPlayer(); if (!p) { return { ok: false, ralat: 'Tiada profil.' }; }
    var of = tawaranLobi(p); if (!of) { return { ok: false, ralat: 'Tiada tawaran lobi sekarang.' }; }
    var bp = keadaan(p);
    if (jenis === 'tidak') {
      bp.lobiTahun = p.tahun;
      var r0 = simpan(bp, { reputasi: 1 }, { tindakan: 'lobi_negeri', nama: 'Tidak melobi Presiden (fokus bahagian)', peringkat: 'negeri' });
      return r0.ok ? { ok: true, mesej: 'Anda memilih fokus pada bahagian. Reputasi +1.', babak: [{ siapa: 'Anda', teks: 'Saya akan tumpukan kepada kerja bahagian.' }] } : { ok: false, ralat: r0.ralat };
    }
    var d = LOBI[jenis]; if (!d) { return { ok: false, ralat: 'Pilihan tidak sah.' }; }
    if ((Number(p.ap) || 0) < d.ap) { return { ok: false, ralat: 'Mata Tindakan (AP) tidak mencukupi.' }; }
    if ((Number(p.myr) || 0) < d.myr) { return { ok: false, ralat: 'Wang (MYR) tidak mencukupi.' }; }
    var rng = opts.rng || s.rngBerbenih(String(p.id) + ctx.kunci + '|lobi|' + p.tahun + '|' + jenis), kesan = { ap: -d.ap, myr: -d.myr }, patch = {}, nota = '', babak = [];
    var nama = p.nama || 'Anda', baris = DIALOG[jenis][Math.floor(rng() * DIALOG[jenis].length)].replace('{nama}', nama);
    bp.dekat = clamp(bp.dekat + d.dekat, 0, 100); bp.lobiTahun = p.tahun;
    babak.push({ siapa: 'Anda', teks: jenis === 'mengadap' ? 'Saya datang menghadap Presiden untuk melaporkan perkembangan bahagian.' : jenis === 'mkt' ? 'Saya menemui beberapa pemimpin MKT untuk mendapatkan sokongan.' : jenis === 'sumbangan' ? 'Bahagian kami menyumbang kepada dana parti negeri.' : 'Saya membawa laporan prestasi bahagian untuk perhatian Presiden.' });
    babak.push({ siapa: 'Presiden ' + of.presiden, teks: baris });
    if (jenis === 'mkt' && rng() < 0.25) { kesan.reputasi = -3; nota = 'Ada pihak mengatakan anda terlalu berpolitik. Reputasi -3.'; }
    if (jenis === 'laporan') { bp.bonusTahun = p.tahun; bp.bonusSkor = 5; }
    if (jenis === 'sumbangan') {
      var ET = root.MyPolitikEtika || (typeof require === 'function' ? tryReq('./etika.js') : null);
      try {
        if (ET && ET.selepasAktiviti) {
          var h = ET.selepasAktiviti(p, { tahap: 'kelabu', risiko: 15, tambahRisiko: 4, modal: 0, perkara: 'Sumbangan besar kepada dana parti negeri bagi mempengaruhi lantikan Pengerusi', fasal: 'Fasal 20.13', berat: 1 }, { rng: rng });
          patch.etika = h.etika; if (h.mesej) { nota = h.mesej; }
        }
      } catch (e) { /* etika tidak tersedia: abaikan */ }
    }
    var r = simpan(bp, kesan, { tindakan: 'lobi_negeri', nama: 'Lobi Presiden: ' + d.label, peringkat: 'negeri' }, patch);
    if (!r.ok) { return { ok: false, ralat: r.ralat }; }
    if (nota) { babak.push({ siapa: 'Berita', teks: nota }); }
    return { ok: true, mesej: d.label + ': kedekatan kini ' + bp.dekat + '%.' + (nota ? ' ' + nota : ''), babak: babak };
  }

  /* ---- Tindakan pemain ---- */
  function dekatiPresiden() {
    var s = S(), p = s.loadPlayer(); if (!p) { return { ok: false, ralat: 'Tiada profil.' }; }
    if (sayaPresiden(p)) { return { ok: false, ralat: 'Anda ialah Presiden.' }; }
    if (!layak(p)) { return { ok: false, ralat: 'Hanya Ketua Bahagian layak dilantik sebagai Pengerusi Badan Perhubungan Negeri.' }; }
    var bp = keadaan(p), kunci = p.tahun + '-' + p.bulan, kali = bp.dekatBulan && bp.dekatBulan.indexOf(kunci + ':') === 0 ? parseInt(bp.dekatBulan.split(':')[1], 10) : 0;
    if (kali >= CONFIG.DEKAT_MAKS_BULAN) { return { ok: false, ralat: 'Had ' + CONFIG.DEKAT_MAKS_BULAN + ' kali bulan ini telah dicapai.' }; }
    bp.dekat = clamp(bp.dekat + CONFIG.DEKAT_NAIK, 0, 100); bp.dekatBulan = kunci + ':' + (kali + 1);
    var r = s.applyEffects({ ap: -CONFIG.KOS_AP, myr: -CONFIG.KOS_MYR }, { kiraTindakan: true, patch: patchBP(bp), log: { tindakan: 'dekati_presiden', nama: 'Dekati Presiden ' + namaPresiden(p), peringkat: 'negeri' } });
    if (!r.ok) { return { ok: false, ralat: r.ralat }; }
    return { ok: true, mesej: 'Anda mendekati Presiden ' + namaPresiden(p) + '. Kedekatan kini ' + bp.dekat + '%.' };
  }

  /** Kuasa Pengerusi: lawatan | media | syor | runding. */
  function tindakan(id) {
    var s = S(), p = s.loadPlayer(), d = TINDAKAN[id]; if (!p || !d) { return { ok: false, ralat: 'Tindakan tidak sah.' }; }
    var bp = keadaan(p); if (!bp.pengerusi.pemain) { return { ok: false, ralat: 'Hanya Pengerusi Badan Perhubungan boleh melakukan ini.' }; }
    var tempoh = d.had === 'bulan' ? p.tahun + '-' + p.bulan : String(p.tahun);
    if (bp.guna[id] === tempoh) { return { ok: false, ralat: d.label + ' sudah dilakukan ' + (d.had === 'bulan' ? 'bulan ini' : 'tahun ini') + '.' }; }
    var kesan = { ap: -d.ap, myr: -d.myr, ip: d.kesan.ip, reputasi: d.kesan.reputasi, kesetiaan: d.kesan.kesetiaan };
    if ((Number(p.ap) || 0) < d.ap) { return { ok: false, ralat: 'Mata Tindakan (AP) tidak mencukupi.' }; }
    if ((Number(p.myr) || 0) < d.myr) { return { ok: false, ralat: 'Wang (MYR) tidak mencukupi.' }; }
    bp.guna[id] = tempoh;
    var r = simpan(bp, kesan, { tindakan: 'tindakan_negeri', nama: d.label, peringkat: 'negeri' });
    return r.ok ? { ok: true, mesej: d.mesej } : { ok: false, ralat: r.ralat };
  }

  function pilihPengerusi(id) {
    var s = S(), p = s.loadPlayer(), bp = p && keadaan(p);
    if (bp && !bp.menunggu && menungguLain(p)) { return pilihLain(id); }
    if (!bp || bp.menunggu !== 'pilih_pengerusi') { return { ok: false, ralat: 'Tiada lantikan menunggu.' }; }
    var c = (bp.calon || []).filter(function (x) { return x.id === id; })[0] || bp.calon[0];
    tetapkanPengerusi(p, bp, c); bp.menunggu = null; bp.calon = []; bp.ajk = ajkNpc(p, bp, c.id); bp.tahunLantik = p.tahun;
    var r = simpan(bp, { kesetiaan: { perwakilan: 2 } }, { tindakan: 'lantik_pengerusi', nama: 'Melantik ' + c.nama + ' (Pengerusi ' + namaNegeri(p) + ')', peringkat: 'negeri' });
    return r.ok ? { ok: true, mesej: c.nama + ' dilantik sebagai Pengerusi Badan Perhubungan ' + namaNegeri(p) + '.' } : { ok: false, ralat: r.ralat };
  }

  function kesanLantikan(c, sumber) {
    if (sumber === 'luar') { var k = KATEGORI_LUAR[c.kategori]; return k ? k.kesan : {}; }
    return { kesetiaan: { perwakilan: CONFIG.KESAN_AJK } };
  }
  function postBaki(bp) {
    return (bp.posts || []).filter(function (x) { return !bp.ajk.some(function (a) { return a.jawatan === x.jawatan; }) && (bp.langkau || []).indexOf(x.jawatan) < 0; });
  }

  /** Lantik AJK. (jawatan, id) manual; id '__langkau' langkau jawatan pilihan; tanpa argumen = automatik semua jawatan wajib. */
  function lantikAjk(jawatan, id) {
    var s = S(), p = s.loadPlayer(), bp = p && keadaan(p);
    if (!bp || bp.menunggu !== 'lantik_ajk') { return { ok: false, ralat: 'Tiada lantikan AJK menunggu.' }; }
    var baki = postBaki(bp), dipakai = bp.ajk.map(function (a) { return a.id; }), bil = 0, kesan = { kesetiaan: {}, reputasi: 0 };
    function gabung(k) { if (!k) { return; } if (k.reputasi) { kesan.reputasi += k.reputasi; } Object.keys(k.kesetiaan || {}).forEach(function (x) { kesan.kesetiaan[x] = (kesan.kesetiaan[x] || 0) + k.kesetiaan[x]; }); }
    if (id === '__langkau') {
      bp.langkau = (bp.langkau || []).concat([jawatan || (baki[0] && baki[0].jawatan)]);
    } else {
      var sasar = id ? baki.filter(function (x) { return x.jawatan === (jawatan || baki[0].jawatan); }) : baki.filter(function (x) { return !x.pilihan; });
      sasar.forEach(function (x) {
        var kolam = (x.sumber === 'luar' ? bp.luar : bp.calon) || [];
        var c = kolam.filter(function (y) { return (id ? y.id === id : true) && dipakai.indexOf(y.id) < 0; })[0];
        if (!c) { return; }
        bp.ajk.push({ jawatan: x.jawatan, id: c.id, nama: c.nama, bahagian: c.bahagian, kategori: c.kategori }); dipakai.push(c.id); bil++; gabung(kesanLantikan(c, x.sumber));
      });
      if (!bil) { return { ok: false, ralat: 'Calon tidak sah atau jawatan sudah diisi.' }; }
    }
    if (postBaki(bp).length === 0) { bp.menunggu = null; bp.calon = []; bp.luar = []; }
    else if (postBaki(bp).every(function (x) { return x.pilihan; }) && !id) { bp.menunggu = null; bp.calon = []; bp.luar = []; }   // automatik: jawatan pilihan ditinggalkan
    var r = simpan(bp, { kesetiaan: kesan.kesetiaan, reputasi: kesan.reputasi }, { tindakan: 'lantik_ajk', nama: 'Melantik ' + bil + ' AJK Badan Perhubungan', peringkat: 'negeri' });
    return r.ok ? { ok: true, mesej: id === '__langkau' ? 'Jawatan dilangkau.' : bil + ' AJK dilantik.', selesai: !bp.menunggu } : { ok: false, ralat: r.ralat };
  }

  /** Keputusan menunggu pemain (untuk pop-up): null | { jenis, jawatan?, sumber?, pilihan?, calon[] }. */
  function menunggu(p) {
    p = p || (S() && S().loadPlayer()); if (!p || !p[ctx.kunci]) { return null; }
    var bp = p[ctx.kunci];
    if (!bp.menunggu) { return menungguLain(p); }                    // v7.43: Presiden: negeri lain
    if (bp.menunggu === 'pilih_pengerusi') { return { jenis: 'pilih_pengerusi', calon: bp.calon || [] }; }
    if (bp.menunggu === 'lantik_ajk') {
      var x = postBaki(bp)[0]; if (!x) { return null; }
      var dipakai = bp.ajk.map(function (a) { return a.id; });
      var kolam = (x.sumber === 'luar' ? bp.luar : bp.calon) || [];
      return { jenis: 'lantik_ajk', jawatan: x.jawatan, tajukJawatan: tr(x.jawatan), sumber: x.sumber, pilihan: !!x.pilihan, wajibKecil: negeriKecil(p),
        calon: kolam.filter(function (c) { return dipakai.indexOf(c.id) < 0; }).slice(0, 9).map(function (c) {
          return { id: c.id, nama: c.nama, bahagian: c.bahagian, skor: c.skor, kategori: c.kategori, ringkas: x.sumber === 'luar' && KATEGORI_LUAR[c.kategori] ? KATEGORI_LUAR[c.kategori].label + ' · ' + KATEGORI_LUAR[c.kategori].ringkas : 'Perwakilan +1' }; }) };
    }
    return null;
  }

  /** Ringkasan status untuk UI. */
  function status(p) {
    var bp = keadaan(p), calon = senaraiCalon(p, bp, 'lantik' + bp.tahunLantik), kedudukan = calon.findIndex(function (c) { return c.pemain; }) + 1;
    return { bp: bp, presiden: namaPresiden(p), layak: layak(p), skor: layak(p) ? skorPemain(p, bp) : null, kedudukan: kedudukan, jumlah: calon.length, kecil: negeriKecil(p),
      sayaPengerusi: !!(bp.pengerusi && bp.pengerusi.pemain), sayaPresiden: sayaPresiden(p), negeri: namaNegeri(p) };
  }

  /** Blok untuk paparan Struktur Organisasi (Pengerusi + AJK + ahli wajib). */
  function htmlStruktur(p) {
    if (!p || !ctx.aktif(p)) { return ''; }
    var st = status(p), bp = st.bp;
    function baris(j, nama, bhg, anda) { return '<div class="org-baris' + (anda ? ' is-anda' : '') + '"><span>' + esc(j) + '</span><span>' + esc(nama) + (anda ? ' (anda)' : '') + (bhg ? ' &middot; ' + esc(labelBhg(p, bhg)) : '') + '</span></div>'; }
    var h = '<div class="org-peringkat"><h3>Badan Perhubungan ' + esc(st.negeri) + '</h3>' + baris('Presiden', st.presiden, '', st.sayaPresiden) + baris('Pengerusi', bp.pengerusi.nama, bp.pengerusi.bahagian, !!bp.pengerusi.pemain);
    if (st.sayaPresiden) { var sp = senaraiPengerusiNegeri(p); h += '<details class="org-ajk"><summary>Pengerusi semua negeri (' + sp.length + ')</summary>' + sp.map(function (x) { return baris(x.negeri, x.nama, x.bahagian, x.pemain); }).join('') + '</details>'; }
    if (bp.ajk && bp.ajk.length) { h += '<details class="org-ajk"><summary>AJK Badan Perhubungan (' + bp.ajk.length + ' orang)</summary>' + bp.ajk.map(function (a) { return baris(a.jawatan, a.nama, a.bahagian, false); }).join('') + '</details>'; }
    if (bp.wajib && bp.wajib.length) { h += '<details class="org-ajk"><summary>Ahli wajib: Ketua Bahagian (' + bp.wajib.length + ')</summary>' + bp.wajib.map(function (a) { return baris('Ketua Bahagian', a.nama, a.bahagian, false); }).join('') + '</details>'; }
    return tr(h + '</div>');
  }

  function htmlKad(p) {
    if (!p || !ctx.aktif(p)) { return ''; }
    var st = status(p), bp = st.bp;
    if (!(st.layak && !st.sayaPresiden) && !menunggu(p) && !st.sayaPengerusi) { return ''; }      // v7.40: tiada tindakan untuk pemain: kad disembunyikan (maklumat ada dalam Struktur)
    var h = '<div class="card pp-negeri" data-b="' + ctx.id + '"><h3>Badan Perhubungan UMNO ' + esc(st.negeri) + '</h3>';
    h += '<p class="note">Pengerusi: ' + esc(bp.pengerusi.nama) + (bp.pengerusi.pemain ? ' (anda)' : '') + '. Senarai penuh pemimpin ada dalam <b>Struktur</b>.</p>';
    if (st.layak && !st.sayaPresiden) {
      h += '<div class="kv"><span>Kedekatan dengan Presiden</span><b>' + bp.dekat + '%</b></div><div class="rv-m"><i class="a" style="width:' + bp.dekat + '%"></i><i class="b" style="width:' + (100 - bp.dekat) + '%"></i></div>';
      h += '<div class="kv"><span>Kedudukan anda</span><b>#' + st.kedudukan + ' / ' + st.jumlah + ' Ketua Bahagian (skor ' + st.skor + ')</b></div>';
      if (tawaranLobi(p)) { h += '<button type="button" class="btn btn--gold" data-act="lobi-presiden" data-b="' + ctx.id + '">Lobi Presiden</button> '; }
      h += '<button type="button" class="btn btn--gold" data-act="dekati-presiden" data-b="' + ctx.id + '">Dekati Presiden (' + CONFIG.KOS_AP + ' AP, RM ' + CONFIG.KOS_MYR.toLocaleString('ms-MY') + ')</button>';
    } else if (!st.sayaPresiden) { h += '<p class="note">Anda belum layak dilantik: hanya <b>Ketua Bahagian</b> negeri ini layak menjadi Pengerusi.</p>'; }
    var m = menunggu(p);
    if (m) { h += '<button type="button" class="btn btn--gold" data-act="urus-negeri" data-b="' + ctx.id + '" style="margin-top:.5rem">' + (m.jenis === 'pilih_pengerusi' ? 'Lantik Pengerusi' : m.jenis === 'pilih_negeri_lain' ? 'Lantik Pengerusi Negeri Lain (' + m.baki + ')' : 'Lantik AJK (' + esc(m.jawatan) + ')') + '</button>'; }
    if (st.sayaPengerusi) {
      h += '<p class="note" style="margin-top:.6rem"><b>Kuasa Pengerusi</b> (ex-officio MKT; +' + CONFIG.BONUS_IP + ' IP dan +' + CONFIG.BONUS_AJK + ' sokongan AJK sebulan)</p><div class="pp-negeri__tindak">' + Object.keys(TINDAKAN).map(function (k) {
        var d = TINDAKAN[k], guna = bp.guna[k] === (d.had === 'bulan' ? p.tahun + '-' + p.bulan : String(p.tahun));
        return '<button type="button" class="btn btn--ghost" data-act="negeri-tindak" data-b="' + ctx.id + '" data-id="' + k + '"' + (guna ? ' disabled' : '') + '>' + esc(d.label) + '<small> ' + d.ap + ' AP' + (d.myr ? ', RM ' + d.myr.toLocaleString('ms-MY') : '') + (d.had === 'bulan' ? ' &middot; sebulan' : ' &middot; setahun') + '</small></button>'; }).join(' ') + '</div>';
    }
    return tr(h + '</div>');
  }

  var API = { CONFIG: CONFIG, LOBI: LOBI, TINDAKAN: TINDAKAN, prosesBulan: prosesBulan, tawaranLobi: tawaranLobi, lobi: lobi, dekatiPresiden: dekatiPresiden, tindakan: tindakan,
    pilihPengerusi: pilihPengerusi, lantikSemuaLain: lantikSemuaLain, lantikAjk: lantikAjk, menunggu: menunggu, status: status, htmlKad: htmlKad, htmlStruktur: htmlStruktur, senaraiPengerusiNegeri: senaraiPengerusiNegeri, layak: layak, negeriKecil: negeriKecil, namaNegeri: namaNegeri,
    _senaraiCalon: senaraiCalon, _keadaan: keadaan, _bil: bilBahagian, id: ctx.id, aktif: ctx.aktif, tr: tr };
  if (ctx.sayap) {
    ['prosesBulan', 'tawaranLobi', 'lobi', 'dekatiPresiden', 'tindakan', 'pilihPengerusi', 'lantikAjk', 'menunggu'].forEach(function (k) { var f = API[k]; API[k] = function () { return trObj(f.apply(null, arguments)); }; });
  }
  return API;
  }

  var CTX_INDUK = { id: 'induk', kunci: 'negeriBP', sayap: false, aktif: function () { return true; }, kodKB: function () { return 'ketua_bahagian'; }, kodPemberi: function () { return 'presiden'; } };
  var CTX_SAYAP = { id: 'sayap', kunci: 'negeriSayap', sayap: true, aktif: function (p) { return !!p && NAMA_SAYAP[p.sayap] !== undefined; },
    kodKB: function (p) { return 'sayap_bahagian_' + p.sayap; }, kodPemberi: function (p) { return 'sayap_pusat_' + p.sayap; } };
  var induk = bina(CTX_INDUK), sayap = bina(CTX_SAYAP), prosesInduk = induk.prosesBulan;
  induk.prosesBulan = function (o) { var a = prosesInduk(o), b2 = sayap.prosesBulan(o); return { peristiwa: (a.peristiwa || []).concat(b2.peristiwa || []) }; };
  induk.sayap = sayap;
  induk.setSumberBahagian = function (fn) { SUMBER_BHG = fn; };
  return induk;
});
