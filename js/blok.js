/* ==========================================================================
   Nusa Politik — js/blok.js   (v6.6)
   Pengaruh Blok Sayap & Tawar-Menawar Pemilihan Induk.

   Pemegang jawatan Ketua Sayap Bahagian (Pemuda/Puteri/Wanita) mempunyai satu BLOK UNDI.
   Dalam tahun pemilihan, calon Ketua Bahagian (Induk) datang merisik sokongan blok itu.
   Pemain boleh BERTAWAR: sokong calon X sebagai balasan janji kuota tempat bertanding
   (kerusi DUN / Parlimen) untuk ahli sayap pada pilihan raya akan datang.

   Alur:
     1. meter(p)            -> Meter Pengaruh Blok (0-100) dan saiz blok (anggaran undi).
     2. calonRisik(p)       -> calon Ketua Bahagian + tawaran maksimum masing-masing.
     3. runding(id, tuntutan) -> terima / terima sebahagian (balas) / tolak. Kos 1 AP.
     4. selesaikanPerlumbaan() -> dipanggil apabila Mesyuarat Bahagian ditutup (election.js):
        blok mengalih undi kepada calon yang disokong; pemenang direkod.
     5. prosesTahunBaharu() -> janji kuota ditunaikan atau dimungkiri pada tahun berikutnya
        (penetapan calon); meter naik atau turun.

   Andaian (laras dalam CONFIG):
     - Permainan belum mempunyai pilihan raya DUN/Parlimen. Janji kuota diselesaikan secara
       abstrak pada pertukaran tahun berikutnya ("Penetapan Calon"), bukan pilihan raya sebenar.
     - Calon Ketua Bahagian ialah NPC (3 orang, dijana berbenih). Jika pemain sendiri bertanding
       Ketua Bahagian, rundingan ditutup (percanggahan kepentingan).
     - Nisbah blok sayap daripada pemilih Bahagian ialah anggaran (CONFIG.NISBAH_BLOK).
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikBlok = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  function modul(nama, fail) {
    if (root[nama]) { return root[nama]; }
    try { if (typeof require === 'function') { return require('./' + fail); } } catch (e) { /* tidak dimuatkan */ }
    return null;
  }
  function S() { return modul('MyPolitikSave', 'save.js'); }
  function D() { return modul('MyPolitikData', 'data.js'); }
  function J() { return modul('MyPolitikJawatan', 'jawatan.js'); }
  function E() { return modul('MyPolitikElection', 'election.js'); }

  var CONFIG = {
    KOD_PERLUMBAAN: 'ketua_bahagian',
    BIL_CALON: 3,
    NISBAH_BLOK: { pemuda: 0.22, puteri: 0.14, wanita: 0.26 },   // bahagian pemilih Bahagian yang dikawal blok sayap (maksimum, pada meter 100)
    BERAT_METER: { ip: 30, kesetiaan: 30, reputasi: 15, ahli: 10, g10: 5, laras: 10 },   // jumlah 100 (laras boleh menokok)
    IP_SKALA: 250,                       // IP sebanyak ini = skor IP penuh
    AHLI_PENUH: 60,                      // ahli sayap Cawangan sebanyak ini = skor ahli penuh
    LARAS_MAKS: 15,                      // had laras meter daripada janji ditunaikan / dimungkiri
    KOS_AP: 1,                           // setiap pusingan rundingan
    NILAI: { dun: 1, parlimen: 2 },      // mata kuota
    MAKS_MATA: 5,
    MIN_MAKS_TAWARAN: 2,
    TUNTUTAN: [                          // menu tuntutan kuota
      { id: 'tanpa', dun: 0, parlimen: 0, label: 'Sokong tanpa syarat' },
      { id: 'd1', dun: 1, parlimen: 0, label: '1 kerusi DUN' },
      { id: 'd2', dun: 2, parlimen: 0, label: '2 kerusi DUN' },
      { id: 'p1', dun: 0, parlimen: 1, label: '1 kerusi Parlimen' },
      { id: 'p1d1', dun: 1, parlimen: 1, label: '1 Parlimen + 1 DUN' },
      { id: 'p1d2', dun: 2, parlimen: 1, label: '1 Parlimen + 2 DUN' }
    ],
    GOODWILL: { reputasi: 1 },           // sokongan tanpa syarat
    JANJI: { asas: 0.88, perMata: 0.08, bonusMeter: 0.2, min: 0.3, maks: 0.95 },
    DITUNAI: { ip: 12, reputasi: 3, kesetiaan: { akarUmbi: 6, perwakilan: 6 }, laras: 5 },
    DIMUNGKIRI: { ip: -6, reputasi: -4, kesetiaan: { akarUmbi: -8, perwakilan: -8 }, laras: -8, stress: 6 },
    KUASA_UNDI: 12                       // penentu kecuraman kekuatan -> undi
  };

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function salin(o) { return JSON.parse(JSON.stringify(o)); }
  function gagal(kod, ralat) { return { ok: false, kod: kod, ralat: ralat }; }

  var SAYAP_NAMA = { pemuda: 'Pemuda', puteri: 'Puteri', wanita: 'Wanita' };

  /** Sayap yang dipegang pemain sebagai Ketua Sayap Bahagian, atau null. */
  function sayapBahagian(p) {
    var j = J();
    if (!p || !j) { return null; }
    var kod = ['pemuda', 'puteri', 'wanita'];
    for (var i = 0; i < kod.length; i++) { if (j.pegang(p, 'sayap_bahagian_' + kod[i])) { return kod[i]; } }
    return null;
  }

  function keadaan(p) {
    var b = p && p.blok ? salin(p.blok) : {};
    if (typeof b.laras !== 'number') { b.laras = 0; }
    if (!Array.isArray(b.janji)) { b.janji = []; }
    if (typeof b.kerusiDiperoleh !== 'number') { b.kerusiDiperoleh = 0; }
    if (!b.runding || b.runding.tahun !== (p && p.tahun)) { b.runding = { tahun: p ? p.tahun : 0, tolak: {}, bil: 0 }; }
    if (b.sokongan && b.sokongan.tahun !== (p && p.tahun)) { b.sokongan = null; }
    if (b.keputusan && b.keputusan.tahun !== (p && p.tahun)) { b.keputusan = null; }
    return b;
  }

  /* ------------------------------------------------------------------------
     1. METER PENGARUH BLOK
     ------------------------------------------------------------------------ */
  function pemilihBahagian(p) {
    var e = E();
    return e ? Math.max(1, e.kuotaCawangan(p) * e.CONFIG.ANGGARAN_CAWANGAN_PER_BAHAGIAN) : 100;
  }

  /** Meter Pengaruh Blok Sayap. Pulang null jika bukan Ketua Sayap Bahagian. */
  function meter(p) {
    var sy = sayapBahagian(p);
    if (!sy) { return null; }
    var C = CONFIG, B = C.BERAT_METER, k = p.kesetiaan || {}, e = E(), b = keadaan(p);
    var skorIp = clamp((Number(p.ip) || 0) / C.IP_SKALA, 0, 1) * B.ip;
    var skorKes = clamp(((k.akarUmbi || 0) * 0.4 + (k.perwakilan || 0) * 0.35 + (k.ajk || 0) * 0.25) / 100, 0, 1) * B.kesetiaan;
    var skorRep = clamp((Number(p.reputasi) || 0) / 100, 0, 1) * B.reputasi;
    var ahli = e && e.ahliSayap ? e.ahliSayap(p, sy) : 0, skorAhli = clamp(ahli / C.AHLI_PENUH, 0, 1) * B.ahli;
    var g10 = p.perwakilan && p.perwakilan.g10 === p.tahun ? B.g10 : 0;
    var laras = clamp(b.laras, -C.LARAS_MAKS, C.LARAS_MAKS);
    var nilai = clamp(Math.round(skorIp + skorKes + skorRep + skorAhli + g10 + laras), 0, 100);
    var pemilih = pemilihBahagian(p), blokUndi = Math.round(pemilih * C.NISBAH_BLOK[sy] * nilai / 100);
    return {
      sayap: sy, nama: SAYAP_NAMA[sy], nilai: nilai, pemilih: pemilih, blokUndi: blokUndi,
      peratusPemilih: Math.round(1000 * blokUndi / pemilih) / 10,
      label: nilai >= 75 ? 'Sangat kuat' : nilai >= 55 ? 'Kuat' : nilai >= 35 ? 'Sederhana' : 'Lemah',
      komponen: { ip: Math.round(skorIp), kesetiaan: Math.round(skorKes), reputasi: Math.round(skorRep), ahli: Math.round(skorAhli), g10: g10, laras: laras }
    };
  }

  /* ------------------------------------------------------------------------
     2. CALON YANG MERISIK
     ------------------------------------------------------------------------ */
  var GAYA = ['Penyandang yang mahu bertahan', 'Timbalan yang mencabar', 'Tokoh pembaharuan', 'Veteran daripada Cawangan', 'Usahawan berprofil tinggi'];

  function mataTuntutan(t) { return (t.dun || 0) * CONFIG.NILAI.dun + (t.parlimen || 0) * CONFIG.NILAI.parlimen; }

  /** Calon Ketua Bahagian tahun ini (tetap, berbenih) dengan tawaran maksimum masing-masing. */
  function senaraiCalon(p) {
    var d = D(), s = S(), m = meter(p) || { nilai: 40 }, C = CONFIG;
    var rng = d.createRng(String(p.id || p.nama || 'nusa') + '|' + p.tahun + '|blok_calon'), out = [];
    for (var i = 0; i < C.BIL_CALON; i++) {
      var lelaki = rng() < 0.8, kekuatan = clamp(Math.round(44 + rng() * 32), 40, 78);
      var maks = clamp(Math.round(1 + (80 - kekuatan) / 8 + (m.nilai - 50) / 50), C.MIN_MAKS_TAWARAN, C.MAKS_MATA);
      out.push({ id: 'c' + (i + 1), nama: d.janaNama(rng, lelaki ? 'L' : 'P'), kekuatan: kekuatan, gaya: GAYA[Math.floor(rng() * GAYA.length)], maksMata: maks });
    }
    return out;
  }

  /** Kenapa rundingan tidak boleh dilakukan sekarang (null = boleh). */
  function sebabTutup(p) {
    var e = E(), b = keadaan(p);
    if (!sayapBahagian(p)) { return 'Hanya Ketua Sayap Bahagian mempunyai blok undi.'; }
    if (!e || !e.adalahTahunPemilihan(p.tahun)) { return 'Calon hanya merisik sokongan pada tahun pemilihan.'; }
    if (b.keputusan) { return 'Pemilihan Ketua Bahagian tahun ' + p.tahun + ' sudah selesai.'; }
    var st = e.getKeadaanPemilihan(p);
    if (st.daftar && st.daftar[CONFIG.KOD_PERLUMBAAN]) { return 'Anda sendiri bertanding Ketua Bahagian. Rundingan blok ditutup (percanggahan kepentingan).'; }
    return null;
  }

  /** Keadaan penuh untuk UI. */
  function ringkasan(p) {
    var m = meter(p);
    if (!m) { return null; }
    var b = keadaan(p), tutup = sebabTutup(p), calon = senaraiCalon(p);
    var tahunPemilihan = !!(E() && E().adalahTahunPemilihan(p.tahun));
    return {
      meter: m, tutup: tutup, tahunPemilihan: tahunPemilihan, sokongan: b.sokongan, keputusan: b.keputusan,
      calon: calon.map(function (c) {
        return { id: c.id, nama: c.nama, kekuatan: c.kekuatan, gaya: c.gaya, maksMata: c.maksMata, ditolak: !!b.runding.tolak[c.id], disokong: !!(b.sokongan && b.sokongan.calonId === c.id) };
      }),
      menu: CONFIG.TUNTUTAN.map(function (t) { return { id: t.id, label: t.label, dun: t.dun, parlimen: t.parlimen, mata: mataTuntutan(t) }; }),
      janji: b.janji.slice(-6), kerusiDiperoleh: b.kerusiDiperoleh, apKos: CONFIG.KOS_AP, laras: b.laras
    };
  }

  /* ------------------------------------------------------------------------
     3. RUNDINGAN
     ------------------------------------------------------------------------ */
  function kecilkan(t, maks) {
    var dun = t.dun || 0, par = t.parlimen || 0;
    while (dun * CONFIG.NILAI.dun + par * CONFIG.NILAI.parlimen > maks && (dun > 0 || par > 0)) { if (dun > 0) { dun--; } else { par--; } }
    return { dun: dun, parlimen: par };
  }

  function kebarangkalianJanji(mata, nilaiMeter) {
    var J_ = CONFIG.JANJI;
    return clamp(J_.asas - J_.perMata * mata + J_.bonusMeter * (nilaiMeter - 50) / 50, J_.min, J_.maks);
  }

  /**
   * Bertawar dengan seorang calon. tuntutanId daripada CONFIG.TUNTUTAN.
   * Keputusan: 'terima' | 'balas' (diterima sebahagian pada tawaran maksimum calon) | 'tolak'.
   * Pulang { ok, keputusan, mesej, sokongan }.
   */
  function runding(calonId, tuntutanId) {
    var s = S(), p = s && s.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    var tutup = sebabTutup(p);
    if (tutup) { return gagal('tutup', tutup); }
    var b = keadaan(p), m = meter(p), calon = senaraiCalon(p).filter(function (c) { return c.id === calonId; })[0];
    var tt = CONFIG.TUNTUTAN.filter(function (t) { return t.id === tuntutanId; })[0];
    if (!calon || !tt) { return gagal('tidak_sah', 'Calon atau tuntutan tidak sah.'); }
    if (b.sokongan) { return gagal('sudah_menyokong', 'Anda sudah mengikat sokongan blok kepada ' + b.sokongan.nama + ' tahun ini.'); }
    if (b.runding.tolak[calonId]) { return gagal('ditolak', calon.nama + ' sudah menolak rundingan dan tidak mahu berunding lagi tahun ini.'); }
    if ((p.ap || 0) < CONFIG.KOS_AP) { return gagal('ap_kurang', 'Tindakan Berbaki (AP) tidak mencukupi untuk berunding.'); }

    var mata = mataTuntutan(tt), keputusan, akhir = { dun: tt.dun, parlimen: tt.parlimen }, kesan = { ap: -CONFIG.KOS_AP }, nota = '';
    if (mata <= calon.maksMata) { keputusan = 'terima'; }
    else if (mata <= calon.maksMata + 1) { keputusan = 'balas'; akhir = kecilkan(tt, calon.maksMata); }
    else { keputusan = 'tolak'; }

    var patch = {}, mesej, sokongan = null;
    b.runding.bil += 1;
    if (keputusan === 'tolak') {
      b.runding.tolak[calonId] = true;
      mesej = calon.nama + ' menolak tuntutan "' + tt.label + '" kerana terlalu tinggi. Beliau tidak akan berunding lagi tahun ini.';
    } else {
      var mataAkhir = akhir.dun * CONFIG.NILAI.dun + akhir.parlimen * CONFIG.NILAI.parlimen;
      sokongan = { tahun: p.tahun, calonId: calon.id, nama: calon.nama, dun: akhir.dun, parlimen: akhir.parlimen, mata: mataAkhir, kekuatan: calon.kekuatan, kemungkinan: Math.round(100 * kebarangkalianJanji(mataAkhir, m.nilai)) };
      b.sokongan = sokongan;
      if (mataAkhir === 0) { kesan.reputasi = CONFIG.GOODWILL.reputasi; nota = ' Sokongan tanpa syarat meningkatkan nama baik anda.'; }
      var teks = mataAkhir === 0 ? 'tanpa syarat' : (akhir.parlimen ? akhir.parlimen + ' kerusi Parlimen' : '') + (akhir.parlimen && akhir.dun ? ' + ' : '') + (akhir.dun ? akhir.dun + ' kerusi DUN' : '');
      mesej = (keputusan === 'balas' ? calon.nama + ' tidak mampu menjanjikan sebanyak itu dan menawarkan ' + teks + ' sahaja. Sokongan blok diikat.' : calon.nama + ' bersetuju. Sokongan blok anda diikat dengan janji ' + teks + '.') + nota;
    }
    patch.blok = b;
    var r = s.applyEffects(kesan, { kiraTindakan: false, patch: patch, log: { tindakan: 'blok_runding', nama: 'Rundingan blok sayap: ' + calon.nama, peringkat: 'pemilihan' } });
    if (!r.ok) { return r; }
    return { ok: true, keputusan: keputusan, mesej: mesej, sokongan: sokongan, calon: calon.nama, profil: r.profil };
  }

  /* ------------------------------------------------------------------------
     4. PERLUMBAAN KETUA BAHAGIAN (blok mengalih undi)
     ------------------------------------------------------------------------ */
  /**
   * Simulasi pemilihan Ketua Bahagian. Blok sayap anda (anggaran undi) beralih kepada calon yang disokong.
   * opts: { rng }. Dipanggil sekali setahun apabila Mesyuarat Bahagian ditutup. Pulang { ok, ... } atau null jika tidak berkenaan.
   */
  function selesaikanPerlumbaan(opts) {
    opts = opts || {};
    var s = S(), p = s && s.loadPlayer();
    if (!p || !sayapBahagian(p)) { return null; }
    var tutup = sebabTutup(p);
    if (tutup) { return null; }
    var b = keadaan(p), m = meter(p), calon = senaraiCalon(p), rng = opts.rng || Math.random, C = CONFIG;
    var hadir = Math.round(m.pemilih * (0.55 + rng() * 0.25));
    var w = calon.map(function (c) { return Math.exp(c.kekuatan / C.KUASA_UNDI); }), jum = w.reduce(function (a, c) { return a + c; }, 0);
    var blokHadir = Math.round(m.blokUndi * hadir / m.pemilih);              // blok hadir selari dengan kehadiran
    var sokId = b.sokongan ? b.sokongan.calonId : null, jangka = calon.map(function (c, i) {
      var asas = hadir * w[i] / jum;
      var laras = (c.id === sokId ? blokHadir : 0) - blokHadir * w[i] / jum;    // blok keluar daripada pembahagian semula jadi, masuk kepada calon sokongan
      return Math.max(1, asas + laras);
    });
    var undi = calon.map(function (c, i) {
      var sisihan = Math.sqrt(jangka[i]) * 0.9, u = jangka[i] + (rng() + rng() + rng() - 1.5) * 2 * sisihan;
      return { id: c.id, nama: c.nama, undi: Math.max(0, Math.round(u)), disokong: c.id === sokId };
    });
    undi.sort(function (a, c) { return c.undi - a.undi; });
    var menang = undi[0];
    var res = { tahun: p.tahun, pemenangId: menang.id, pemenang: menang.nama, disokong: b.sokongan ? b.sokongan.nama : null, disokongMenang: !!(b.sokongan && b.sokongan.calonId === menang.id), undi: undi, blokUndi: blokHadir, hadir: hadir };
    b.keputusan = res;
    var kesan = {}, mesej;
    if (b.sokongan) {
      if (res.disokongMenang) {
        kesan.ip = 8; kesan.reputasi = 2;
        mesej = 'Calon sokongan blok sayap anda, ' + menang.nama + ', dipilih sebagai Ketua Bahagian (' + menang.undi + ' undi). Beliau berhutang budi kepada anda.';
        if (b.sokongan.mata > 0) {
          b.janji.push({ tahun: p.tahun, calonId: menang.id, nama: menang.nama, dun: b.sokongan.dun, parlimen: b.sokongan.parlimen, mata: b.sokongan.mata, status: 'menunggu', kemungkinan: b.sokongan.kemungkinan });
          mesej += ' Janji kuota ' + b.sokongan.mata + ' mata akan diuji pada Penetapan Calon tahun depan.';
        }
      } else {
        kesan.reputasi = -2; kesan.ip = -3;
        b.laras = clamp(b.laras - 2, -C.LARAS_MAKS, C.LARAS_MAKS);
        mesej = 'Calon sokongan anda, ' + b.sokongan.nama + ', kalah. ' + menang.nama + ' dipilih sebagai Ketua Bahagian dan mengingati pihak yang tidak menyokongnya. Janji kuota terbatal.';
      }
    } else {
      mesej = menang.nama + ' dipilih sebagai Ketua Bahagian. Blok sayap anda tidak mengikat sokongan kepada sesiapa.';
    }
    res.mesej = mesej;
    var r = s.applyEffects(kesan, { kiraTindakan: false, patch: { blok: b }, log: { tindakan: 'blok_perlumbaan', nama: 'Pemilihan Ketua Bahagian: ' + menang.nama, peringkat: 'pemilihan' } });
    return { ok: !!r.ok, mesej: mesej, keputusan: res, profil: r.profil };
  }

  /* ------------------------------------------------------------------------
     5. PENETAPAN CALON (janji kuota ditunaikan atau dimungkiri)
     ------------------------------------------------------------------------ */
  /** Dipanggil pada pertukaran tahun. Pulang { peristiwa: [] }. opts.rng boleh diberi untuk ujian. */
  function prosesTahunBaharu(opts) {
    opts = opts || {};
    var s = S(), p = s && s.loadPlayer(), out = { peristiwa: [] };
    if (!p || !p.blok || !Array.isArray(p.blok.janji)) { return out; }
    var b = keadaan(p), C = CONFIG, m = meter(p), nilaiMeter = m ? m.nilai : 50, kesan = {}, perlu = false;
    var rng = opts.rng || Math.random;
    b.janji.forEach(function (j) {
      if (j.status !== 'menunggu' || j.tahun >= p.tahun) { return; }
      perlu = true;
      var tunai = rng() < kebarangkalianJanji(j.mata, nilaiMeter), A = tunai ? C.DITUNAI : C.DIMUNGKIRI;
      j.status = tunai ? 'ditepati' : 'dimungkiri'; j.tahunSelesai = p.tahun;
      kesan.ip = (kesan.ip || 0) + A.ip; kesan.reputasi = (kesan.reputasi || 0) + A.reputasi;
      kesan.kesetiaan = kesan.kesetiaan || {};
      Object.keys(A.kesetiaan).forEach(function (k) { kesan.kesetiaan[k] = (kesan.kesetiaan[k] || 0) + A.kesetiaan[k]; });
      if (A.stress) { kesan.stress = (kesan.stress || 0) + A.stress; }
      b.laras = clamp(b.laras + A.laras, -C.LARAS_MAKS, C.LARAS_MAKS);
      if (tunai) { b.kerusiDiperoleh += j.mata; }
      var teks = (j.parlimen ? j.parlimen + ' Parlimen' : '') + (j.parlimen && j.dun ? ' + ' : '') + (j.dun ? j.dun + ' DUN' : '');
      out.peristiwa.push({ jenis: tunai ? 'blok_janji_tunai' : 'blok_janji_mungkir',
        mesej: tunai ? 'Penetapan Calon: Ketua Bahagian ' + j.nama + ' menunaikan janji. Ahli sayap anda dicalonkan untuk ' + teks + '. Pengaruh blok sayap naik.'
                     : 'Penetapan Calon: Ketua Bahagian ' + j.nama + ' memungkiri janji ' + teks + ' kepada sayap anda. Ahli sayap kecewa dan pengaruh blok merosot.' });
    });
    if (!perlu) { return out; }
    var stres = kesan.stress; delete kesan.stress;
    s.applyEffects(kesan, { kiraTindakan: false, patch: { blok: b }, log: { tindakan: 'blok_penetapan_calon', nama: 'Penetapan Calon: janji kuota sayap', peringkat: 'pemilihan' } });
    if (stres) { var ST = modul('MyPolitikStres', 'stress.js'); if (ST && ST.laras) { ST.laras({ stress: stres }); } }
    return out;
  }

  return {
    CONFIG: CONFIG, sayapBahagian: sayapBahagian, meter: meter, senaraiCalon: senaraiCalon, ringkasan: ringkasan,
    sebabTutup: sebabTutup, runding: runding, selesaikanPerlumbaan: selesaikanPerlumbaan, prosesTahunBaharu: prosesTahunBaharu,
    kebarangkalianJanji: kebarangkalianJanji, mataTuntutan: mataTuntutan
  };
});
