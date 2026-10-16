/* ==========================================================================
   Nusa Politik — js/organisasi.js   (v6.0)
   Struktur organisasi: Ketua -> Naib Ketua -> AJK, bagi Induk dan setiap Sayap,
   di tiga peringkat (Cawangan, Bahagian, Pusat). Modul PAPARAN sahaja: tidak mengubah
   profil pemain. Nama NPC dijana berbenih (sama setiap kali dibuka).

   Andaian (laras dalam CONFIG):
     - Bilangan AJK Induk mengikut data.js: Cawangan 7, Bahagian 15, Pusat (Ahli MKT) 25.
       (Cadangan pengguna bagi Pusat ialah 22; angka lalai kekal 25 kerana kerusi ahli_mkt
        dalam permainan ialah 25. Tukar CONFIG.AJK.pusat untuk 22 - hanya paparan.)
     - Sayap meniru struktur Induk (bilangan AJK sama).
     - Jawatan Ketua sayap sahaja boleh dipegang pemain; Naib Ketua dan AJK sayap ialah NPC.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikOrganisasi = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  var D = root.MyPolitikData || (typeof module === 'object' && typeof require === 'function' ? require('./data.js') : null);
  var SY = root.MyPolitikSayap || (typeof module === 'object' && typeof require === 'function' ? require('./sayap.js') : null);

  var CONFIG = { AJK: { cawangan: 7, bahagian: 15, pusat: 25 }, AJK_SAYAP: { cawangan: 5, bahagian: 10, pusat: 15 } };   // v7.39: AJK sayap (andaian)
  var PERINGKAT = ['cawangan', 'bahagian', 'pusat'];
  var LABEL = { cawangan: 'Peringkat Cawangan', bahagian: 'Peringkat Bahagian', pusat: 'Peringkat Pusat' };
  var NAMA_SAYAP = { pemuda: 'Pemuda', puteri: 'Puteri', wanita: 'Wanita' };
  var PENERANGAN = {
    pemuda: 'Lelaki muda (sehingga 40 tahun).',
    puteri: 'Perempuan muda (sehingga 35 tahun).',
    wanita: 'Perempuan dewasa dan warga emas (36 tahun ke atas).'
  };

  function sufiks(peringkat) { return peringkat === 'pusat' ? '' : ' ' + (peringkat === 'cawangan' ? 'Cawangan' : 'Bahagian'); }

  /** Tajuk jawatan tiga lapis bagi sesuatu peringkat. */
  function tajuk(peringkat, sayap) {
    if (!sayap) {
      return peringkat === 'cawangan' ? { ketua: 'Ketua Cawangan', naib: 'Naib Ketua Cawangan', ajk: 'AJK Cawangan' }
        : peringkat === 'bahagian' ? { ketua: 'Ketua Bahagian', timbalan: 'Timbalan Ketua Bahagian', naib: 'Naib Ketua Bahagian', ajk: 'AJK Bahagian' }
        : { ketua: 'Presiden', naib: 'Timbalan Presiden', ajk: 'Ahli MKT' };
    }
    var N = NAMA_SAYAP[sayap], s = sufiks(peringkat);
    return { ketua: 'Ketua ' + N + s, naib: 'Naib Ketua ' + N + s, ajk: 'AJK ' + N + (peringkat === 'pusat' ? ' Pusat' : s) };
  }

  function benih(p) { return String((p && (p.benih || p.seed || p.cawanganId || p.cawangan)) || 'nusa') + '|org'; }

  function nama(rng, jantina) { return D && D.janaNama ? D.janaNama(rng, jantina) : 'Pemimpin NPC'; }

  function pemegang(p, kod) {
    var senarai = (p && p.jawatanList) || [];
    for (var i = 0; i < senarai.length; i++) { if (senarai[i].kod === kod) { return true; } }
    return false;
  }

  /** Kod jawatan katalog yang sepadan dengan slot Ketua / Naib / AJK. */
  function kodSlot(peringkat, sayap, slot) {
    if (sayap) { return slot === 'ketua' ? 'sayap_' + peringkat + '_' + sayap : (slot === 'naib' || slot === 'ajk') ? 'sayap_' + slot + '_' + peringkat + '_' + sayap : null; }
    var peta = {
      cawangan: { ketua: 'ketua_cawangan', naib: 'naib_ketua_cawangan', ajk: 'ajk_cawangan' },
      bahagian: { ketua: 'ketua_bahagian', timbalan: 'timbalan_ketua_bahagian', naib: 'naib_ketua_bahagian', ajk: 'ajk_bahagian' },
      pusat:    { ketua: 'presiden', naib: 'timbalan_presiden', ajk: 'ahli_mkt' }
    };
    return peta[peringkat][slot];
  }

  function jantinaSlot(sayap, rng) { return sayap === 'pemuda' ? 'L' : sayap ? 'P' : (rng() < 0.7 ? 'L' : 'P'); }

  function binaSatu(p, peringkat, sayap) {
    var t = tajuk(peringkat, sayap), rng = D.createRng(benih(p) + '|' + peringkat + '|' + (sayap || 'induk'));
    var bil = (sayap ? CONFIG.AJK_SAYAP : CONFIG.AJK)[peringkat];
    function slot(kunci) {
      var kod = kodSlot(peringkat, sayap, kunci), ada = kod && pemegang(p, kod);
      return { jawatan: t[kunci], nama: ada ? (p.nama || 'Anda') : nama(rng, jantinaSlot(sayap, rng)), pemain: !!ada };
    }
    var ketua = slot('ketua'), naib = slot('naib'), timbalan = t.timbalan ? slot('timbalan') : null;
    var kodAjk = kodSlot(peringkat, sayap, 'ajk'), pAjk = kodAjk && pemegang(p, kodAjk);
    var ajk = [];
    for (var i = 0; i < bil; i++) {
      var sendiri = pAjk && i === 0;
      ajk.push({ jawatan: t.ajk + ' ' + (i + 1), nama: sendiri ? (p.nama || 'Anda') : nama(rng, jantinaSlot(sayap, rng)), pemain: !!sendiri });
    }
    var out = { peringkat: peringkat, label: LABEL[peringkat], ketua: ketua, timbalan: timbalan, naib: naib, ajk: ajk, bilAjk: bil, tambahan: [] };
    if (!sayap && peringkat === 'pusat') {            // Naib Presiden (3) ialah jawatan tambahan Induk di Pusat
      for (var n = 1; n <= 3; n++) {
        var nm = pemegang(p, 'naib_presiden') && n === 1;
        out.tambahan.push({ jawatan: 'Naib Presiden ' + n, nama: nm ? (p.nama || 'Anda') : nama(rng, 'L'), pemain: nm });
      }
    }
    return out;
  }

  /** Struktur penuh: Induk + tiga sayap, tiga peringkat setiap satu. */
  function getStruktur(p) {
    var laluan = SY && p ? SY.kod(p) : 'utama';
    var info = p && p.cawanganInfo ? p.cawanganInfo : null, kg = info && info.kumpulan ? info.kumpulan : (D && D.pecahanKumpulan && info ? D.pecahanKumpulan(info) : null);
    var hasil = { laluan: laluan, induk: {}, sayap: {}, ahli: kg ? { induk: kg.induk, pemuda: kg.pemuda, puteri: kg.puteri, wanita: kg.wanita, langsung: !!kg.langsung } : null };   // v6.3: ahli Cawangan ikut kumpulan
    PERINGKAT.forEach(function (k) { hasil.induk[k] = binaSatu(p, k, null); });
    Object.keys(NAMA_SAYAP).forEach(function (w) {
      var info = SY && SY.ISU ? SY.ISU[w] : { golongan: '', isu: [] };
      hasil.sayap[w] = { kod: w, nama: NAMA_SAYAP[w], penerangan: PENERANGAN[w], golongan: info.golongan, isu: info.isu.slice(), milikAnda: laluan === w, peringkat: {} };
      PERINGKAT.forEach(function (k) { hasil.sayap[w].peringkat[k] = binaSatu(p, k, w); });
    });
    return hasil;
  }

  return { CONFIG: CONFIG, PERINGKAT: PERINGKAT, LABEL: LABEL, tajuk: tajuk, getStruktur: getStruktur };
});
