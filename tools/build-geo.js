#!/usr/bin/env node
/* ==========================================================================
   Nusa Politik — tools/build-geo.js
   Skrip PENGIMPORT sekali jalan (offline, Node 16+, tiada pakej luar).

   Membaca fail mentah dalam data-sumber/ (GeoJSON sempadan + CSV banci DOSM)
   dan menghasilkan fail ringan untuk pelayar dalam data/:

     negeri.json     16 kawasan   (sempadan negeri / wilayah persekutuan)
     parlimen.json   222 kawasan  (= Bahagian dalam permainan)
     dun.json        600 kawasan  (DUN)
     demografi.json  statistik banci 2020 + anggaran pemilih + tahap kesukaran

   Guna:   node tools/build-geo.js            (jalankan dari akar projek)
   Lapisan Daerah Mengundi (DM, = Lokaliti/Cawangan) dibaca daripada fail dalam LAPISAN_DM
   dan menghasilkan dm-<kodNegeri>.json (cth. dm-10.json untuk Selangor). Fail ini mengandungi
   BILANGAN PEMILIH SEBENAR (bukan anggaran). Tambah negeri lain dengan menambah satu baris.

   Selepas itu commit data/*.json. Fail mentah tidak perlu dihantar ke GitHub Pages.

   Sempadan dipermudahkan (Douglas-Peucker) dan diunjurkan ke koordinat integer
   (1000 unit = 1 darjah). Laluan disimpan sebagai SVG path relatif ("M x y l dx dy ... z").

   NOTA DATA
   - Data ini ialah data terbuka DOSM (lihat data-sumber/LICENSE.md). Jangan
     dakwa status rasmi. Kredit dipaparkan oleh js/geo.js.
   - Fail yang diberi TIDAK mengandungi bilangan pemilih berdaftar atau
     Daerah Mengundi (DM). Tahap terkecil ialah DUN. JUMLAH PEMILIH di sini ialah
     ANGGARAN: warganegara x peratus umur 18+ (banci 2020).
   - "kesukaran" (1-5) ialah heuristik reka bentuk permainan, bukan data rasmi.
     Ubah KESUKARAN di bawah dan jalankan semula.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const SUMBER = process.env.SUMBER_DIR || path.join(__dirname, '..', 'data-sumber');          // SUMBER_DIR: laluan lain untuk fail mentah (pilihan)
const KELUAR = path.join(__dirname, '..', 'data');

/* ---- Tetapan ---- */
const UNIT_PER_DARJAH = 1000;
const LON_MIN = 99.5, LAT_MAX = 7.5, LAT_TENGAH = 4;               // asal unjuran
const KOS = Math.cos(LAT_TENGAH * Math.PI / 180);
const TOLERANSI = { negeri: 2.5, parlimen: 1.6, dun: 1.2, dm: 0.8 };         // unit (~1 unit = 110 m)
const LUAS_MIN = { negeri: 12, parlimen: 4, dun: 2, dm: 0.6 };               // gelang yang lebih kecil dibuang (kecuali yang terbesar)
const KESUKARAN = {                                                  // heuristik; ubah mengikut keseimbangan permainan
  beratSaizPemilih: 0.6,                                             // kawasan besar = lebih sukar dipengaruhi
  beratBukanBumi: 0.4                                                // campuran etnik lebih tinggi = lebih sukar
};
const LAPISAN_DM = [                                                 // fail DM per negeri (medan: kod_dm, daerah_mengundi, pemilih, kod_dun, dun, kod_parlimen, parlimen, state). Sarawak belum ada.
  { fail: 'dm_johor.geojson', negeri: '1' }, { fail: 'dm_kedah.geojson', negeri: '2' }, { fail: 'dm_kelantan.geojson', negeri: '3' },
  { fail: 'dm_melaka.geojson', negeri: '4' }, { fail: 'dm_n9.geojson', negeri: '5' }, { fail: 'dm_pahang.geojson', negeri: '6' },
  { fail: 'dm_pp.geojson', negeri: '7' }, { fail: 'dm_perak.geojson', negeri: '8' }, { fail: 'dm_perlis.geojson', negeri: '9' },
  { fail: 'dm_selangor.geojson', negeri: '10' }, { fail: 'dm_terengganu.geojson', negeri: '11' }, { fail: 'dm_sabah.geojson', negeri: '12' },
  { fail: 'dm_kl.geojson', negeri: '14' }, { fail: 'dm_labuan.geojson', negeri: '15' }, { fail: 'dm_putrajaya.geojson', negeri: '16' }
];
const PEMILIH_UMUR_ANGGARAN = 'warganegara x peratus umur 18+ (banci 2020)';

