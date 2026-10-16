/* ==========================================================================
   Nusa Politik — js/jawatan.js   (v3.0)
   Katalog jawatan, pegangan berbilang peringkat dan mandat perwakilan tahunan.

   1. Pegangan berbilang (multi-holding)
        profil.jawatanList = [{ kod, jawatan, peringkat:'cawangan'|'bahagian'|'pusat', kumpulan:'utama'|'sayap',
                                sayap, pangkat, tahun }]
        v5.7 PERTINDIHAN MENEGAK: boleh memegang jawatan di peringkat BERBEZA serentak (Cawangan + Bahagian + Pusat),
        tetapi hanya SATU jawatan bagi setiap peringkat (utama atau sayap - contoh: Ketua Bahagian dan Ketua Pemuda
        Bahagian tidak boleh serentak). Menang jawatan lebih tinggi di peringkat yang sama menggantikan jawatan lama.
        Beban pelbagai jawatan dikawal oleh Stress (stress.js).
        profil.pangkatUtamaLalu = pangkat utama yang dilepaskan demi sayap (untuk syarat tangga jawatan utama).
        profil.jawatan sentiasa = nama jawatan berpangkat tertinggi (sandaran untuk modul lama).
   2. Jawatan mengikut sayap
        v5.9: Sayap pemain = profil.sayap ('utama' = tiada sayap | pemuda | puteri | wanita), dipilih semasa pendaftaran (lihat sayap.js). Simpanan lama mengikut avatar. Kategori bertukar mengikut umur pada tahun baharu (hayat.js); jawatan sayap lama kekal sehingga pemilihan seterusnya.
        Hanya jawatan sayap yang sepadan dibuka. Jawatan utama dibuka kepada semua.
   3. Mandat perwakilan (sah tahun semasa SAHAJA)
        profil.perwakilan = { cawangan: <tahun menang>|0, bahagian: <tahun menang>|0 }
        Sah jika nilai === profil.tahun. Tahun baharu = mandat luput, bertanding semula di Cawangan.
        Ex-officio: pemegang jawatan Bahagian/Pusat hadir Bahagian secara automatik;
        Ketua Bahagian dan pemegang jawatan Pusat hadir PAU secara automatik.
   ========================================================================== */
