/* ==========================================================================
   Nusa Politik — js/calendar.js
   Sistem masa BULANAN (Bulan 1 hingga 12) dan Takwim Aktiviti UMNO.

   Takwim (v3.0):
     Bulan 1-3   Akar umbi         Aktiviti akar umbi dan membina pengaruh
                                    (bonus +25% IP dan kesetiaan positif bagi tindakan)
     Bulan 4-6   Musim Cawangan    Mesyuarat dan Pemilihan Cawangan (Cawangan dan Sayap)
     Bulan 7     Musim Bahagian    Mesyuarat dan Pemilihan Bahagian (Bahagian dan Sayap)
     Bulan 8     PAU               Perhimpunan Agung UMNO dan Pemilihan Pusat
     Bulan 9-12  Pasca-PAU         Aktiviti akar umbi dan pasca-PAU
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
    DANA_ASAS: 450,                      // elaun bulanan semua pemain (MYR)
    DANA_JAWATAN: { cawangan: 300, bahagian: 800, pusat: 2000 },   // tambahan bagi pemegang jawatan
    // v3.8: kesetiaan susut setiap bulan jika tidak dijaga. Pemegang jawatan menanggung susutan Akar Umbi tambahan.
    SUSUT_BULANAN: { akarUmbi: 3, ajk: 2, perwakilan: 3 },       // ketuaCawangan tidak disusutkan: pemegang jawatan tiada tindakan untuk memulihkannya
    SUSUT_PEMEGANG_JAWATAN: 2,           // tambahan susutan Akar Umbi bagi pemegang jawatan
    BONUS_AKAR_UMBI: 0.25,               // bulan 1-3: tambahan pada IP dan kesetiaan positif

    /* Fasa takwim (bulan mula-tamat, termasuk). */
    FASA: [
      { kod: 'akar_umbi', mula: 1, tamat: 3, tajuk: 'Awal Tahun', ringkas: 'Khidmat Akar Umbi & Pendaftaran Ahli',
        fokus: ['Ziarah dan gotong-royong', 'Bina pengaruh dan kesetiaan akar umbi', 'Kumpul isu tempatan'] },
      { kod: 'cawangan', mula: 4, tamat: 6, tajuk: 'Musim Cawangan', ringkas: 'Musim Mesyuarat & Pemilihan Cawangan (Cawangan & Sayap)',
        fokus: ['Mesyuarat Cawangan dan usul lokaliti', 'Pemilihan jawatan Cawangan dan Sayap Cawangan', 'Pemilihan Perwakilan ke Bahagian'] },
      { kod: 'bahagian', mula: 7, tamat: 7, tajuk: 'Musim Bahagian', ringkas: 'Musim Mesyuarat & Pemilihan Bahagian (Bahagian & Sayap)',
        fokus: ['Mesyuarat Bahagian', 'Pemilihan jawatan Bahagian dan Sayap Bahagian', 'Pemilihan Perwakilan ke PAU'] },
      { kod: 'pau', mula: 8, tamat: 8, tajuk: 'Perhimpunan Agung', ringkas: 'Perhimpunan Agung UMNO (PAU) & Pemilihan Pusat',
        fokus: ['Perhimpunan Agung UMNO', 'Pemilihan Presiden, Timbalan Presiden, 3 Naib Presiden, MKT dan Ketua Sayap (tahun pemilihan)'] },
      { kod: 'pasca_pau', mula: 9, tamat: 12, tajuk: 'Akhir Tahun', ringkas: 'Pasca-PAU & Khidmat Masyarakat',
        fokus: ['Pulih dan bina semula sokongan', 'Laksana tanggungjawab jawatan', 'Bersedia untuk kitaran seterusnya'] }
    ],

    /* Tetingkap setiap mesyuarat / pengundian. 'pusat' dalam election.js dipetakan kepada 'pau'. */
    TETINGKAP: {
      cawangan: { mula: 4, tamat: 6, nama: 'Mesyuarat Cawangan' },
      bahagian: { mula: 7, tamat: 7, nama: 'Mesyuarat Bahagian' },
      pau:      { mula: 8, tamat: 8, nama: 'Perhimpunan Agung UMNO (PAU)' }
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

  /** Peringkat unik yang dipegang (jawatanList v3.0, atau jawatan tunggal sebagai sandaran). */
  function peringkatDipegang(p) {
    var out = [];
    (Array.isArray(p && p.jawatanList) ? p.jawatanList : []).forEach(function (j) {
      var k = j.peringkat === 'pusat' ? 'pusat' : j.peringkat;
      if (CONFIG.DANA_JAWATAN[k] && out.indexOf(k) < 0) { out.push(k); }
    });
    if (!out.length && p) { var per = peringkatJawatan(p.jawatan); if (per) { out.push(per); } }
    return out;
  }

  /** Elaun bulanan: { jumlah, butiran:[{nama, jumlah}] }. Setiap peringkat yang dipegang menambah elaun. */
  function pendapatanBulanan(profil) {
    var p = profil || S.loadPlayer(), butiran = [{ nama: 'Elaun asas', jumlah: CONFIG.DANA_ASAS }];
    peringkatDipegang(p).forEach(function (per) {
      butiran.push({ nama: 'Elaun jawatan ' + per.charAt(0).toUpperCase() + per.slice(1), jumlah: CONFIG.DANA_JAWATAN[per] });
    });
    return { jumlah: butiran.reduce(function (a, b) { return a + b.jumlah; }, 0), butiran: butiran };
  }

  /** Perubahan AP dan MYR pada permulaan bulan baharu. */
  function regenerasi(profil) {
    var p = profil || S.loadPlayer(), d = pendapatanBulanan(p);
    var susut = {};                                                    // v3.8: susutan kesetiaan bulanan
    Object.keys(CONFIG.SUSUT_BULANAN).forEach(function (k) { susut[k] = -CONFIG.SUSUT_BULANAN[k]; });
    if (peringkatDipegang(p).length) {
      var syKurang = (root.MyPolitikSayap && root.MyPolitikSayap.kurangSusutAkarUmbi) ? root.MyPolitikSayap.kurangSusutAkarUmbi(p) : 0;   // v5.9: Wanita
      susut.akarUmbi -= Math.max(0, CONFIG.SUSUT_PEMEGANG_JAWATAN - syKurang);
    }
    return { ap: CONFIG.AP_BULANAN - p.ap, apBaharu: CONFIG.AP_BULANAN, myr: d.jumlah, butiran: d.butiran, kesetiaan: susut };
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
    if (bulan === 1) { out.push({ jenis: 'fasa_bulan', mesej: 'Bulan 1 (' + nb + ' ' + tahun + '): ' + f.tajuk + '. ' + f.ringkas + '. Bonus +' + Math.round(CONFIG.BONUS_AKAR_UMBI * 100) + '% IP dan kesetiaan bagi tindakan sehingga bulan 3. Mandat perwakilan tahun lalu telah tamat; bertanding semula di Cawangan (bulan 4-6).' }); }
    else if (bulan === 4) { out.push({ jenis: 'fasa_bulan', mesej: 'Bulan 4 (' + nb + '): Musim Mesyuarat & Pemilihan Cawangan dan Sayap dibuka (bulan 4-6).' }); }
    else if (bulan === 7) { out.push({ jenis: 'fasa_bulan', mesej: 'Bulan 7 (' + nb + '): Mesyuarat & Pemilihan Bahagian dan Sayap dibuka. Hanya bulan ini.' }); }
    else if (bulan === 8) { out.push({ jenis: 'fasa_bulan', mesej: 'Bulan 8 (' + nb + '): Perhimpunan Agung UMNO (PAU) dan Pemilihan Pusat di WTC Kuala Lumpur (Menara Dato\' Onn). Hanya bulan ini.' }); }
    else if (bulan === 9) { out.push({ jenis: 'fasa_bulan', mesej: 'Bulan 9 (' + nb + '): Pasca-PAU. Kembali ke akar umbi dan laksana tanggungjawab jawatan anda.' }); }
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
        if (E) {
          (E.jalankanPemilihanPeringkat(k === 'pau' ? 'pusat' : k) || []).forEach(function (x) {
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
    if (p.tamat) { return gagal('kerjaya_tamat', 'Kerjaya anda telah tamat. Mulakan permainan baharu.'); }     // v5.0
    var asal = snapshot(p), bulanLama = sah(p.bulan), tahunLama = p.tahun, peristiwa = [];

    peristiwa = peristiwa.concat(tutupMusim(p));
    p = S.loadPlayer();
    var tahunBaharu = bulanLama >= 12, bulan = tahunBaharu ? 1 : bulanLama + 1, tahun = tahunBaharu ? tahunLama + 1 : tahunLama;
    var rg = regenerasi(p), E = muat('MyPolitikElection', 'election.js'), r;

    if (tahunBaharu && E && E.majuTahun) {
      r = E.majuTahun({ pulihAP: true });                 // tahun + 1, bulan = 1, AP dipulihkan, kitaran dikemas kini
      if (!r.ok) { return r; }
      peristiwa = peristiwa.concat(r.peristiwa || []);
      r = S.applyEffects({ myr: rg.myr, kesetiaan: rg.kesetiaan }, { kiraTindakan: false, log: { tindakan: 'regenerasi', nama: 'Elaun bulan ' + bulan + ' ' + tahun, peringkat: 'bulan' } });
    } else {
      r = S.applyEffects({ ap: rg.ap, myr: rg.myr, kesetiaan: rg.kesetiaan }, {
        kiraTindakan: false, patch: tahunBaharu ? { bulan: bulan, tahun: tahun } : { bulan: bulan },
        log: { tindakan: 'bulan_baharu', nama: 'Bulan ' + bulan + ' (' + namaBulan(bulan) + ') ' + tahun, peringkat: 'bulan' }
      });
    }
    if (!r.ok) { return r; }

    var STR = muat('MyPolitikStres', 'stress.js');                                              // v5.6: stress dan kesihatan bulanan
    if (STR) { peristiwa = peristiwa.concat(STR.prosesBulan().peristiwa || []); }

    var HY = tahunBaharu ? muat('MyPolitikHayat', 'hayat.js') : null;                       // v5.0: umur +1 dan semakan kesihatan
    if (HY) {
      var ht = HY.prosesTahunBaharu();
      peristiwa = peristiwa.concat(ht.peristiwa || []);
      if (!ht.tamat && HY.prosesPeralihanKategori) { peristiwa = peristiwa.concat(HY.prosesPeralihanKategori().peristiwa || []); }   // v5.1: kategori bertukar mengikut umur pada tahun baharu
    }

    peristiwa = peristiwa.concat(mesejMasuk(bulan, tahun, tahunBaharu));
    var akhir = S.loadPlayer();
    return {
      ok: true, bulanLama: bulanLama, tahunLama: tahunLama, bulan: bulan, tahun: tahun, tahunBaharu: tahunBaharu,
      fasa: getFasa(bulan), regenerasi: rg,
      perubahan: { ip: akhir.ip - asal.ip, myr: akhir.myr - asal.myr, ap: akhir.ap - asal.ap, reputasi: akhir.reputasi - asal.reputasi },
      peristiwa: peristiwa,
      mesej: 'Bulan ' + bulan + ' (' + namaBulan(bulan) + ') ' + tahun + ': AP ' + CONFIG.AP_BULANAN + ', elaun +MYR ' + rg.myr.toLocaleString('ms-MY') + '. Kesetiaan susut jika tidak dijaga.',
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
    peringkatDipegang: peringkatDipegang,
    pendapatanBulanan: pendapatanBulanan,
    regenerasi: regenerasi,
    skalaKesan: skalaKesan,
    getTakwim: getTakwim,
    pratonton: pratonton,
    majuBulan: majuBulan
  };
});
