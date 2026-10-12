/* ==========================================================================
   Nusa Politik — js/watak.js   (v3.9)
   1. Gaya Kepimpinan: menentukan "watak" pemain daripada cara dia bermain
      (jawatan, kesetiaan, Modal Sosial dan rekod disiplin). Tiada tokoh sebenar
      dinamakan atau dijadikan ukuran. Pemain hanya dibandingkan dengan gayanya sendiri.
   2. Laluan Karier Sebenar: kad maklumat neutral tentang jawatan awam yang dipegang
      beberapa Presiden UMNO, dengan sumber. Ia TIDAK dikaitkan dengan skor atau
      pilihan pemain dan tidak menilai mana-mana tokoh.

   Data tokoh di bawah dikumpul daripada sumber awam. Tarikh antara sumber kadangkala
   berbeza: medan 'nota' menyatakannya. Semak dan kemas kini di sini jika perlu.

   Guna: MyPolitikWatak.tentukan(profil) -> { kod, nama, huraian, sebab[], skor }
         MyPolitikWatak.LALUAN_TOKOH, MyPolitikWatak.TANGGA, MyPolitikWatak.SUMBER
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikWatak = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  function etika() { var g = typeof globalThis !== 'undefined' ? globalThis : null; if (g && g.MyPolitikEtika) { return g.MyPolitikEtika; } try { return typeof require === 'function' ? require('./etika.js') : null; } catch (e) { return null; } }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  /* ------------------------------------------------------------------------
     1. GAYA KEPIMPINAN
     ------------------------------------------------------------------------ */
  var WATAK = {
    akar_umbi: {
      nama: 'Pemimpin Akar Umbi',
      huraian: 'Kekuatan anda ialah hubungan dengan ahli di lapangan: ziarah, gotong-royong dan kerja khidmat. Ahli kenal dan percaya kepada anda.'
    },
    jentera: {
      nama: 'Jentera Parti',
      huraian: 'Anda kuat dalam struktur: AJK, perwakilan dan jawatan Bahagian atau Pusat. Anda tahu cara menggerakkan jentera sehingga hari mengundi.'
    },
    sayap: {
      nama: 'Pemimpin Sayap',
      huraian: 'Kerjaya anda dibina melalui sayap parti. Anda menjadi suara kumpulan anda dan naik bersama pergerakan sayap.'
    },
    pelobi: {
      nama: 'Pelobi Strategik',
      huraian: 'Anda mahir mendekati perwakilan dan membina sokongan di peringkat atasan, walaupun hubungan dengan akar umbi tidak sekuat itu.'
    },
    berintegriti: {
      nama: 'Pemimpin Berintegriti',
      huraian: 'Rekod anda bersih, Modal Sosial tinggi dan anda dipercayai. Kemenangan anda datang daripada kepercayaan, bukan daripada jalan pintas.'
    },
    berisiko: {
      nama: 'Pemain Berisiko Tinggi',
      huraian: 'Anda memilih jalan pantas. Ia memberi kelebihan jangka pendek, tetapi rekod disiplin dan risiko laporan boleh menamatkan kerjaya bila-bila masa.'
    },
    baharu: {
      nama: 'Ahli Akar Umbi',
      huraian: 'Anda baru bermula. Gaya kepimpinan anda akan terbentuk daripada pilihan yang anda buat: siapa yang anda ziarah, bagaimana anda berkempen dan jawatan yang anda kejar.'
    }
  };

  function jumlahJawatan(p) {
    var g = typeof globalThis !== 'undefined' ? globalThis : null, J = g && g.MyPolitikJawatan;
    if (!J) { try { J = require('./jawatan.js'); } catch (e) { J = null; } }
    return J ? J.getJawatan(p) : [];
  }

  /**
   * Tentukan gaya kepimpinan. Skor 0-100 bagi setiap gaya; yang tertinggi (melebihi ambang) dipilih.
   * Pulang { kod, nama, huraian, sebab:[teks], skor:{kod:nilai}, peringkat }
   */
  function tentukan(p) {
    var senarai = jumlahJawatan(p || {}), k = (p && p.kesetiaan) || {}, Et = etika();
    var r = Et && p ? Et.ringkasan(p) : { modal: 0, risiko: 0, salah: 0, amaran: 0 };
    var utama = senarai.filter(function (j) { return j.kumpulan !== 'sayap'; }), sayap = senarai.filter(function (j) { return j.kumpulan === 'sayap'; });
    var pangkatUtama = utama.reduce(function (m, j) { return Math.max(m, j.pangkat || 0); }, 0);
    var pangkatSayap = sayap.reduce(function (m, j) { return Math.max(m, j.pangkat || 0); }, 0);
    var aras = { cawangan: 1, bahagian: 2, pusat: 3 };
    var tertinggi = senarai.reduce(function (m, j) { return Math.max(m, aras[j.peringkat] || 0); }, 0);
    var akar = k.akarUmbi || 0, perw = k.perwakilan || 0, ajk = k.ajk || 0;

    var skor = {
      akar_umbi: clamp(akar + (akar >= 65 ? 10 : 0) - (tertinggi >= 2 ? 15 : 0), 0, 100),
      jentera: clamp((perw + ajk) / 2 + (tertinggi >= 2 ? 15 : 0) + (tertinggi >= 3 ? 10 : 0), 0, 100),
      sayap: sayap.length && pangkatSayap >= pangkatUtama ? clamp(55 + (pangkatSayap - pangkatUtama) * 6 + sayap.length * 4, 0, 100) : 0,
      pelobi: perw >= 65 && perw - akar >= 10 ? clamp(perw + (perw - akar), 0, 100) : 0,
      berintegriti: r.salah === 0 && r.risiko < 20 && senarai.length ? clamp(r.modal * 1.1 + (r.amaran ? -15 : 10), 0, 100) : 0,
      berisiko: r.salah > 0 || r.risiko >= 45 ? clamp(40 + r.salah * 20 + r.risiko * 0.6, 0, 100) : 0
    };

    var kod = 'baharu';
    if (senarai.length) {
      var terbaik = 0;
      Object.keys(skor).forEach(function (n) { if (skor[n] > terbaik) { terbaik = skor[n]; kod = n; } });
      if (terbaik < 40) { kod = 'baharu'; }
      if (skor.berisiko >= 60) { kod = 'berisiko'; }     // rekod disiplin sentiasa dinyatakan terus terang
    }

    var sebab = [];
    if (kod === 'akar_umbi') { sebab.push('Kesetiaan Akar Umbi ' + akar + '%.'); }
    if (kod === 'jentera') { sebab.push('Perwakilan ' + perw + '% dan AJK ' + ajk + '%.'); }
    if (kod === 'sayap') { sebab.push('Anda memegang ' + sayap.length + ' jawatan sayap.'); }
    if (kod === 'pelobi') { sebab.push('Perwakilan ' + perw + '% jauh melebihi Akar Umbi ' + akar + '%.'); }
    if (kod === 'berintegriti') { sebab.push('Modal Sosial ' + r.modal + '% dan tiada hukuman disiplin.'); }
    if (kod === 'berisiko') { sebab.push('Hukuman disiplin: ' + r.salah + ', risiko dilapor ' + r.risiko + '%.'); }
    if (senarai.length) { sebab.push('Peringkat tertinggi: ' + ['', 'Cawangan', 'Bahagian', 'Pusat'][tertinggi] + '.'); }

    return { kod: kod, nama: WATAK[kod].nama, huraian: WATAK[kod].huraian, sebab: sebab, skor: skor, peringkat: tertinggi };
  }

  /* ------------------------------------------------------------------------
     2. LALUAN KARIER SEBENAR (maklumat, bukan penilaian)
     ------------------------------------------------------------------------ */
  /** Tangga jawatan dalam permainan, sepadan dengan struktur UMNO. */
  var TANGGA = [
    { peringkat: 'Cawangan', jawatan: 'AJK Cawangan / Ketua Cawangan' },
    { peringkat: 'Bahagian', jawatan: 'AJK Bahagian / Ketua Bahagian' },
    { peringkat: 'Pusat', jawatan: 'Ahli Majlis Kerja Tertinggi (MKT)' },
    { peringkat: 'Pusat', jawatan: 'Naib Presiden' },
    { peringkat: 'Pusat', jawatan: 'Timbalan Presiden' },
    { peringkat: 'Pusat', jawatan: 'Presiden' }
  ];

  var SUMBER = {
    senarai: { nama: 'Wikipedia: Presiden UMNO', url: 'https://en.wikipedia.org/wiki/President_of_the_United_Malays_National_Organisation' },
    zahidUmno: { nama: 'Laman rasmi UMNO: Presiden', url: 'https://umno.org.my/en/presiden/zahid-hamidi/' },
    zahidWiki: { nama: 'Wikipedia: Ahmad Zahid Hamidi', url: 'https://en.wikipedia.org/wiki/Ahmad_Zahid_Hamidi' },
    zahidMstar: { nama: 'mStar: Profil TPM baharu (2015)', url: 'https://www.mstar.com.my/lokal/semasa/2015/07/28/profil-tpm-baru' },
    najib: { nama: 'Wikipedia: Najib Razak', url: 'https://en.wikipedia.org/wiki/Najib_Razak' },
    abdullah: { nama: 'Wikipedia: Abdullah Ahmad Badawi', url: 'https://en.wikipedia.org/wiki/Abdullah_Ahmad_Badawi' },
    mahathir: { nama: 'Wikipedia: Mahathir Mohamad', url: 'https://en.wikipedia.org/wiki/Mahathir_Mohamad' }
  };

  /**
   * Presiden UMNO mengikut senarai awam, dengan jawatan parti sebelum itu hanya jika dinyatakan oleh sumber.
   * 'sebelum' kosong bermakna sumber yang disemak tidak menyatakannya (bukan bermakna tiada).
   */
  var LALUAN_TOKOH = [
    { nama: 'Onn Jaafar', tempoh: '1946-1951', sebelum: [], sumber: ['senarai'] },
    { nama: 'Tunku Abdul Rahman', tempoh: '1951-1971', sebelum: [], sumber: ['senarai'] },
    { nama: 'Abdul Razak Hussein', tempoh: '1972-1976', sebelum: [], sumber: ['senarai'] },
    { nama: 'Hussein Onn', tempoh: '1978-1981', sebelum: [], sumber: ['senarai'] },
    { nama: 'Mahathir Mohamad', tempoh: '1981-2003', sebelum: ['Ahli Majlis Tertinggi (1973)', 'Naib Presiden (1975)'], sumber: ['senarai', 'mahathir'] },
    { nama: 'Abdullah Ahmad Badawi', tempoh: '2004-2009', sebelum: ['Timbalan Presiden (1999-2003)'], sumber: ['senarai', 'abdullah'],
      nota: 'Sumber berbeza tentang tahun mula jawatan Presiden (2003 atau 2004).' },
    { nama: 'Najib Razak', tempoh: '2009-2018', sebelum: ['Ketua Pemuda (akhir 1980-an)', 'Naib Presiden (1993-2009)'], sumber: ['senarai', 'najib'],
      nota: 'Tahun Ketua Pemuda berbeza antara sumber, maka tidak dinyatakan tepat.' },
    { nama: 'Ahmad Zahid Hamidi', tempoh: '2018-kini', sebelum: ['Ketua Pemuda (bermula 1996)', 'Ahli Majlis Tertinggi (bermula 2000)', 'Naib Presiden'], sumber: ['senarai', 'zahidUmno', 'zahidWiki', 'zahidMstar'],
      nota: 'Tarikh dilantik Presiden berbeza antara sumber (9 Mei, 12 Mei sebagai pemangku, atau 30 Jun 2018). Tahun jawatan Naib Presiden tidak sepakat antara sumber, maka tidak dinyatakan.' }
  ];

  var NOTA_UMUM = 'Ringkasan fakta jawatan parti yang diterbitkan secara awam. Ia bukan penilaian terhadap mana-mana tokoh dan tidak mempengaruhi skor atau pilihan dalam permainan. Tarikh antara sumber kadangkala berbeza; semak sumber untuk butiran penuh.';

  return {
    WATAK: WATAK, tentukan: tentukan,
    TANGGA: TANGGA, SUMBER: SUMBER, LALUAN_TOKOH: LALUAN_TOKOH, NOTA_UMUM: NOTA_UMUM
  };
});
