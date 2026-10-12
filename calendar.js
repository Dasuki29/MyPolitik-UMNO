/* ==========================================================================
   MyPolitik: UMNO — js/calendar.js
   Sistem masa BULANAN (Bulan 1 hingga 12) dan Takwim Aktiviti UMNO.

   Takwim:
     Bulan 1-3   Awal Tahun        Aktiviti akar umbi dan membina pengaruh
                                    (bonus +25% IP dan kesetiaan positif bagi tindakan)
     Bulan 4-6   Pertengahan Tahun Musim Mesyuarat dan Pemilihan Cawangan
     Bulan 7-12  Akhir Tahun       Mesyuarat Bahagian (bulan 7-9) dan
                                    Perhimpunan Agung UMNO / PAU (bulan 10-12)
   Semua angka boleh diubah dalam CONFIG.

   Regenerasi pada setiap permulaan bulan:
     AP   : ditetapkan semula kepada CONFIG.AP_BULANAN (baki lama tidak dibawa)
     MYR  : ditambah elaun bulanan (asas + tambahan mengikut peringkat jawatan)

   Pergantian bulan 12 -> bulan 1 menaikkan tahun dan mengemas kini kitaran
   pemilihan 3 tahun melalui MyPolitikElection.majuTahun().

   Cara guna (dashboard):
     var K = MyPolitikCalendar;
     K.getTakwim();                  // bulan, fasa, tetingkap mesyuarat, 12 bulan
     K.pratonton();                  // apa yang berlaku jika terus ke bulan seterusnya
     var h = K.majuBulan();          // { ok, bulan, tahun, tahunBaharu, regenerasi, peristiwa:[], ... }
     K.statusTetingkap('cawangan');  // 'belum_tiba' | 'dibuka' | 'tamat'

   Pemain disimpan dalam profil.bulan (1-12) dan profil.tahun (localStorage).
   Perlu dimuatkan selepas js/save.js. election.js dan meeting.js adalah pilihan
   dan dikesan semasa dijalankan.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikCalendar = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  function muat(nama, fail) {
    if (root[nama]) { return root[nama]; }
    try { if (typeof require === 'function') { return require('./' + fail); } } catch (e) { /* tidak dimuatkan */ }
    return null;
  }
  var S = muat('MyPolitikSave', 'save.js');

  /* ------------------------------------------------------------------------
     1. TETAPAN
     ------------------------------------------------------------------------ */
  var CONFIG = {
    BULAN_NAMA: ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'],
    AP_BULANAN: 5,                       // AP ditetapkan kepada nilai ini setiap bulan
    DANA_ASAS: 600,                      // elaun bulanan semua pemain (MYR)
    DANA_JAWATAN: { cawangan: 300, bahagian: 800, pusat: 2000 },   // tambahan bagi pemegang jawatan
    BONUS_AKAR_UMBI: 0.25,               // bulan 1-3: tambahan pada IP dan kesetiaan positif

    /* Fasa takwim (bulan mula-tamat, termasuk). */
    FASA: [
      { kod: 'akar_umbi', mula: 1, tamat: 3, tajuk: 'Awal Tahun', ringkas: 'Akar Umbi & Bina Pengaruh',
        fokus: ['Ziarah dan gotong-royong', 'Bina pengaruh dan kesetiaan akar umbi', 'Kumpul isu tempatan'] },
      { kod: 'cawangan', mula: 4, tamat: 6, tajuk: 'Pertengahan Tahun', ringkas: 'Musim Mesyuarat & Pemilihan Cawangan',
        fokus: ['Mesyuarat Cawangan dan usul lokaliti', 'Pemilihan jawatan dan perwakilan Cawangan'] },
      { kod: 'bahagian_pau', mula: 7, tamat: 12, tajuk: 'Akhir Tahun', ringkas: 'Mesyuarat Bahagian & Perhimpunan Agung',
        fokus: ['Mesyuarat Bahagian (bulan 7-9)', 'Perhimpunan Agung UMNO / PAU (bulan 10-12)'] }
    ],

    /* Tetingkap setiap mesyuarat / pengundian. 'pusat' dalam election.js dipetakan kepada 'pau'. */
    TETINGKAP: {
      cawangan: { mula: 4, tamat: 6, nama: 'Mesyuarat Cawangan' },
      bahagian: { mula: 7, tamat: 9, nama: 'Mesyuarat Bahagian' },
      pau:      { mula: 10, tamat: 12, nama: 'Perhimpunan Agung UMNO (PAU)' }
    }
  };

  /* ------------------------------------------------------------------------
     2. PEMBANTU
     ------------------------------------------------------------------------ */
  function gagal(kod, ralat) { return { ok: false, kod: kod, ralat: ralat }; }
  function sah(n) { n = parseInt(n, 10); return isFinite(n) ? Math.max(1, Math.min(12, n)) : 1; }
  function namaBulan(b) { return CONFIG.BULAN_NAMA[sah(b) - 1]; }
  function normPeringkat(p) { return p === 'pusat' ? 'pau' : p; }
  function getBulan(profil) { var p = profil || (S && S.loadPlayer()); return p ? sah(p.bulan) : 1; }

  function getFasa(bulan) {
    bulan = sah(bulan);
    for (var i = 0; i < CONFIG.FASA.length; i++) {
      if (bulan >= CONFIG.FASA[i].mula && bulan <= CONFIG.FASA[i].tamat) { return CONFIG.FASA[i]; }
    }
    return CONFIG.FASA[0];
  }

  /* ------------------------------------------------------------------------
     3. TETINGKAP MESYUARAT / PENGUNDIAN
     ------------------------------------------------------------------------ */
  /** { mula, tamat, nama, status:'belum_tiba'|'dibuka'|'tamat', label:'Bulan 4-6' } */
  function getTetingkap(peringkat, bulan) {
    var t = CONFIG.TETINGKAP[normPeringkat(peringkat)];
    if (!t) { return null; }
    bulan = sah(bulan === undefined ? getBulan() : bulan);
    return {
      mula: t.mula, tamat: t.tamat, nama: t.nama, label: 'Bulan ' + t.mula + '-' + t.tamat,
      status: bulan < t.mula ? 'belum_tiba' : (bulan > t.tamat ? 'tamat' : 'dibuka')
    };
  }
  function statusTetingkap(peringkat, bulan) { var t = getTetingkap(peringkat, bulan); return t ? t.status : 'dibuka'; }

  /* ------------------------------------------------------------------------
     4. SUMBER BULANAN
     ------------------------------------------------------------------------ */
  function peringkatJawatan(j) {
    j = String(j || '');
    if (!j || j === 'Ahli Biasa') { return null; }
    if (/Bahagian/i.test(j)) { return 'bahagian'; }
    if (/Cawangan/i.test(j)) { return 'cawangan'; }
    return 'pusat';
  }

  /** Elaun bulanan: { jumlah, butiran:[{nama, jumlah}] } */
  function pendapatanBulanan(profil) {
    var p = profil || S.loadPlayer(), butiran = [{ nama: 'Elaun asas', jumlah: CONFIG.DANA_ASAS }];
    var per = p ? peringkatJawatan(p.jawatan) : null;
    if (per) { butiran.push({ nama: 'Elaun jawatan (' + p.jawatan + ')', jumlah: CONFIG.DANA_JAWATAN[per] }); }
    return { jumlah: butiran.reduce(function (a, b) { return a + b.jumlah; }, 0), butiran: butiran };
  }

  /** Perubahan AP dan MYR pada permulaan bulan baharu. */
  function regenerasi(profil) {
    var p = profil || S.loadPlayer(), d = pendapatanBulanan(p);
    return { ap: CONFIG.AP_BULANAN - p.ap, apBaharu: CONFIG.AP_BULANAN, myr: d.jumlah, butiran: d.butiran };
  }

  /**
   * Bulan 1-3 (akar umbi): tambah IP dan kesetiaan positif. Pulang salinan `kesan`.
   * Dipanggil oleh ordinaryMember.js dan incumbent.js sebelum applyEffects().
   */
  function skalaKesan(profil, kesan) {
    var k = JSON.parse(JSON.stringify(kesan || {}));
    if (!profil || getFasa(getBulan(profil)).kod !== 'akar_umbi') { return k; }
    var f = 1 + CONFIG.BONUS_AKAR_UMBI;
    if (k.ip > 0) { k.ip = Math.round(k.ip * f); }
    if (k.kesetiaan) { Object.keys(k.kesetiaan).forEach(function (n) { if (k.kesetiaan[n] > 0) { k.kesetiaan[n] = Math.round(k.kesetiaan[n] * f); } }); }
    return k;
  }

  /* ------------------------------------------------------------------------
     5. TAKWIM
     ------------------------------------------------------------------------ */
  function getTakwim(profil) {
    var p = profil || (S && S.loadPlayer());
    if (!p) { return null; }
    var bulan = sah(p.bulan), fasa = getFasa(bulan), E = muat('MyPolitikElection', 'election.js');
    var pemilihan = E ? E.adalahTahunPemilihan(p.tahun) : ((p.tahun - 2026) % 3 === 0);
    var tahunBaharu = bulan >= 12;
    var jadual = CONFIG.BULAN_NAMA.map(function (nama, i) {
      var b = i + 1, f = getFasa(b), acara = [];
      Object.keys(CONFIG.TETINGKAP).forEach(function (k) { if (b >= CONFIG.TETINGKAP[k].mula && b <= CONFIG.TETINGKAP[k].tamat) { acara.push(CONFIG.TETINGKAP[k].nama); } });
      return { bulan: b, nama: nama, pendek: nama.slice(0, 3), fasa: f.kod, semasa: b === bulan, lepas: b < bulan, acara: acara };
    });
    return {
      tahun: p.tahun, bulan: bulan, namaBulan: namaBulan(bulan), pemilihan: pemilihan,
      fasa: fasa, bonusAkarUmbi: fasa.kod === 'akar_umbi' ? CONFIG.BONUS_AKAR_UMBI : 0,
      bulanSeterusnya: tahunBaharu ? 1 : bulan + 1, tahunSeterusnya: tahunBaharu ? p.tahun + 1 : p.tahun,
      tahunBaharuSeterusnya: tahunBaharu,
      tetingkap: { cawangan: getTetingkap('cawangan', bulan), bahagian: getTetingkap('bahagian', bulan), pau: getTetingkap('pau', bulan) },
      jadual: jadual
    };
  }

  /* ------------------------------------------------------------------------
     6. MAJU BULAN
     ------------------------------------------------------------------------ */
  function mesejMasuk(bulan, tahun, tahunBaharu) {
    var f = getFasa(bulan), nb = namaBulan(bulan), out = [];
    if (bulan === 1) { out.push({ jenis: 'fasa_bulan', mesej: 'Bulan 1 (' + nb + ' ' + tahun + '): ' + f.tajuk + '. ' + f.ringkas + '. Bonus +' + Math.round(CONFIG.BONUS_AKAR_UMBI * 100) + '% IP dan kesetiaan bagi tindakan sehingga bulan 3.' }); }
    else if (bulan === 4) { out.push({ jenis: 'fasa_bulan', mesej: 'Bulan 4 (' + nb + '): Musim Mesyuarat & Pemilihan Cawangan dibuka (bulan 4-6).' }); }
    else if (bulan === 7) { out.push({ jenis: 'fasa_bulan', mesej: 'Bulan 7 (' + nb + '): Mesyuarat Bahagian dibuka (bulan 7-9).' }); }
    else if (bulan === 10) { out.push({ jenis: 'fasa_bulan', mesej: 'Bulan 10 (' + nb + '): Perhimpunan Agung UMNO (PAU) dibuka (bulan 10-12).' }); }
    Object.keys(CONFIG.TETINGKAP).forEach(function (k) {
      var t = CONFIG.TETINGKAP[k];
      if (bulan === t.tamat && bulan !== t.mula) { out.push({ jenis: 'tetingkap_akhir', mesej: 'Bulan ' + bulan + ' ialah bulan terakhir untuk ' + t.nama + '.' }); }
    });
    return out;
  }

  /**
   * Selesaikan musim yang tamat pada bulan ini sebelum bulan bertukar:
   *  - mesyuarat yang sedang berjalan ditutup secara automatik
   *  - mesyuarat yang tidak dimulakan dianggap terlepas; pengundian yang sudah didaftarkan
   *    tetap diselesaikan oleh urus setia (tahun pemilihan)
   */
  function tutupMusim(p) {
    var M = muat('MyPolitikMeeting', 'meeting.js'), E = muat('MyPolitikElection', 'election.js'), out = [];
    if (!M) { return out; }
    Object.keys(CONFIG.TETINGKAP).forEach(function (k) {
      var t = CONFIG.TETINGKAP[k];
      if (sah(p.bulan) !== t.tamat) { return; }
      var lv = M.getKeadaanMesyuarat(S.loadPlayer()).peringkat.filter(function (x) { return x.kod === k; })[0];
      if (!lv) { return; }
      if (lv.status === 'sedang') {
        var r = M.tutupMesyuarat(k);
        if (r.ok) { out.push({ jenis: 'mesyuarat_ditutup_auto', mesej: t.nama + ' ditutup secara automatik kerana musim tamat. ' + r.mesej }); (r.peristiwa || []).forEach(function (e) { out.push(e); }); }
      } else if (lv.status === 'boleh_mula') {
        out.push({ jenis: 'mesyuarat_terlepas', mesej: t.nama + ' tahun ' + p.tahun + ' terlepas kerana tidak dihadiri.' });
        if (E && k !== 'pau') {
          (E.jalankanPemilihanPeringkat(k) || []).forEach(function (x) {
            if (x.ok) { out.push({ jenis: 'pemilihan_auto', mesej: 'Pengundian dijalankan oleh urus setia. ' + x.mesej }); (x.peristiwa || []).forEach(function (e) { out.push(e); }); }
          });
        }
      }
    });
    return out;
  }

  function snapshot(p) { return { ip: p.ip, myr: p.myr, ap: p.ap, reputasi: p.reputasi }; }

  /** Apa yang akan berlaku pada bulan seterusnya, untuk dialog pengesahan. */
  function pratonton(profil) {
    var p = profil || S.loadPlayer();
    if (!p) { return null; }
    var tk = getTakwim(p), rg = regenerasi(p), amaran = [];
    var M = muat('MyPolitikMeeting', 'meeting.js');
    if (M) {
      var ms = M.getKeadaanMesyuarat(p);
      Object.keys(CONFIG.TETINGKAP).forEach(function (k) {
        var t = CONFIG.TETINGKAP[k];
        if (tk.bulan !== t.tamat) { return; }
        var lv = ms.peringkat.filter(function (x) { return x.kod === k; })[0];
        if (lv && lv.status === 'sedang') { amaran.push(t.nama + ' sedang berjalan dan akan ditutup secara automatik.'); }
        else if (lv && lv.status === 'boleh_mula') { amaran.push(t.nama + ' belum dimulakan dan akan terlepas.'); }
      });
    }
    var fasaBaharu = getFasa(tk.bulanSeterusnya);
    return {
      dari: { bulan: tk.bulan, tahun: tk.tahun }, ke: { bulan: tk.bulanSeterusnya, tahun: tk.tahunSeterusnya },
      tahunBaharu: tk.tahunBaharuSeterusnya, fasaBaharu: fasaBaharu, regenerasi: rg, amaran: amaran
    };
  }

  /**
   * Maju ke bulan seterusnya. Bulan 12 -> bulan 1 tahun berikutnya.
   * Pulangan: { ok, bulanLama, tahunLama, bulan, tahun, tahunBaharu, fasa, regenerasi, perubahan,
   *             peristiwa:[{jenis,mesej}], mesej, profil } atau { ok:false, kod, ralat }
   */
  function majuBulan() {
    var p = S && S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    var asal = snapshot(p), bulanLama = sah(p.bulan), tahunLama = p.tahun, peristiwa = [];

    peristiwa = peristiwa.concat(tutupMusim(p));
    p = S.loadPlayer();
    var tahunBaharu = bulanLama >= 12, bulan = tahunBaharu ? 1 : bulanLama + 1, tahun = tahunBaharu ? tahunLama + 1 : tahunLama;
    var rg = regenerasi(p), E = muat('MyPolitikElection', 'election.js'), r;

    if (tahunBaharu && E && E.majuTahun) {
      r = E.majuTahun({ pulihAP: true });                 // tahun + 1, bulan = 1, AP dipulihkan, kitaran dikemas kini
      if (!r.ok) { return r; }
      peristiwa = peristiwa.concat(r.peristiwa || []);
      r = S.applyEffects({ myr: rg.myr }, { kiraTindakan: false, log: { tindakan: 'regenerasi', nama: 'Elaun bulan ' + bulan + ' ' + tahun, peringkat: 'bulan' } });
    } else {
      r = S.applyEffects({ ap: rg.ap, myr: rg.myr }, {
        kiraTindakan: false, patch: tahunBaharu ? { bulan: bulan, tahun: tahun } : { bulan: bulan },
        log: { tindakan: 'bulan_baharu', nama: 'Bulan ' + bulan + ' (' + namaBulan(bulan) + ') ' + tahun, peringkat: 'bulan' }
      });
    }
    if (!r.ok) { return r; }

    peristiwa = peristiwa.concat(mesejMasuk(bulan, tahun, tahunBaharu));
    var akhir = S.loadPlayer();
    return {
      ok: true, bulanLama: bulanLama, tahunLama: tahunLama, bulan: bulan, tahun: tahun, tahunBaharu: tahunBaharu,
      fasa: getFasa(bulan), regenerasi: rg,
      perubahan: { ip: akhir.ip - asal.ip, myr: akhir.myr - asal.myr, ap: akhir.ap - asal.ap, reputasi: akhir.reputasi - asal.reputasi },
      peristiwa: peristiwa,
      mesej: 'Bulan ' + bulan + ' (' + namaBulan(bulan) + ') ' + tahun + ': AP ' + CONFIG.AP_BULANAN + ', elaun +MYR ' + rg.myr.toLocaleString('ms-MY') + '.',
      profil: akhir
    };
  }

  return {
    CONFIG: CONFIG,
    namaBulan: namaBulan,
    getBulan: getBulan,
    getFasa: getFasa,
    getTetingkap: getTetingkap,
    statusTetingkap: statusTetingkap,
    pendapatanBulanan: pendapatanBulanan,
    regenerasi: regenerasi,
    skalaKesan: skalaKesan,
    getTakwim: getTakwim,
    pratonton: pratonton,
    majuBulan: majuBulan
  };
});