/* ---- Utiliti ---- */
function csv(fail) {
  const t = fs.readFileSync(path.join(SUMBER, fail), 'utf8').replace(/^﻿/, '');
  const baris = []; let med = '', rekod = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { med += '"'; i++; } else { q = false; } } else { med += c; } }
    else if (c === '"') { q = true; }
    else if (c === ',') { rekod.push(med); med = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') { i++; } rekod.push(med); med = ''; if (rekod.length > 1 || rekod[0] !== '') { baris.push(rekod); } rekod = []; }
    else { med += c; }
  }
  if (med !== '' || rekod.length) { rekod.push(med); baris.push(rekod); }
  const tajuk = baris.shift();
  return baris.map(r => { const o = {}; tajuk.forEach((h, i) => { o[h] = r[i] === undefined ? '' : r[i]; }); return o; });
}
const nombor = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const bulat = (n, d) => n == null ? null : Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
const pctl = (arr, v) => { const s = arr.slice().sort((a, b) => a - b); let k = 0; while (k < s.length && s[k] <= v) { k++; } return k / s.length; };

function unjur([lon, lat]) { return [(lon - LON_MIN) * UNIT_PER_DARJAH * KOS, (LAT_MAX - lat) * UNIT_PER_DARJAH]; }

function dp(pts, tol) {                                              // Douglas-Peucker (iteratif)
  const n = pts.length; if (n < 5) { return pts; }
  const simpan = new Uint8Array(n); simpan[0] = simpan[n - 1] = 1;
  const tindanan = [[0, n - 1]]; const t2 = tol * tol;
  while (tindanan.length) {
    const [a, b] = tindanan.pop(); let maks = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, pj = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      let u = pj ? ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / pj : 0; u = Math.max(0, Math.min(1, u));
      const ex = ax + u * dx - pts[i][0], ey = ay + u * dy - pts[i][1], d = ex * ex + ey * ey;
      if (d > maks) { maks = d; idx = i; }
    }
    if (maks > t2) { simpan[idx] = 1; tindanan.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => simpan[i]);
}
function luas(g) { let s = 0; for (let i = 0; i < g.length - 1; i++) { s += g[i][0] * g[i + 1][1] - g[i + 1][0] * g[i][1]; } return Math.abs(s) / 2; }

function binaLaluan(poligon, peringkat, toleransi) {                          // poligon = [gelang luar, lubang...]
  const bahagian = []; const bbox = [Infinity, Infinity, -Infinity, -Infinity]; let titik = 0;
  const kelompok = poligon.map((r, i) => ({ i, r: r.map(unjur) }));
  const terbesar = kelompok[0];
  kelompok.forEach(({ i, r }) => {
    let g = dp(r, toleransi == null ? TOLERANSI[peringkat] : toleransi).map(([x, y]) => [Math.round(x), Math.round(y)]);
    g = g.filter((p, k) => k === 0 || p[0] !== g[k - 1][0] || p[1] !== g[k - 1][1]);
    if (g.length > 1 && g[0][0] === g[g.length - 1][0] && g[0][1] === g[g.length - 1][1]) { g.pop(); }
    if (g.length < 3) { return; }
    if (i > 0 && luas(g.concat([g[0]])) < LUAS_MIN[peringkat]) { return; }
    let d = 'M' + g[0][0] + ' ' + g[0][1] + 'l'; const rel = [];
    for (let k = 1; k < g.length; k++) { rel.push((g[k][0] - g[k - 1][0]) + ' ' + (g[k][1] - g[k - 1][1])); }
    bahagian.push(d + rel.join(' ') + 'z');
    g.forEach(p => { bbox[0] = Math.min(bbox[0], p[0]); bbox[1] = Math.min(bbox[1], p[1]); bbox[2] = Math.max(bbox[2], p[0]); bbox[3] = Math.max(bbox[3], p[1]); titik++; });
  });
  return { d: bahagian.join(''), bbox, titik, luas: luas(terbesar.r.concat([terbesar.r[0]])) };
}