(function (root, factory) {
  var S = root.MyPolitikSave || (typeof module === 'object' && typeof require === 'function' ? require('./save.js') : null);
  var api = factory(S);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikJawatan = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (S) {
  'use strict';

  function etika() { var g = typeof globalThis !== 'undefined' ? globalThis : null; if (g && g.MyPolitikEtika) { return g.MyPolitikEtika; } try { return typeof require === 'function' ? require('./etika.js') : null; } catch (e) { return null; } }

  var BIASA = 'Ahli Biasa';
  var SAYAP = ['pemuda', 'puteri', 'wanita'];
  var NAMA_SAYAP = { pemuda: 'Pemuda', puteri: 'Puteri', wanita: 'Wanita' };
  var LABEL_PERINGKAT = { cawangan: 'Cawangan', bahagian: 'Bahagian', pusat: 'Pusat', sayap_cawangan: 'Sayap Cawangan', sayap_bahagian: 'Sayap Bahagian', sayap_pau: 'Sayap Pusat' };

  /* ------------------------------------------------------------------------
     KATALOG. ipMin dan pangkatMin ialah andaian permainan, boleh diubah di sini.
       pangkatMin : pangkat tertinggi yang mesti sudah dipegang (di mana-mana peringkat)
       kesukaran  : tambahan kekuatan pesaing (jawatan lebih tinggi, pesaing lebih kuat)
     ------------------------------------------------------------------------ */
  var KATALOG = [];
  function tambah(d) { d.kumpulan = d.kumpulan || 'utama'; d.sayap = d.sayap || null; d.kerusi = d.kerusi || 1; d.kesukaran = d.kesukaran || 0; d.pangkatMin = d.pangkatMin || 0; KATALOG.push(d); }

  // Cawangan
  tambah({ kod: 'ajk_cawangan',   jawatan: 'AJK Cawangan',   peringkat: 'cawangan', pangkat: 1, kerusi: 7, ipMin: 50 });
  tambah({ kod: 'ketua_cawangan', jawatan: 'Ketua Cawangan', peringkat: 'cawangan', pangkat: 3, ipMin: 95, pangkatMin: 1, kesukaran: 8 });
  // Bahagian
  tambah({ kod: 'ajk_bahagian',        jawatan: 'AJK Bahagian',        peringkat: 'bahagian', pangkat: 4, kerusi: 15, ipMin: 140, pangkatMin: 1, perluBahagian: true, kesukaran: 6, keahlian: 36, fasal: 'Fasal 15.5' });
  tambah({ kod: 'naib_ketua_bahagian', jawatan: 'Naib Ketua Bahagian', peringkat: 'bahagian', pangkat: 6, ipMin: 185, pangkatMin: 4, perluBahagian: true, kesukaran: 14, keahlian: 36, fasal: 'Fasal 15.5' });
  tambah({ kod: 'ketua_bahagian',      jawatan: 'Ketua Bahagian',      peringkat: 'bahagian', pangkat: 7, ipMin: 220, pangkatMin: 4, perluBahagian: true, kesukaran: 20, keahlian: 36, fasal: 'Fasal 15.5' });
  // Pusat (bulan 8, tahun pemilihan)
  tambah({ kod: 'ahli_mkt',          jawatan: 'Ahli MKT',         peringkat: 'pusat', pangkat: 8,  kerusi: 25, ipMin: 250, pangkatMin: 7, perluPAU: true, kesukaran: 14, penggal: true });
  tambah({ kod: 'naib_presiden',     jawatan: 'Naib Presiden',    peringkat: 'pusat', pangkat: 10, kerusi: 3,  ipMin: 300, pangkatMin: 8, perluPAU: true, kesukaran: 24, penggal: true });
  tambah({ kod: 'timbalan_presiden', jawatan: 'Timbalan Presiden', peringkat: 'pusat', pangkat: 11, ipMin: 350, pangkatMin: 8, perluPAU: true, kesukaran: 30, penggal: true });
  tambah({ kod: 'presiden',          jawatan: 'Presiden',         peringkat: 'pusat', pangkat: 12, ipMin: 420, pangkatMin: 10, perluPAU: true, kesukaran: 36, penggal: true });
  // Sayap (satu set bagi setiap sayap, hanya sayap pemain dipaparkan)
  SAYAP.forEach(function (w) {
    var N = NAMA_SAYAP[w];
    tambah({ kod: 'sayap_cawangan_' + w, jawatan: 'Ketua ' + N + ' Cawangan', peringkat: 'cawangan', kumpulan: 'sayap', sayap: w, pangkat: 2, ipMin: 50, kesukaran: 3 });
    tambah({ kod: 'sayap_bahagian_' + w, jawatan: 'Ketua ' + N + ' Bahagian', peringkat: 'bahagian', kumpulan: 'sayap', sayap: w, pangkat: 5, ipMin: 160, pangkatMin: 2, perluBahagian: true, perluSayapCawangan: true, kesukaran: 12, keahlian: 36, fasal: 'Peraturan ' + N + ' (3 tahun ahli)' });
    tambah({ kod: 'sayap_pusat_' + w,    jawatan: 'Ketua ' + N,             peringkat: 'pusat',    kumpulan: 'sayap', sayap: w, pangkat: 9, ipMin: 280, pangkatMin: 5, perluPAU: true, kesukaran: 22, keahlian: 36, fasal: 'Peraturan ' + N + ' (3 tahun ahli)' });
  });

  function cariDef(kod) { for (var i = 0; i < KATALOG.length; i++) { if (KATALOG[i].kod === kod) { return KATALOG[i]; } } return null; }

  /* ------------------------------------------------------------------------
     PEGANGAN
     ------------------------------------------------------------------------ */
  function peringkatDaripadaNama(j) {
    j = String(j || '');
    if (/Bahagian/i.test(j)) { return 'bahagian'; }
    if (/Cawangan/i.test(j)) { return 'cawangan'; }
    return 'pusat';
  }

  /** Senarai jawatan dipegang. Profil lama (hanya `jawatan`) disintesis supaya tidak hilang. */
  function getJawatan(p) {
    if (!p) { return []; }
    if (Array.isArray(p.jawatanList) && p.jawatanList.length) { return p.jawatanList.slice(); }
    if (p.jawatan && p.jawatan !== BIASA) {
      var d = null;
      KATALOG.forEach(function (x) { if (x.jawatan === p.jawatan && !d) { d = x; } });
      return [{ kod: d ? d.kod : 'lama', jawatan: p.jawatan, peringkat: d ? d.peringkat : peringkatDaripadaNama(p.jawatan),
                kumpulan: d ? d.kumpulan : 'utama', sayap: d ? d.sayap : null, pangkat: d ? d.pangkat : 1, tahun: p.tahun }];
    }
    return [];
  }

  function pegang(p, kod) { return getJawatan(p).some(function (j) { return j.kod === kod; }); }
  /** kumpulan (pilihan): 'utama' hanya mengira jawatan utama, supaya jawatan sayap tidak melangkau tangga jawatan utama (v3.8). */
  function pangkatTertinggi(p, kumpulan) {
    var asas = getJawatan(p).reduce(function (m, j) { return (kumpulan && j.kumpulan !== kumpulan) ? m : Math.max(m, j.pangkat || 0); }, 0);
    var exMkt = p && p.negeriBP && p.negeriBP.pengerusi && p.negeriBP.pengerusi.pemain && (!kumpulan || kumpulan === 'utama') ? 8 : 0;      // v7.34: Pengerusi Badan Perhubungan Negeri = ahli MKT ex-officio (pangkat 8)
    return Math.max(asas, exMkt);
  }
  function jawatanTertinggi(p) {
    var t = null;
    getJawatan(p).forEach(function (j) { if (!t || (j.pangkat || 0) > (t.pangkat || 0)) { t = j; } });
    return t ? t.jawatan : BIASA;
  }
  function peringkatTertinggi(p) {
    var rank = { cawangan: 1, bahagian: 2, pusat: 3 }, t = null;
    getJawatan(p).forEach(function (j) { if (!t || rank[j.peringkat] > rank[t]) { t = j.peringkat; } });
    return t;
  }
  function pegangPeringkat(p, peringkat) { return getJawatan(p).some(function (j) { return j.peringkat === peringkat; }); }
  function bilJawatan(p) { return getJawatan(p).length; }

  /** Sayap pemain: pemuda | puteri | wanita | null (veteran / ahli biasa). */
  function sayapPemain(p) {
    if (p && (p.sayap === 'utama')) { return null; }                            // v5.9: laluan Utama / Induk tiada sayap
    if (p && SAYAP.indexOf(p.sayap) >= 0) { return p.sayap; }                   // v5.9: laluan sayap dipilih semasa pendaftaran
    var a = p && p.avatar ? p.avatar : (p && p.demografik ? p.demografik.kategoriKod : null);   // simpanan lama
    return SAYAP.indexOf(a) >= 0 ? a : null;
  }

  /* ------------------------------------------------------------------------
     MANDAT PERWAKILAN (tahun semasa sahaja)
     ------------------------------------------------------------------------ */
  function tahunMandat(p, aras) { return p && p.perwakilan && Number(p.perwakilan[aras]) ? Number(p.perwakilan[aras]) : 0; }

  /** Ex-officio: tidak perlu bertanding perwakilan. aras: 'bahagian' (hadir Bahagian) | 'pau'. */
  function exOfficio(p, aras) {
    var senarai = getJawatan(p);
    if (aras === 'bahagian') {
      var h = senarai.filter(function (j) { return j.peringkat === 'bahagian' || j.peringkat === 'pusat'; })[0];
      return h ? { sah: true, sumber: h.jawatan } : { sah: false };
    }
    var h2 = senarai.filter(function (j) { return j.peringkat === 'pusat' || j.kod === 'ketua_bahagian' || (j.kod === 'lama' && /Ketua Bahagian/.test(j.jawatan)); })[0];
    return h2 ? { sah: true, sumber: h2.jawatan } : { sah: false };
  }

  /** 'cawangan' = Perwakilan Cawangan ke Bahagian. 'bahagian' = Perwakilan Bahagian ke PAU. */
  function perwakilanSah(p, aras) {
    var tahun = tahunMandat(p, aras), sah = !!p && tahun === p.tahun;
    var ex = exOfficio(p, aras === 'cawangan' ? 'bahagian' : 'pau');
    return {
      sah: sah, tahun: tahun, luput: !sah && tahun > 0 && tahun < p.tahun,
      exOfficio: ex.sah, sumberExOfficio: ex.sumber || '',
      layak: sah || ex.sah
    };
  }

  /* ------------------------------------------------------------------------
     KELAYAKAN
     ------------------------------------------------------------------------ */
  /** Katalog yang berkaitan dengan sayap pemain (jawatan sayap sayap lain disembunyikan). */
  function katalogUntuk(p) {
    var w = sayapPemain(p);
    return KATALOG.filter(function (d) { return d.kumpulan !== 'sayap' || d.sayap === w; });
  }

  function semakKelayakan(p, d) {
    var Et = etika();
    if (Et) {
      var hak = Et.semakHak(p, 'jawatan');
      if (!hak.boleh) { return { terbuka: false, sebab: hak.sebab }; }
    }
    var pertahan = pegang(p, d.kod);
    if (pertahan) { return { terbuka: true, sebab: '', pertahan: true }; }
    if (d.kumpulan === 'sayap' && d.sayap !== sayapPemain(p)) { return { terbuka: false, sebab: 'Hanya untuk sayap ' + NAMA_SAYAP[d.sayap] + '.' }; }
    var sama = jawatanSamaPeringkat(p, d);                      // v5.7: satu jawatan setiap peringkat; calon mesti naik pangkat di peringkat itu
    if (sama && (sama.pangkat || 0) >= d.pangkat) {
      return { terbuka: false, sebab: 'Konflik peringkat: anda sudah memegang ' + sama.jawatan + ' di peringkat ' + LABEL_PERINGKAT[d.peringkat] + '. Hanya satu jawatan bagi setiap peringkat (boleh bertanding jawatan lebih tinggi di peringkat ini, atau jawatan di peringkat lain).' };
    }
    var sudahTahunIni = getJawatan(p).filter(function (j) { return j.kod !== d.kod && j.kod !== 'lama' && j.peringkat === d.peringkat && j.kumpulan === d.kumpulan && Number(j.tahun) === Number(p.tahun); })[0];
    if (sudahTahunIni) {                                         // v6.8: satu jawatan setiap peringkat (kumpulan sama) dalam satu pemilihan; tiada rantaian MKT -> Timbalan -> Presiden
      return { terbuka: false, sebab: 'Anda sudah memenangi ' + sudahTahunIni.jawatan + ' pada pemilihan ' + p.tahun + '. Hanya satu jawatan bagi setiap peringkat dalam satu pemilihan; jawatan lebih tinggi dibuka pada pemilihan seterusnya.' };
    }
    if (Et && d.keahlian) {                                    // Fasal 15.5: ahli sekurang-kurangnya 3 tahun
      var kh = Et.semakKeahlian(p, d.keahlian, d.fasal);
      if (!kh.sah) { return { terbuka: false, sebab: kh.sebab, tunggu: kh.baki }; }
    }
    if (Et && d.penggal) {                                     // Fasal 9.5: satu penggal AJK Bahagian/MKT
      var pg = Et.semakPenggal(p, { getJawatan: getJawatan });
      if (!pg.sah) { return { terbuka: false, sebab: pg.sebab }; }
    }
    if (p.ip < d.ipMin) { return { terbuka: false, sebab: 'Perlukan ' + d.ipMin + ' IP (anda ada ' + p.ip + ').' }; }
    if (d.perluSayapCawangan && !(pegang(p, 'sayap_cawangan_' + d.sayap) || pegang(p, 'sayap_pusat_' + d.sayap))) {     // v6.7: mesti Ketua Sayap Cawangan dahulu
      return { terbuka: false, sebab: 'Menangi jawatan Ketua ' + NAMA_SAYAP[d.sayap] + ' Cawangan dahulu (pertandingan menentang calon NPC di Cawangan).' };
    }
    if (d.perluBahagian && !(perwakilanSah(p, 'cawangan').layak)) {
      return { terbuka: false, sebab: 'Menangi Perwakilan Cawangan tahun ' + p.tahun + ' dahulu (atau pegang jawatan Bahagian/Pusat).' };
    }
    if (d.perluPAU && !(perwakilanSah(p, 'bahagian').layak)) {
      return { terbuka: false, sebab: 'Perlu Perwakilan Bahagian ke PAU tahun ' + p.tahun + ' (atau Ketua Bahagian/pemegang jawatan Pusat).' };
    }
    if (d.pangkatMin && Math.max(pangkatTertinggi(p, d.kumpulan === 'utama' ? 'utama' : null), Number(p.pangkatUtamaLalu) || 0) < d.pangkatMin) {
      var perlu = null;
      KATALOG.forEach(function (x) { if (x.pangkat === d.pangkatMin && !perlu && x.kumpulan === 'utama') { perlu = x.jawatan; } });
      if (!perlu) { KATALOG.forEach(function (x) { if (x.pangkat === d.pangkatMin && !perlu) { perlu = x.jawatan; } }); }
      return { terbuka: false, sebab: 'Perlu memegang jawatan sekurang-kurangnya ' + (perlu || 'peringkat lebih rendah') + ' dahulu.' };
    }
    return { terbuka: true, sebab: '', pertahan: false };
  }

  /* ------------------------------------------------------------------------
     KEPUTUSAN PEMILIHAN -> PATCH PROFIL
     ------------------------------------------------------------------------ */
  /** v5.7: jawatan (pangkat tertinggi) yang dipegang pada peringkat yang sama dengan d, kecuali d itu sendiri. */
  function jawatanSamaPeringkat(p, d) {
    var r = null;
    getJawatan(p).forEach(function (j) { if (j.kod !== d.kod && j.peringkat === d.peringkat && (!r || (j.pangkat || 0) > (r.pangkat || 0))) { r = j; } });
    return r;
  }

  function pemilihanMod() { var g = typeof globalThis !== 'undefined' ? globalThis : null; if (g && g.MyPolitikElection) { return g.MyPolitikElection; } try { return typeof require === 'function' ? require('./election.js') : null; } catch (e) { return null; } }

  /**
   * v6.8: Penggal tamat. Jawatan dipilih pada tahun pemilihan Y sah sehingga akhir tahun pemilihan seterusnya.
   * Jika tidak dipertahankan (tiada kemenangan baharu), jawatan luput. Jawatan sayap yang tidak sepadan
   * dengan laluan sayap semasa juga dibuang. Pulang { dibuang:[{jawatan,sebab}], patch } atau null.
   */
  function semakPenggalTamat(p) {
    if (!p || p.tamat) { return null; }
    var E = pemilihanMod(), senarai = getJawatan(p), tahun = Number(p.tahun) || 0;
    if (!E || !senarai.length || !Array.isArray(p.jawatanList) || !p.jawatanList.length) { return null; }
    var lepas = E.tahunPemilihanLepas ? E.tahunPemilihanLepas(tahun) : null, sy = sayapPemain(p), dibuang = [];
    senarai.forEach(function (j) {
      if (j.kod === 'lama') { return; }
      if (j.kumpulan === 'sayap' && j.sayap && j.sayap !== sy) { dibuang.push({ j: j, sebab: 'tidak lagi layak dalam sayap ' + NAMA_SAYAP[j.sayap] }); return; }
      if (lepas && lepas !== tahun && Number(j.tahun) && Number(j.tahun) < lepas) { dibuang.push({ j: j, sebab: 'penggal tamat pada pemilihan ' + lepas + ' dan tidak dipertahankan' }); }
    });
    if (!dibuang.length) { return null; }
    var baki = senarai.filter(function (j) { return !dibuang.some(function (x) { return x.j === j; }); }), tangga = Number(p.pangkatUtamaLalu) || 0;
    dibuang.forEach(function (x) { if (x.j.kumpulan === 'utama') { tangga = Math.max(tangga, x.j.pangkat || 0); } });
    baki.sort(function (a, b) { return (b.pangkat || 0) - (a.pangkat || 0); });
    var patch = { jawatanList: baki, jawatan: baki.length ? baki[0].jawatan : BIASA, pangkatUtamaLalu: tangga };
    if (!baki.length) { patch.cabaran = null; patch.amaranAktif = false; }
    return { dibuang: dibuang.map(function (x) { return { kod: x.j.kod, jawatan: x.j.jawatan, sebab: x.sebab }; }), patch: patch };
  }

  /** Laksanakan semakan penggal tamat pada profil semasa. Pulang { peristiwa: [] }. */
  function kemaskiniPenggal() {
    var p = S.loadPlayer(), out = { peristiwa: [] }, r = semakPenggalTamat(p);
    if (!r) { return out; }
    var nama = r.dibuang.map(function (x) { return x.jawatan; }).join(', ');
    var ap = S.applyEffects({}, { kiraTindakan: false, patch: r.patch, log: { tindakan: 'penggal_tamat', nama: 'Jawatan luput: ' + nama, peringkat: 'ahli' } });
    if (ap && ap.ok) {
      out.peristiwa.push({ jenis: 'penggal_tamat', mesej: 'Jawatan luput: ' + r.dibuang.map(function (x) { return x.jawatan + ' (' + x.sebab + ')'; }).join('; ') + '. Bertanding semula pada pemilihan untuk mendapatkannya kembali.' });
    }
    return out;
  }

  /** Pulang { jawatanList, jawatan, ... } untuk dipatch ke profil selepas menang/kalah satu jawatan. */
  function terapkan(p, d, menang) {
    var senarai = getJawatan(p);
    var tadiPegang = pegang(p, d.kod);
    var penggal = !!p.penggalSelesai;                                  // Fasal 9.5: simpan rekod satu penggal walaupun jawatan hilang
    var sama = jawatanSamaPeringkat(p, d);
    if (menang && sama && (sama.pangkat || 0) > d.pangkat) { return {}; }   // menang dua jawatan sama peringkat dalam satu pusingan: yang lebih tinggi dikekalkan
    var dilepas = [];
    senarai.forEach(function (j) {
      // v5.7: menang melepaskan jawatan LAMA di peringkat yang SAMA sahaja; peringkat lain dikekalkan.
      var buang = menang ? (j.kod === d.kod || j.peringkat === d.peringkat) : (j.kod === d.kod);
      if (buang) { dilepas.push(j); }
      if (buang && (j.peringkat === 'bahagian' || j.peringkat === 'pusat') && j.tahun && (p.tahun - j.tahun) >= 3) { penggal = true; }
    });
    var tangga = null;                                                  // pangkat utama tertinggi dilepaskan (syarat tangga jawatan utama)
    if (menang) {
      tangga = dilepas.reduce(function (m, j) { return (j.kumpulan === 'utama' && d.kumpulan === 'sayap') ? Math.max(m, j.pangkat || 0) : m; }, Number(p.pangkatUtamaLalu) || 0);
      senarai = senarai.filter(function (j) { return dilepas.indexOf(j) < 0; });
      senarai.push({ kod: d.kod, jawatan: d.jawatan, peringkat: d.peringkat, kumpulan: d.kumpulan, sayap: d.sayap, pangkat: d.pangkat, tahun: p.tahun });
    } else if (tadiPegang) {
      senarai = senarai.filter(function (j) { return j.kod !== d.kod; });
    }
    senarai.sort(function (a, b) { return (b.pangkat || 0) - (a.pangkat || 0); });
    var tertinggi = senarai.length ? senarai[0].jawatan : BIASA;
    var patch = { jawatanList: senarai, jawatan: tertinggi };
    if (penggal) { patch.penggalSelesai = true; }
    if (tangga !== null) { patch.pangkatUtamaLalu = tangga; }
    if (!senarai.length) { patch.cabaran = null; patch.amaranAktif = false; }
    return patch;
  }

  /** v5.7: pastikan hanya SATU jawatan bagi setiap peringkat (pangkat tertinggi). Pulang patch profil atau null. */
  function selaraskan(p) {
    var senarai = getJawatan(p);
    if (!senarai.length) { return null; }
    var isih = senarai.slice().sort(function (a, b) { return (b.pangkat || 0) - (a.pangkat || 0); }), kekal = [], buang = [], lihat = {};
    isih.forEach(function (j) { if (lihat[j.peringkat]) { buang.push(j); } else { lihat[j.peringkat] = true; kekal.push(j); } });
    if (!buang.length) { return null; }
    var penggal = !!p.penggalSelesai, tangga = Number(p.pangkatUtamaLalu) || 0;
    buang.forEach(function (j) {
      if ((j.peringkat === 'bahagian' || j.peringkat === 'pusat') && j.tahun && (p.tahun - j.tahun) >= 3) { penggal = true; }
      if (j.kumpulan === 'utama' && kekal.some(function (k) { return k.kumpulan === 'sayap'; })) { tangga = Math.max(tangga, j.pangkat || 0); }
    });
    var patch = { jawatanList: kekal, jawatan: kekal[0].jawatan };
    if (penggal) { patch.penggalSelesai = true; }
    if (tangga) { patch.pangkatUtamaLalu = tangga; }
    return patch;
  }

  /** Ringkasan untuk lencana pada header dashboard. */
  function ringkas(p) {
    return getJawatan(p).slice().sort(function (a, b) { return (b.pangkat || 0) - (a.pangkat || 0); }).map(function (j) {
      return { kod: j.kod, jawatan: j.jawatan, peringkat: j.peringkat, kumpulan: j.kumpulan, label: LABEL_PERINGKAT[j.peringkat] };
    });
  }

  return {
    BIASA: BIASA, KATALOG: KATALOG, SAYAP: SAYAP, NAMA_SAYAP: NAMA_SAYAP, LABEL_PERINGKAT: LABEL_PERINGKAT,
    cariDef: cariDef, selaraskan: selaraskan, getJawatan: getJawatan, pegang: pegang, pegangPeringkat: pegangPeringkat, bilJawatan: bilJawatan,
    pangkatTertinggi: pangkatTertinggi, jawatanTertinggi: jawatanTertinggi, peringkatTertinggi: peringkatTertinggi,
    sayapPemain: sayapPemain, exOfficio: exOfficio, perwakilanSah: perwakilanSah,
    jawatanSamaPeringkat: jawatanSamaPeringkat, katalogUntuk: katalogUntuk, semakKelayakan: semakKelayakan, terapkan: terapkan, semakPenggalTamat: semakPenggalTamat, kemaskiniPenggal: kemaskiniPenggal, ringkas: ringkas
  };
});