function binaFitur(f, peringkat) {
  const geom = f.geometry; const polis = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  const hasil = polis.map(p => ({ p, a: luas(p[0].map(unjur)) })).sort((x, y) => y.a - x.a);
  const lulus = hasil.filter((h, i) => i === 0 || h.a >= LUAS_MIN[peringkat]);
  let d = '', titik = 0; const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  lulus.forEach(h => {
    const r = binaLaluan(h.p, peringkat); d += r.d; titik += r.titik;
    if (r.d) { bbox[0] = Math.min(bbox[0], r.bbox[0]); bbox[1] = Math.min(bbox[1], r.bbox[1]); bbox[2] = Math.max(bbox[2], r.bbox[2]); bbox[3] = Math.max(bbox[3], r.bbox[3]); }
  });
  if (!d && peringkat === 'dm') {                                  // DM sangat kecil hilang selepas dipermudahkan: ulang tanpa Douglas-Peucker
    const r = binaLaluan(hasil[0].p, peringkat, 0); d = r.d; titik = r.titik;
    if (d) { bbox[0] = r.bbox[0]; bbox[1] = r.bbox[1]; bbox[2] = r.bbox[2]; bbox[3] = r.bbox[3]; }
  }
  return { d, bbox, titik };
}

/* ---- Demografi ---- */
const MEDAN = {                                                      // nama dalam fail -> nama ringkas
  area_km2: 'luas', population_total: 'penduduk', nationality_citizen: 'warganegara',
  ethnicity_proportion_bumi: 'bumi', ethnicity_proportion_chinese: 'cina', ethnicity_proportion_indian: 'india', ethnicity_proportion_other: 'lain',
  age_proportion_0_14: 'umur0_14', age_proportion_15_64: 'umur15_64', age_proportion_65_above: 'umur65', age_proportion_18_above: 'umur18',
  household_total: 'isiRumah', household_size_avg: 'saizIsiRumah',
  income_median: 'pendapatanMedian', poverty_incidence: 'kemiskinan', gini: 'gini', labour_unemployment_rate: 'pengangguran'
};
function entriDemografi(r) {
  const o = {};
  Object.keys(MEDAN).forEach(k => { const v = nombor(r[k]); o[MEDAN[k]] = (v == null) ? null : (['bumi', 'cina', 'india', 'lain'].includes(MEDAN[k]) ? bulat(v, 1) : bulat(v, 2)); });
  const u18 = o.umur18 != null ? o.umur18 : 74;
  o.pemilih = o.warganegara != null ? Math.round(o.warganegara * u18 / 100) : null;      // ANGGARAN
  return o;
}
function tambahKesukaran(senarai) {                                  // senarai: objek demografi seperingkat
  const saiz = senarai.map(x => x.pemilih || 0);
  senarai.forEach(x => {
    const bukanBumi = x.bumi == null ? 0.5 : (100 - x.bumi) / 100;
    const skor = KESUKARAN.beratSaizPemilih * pctl(saiz, x.pemilih || 0) + KESUKARAN.beratBukanBumi * bukanBumi;
    x.kesukaran = Math.max(1, Math.min(5, 1 + Math.floor(skor * 5)));
  });
}

/* ---- Utama ---- */
function utama() {
  fs.mkdirSync(KELUAR, { recursive: true });
  const hir = csv('state_parlimen_dun.csv');
  const negeriDariP = {};                                            // P.097 -> kod negeri
  hir.forEach(r => { if (r.code_parlimen) { negeriDariP[r.code_parlimen] = r.code_state || null; } });

  const cenP = csv('census_parlimen.csv'), cenD = csv('census_dun.csv');
  const demo = { versi: 1, sumberBanci: 'DOSM banci 2020', pemilihAnggaran: PEMILIH_UMUR_ANGGARAN, kesukaranHeuristik: KESUKARAN, negeri: {}, parlimen: {}, dun: {} };

  cenP.forEach(r => { demo.parlimen[r.code_parlimen] = Object.assign({ kod: r.code_parlimen, nama: r.parlimen.replace(/^P\.\d+\s+/, ''), negeri: String(r.code_state) }, entriDemografi(r)); });
  cenD.forEach(r => { demo.dun[r.code_state_dun] = Object.assign({ kod: r.code_state_dun, nama: r.dun.replace(/^N\.\d+\s+/, ''), noDun: r.code_dun, parlimen: r.code_parlimen, negeri: String(r.code_state) }, entriDemografi(r)); });

  // Agregat negeri (daripada parlimen; peratus dibahagi mengikut penduduk)
  const kumpulan = {};
  cenP.forEach(r => { (kumpulan[r.code_state] = kumpulan[r.code_state] || { nama: r.state, baris: [] }).baris.push(demo.parlimen[r.code_parlimen]); });
  Object.keys(kumpulan).forEach(k => {
    const b = kumpulan[k].baris, jum = f => b.reduce((s, x) => s + (x[f] || 0), 0), pw = f => { const t = jum('penduduk'); return t ? bulat(b.reduce((s, x) => s + (x[f] || 0) * (x.penduduk || 0), 0) / t, 1) : null; };
    demo.negeri[k] = { kod: String(k), nama: kumpulan[k].nama, luas: Math.round(jum('luas')), penduduk: jum('penduduk'), warganegara: jum('warganegara'), pemilih: jum('pemilih'),
      bumi: pw('bumi'), cina: pw('cina'), india: pw('india'), lain: pw('lain'), umur18: pw('umur18'), kemiskinan: pw('kemiskinan'), pengangguran: pw('pengangguran'), bilParlimen: b.length };
  });
  ['negeri', 'parlimen', 'dun'].forEach(p => tambahKesukaran(Object.values(demo[p])));

  // Geometri
  const fail = [
    ['negeri', 'administrative_1_state.geojson', f => String(f.properties.code_state), f => f.properties.state],
    ['parlimen', 'electoral_0_parlimen.geojson', f => f.properties.code_parlimen, f => f.properties.parlimen.replace(/^P\.\d+\s+/, '')],
    ['dun', 'electoral_1_dun.geojson', f => f.properties.code_state_dun, f => f.properties.dun.replace(/^N\.\d+\s+/, '')]
  ];
  const meta = { versi: 1, unitPerDarjah: UNIT_PER_DARJAH, asal: { lonMin: LON_MIN, latMax: LAT_MAX, latTengah: LAT_TENGAH },
    kredit: 'Data sempadan dan banci: Jabatan Perangkaan Malaysia (DOSM), Open Data License. Bukan produk rasmi.', peringkat: {} };
  let maksX = 0, maksY = 0;
  fail.forEach(([p, nama, kodFn, namaFn]) => {
    const gj = JSON.parse(fs.readFileSync(path.join(SUMBER, nama), 'utf8'));
    const fitur = gj.features.map(f => {
      const r = binaFitur(f, p), kod = kodFn(f), pr = f.properties;
      maksX = Math.max(maksX, r.bbox[2]); maksY = Math.max(maksY, r.bbox[3]);
      const o = { id: kod, nama: namaFn(f), negeri: String(pr.code_state), bbox: r.bbox, d: r.d };
      if (p !== 'negeri') { o.parlimen = pr.code_parlimen; }
      if (p === 'dun') { o.noDun = pr.code_dun; }
      return o;
    });
    const sasaran = path.join(KELUAR, p + '.json');
    fs.writeFileSync(sasaran, JSON.stringify({ peringkat: p, bil: fitur.length, fitur }));
    const kb = Math.round(fs.statSync(sasaran).size / 1024);
    const tanpaDemo = fitur.filter(f => !demo[p][f.id]).map(f => f.id);
    meta.peringkat[p] = { bil: fitur.length, kb, tanpaDemografi: tanpaDemo };
    console.log(p.padEnd(9), String(fitur.length).padStart(4), 'kawasan', String(kb).padStart(5) + ' KB', tanpaDemo.length ? ' tanpa demografi: ' + tanpaDemo.length : '');
  });
  // Lapisan Daerah Mengundi (pemilih sebenar)
  meta.dm = {};
  LAPISAN_DM.forEach(L => {
    const gj = JSON.parse(fs.readFileSync(path.join(SUMBER, L.fail), 'utf8')), ada = {}, fitur = [], dmDemo = {}, amaran = [];
    gj.features.forEach(f => {
      const pr = f.properties, id = pr.kod_dm;
      if (!f.geometry) { amaran.push('tiada geometri ' + id); return; }
      if (ada[id]) { amaran.push('kod_dm berganda ' + id); return; }
      ada[id] = true;
      const r = binaFitur(f, 'dm'), kodDun = pr.kod_dun ? L.negeri + '_N.' + String(pr.kod_dun).replace(/^N\./, '') : null;      // Wilayah Persekutuan: tiada DUN
      if (kodDun && !demo.dun[kodDun]) { amaran.push('DUN tiada dalam banci: ' + kodDun + ' (' + id + ')'); }
      maksX = Math.max(maksX, r.bbox[2]); maksY = Math.max(maksY, r.bbox[3]);
      fitur.push({ id, nama: pr.daerah_mengundi, negeri: L.negeri, parlimen: pr.kod_parlimen, dun: kodDun, bbox: r.bbox, d: r.d });
      dmDemo[id] = { kod: id, nama: pr.daerah_mengundi, negeri: L.negeri, parlimen: pr.kod_parlimen, dun: kodDun, namaDun: pr.dun, namaParlimen: pr.parlimen, pemilih: pr.pemilih };
    });
    const senarai = Object.values(dmDemo), saiz = senarai.map(x => x.pemilih || 0);
    senarai.forEach(x => { x.kesukaran = Math.max(1, Math.min(5, 1 + Math.floor(pctl(saiz, x.pemilih || 0) * 5 - 1e-9))); });
    const fail = path.join(KELUAR, 'dm-' + L.negeri + '.json');
    fs.writeFileSync(fail, JSON.stringify({ peringkat: 'dm', negeri: L.negeri, pemilihSebenar: true, bil: fitur.length, fitur, demografi: dmDemo }));
    const jum = saiz.reduce((a, b) => a + b, 0), kb = Math.round(fs.statSync(fail).size / 1024);
    meta.dm[L.negeri] = { bil: fitur.length, kb, jumlahPemilih: jum, amaran };
    console.log(('dm-' + L.negeri).padEnd(9), String(fitur.length).padStart(4), 'DM     ', String(kb).padStart(5) + ' KB', ' pemilih ' + jum.toLocaleString('en'), amaran.length ? ' AMARAN: ' + amaran.slice(0, 5).join('; ') : '');
  });
  meta.viewBox = [0, 0, Math.ceil(maksX), Math.ceil(maksY)];
  meta.negeriDariParlimen = negeriDariP;
  fs.writeFileSync(path.join(KELUAR, 'demografi.json'), JSON.stringify(demo));
  fs.writeFileSync(path.join(KELUAR, 'meta.json'), JSON.stringify(meta));
  console.log('demografi.json', Math.round(fs.statSync(path.join(KELUAR, 'demografi.json')).size / 1024) + ' KB', '· viewBox', meta.viewBox.join(' '));
}
utama();
