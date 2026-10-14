/* ==========================================================================
   Nusa Politik — js/events.js
   Sistem Acara Rawak (Random Event Pop-Up).

   Cetusan
     - 'bulan'    : setiap kali bulan bertukar (peluang CONFIG.PELUANG_BULAN)
     - 'aktiviti' : selepas tindakan akar umbi (peluang CONFIG.PELUANG_AKTIVITI,
                    maks CONFIG.MAKS_AKTIVITI_SEBULAN sebulan)

   Setiap acara ada 2-3 pilihan dengan implikasi berbeza (guna Dana / guna AP /
   abaikan). Kesan terus dikenakan melalui MyPolitikSave.applyEffects().
   Pilihan yang kosnya melebihi AP/Dana pemain dinyahaktifkan; pilihan
   "abaikan" sentiasa ada, jadi pemain tidak pernah terperangkap.

   Acara yang belum dijawab disimpan (kunci 'myPolitik_events') supaya tidak
   hilang jika halaman dimuat semula.

   Cara guna:
     var a = MyPolitikEvents.janaAcara({ pencetus: 'bulan' });   // acara | null
     // a = { uid, id, kategori, ikon, tajuk, huraian, pilihan:[{id,label,huraian,ringkas,boleh,sebab}] }
     var h = MyPolitikEvents.pilih(a.pilihan[0].id);             // { ok, mesej, ringkas, perubahan, acara, pilihan }
     MyPolitikEvents.getTertunggak();                            // acara belum dijawab | null
   Perlu dimuatkan selepas js/save.js.
   ========================================================================== */
(function (root, factory) {
  var S = root.MyPolitikSave || (typeof module === 'object' && typeof require === 'function' ? require('./save.js') : null);
  if (!S) { throw new Error('events.js memerlukan js/save.js dimuatkan dahulu.'); }
  var api = factory(S, root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikEvents = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (S, root) {
  'use strict';

  function etika() { var g = typeof globalThis !== 'undefined' ? globalThis : null; if (g && g.MyPolitikEtika) { return g.MyPolitikEtika; } try { return typeof require === 'function' ? require('./etika.js') : null; } catch (e) { return null; } }

  var KEY = 'myPolitik_events';

  var CONFIG = {
    PELUANG_BULAN: 0.7,            // peluang acara apabila bulan bertukar
    PELUANG_AKTIVITI: 0.15,        // peluang acara selepas satu tindakan
    MAKS_AKTIVITI_SEBULAN: 2,
    ELAK_ULANG: 4,                 // acara sama tidak diulang dalam N acara terakhir
    BULAN_BANJIR: [11, 12, 1, 2],  // musim tengkujuh: banjir lebih kerap
    PELUANG_KRISIS: 0.35,          // v5.8: peluang krisis politik apabila bulan bertukar (pemegang jawatan sahaja)
    KRISIS_JARAK_BULAN: 2          // sekurang-kurangnya N bulan antara dua krisis (purata satu krisis setiap ~4-5 bulan)
  };

  /* ------------------------------------------------------------------------
     DEFINISI ACARA
     kategori : 'cawangan' | 'projek' | 'tempatan' | 'politik'
     syarat   : fn(profil) -> boolean (pilihan)
     berat    : nombor | fn(profil) -> nombor (lalai 1)
     pilihan  : [{ id, label, huraian, kesan, mesej, hasil? }]
        kesan  : dihantar ke applyEffects (ap/myr negatif = kos)
        hasil  : (pilihan) [{ peluang, kesan, mesej }] — keputusan berisiko;
                 jumlah peluang = 1. Kos asas dikira dahulu daripada `kesan`.
     Teks boleh guna {cawangan} / {bahagian} / {dun}.
     ------------------------------------------------------------------------ */
  /* v6.4: peristiwa khas sayap. 'sayapIni' = laluan sayap pemain; 'ketuaSayap' = memegang jawatan Ketua sayap di mana-mana peringkat. */
  function sayapIni(p, k) { return p.sayap === k; }
  function ketuaSayap(p, k) { return p.sayap === k && Array.isArray(p.jawatanList) && p.jawatanList.some(function (j) { return j.kumpulan === 'sayap' && j.sayap === k; }); }
  function bilJ(p) { return Array.isArray(p.jawatanList) ? p.jawatanList.length : (p.jawatan && p.jawatan !== 'Ahli Biasa' ? 1 : 0); }

  var ACARA = [
    /* --- Isu Cawangan --- */
    {
      id: 'dana_program_kering', kategori: 'cawangan', ikon: '💸', tajuk: 'Dana Program Cawangan Kering',
      huraian: 'Bendahari Cawangan {cawangan} melapor tabung program telah kosong, sedangkan majlis Hari Keluarga tinggal beberapa hari lagi. Ahli mula berbisik.',
      pilihan: [
        { id: 'a', label: 'Tampung dengan Dana sendiri', huraian: 'Anda keluarkan wang peribadi.', kesan: { myr: -400, ip: 12, kesetiaan: { ketuaCawangan: 6, akarUmbi: 4 } }, mesej: 'Majlis berjalan lancar. Ahli menghargai kesanggupan anda berkorban.' },
        { id: 'b', label: 'Kutip derma (guna AP)', huraian: 'Turun padang meminta sumbangan ahli.', kesan: { ap: -2, ip: 6, kesetiaan: { akarUmbi: 3 } }, mesej: 'Sumbangan terkumpul agak cukup. Majlis diadakan secara sederhana.' },
        { id: 'c', label: 'Biarkan Bendahari uruskan', huraian: 'Tiada kos, tetapi risiko kecewa.', kesan: { ip: -5, kesetiaan: { akarUmbi: -4, ketuaCawangan: -2 } }, mesej: 'Majlis dibatalkan. Ahli kecewa dengan kepimpinan cawangan.' }
      ]
    },
    {
      id: 'isu_keahlian', kategori: 'cawangan', ikon: '📋', tajuk: 'Isu Keahlian Tertunggak',
      huraian: 'Puluhan ahli di Cawangan {cawangan} didapati belum menjelaskan yuran dan terancam hilang kelayakan mengundi.',
      pilihan: [
        { id: 'a', label: 'Bayarkan yuran mereka', huraian: 'Kos tinggi, tetapi sokongan dijamin.', kesan: { myr: -500, ip: 8, kesetiaan: { akarUmbi: 8, ajk: 3 } }, mesej: 'Keahlian dipulihkan. Mereka berjanji menyokong anda.' },
        { id: 'b', label: 'Jalankan operasi ziarah', huraian: 'Pujuk satu demi satu.', kesan: { ap: -2, ip: 10, kesetiaan: { akarUmbi: 4 } }, mesej: 'Sebahagian besar ahli menjelaskan sendiri selepas dipujuk.' },
        { id: 'c', label: 'Biarkan', huraian: 'Tiada kos.', kesan: { kesetiaan: { akarUmbi: -6 }, ip: -4 }, mesej: 'Ramai ahli gugur kelayakan. Ada yang menyalahkan anda.' }
      ]
    },
    {
      id: 'ahli_baharu_ramai', kategori: 'cawangan', ikon: '🧑‍🤝‍🧑', tajuk: 'Gelombang Ahli Baharu',
      huraian: 'Sekumpulan belia di {dun} berminat menyertai parti tetapi mahu bertemu dengan anda dahulu.',
      pilihan: [
        { id: 'a', label: 'Anjur sesi bual mesra (Dana)', huraian: 'Sediakan jamuan ringan.', kesan: { myr: -150, ip: 14, kesetiaan: { akarUmbi: 5 } }, mesej: 'Belia teruja dan mendaftar ramai-ramai.' },
        { id: 'b', label: 'Jumpa sendiri (AP)', huraian: 'Luangkan masa bersembang.', kesan: { ap: -1, ip: 8, kesetiaan: { akarUmbi: 3 } }, mesej: 'Beberapa orang menyertai selepas bersembang dengan anda.' },
        { id: 'c', label: 'Minta mereka daftar sendiri', huraian: 'Abaikan.', kesan: { ip: -2 }, mesej: 'Minat mereka beransur pudar.' }
      ]
    },
    {
      id: 'pertikaian_ajk', kategori: 'cawangan', ikon: '⚖️', tajuk: 'Pertikaian Dalaman AJK',
      huraian: 'Dua AJK Cawangan {cawangan} bertelagah terbuka di WhatsApp. Tangkap layar sudah tersebar.',
      pilihan: [
        { id: 'a', label: 'Damaikan dengan jamuan (Dana)', huraian: 'Mengundang kedua-duanya makan malam.', kesan: { myr: -200, kesetiaan: { ajk: 8, ketuaCawangan: 3 } }, mesej: 'Kedua-dua pihak berdamai dan berjabat tangan.' },
        { id: 'b', label: 'Jadi orang tengah (AP)', huraian: 'Runding secara berasingan.', kesan: { ap: -2, ip: 6, kesetiaan: { ajk: 5 } }, mesej: 'Anda dihormati sebagai pendamai.' },
        { id: 'c', label: 'Tidak masuk campur', huraian: 'Biar reda sendiri.', kesan: { kesetiaan: { ajk: -6 }, ip: -3 }, mesej: 'Pertelagahan berlarutan dan memecahkan cawangan.' }
      ]
    },

    /* --- Projek / Aktiviti --- */
    {
      id: 'program_kebajikan', kategori: 'projek', ikon: '🤲', tajuk: 'Program Kebajikan Warga Emas',
      huraian: 'Sayap Wanita mencadangkan program kebajikan dan agihan bakul makanan untuk warga emas di {dun}. Mereka memerlukan penaja.',
      pilihan: [
        { id: 'a', label: 'Taja sepenuhnya (Dana)', huraian: 'Anda menjadi penaja utama.', kesan: { myr: -450, ip: 18, reputasi: 2, kesetiaan: { akarUmbi: 6 } }, mesej: 'Program meriah. Gambar anda tersebar dengan sentimen positif.' },
        { id: 'b', label: 'Turun membantu (AP)', huraian: 'Jadi sukarelawan agihan.', kesan: { ap: -2, ip: 10, kesetiaan: { akarUmbi: 4 } }, mesej: 'Warga emas mengenali wajah anda.' },
        { id: 'c', label: 'Hanya beri ucapan terima kasih', huraian: 'Tiada kos.', kesan: { ip: 1 }, mesej: 'Program berjalan kecil-kecilan tanpa banyak kesan.' }
      ]
    },
    {
      id: 'sukaneka_pemuda', kategori: 'projek', ikon: '⚽', tajuk: 'Sukaneka Pemuda',
      huraian: 'Pemuda cawangan mahu menganjurkan Sukaneka peringkat {bahagian}. Peluang menarik belia dan menunjukkan kepimpinan.',
      pilihan: [
        { id: 'a', label: 'Sediakan hadiah & jersi (Dana)', huraian: 'Penajaan penuh.', kesan: { myr: -350, ip: 14, kesetiaan: { akarUmbi: 5, ajk: 3 } }, mesej: 'Sukaneka meriah dengan ratusan peserta.' },
        { id: 'b', label: 'Jadi pengelola (AP)', huraian: 'Kendalikan pasukan dan jadual.', kesan: { ap: -2, ip: 9, kesetiaan: { akarUmbi: 4 } }, mesej: 'Penganjuran kemas dan anda dipuji.' },
        { id: 'c', label: 'Lepaskan peluang', huraian: 'Biar Pemuda uruskan sendiri.', kesan: { ip: -3, kesetiaan: { akarUmbi: -2 } }, mesej: 'Pemuda kecewa tiada sokongan.' }
      ]
    },
    {
      id: 'konvensyen_puteri', kategori: 'projek', ikon: '🎤', tajuk: 'Konvensyen Puteri',
      huraian: 'Puteri UMNO menjemput anda hadir ke Konvensyen Puteri peringkat negeri dan memohon sokongan logistik.',
      pilihan: [
        { id: 'a', label: 'Sumbang penginapan & bas (Dana)', huraian: 'Bantuan logistik.', kesan: { myr: -300, ip: 12, kesetiaan: { akarUmbi: 4, ajk: 4 } }, mesej: 'Delegasi cawangan anda menyerlah di konvensyen.' },
        { id: 'b', label: 'Hadir & berucap (AP)', huraian: 'Luangkan masa seharian.', kesan: { ap: -2, ip: 11, reputasi: 1 }, mesej: 'Ucapan anda mendapat tepukan gemuruh.' },
        { id: 'c', label: 'Hantar mesej tahniah sahaja', huraian: 'Tiada kos.', kesan: { ip: 1 }, mesej: 'Ucapan anda dibaca sepintas lalu.' }
      ]
    },
    {
      id: 'kursus_kepimpinan', kategori: 'projek', ikon: '🎓', tajuk: 'Kursus Kepimpinan Parti',
      huraian: 'Bahagian {bahagian} membuka tempat terhad untuk Kursus Kepimpinan. Peserta mendapat kenalan dan kredibiliti.',
      pilihan: [
        { id: 'a', label: 'Daftar kursus berbayar (Dana)', huraian: 'Kursus intensif tiga hari.', kesan: { myr: -400, ip: 16, reputasi: 2, kesetiaan: { ajk: 3 } }, mesej: 'Anda pulang dengan jaringan dan sijil yang bernilai.' },
        { id: 'b', label: 'Ikuti sesi percuma (AP)', huraian: 'Versi ringkas hujung minggu.', kesan: { ap: -2, ip: 8 }, mesej: 'Sesi ringkas, tetapi cukup menambah ilmu.' },
        { id: 'c', label: 'Tolak', huraian: 'Terlalu sibuk.', kesan: {}, mesej: 'Peluang berlalu begitu sahaja.' }
      ]
    },
    {
      id: 'gotong_royong_besar', kategori: 'projek', ikon: '🧹', tajuk: 'Gotong-Royong Perdana',
      huraian: 'Ketua Cawangan mengajak semua AJK menjayakan gotong-royong membersihkan surau dan balairaya.',
      pilihan: [
        { id: 'a', label: 'Sertai & bawa makanan', huraian: 'Guna AP dan Dana.', kesan: { ap: -1, myr: -100, ip: 10, kesetiaan: { ketuaCawangan: 8, akarUmbi: 4 } }, mesej: 'Ketua Cawangan menyebut nama anda dalam ucapan penutup.' },
        { id: 'b', label: 'Sertai sahaja (AP)', huraian: 'Turun bekerja.', kesan: { ap: -1, ip: 6, kesetiaan: { ketuaCawangan: 5 } }, mesej: 'Peluh anda dilihat ramai.' },
        { id: 'c', label: 'Beri alasan tidak hadir', huraian: 'Tiada kos.', kesan: { kesetiaan: { ketuaCawangan: -5 }, ip: -2 }, mesej: 'Ketiadaan anda disedari Ketua Cawangan.' }
      ]
    },

    /* --- Isu Tempatan --- */
    {
      id: 'banjir_kilat', kategori: 'tempatan', ikon: '🌊', tajuk: 'Banjir di Kawasan Cawangan',
      berat: function (p) { return CONFIG.BULAN_BANJIR.indexOf(p.bulan) >= 0 ? 4 : 0.6; },
      huraian: 'Hujan lebat berterusan. Beberapa kampung di Cawangan {cawangan} dinaiki air dan mangsa menunggu bantuan di pusat pemindahan.',
      pilihan: [
        { id: 'a', label: 'Sumbang bantuan tunai & makanan (Dana)', huraian: 'Kos besar, kesan besar.', kesan: { myr: -500, ip: 22, reputasi: 3, kesetiaan: { akarUmbi: 10 } }, mesej: 'Bantuan anda sampai pantas. Mangsa banjir berterima kasih.' },
        { id: 'b', label: 'Turun padang membantu (AP)', huraian: 'Bergotong-royong bersama sukarelawan.', kesan: { ap: -3, ip: 14, kesetiaan: { akarUmbi: 7 } }, mesej: 'Anda berlumpur bersama penduduk. Foto anda tular.' },
        { id: 'c', label: 'Abaikan', huraian: 'Serahkan kepada agensi.', kesan: { ip: -10, reputasi: -3, kesetiaan: { akarUmbi: -8 } }, mesej: 'Penduduk marah kerana ketiadaan anda ketika diperlukan.' }
      ]
    },
    {
      id: 'jalan_berlubang', kategori: 'tempatan', ikon: '🕳️', tajuk: 'Jalan Berlubang Jadi Viral',
      huraian: 'Gambar jalan berlubang di {dun} tular di media sosial. Penduduk menuntut tindakan wakil parti.',
      pilihan: [
        { id: 'a', label: 'Tampal sendiri melalui kontraktor kecil (Dana)', huraian: 'Pantas tetapi mahal.', kesan: { myr: -250, ip: 12, kesetiaan: { akarUmbi: 5 } }, mesej: 'Jalan ditampal dalam dua hari. Penduduk lega.' },
        { id: 'b', label: 'Adukan rasmi ke pejabat daerah (AP)', huraian: 'Desak melalui saluran.', kesan: { ap: -2, ip: 8, kesetiaan: { akarUmbi: 3 } }, mesej: 'Aduan anda diberi perhatian. Kerja baik pulih bermula.' },
        { id: 'c', label: 'Tunggu pihak berkuasa', huraian: 'Tiada tindakan.', kesan: { ip: -4, kesetiaan: { akarUmbi: -3 } }, mesej: 'Penduduk menyindir wakil parti yang menyepi.' }
      ]
    },
    {
      id: 'kenduri_kematian', kategori: 'tempatan', ikon: '🕊️', tajuk: 'Kematian Ahli Veteran',
      huraian: 'Seorang ahli veteran Cawangan {cawangan} meninggal dunia. Keluarganya mengharapkan kehadiran wakil parti.',
      pilihan: [
        { id: 'a', label: 'Hadir & beri sumbangan (Dana)', huraian: 'Sumbangan khairat.', kesan: { myr: -120, ip: 8, kesetiaan: { akarUmbi: 5, ketuaCawangan: 3 } }, mesej: 'Keluarga arwah terharu dengan keprihatinan anda.' },
        { id: 'b', label: 'Hadir menziarah (AP)', huraian: 'Beri takziah.', kesan: { ap: -1, ip: 6, kesetiaan: { akarUmbi: 4 } }, mesej: 'Kehadiran anda dihargai.' },
        { id: 'c', label: 'Hantar ucapan takziah sahaja', huraian: 'Tiada kos.', kesan: { ip: -2, kesetiaan: { akarUmbi: -2 } }, mesej: 'Ada yang menganggap anda tidak mengambil berat.' }
      ]
    },
    {
      id: 'kebakaran_rumah', kategori: 'tempatan', ikon: '🔥', tajuk: 'Kebakaran Rumah Penduduk',
      huraian: 'Sebuah rumah penduduk di {dun} terbakar. Keluarga itu kehilangan hampir segala-galanya.',
      pilihan: [
        { id: 'a', label: 'Sumbang wang & pakaian (Dana)', huraian: 'Bantuan segera.', kesan: { myr: -300, ip: 15, reputasi: 1, kesetiaan: { akarUmbi: 7 } }, mesej: 'Keluarga itu dapat berteduh sementara berkat bantuan anda.' },
        { id: 'b', label: 'Koordinasi bantuan ahli (AP)', huraian: 'Kumpul derma melalui cawangan.', kesan: { ap: -2, ip: 11, kesetiaan: { akarUmbi: 5, ajk: 3 } }, mesej: 'Ahli cawangan bergabung tenaga membantu mangsa.' },
        { id: 'c', label: 'Abaikan', huraian: 'Bukan urusan anda.', kesan: { ip: -6, kesetiaan: { akarUmbi: -5 } }, mesej: 'Kisah ini tersebar dan imej anda terjejas.' }
      ]
    },

    /* --- Politik / Media --- */
    {
      id: 'fitnah_media_sosial', kategori: 'politik', ikon: '📱', tajuk: 'Fitnah di Media Sosial',
      huraian: 'Akaun tanpa nama menuduh anda menyalahgunakan dana cawangan. Kandungan itu dikongsi di kumpulan WhatsApp ahli.',
      pilihan: [
        { id: 'a', label: 'Lantik peguam & keluarkan kenyataan (Dana)', huraian: 'Tegas dan rasmi.', kesan: { myr: -400, reputasi: 2, ip: 6 }, mesej: 'Tuduhan tidak berasas dibersihkan dan imej anda pulih.' },
        { id: 'b', label: 'Jelaskan secara peribadi (AP)', huraian: 'Terangkan kepada ketua-ketua.', kesan: { ap: -2, ip: 3, kesetiaan: { ketuaCawangan: 3 } }, mesej: 'Ketua-ketua menerima penjelasan anda.' },
        { id: 'c', label: 'Biarkan reda', huraian: 'Tiada kos.', hasil: [
            { peluang: 0.5, kesan: { ip: -2 }, mesej: 'Isu padam sendiri tanpa banyak kesan.' },
            { peluang: 0.5, kesan: { ip: -10, reputasi: -3, kesetiaan: { akarUmbi: -5 } }, mesej: 'Fitnah merebak dan ramai mula mempercayainya.' } ] }
      ]
    },
    {
      id: 'tawaran_penaja', kategori: 'politik', ikon: '🤝', tajuk: 'Tawaran Penaja Misteri',
      huraian: 'Seorang usahawan menawarkan RM 800 untuk "membantu aktiviti anda", tetapi mahu dijemput ke setiap majlis cawangan.',
      pilihan: [
        { id: 'a', label: 'Terima tawaran', huraian: 'Dapat wang, tetapi ada risiko.', hasil: [
            { peluang: 0.6, kesan: { myr: 800, ip: 3 }, mesej: 'Usahawan itu jujur dan wang digunakan untuk aktiviti.' },
            { peluang: 0.4, kesan: { myr: 800, reputasi: -5, ip: -8, kesetiaan: { ketuaCawangan: -6 } }, mesej: 'Hubungan itu dibongkar dan anda dituduh menerima dana tidak telus.' } ], kesan: {} },
        { id: 'b', label: 'Tolak baik-baik (AP)', huraian: 'Jelaskan sebab dengan hormat.', kesan: { ap: -1, reputasi: 1, ip: 2 }, mesej: 'Pendirian berintegriti anda dipuji.' },
        { id: 'c', label: 'Abaikan mesej itu', huraian: 'Tiada kos.', kesan: {}, mesej: 'Tawaran itu hilang begitu sahaja.' }
      ]
    },
    {
      id: 'wartawan_temu_bual', kategori: 'politik', ikon: '🎙️', tajuk: 'Wartawan Mahu Temu Bual',
      huraian: 'Wartawan portal berita tempatan mahu menemu bual anda tentang masa depan parti di peringkat akar umbi.',
      pilihan: [
        { id: 'a', label: 'Sediakan bahan & hadir (AP)', huraian: 'Bersedia sebaiknya.', kesan: { ap: -2, ip: 12, reputasi: 2 }, mesej: 'Temu bual tersiar dengan sorotan positif.' },
        { id: 'b', label: 'Jawab spontan', huraian: 'Tiada kos, tetapi berisiko.', hasil: [
            { peluang: 0.6, kesan: { ip: 6 }, mesej: 'Jawapan spontan anda kelihatan jujur dan meyakinkan.' },
            { peluang: 0.4, kesan: { ip: -6, reputasi: -2 }, mesej: 'Anda tersilap kata dan ayat itu dipotong untuk tajuk berita.' } ], kesan: {} },
        { id: 'c', label: 'Tolak temu bual', huraian: 'Tiada komen.', kesan: {}, mesej: 'Wartawan mencari tokoh lain.' }
      ]
    },

    /* --- Tataetika & Disiplin (Perlembagaan Fasal 20; Tataetika Ahli UMNO 2025) --- */
    {
      id: 'tawaran_wang_politik', kategori: 'politik', ikon: '💰', tajuk: 'Tawaran Wang Politik',
      huraian: 'Seorang taukeh yang rapat dengan Bahagian {bahagian} menghulurkan sampul tebal berisi RM 5,000 "untuk membantu kempen anda", dengan syarat anda memberi laluan kepada projeknya kelak. Tiada siapa lain melihat.',
      syarat: function (p) { return p.jawatan !== 'Ahli Biasa' || p.ip >= 40; },
      berat: function (p) { return (p.tahun - 2026) % 3 === 0 && p.bulan >= 3 && p.bulan <= 8 ? 2.5 : 0.5; },
      pilihan: [
        { id: 'a', label: 'Terima sampul itu', huraian: 'Dana segera, tetapi ini rasuah politik.', kesan: { myr: 5000, kesetiaan: { ajk: 4 } },
          etika: { modal: -12, risiko: 30, lapor: { peluang: 25, berat: 3, perkara: 'Menerima wang bagi mendapatkan sokongan dan kontrak (Tataetika Perkara 5.1.3, 6.1)', fasal: 'Fasal 20.13' } },
          mesej: 'Anda menyimpan sampul itu. Wang masuk, tetapi anda kini berhutang budi, dan ramai yang boleh bersuara kelak.' },
        { id: 'b', label: 'Tolak dan laporkan kepada Setiausaha Bahagian', huraian: 'Jujur dan selamat. Dikenang oleh akar umbi.', kesan: { ap: -1, ip: 6, reputasi: 4 },
          etika: { modal: 8, risiko: -10 }, mesej: 'Anda menolak dan melaporkan dengan jelas. Berita integriti anda tersebar dengan baik.' },
        { id: 'c', label: 'Tolak dengan sopan', huraian: 'Tiada kos.', kesan: {}, etika: { modal: 3 }, mesej: 'Taukeh itu beredar kecewa. Nama anda kekal bersih.' }
      ]
    },
    {
      id: 'aduan_tataetika_palsu', kategori: 'politik', ikon: '📨', tajuk: 'Fitnah: Dituduh Beri Wang Undi',
      huraian: 'Lawan anda menyebar mesej bahawa anda "membeli undi". Tuduhan itu tidak benar, tetapi sudah dikongsi dalam kumpulan WhatsApp Bahagian.',
      syarat: function (p) { return p.ip >= 30; },
      berat: function (p) { return (p.tahun - 2026) % 3 === 0 ? 1.5 : 0.4; },
      pilihan: [
        { id: 'a', label: 'Kemukakan penafian rasmi kepada JK Disiplin (AP)', huraian: 'Ikut saluran parti (Fasal 20.5).', kesan: { ap: -2, reputasi: 3 }, etika: { modal: 4, risiko: -8 },
          mesej: 'Jawatankuasa Disiplin menerima penafian anda dan memberi peringatan kepada penyebar fitnah.' },
        { id: 'b', label: 'Balas di media sosial', huraian: 'Memuaskan hati, tetapi anda pun melanggar Tataetika.', kesan: { ip: 4, reputasi: -3 },
          etika: { modal: -4, risiko: 12, lapor: { peluang: 14, berat: 1, perkara: 'Membalas fitnah di media sosial secara terbuka (Tataetika Perkara 5.3)', fasal: 'Tataetika 5.3' } },
          mesej: 'Balasan anda viral. Sokongan padu, namun ada yang mengadu kepada parti.' },
        { id: 'c', label: 'Abaikan', huraian: 'Biar masa menjawab.', kesan: { ip: -3 }, etika: { modal: -2 }, mesej: 'Desas-desus terus berlegar dan sebahagian ahli mula ragu.' }
      ]
    },
    {
      id: 'kenduri_kahwin_kempen', kategori: 'politik', ikon: '🍛', tajuk: 'Kenduri Kahwin Anak Ketua Cawangan',
      huraian: 'Anda dijemput ke kenduri kahwin di Cawangan {cawangan}. Ramai perwakilan hadir. Ada yang mengajak anda "bercakap sedikit" kepada para tetamu.',
      berat: function (p) { return (p.tahun - 2026) % 3 === 0 ? 1.5 : 0.6; },
      pilihan: [
        { id: 'a', label: 'Hadir, bersalam, tidak berucap', huraian: 'Tunjuk muka sebagai jiran.', kesan: { ip: 4, kesetiaan: { akarUmbi: 3 } }, etika: { modal: 3 },
          mesej: 'Anda dihormati kerana hadir tanpa berkempen.' },
        { id: 'b', label: 'Berucap meraih undi', huraian: 'Cepat dikenali, tetapi melanggar Tataetika Perkara 5.6.', kesan: { ip: 10, kesetiaan: { akarUmbi: 6, ajk: 3 } },
          etika: { modal: -3, risiko: 10, lapor: { peluang: 10, berat: 1, perkara: 'Berucap meraih undi di majlis kenduri (Tataetika Perkara 5.6)', fasal: 'Tataetika 5.6' } },
          mesej: 'Ucapan anda disambut. Seorang tetamu merakam sebahagiannya.' },
        { id: 'c', label: 'Tidak hadir', huraian: 'Hantar salam sahaja.', kesan: { ip: -2, kesetiaan: { akarUmbi: -2 } }, mesej: 'Ada yang berkecil hati.' }
      ]
    },
    {
      id: 'program_integriti', kategori: 'politik', ikon: '🎓', tajuk: 'Jemputan Program Integriti Ahli',
      huraian: 'Badan Perhubungan Negeri menganjurkan program Tataetika Ahli dan integriti di {dun}. Anda diminta mewakili Cawangan {cawangan}.',
      berat: 0.8,
      pilihan: [
        { id: 'a', label: 'Hadir dan jadi panel (AP)', huraian: 'Bina imej bersih.', kesan: { ap: -2, ip: 6, reputasi: 3 }, etika: { modal: 8, risiko: -12 }, mesej: 'Anda dikenali sebagai ahli yang berprinsip. Risiko dilapor merosot.' },
        { id: 'b', label: 'Hantar wakil', huraian: 'Kos kecil.', kesan: { ap: -1, ip: 2 }, etika: { modal: 2 }, mesej: 'Cawangan hadir, tetapi anda tidak kelihatan.' },
        { id: 'c', label: 'Abaikan', huraian: 'Tiada kos.', kesan: {}, mesej: 'Jemputan tidak dibalas.' }
      ]
    },
    {
      id: 'pendengaran_disiplin', kategori: 'politik', ikon: '⚖️', tajuk: 'Pendengaran Jawatankuasa Disiplin',
      huraian: 'Anda dipanggil Jawatankuasa Disiplin berhubung aduan terhadap anda. Keputusan akan dibuat bulan depan (Fasal 20.4 dan 20.5). Bagaimana anda mahu bertindak?',
      syarat: function (p) { return !!(p.etika && p.etika.siasatan && p.etika.siasatan.fasa === 'pendengaran' && !p.etika.siasatan.dijawab); },
      berat: function (p) { return p.etika && p.etika.siasatan && p.etika.siasatan.fasa === 'pendengaran' && !p.etika.siasatan.dijawab ? 1000 : 0; },
      pilihan: [
        { id: 'a', label: 'Kemukakan pembelaan bertulis dan saksi (AP)', huraian: 'Peluang terbaik mengurangkan hukuman.', kesan: { ap: -2 }, pendengaran: 'pembelaan', mesej: 'Pembelaan anda dikemukakan dengan teratur. Jawatankuasa mencatatnya.' },
        { id: 'b', label: 'Akui kesilapan dan mohon maaf', huraian: 'Sikap jujur sedikit meringankan.', kesan: { reputasi: 2 }, pendengaran: 'akur', mesej: 'Anda mengakui dan memohon maaf. Jawatankuasa mengambil kira keikhlasan anda.' },
        { id: 'c', label: 'Ugut bawa ke mahkamah awam', huraian: 'Fasal 20.7: membawa perkara parti ke mahkamah sebelum mematuhi peraturan parti menggugurkan keahlian.', kesan: {}, pendengaran: 'mahkamah', mesej: 'Anda mengancam mahkamah. Jawatankuasa mencatat bahawa anda telah melanggar Fasal 20.7.' }
      ]
    },

    /* --- Krisis Akar Umbi (v5.6): dicetus oleh Stress tinggi / jawatan tinggi. v5.7: berat naik mengikut bilangan jawatan --- */
    {
      id: 'akar_umbi_terpinggir', kategori: 'politik', krisis: true, ikon: '😔', tajuk: 'Akar Umbi Rasa Terpinggir',
      syarat: function (p) { return (Number(p.stress) || 0) >= 60 && p.jawatan !== 'Ahli Biasa'; },
      berat: function (p) { return 4 + ((Number(p.stress) || 0) - 60) / 4 + 2 * (bilJ(p) - 1); },
      huraian: 'Anda terlalu sibuk dengan tugas dan tekanan. Ahli cawangan {cawangan} merungut tidak pernah bertemu anda lagi dan mula berasa terpinggir.',
      pilihan: [
        { id: 'a', label: 'Lepaskan jawatan paling membebankan', huraian: 'Serahkan jawatan yang paling berat kepada orang lain. Stress -35.', lepasJawatan: true, stres: { stress: -35, kesihatan: 3 }, kesan: { kesetiaan: { akarUmbi: 6 } }, mesej: 'Anda melepaskan jawatan. Ahli menghargai kejujuran anda dan tekanan berkurang.' },
        { id: 'b', label: 'Turun padang bertemu ahli (AP)', huraian: 'Luangkan masa, tetapi memenatkan. Stress -5.', kesan: { ap: -3, kesetiaan: { akarUmbi: 5 } }, stres: { stress: -5 }, mesej: 'Ahli gembira anda hadir, namun jadual anda bertambah padat.' },
        { id: 'c', label: 'Abaikan rungutan itu', huraian: 'Sokongan akar umbi jatuh drastik.', kesan: { ip: -10, kesetiaan: { akarUmbi: -15 } }, stres: { stress: 6 }, mesej: 'Ahli berasa diketepikan. Sokongan akar umbi merosot dan tekanan anda bertambah.' }
      ]
    },
    {
      id: 'sabotaj_akar_umbi', kategori: 'politik', krisis: true, ikon: '🕵️', tajuk: 'Sabotaj dalam Cawangan',
      syarat: function (p) { return ((Number(p.stress) || 0) >= 65 || (p.stress >= 50 && p.jawatan === 'Presiden')) && p.jawatan !== 'Ahli Biasa'; },
      berat: function (p) { return 3 + ((Number(p.stress) || 0) - 60) / 4 + 2 * (bilJ(p) - 1); },
      huraian: 'Sekumpulan ahli yang marah menyebarkan khabar angin bahawa anda sudah letih dan tidak layak. Mereka menghalang usaha anda di mesyuarat cawangan {cawangan}.',
      pilihan: [
        { id: 'a', label: 'Letak jawatan paling membebankan dengan terhormat', huraian: 'Serangan terhenti. Stress -30.', lepasJawatan: true, stres: { stress: -30, kesihatan: 2 }, kesan: { reputasi: 1 }, mesej: 'Anda berundur dengan maruah. Serangan politik terhadap anda reda.' },
        { id: 'b', label: 'Bendung dengan jamuan & pujukan (Dana)', huraian: 'Kos tinggi tetapi menenangkan keadaan. Stress +4.', kesan: { myr: -600, kesetiaan: { akarUmbi: 4, ajk: 3 } }, stres: { stress: 4 }, mesej: 'Pujukan anda berjaya meredakan sebahagian ahli, tetapi anda semakin letih.' },
        { id: 'c', label: 'Lawan balik', huraian: 'Berisiko tinggi.', stres: { stress: 8 }, kesan: {}, hasil: [
            { peluang: 0.4, kesan: { ip: 6, kesetiaan: { akarUmbi: 3 } }, mesej: 'Anda mematahkan hujah mereka dan ahli kembali menyokong anda.' },
            { peluang: 0.6, kesan: { ip: -14, reputasi: -3, kesetiaan: { akarUmbi: -14, ajk: -8 } }, mesej: 'Pertengkaran terbuka merosakkan imej anda. Sokongan akar umbi jatuh drastik.' } ] }
      ]
    },
    {
      id: 'ahli_marah_pemimpin_letih', kategori: 'politik', krisis: true, ikon: '😡', tajuk: 'Ahli Marah: Pemimpin Dah Tak Peduli',
      syarat: function (p) { return (Number(p.stress) || 0) >= 60 && p.jawatan !== 'Ahli Biasa'; },
      berat: function (p) { return 3 + ((Number(p.stress) || 0) - 60) / 5 + 2 * (bilJ(p) - 1); },
      huraian: 'Ahli akar umbi di {dun} meluahkan kemarahan di media sosial kerana anda kelihatan letih, lewat membalas dan tidak lagi mendengar masalah mereka.',
      pilihan: [
        { id: 'a', label: 'Ambil cuti rehat sebulan (AP)', huraian: 'Pulihkan diri, dan minta ahli bersabar. Stress -20.', kesan: { ap: -3, kesetiaan: { akarUmbi: -3 } }, stres: { stress: -20, kesihatan: 5 }, mesej: 'Anda berehat dan kembali lebih bertenaga. Sedikit ahli kecewa, tetapi ramai memahami.' },
        { id: 'b', label: 'Lepaskan jawatan paling membebankan', huraian: 'Serahkan kepada orang lain. Stress -35.', lepasJawatan: true, stres: { stress: -35, kesihatan: 3 }, kesan: {}, mesej: 'Anda menyerahkan tugas kepada orang lain dan memulihkan diri.' },
        { id: 'c', label: 'Teruskan seperti biasa', huraian: 'Sokongan jatuh drastik.', kesan: { reputasi: -3, kesetiaan: { akarUmbi: -12, ajk: -6 } }, stres: { stress: 5 }, mesej: 'Kemarahan ahli merebak. Sokongan akar umbi jatuh dan tekanan anda bertambah.' }
      ]
    },
    {
      id: 'cemburu_cabaran_jawatan', kategori: 'politik', krisis: true, ikon: '🗡️', tajuk: 'Ahli Cemburu: Cabaran terhadap Kedudukan Anda',
      syarat: function (p) { return bilJ(p) >= 2 && (Number(p.stress) || 0) >= 80; },
      berat: function (p) { return 6 + 3 * (bilJ(p) - 2) + ((Number(p.stress) || 0) - 80) / 3; },
      huraian: 'Anda memegang terlalu banyak jawatan serentak dan sudah kepenatan. Pemimpin muda di {cawangan} berasa terpinggir dan cemburu; mereka mengumpul sokongan untuk mencabar dan merampas salah satu jawatan anda.',
      pilihan: [
        { id: 'a', label: 'Lepaskan jawatan paling membebankan', huraian: 'Beri laluan kepada orang lain. Stress -25.', lepasJawatan: true, stres: { stress: -25, kesihatan: 2 }, kesan: { kesetiaan: { akarUmbi: 5 } }, mesej: 'Anda melepaskan satu jawatan. Pencabar reda dan ahli menghargai langkah itu.' },
        { id: 'b', label: 'Agihkan tugas dan beri ruang kepada pencabar (AP)', huraian: 'Meredakan api cemburu, tetapi memerlukan tenaga. Stress -8.', kesan: { ap: -4, kesetiaan: { akarUmbi: 4, ajk: 3 } }, stres: { stress: -8 }, mesej: 'Anda mengagihkan beberapa tugas. Pencabar berpuas hati buat masa ini.' },
        { id: 'c', label: 'Pertahankan semua jawatan', huraian: 'Berisiko: pencabar mungkin merampas jawatan paling rendah anda.', stres: { stress: 8 }, kesan: {}, hasil: [
            { peluang: 0.45, kesan: { ip: 5, kesetiaan: { akarUmbi: 2 } }, mesej: 'Anda mematahkan cabaran itu dan kedudukan anda kekal.' },
            { peluang: 0.55, lucut: true, kesan: { ip: -10, reputasi: -2, kesetiaan: { akarUmbi: -12, ajk: -6 } }, mesej: 'Pencabar berjaya merampas salah satu jawatan anda dan sokongan akar umbi jatuh drastik.' } ] }
      ]
    },
    {
      id: 'monopoli_jawatan_sabotaj', kategori: 'politik', krisis: true, ikon: '😒', tajuk: 'Sabotaj: "Semua Jawatan Awak Nak Ambil?"',
      syarat: function (p) { return bilJ(p) >= 3 && (Number(p.stress) || 0) >= 70; },
      berat: function (p) { return 5 + (bilJ(p) - 3) * 2 + ((Number(p.stress) || 0) - 70) / 4; },
      huraian: 'Anda memegang jawatan di Cawangan, Bahagian dan Pusat sekaligus. Ahli yang tidak dilantik mengadu bahawa kuasa dimonopoli dan mula menyabotaj mesyuarat serta memboikot program anda.',
      pilihan: [
        { id: 'a', label: 'Lepaskan jawatan peringkat paling rendah', huraian: 'Beri peluang kepada ahli cawangan. Stress -15.', lepasJawatan: 'terendah', stres: { stress: -15, kesihatan: 2 }, kesan: { kesetiaan: { akarUmbi: 6 } }, mesej: 'Anda melepaskan jawatan peringkat bawah. Ahli tempatan menyambut baik keputusan anda.' },
        { id: 'b', label: 'Bendung dengan jamuan & pujukan (Dana)', huraian: 'Kos tinggi dan meletihkan. Stress +4.', kesan: { myr: -800, kesetiaan: { akarUmbi: 3, ajk: 3 } }, stres: { stress: 4 }, mesej: 'Pujukan anda meredakan sebahagian ahli, namun anda semakin letih.' },
        { id: 'c', label: 'Abaikan dan teruskan', huraian: 'Pembangkang dalaman menang sokongan; salah satu jawatan anda dilucutkan.', lucut: true, stres: { stress: 6 }, kesan: { ip: -8, kesetiaan: { akarUmbi: -14 } }, mesej: 'Sabotaj merebak dan salah satu jawatan anda dilucutkan. Sokongan akar umbi jatuh drastik.' }
      ]
    },

    /* --- Krisis & Dilema Kepimpinan (v5.8). hanyaKrisis: hanya keluar melalui undian krisis bulanan. 2-3 pilihan, sentiasa ada satu pilihan tanpa kos. --- */
    {
      id: 'krisis_pemberontakan_akar_umbi', kategori: 'krisis', krisis: true, hanyaKrisis: true, ikon: '🔥', tajuk: 'Pemberontakan Akar Umbi',
      berat: function (p) { var ak = (p.kesetiaan && Number(p.kesetiaan.akarUmbi)) || 0; return 2 + (ak < 40 ? 3 : 0) + ((Number(p.stress) || 0) >= 60 ? 2 : 0); },
      huraian: 'Sekumpulan ketua ranting di {cawangan} mengadakan mesyuarat tergempar tanpa pengetahuan anda. Mereka mahu memboikot program anda dan menuntut perubahan kepimpinan.',
      pilihan: [
        { id: 'a', label: 'Akur tuntutan dan taja dialog terbuka (Dana + AP)', huraian: 'Mahal dan meletihkan, tetapi meredakan api. Stress +3.', kesan: { myr: -600, ap: -2, kesetiaan: { akarUmbi: 8, ketuaCawangan: 3 } }, stres: { stress: 3 }, mesej: 'Dialog terbuka meredakan keadaan. Ketua ranting kembali menyokong anda.' },
        { id: 'b', label: 'Tegur dan singkirkan penghasut', huraian: 'Berisiko. Stress +5.', stres: { stress: 5 }, kesan: {}, hasil: [
            { peluang: 0.45, kesan: { ip: 6, kesetiaan: { ajk: 4, akarUmbi: 2 } }, mesej: 'Penghasut ditegur dan kumpulan itu berpecah. Kedudukan anda diperkukuh.' },
            { peluang: 0.55, kesan: { ip: -10, reputasi: -3, kesetiaan: { akarUmbi: -14, ajk: -6 } }, mesej: 'Tindakan keras menimbulkan lebih banyak kemarahan. Pemberontakan merebak ke ranting lain.' } ] },
        { id: 'c', label: 'Abaikan, mereka akan reda sendiri', huraian: 'Tiada kos, tetapi sokongan jatuh. Stress +6.', kesan: { ip: -8, kesetiaan: { akarUmbi: -16 } }, stres: { stress: 6 }, mesej: 'Pemberontakan dibiarkan membesar. Akar umbi berasa anda tidak peduli.' }
      ]
    },
    {
      id: 'krisis_kebocoran_dana', kategori: 'krisis', krisis: true, hanyaKrisis: true, ikon: '💸', tajuk: 'Isu Kebocoran Dana',
      berat: function (p) { return 2 + (Number(p.myr) >= 3000 ? 2 : 0); },
      huraian: 'Audit dalaman mendapati RM 4,800 dana program {cawangan} tidak dapat dijelaskan. Bendahari mengaku kehilangan resit, dan khabar angin sudah sampai ke Bahagian.',
      pilihan: [
        { id: 'a', label: 'Tanggung kerugian dengan Dana sendiri', huraian: 'Selamatkan nama baik. Stress +2.', kesan: { myr: -1500, ip: 4, reputasi: 2, kesetiaan: { akarUmbi: 4 } }, etika: { modal: 3 }, stres: { stress: 2 }, mesej: 'Anda menutup kekurangan dengan wang sendiri. Ahli menghormati sikap bertanggungjawab anda.' },
        { id: 'b', label: 'Laporkan dan minta siasatan dalaman (AP)', huraian: 'Jujur tetapi memalukan buat sementara. Stress +5.', kesan: { ap: -2, ip: -4, reputasi: 3, kesetiaan: { akarUmbi: -4, ajk: 3 } }, etika: { modal: 4 }, stres: { stress: 5 }, mesej: 'Siasatan dibuka. Imej cawangan tercalar tetapi integriti anda dipuji.' },
        { id: 'c', label: 'Tutup cerita secara senyap', huraian: 'Tiada kos, tetapi sangat berisiko. Stress +4.', stres: { stress: 4 }, etika: { modal: -4, risiko: 10 }, kesan: {}, hasil: [
            { peluang: 0.5, kesan: { ip: 0 }, mesej: 'Isu itu tenggelam tanpa sesiapa menyedarinya, buat masa ini.' },
            { peluang: 0.5, kesan: { ip: -15, reputasi: -4, kesetiaan: { akarUmbi: -12, ajk: -8 } }, mesej: 'Isu bocor ke media. Anda dituduh menutup salah laku dan sokongan runtuh.' } ] }
      ]
    },
    {
      id: 'krisis_sabotaj_musuh', kategori: 'krisis', krisis: true, hanyaKrisis: true, ikon: '🕵️', tajuk: 'Sabotaj Musuh Politik',
      berat: function (p) { return 2 + Math.min(3, Math.floor((Number(p.ip) || 0) / 150)); },
      huraian: 'Surat layang dan dokumen mesyuarat dalaman anda sampai ke tangan wartawan. Pesaing politik anda dipercayai berada di sebalik kebocoran itu.',
      pilihan: [
        { id: 'a', label: 'Siasat dan dedahkan dalangnya (AP + Dana)', huraian: 'Perlukan bukti kukuh. Stress +4.', kesan: { ap: -2, myr: -400 }, stres: { stress: 4 }, hasil: [
            { peluang: 0.5, kesan: { ip: 10, reputasi: 2, kesetiaan: { ajk: 4, perwakilan: 3 } }, mesej: 'Dalang dikenal pasti dan pesaing anda malu. Sokongan kepada anda menguat.' },
            { peluang: 0.5, kesan: { ip: -6, reputasi: -2 }, mesej: 'Bukti tidak cukup. Anda dituduh membuat tuduhan melulu.' } ] },
        { id: 'b', label: 'Perkukuh barisan: tutup semua pintu bocor (AP)', huraian: 'Selamat tetapi memenatkan. Stress +3.', kesan: { ap: -2, ip: 3, kesetiaan: { ajk: 5 } }, stres: { stress: 3 }, mesej: 'Anda mengetatkan kawalan maklumat. AJK lebih bersatu, walaupun suasana tegang.' },
        { id: 'c', label: 'Buat tidak tahu', huraian: 'Tiada kos. Stress +2.', kesan: { ip: -5, kesetiaan: { perwakilan: -4 } }, stres: { stress: 2 }, mesej: 'Anda berdiam diri. Pesaing menganggap anda lemah dan terus menyerang.' }
      ]
    },
    {
      id: 'krisis_kenyataan_media', kategori: 'krisis', krisis: true, hanyaKrisis: true, ikon: '🎙️', tajuk: 'Kontroversi Kenyataan Media',
      berat: function (p) { return 2 + ((Number(p.ip) || 0) >= 100 ? 2 : 0); },
      huraian: 'Sebahagian kenyataan anda dalam sidang media dipotong dan tular. Netizen menuduh anda menghina rakyat, dan kumpulan WhatsApp ahli penuh dengan kemarahan.',
      pilihan: [
        { id: 'a', label: 'Minta maaf secara terbuka', huraian: 'Pahit tetapi ikhlas. Stress -2.', kesan: { ip: -3, reputasi: 1, kesetiaan: { akarUmbi: 4 } }, stres: { stress: -2 }, mesej: 'Permohonan maaf anda diterima ramai. Kontroversi reda dalam beberapa hari.' },
        { id: 'b', label: 'Pertahankan kenyataan dengan penjelasan penuh (AP)', huraian: 'Berisiko. Stress +4.', kesan: { ap: -2 }, stres: { stress: 4 }, hasil: [
            { peluang: 0.5, kesan: { ip: 8, reputasi: 2, kesetiaan: { akarUmbi: 3 } }, mesej: 'Klip penuh disebarkan dan ramai sedar anda dipotong di luar konteks. Sokongan naik.' },
            { peluang: 0.5, kesan: { ip: -9, reputasi: -3, kesetiaan: { akarUmbi: -8 } }, mesej: 'Penjelasan anda dianggap berdolak-dalik dan kemarahan bertambah.' } ] },
        { id: 'c', label: 'Salahkan wartawan dan netizen', huraian: 'Memuaskan hati, tetapi sokongan jatuh. Stress +3.', kesan: { ip: -8, reputasi: -3, kesetiaan: { akarUmbi: -7 } }, stres: { stress: 3 }, mesej: 'Anda menyalahkan orang lain. Ramai menganggap anda angkuh dan tidak bertanggungjawab.' }
      ]
    },
    {
      id: 'krisis_skandal_orang_kanan', kategori: 'krisis', krisis: true, hanyaKrisis: true, ikon: '📰', tajuk: 'Skandal Orang Kanan',
      berat: 2,
      huraian: 'Setiausaha politik anda didakwa menyalahgunakan nama anda untuk mengutip "sumbangan" daripada peniaga di {dun}. Media mula bertanya sama ada anda tahu.',
      pilihan: [
        { id: 'a', label: 'Pecat serta-merta dan buat laporan', huraian: 'Tegas dan bersih. Stress +3.', kesan: { ip: 2, reputasi: 2, kesetiaan: { akarUmbi: 3, ajk: -3 } }, etika: { modal: 3 }, stres: { stress: 3 }, mesej: 'Anda bertindak tegas. Imej bersih terpelihara, walaupun sebahagian AJK yang rapat dengannya kecewa.' },
        { id: 'b', label: 'Lindungi dia dan nafikan segala tuduhan', huraian: 'Tiada kos, tetapi berisiko tinggi. Stress +5.', stres: { stress: 5 }, etika: { modal: -3, risiko: 8 }, kesan: {}, hasil: [
            { peluang: 0.4, kesan: { kesetiaan: { ajk: 5 } }, mesej: 'Tuduhan tidak dapat dibuktikan dan orang kanan anda terhutang budi.' },
            { peluang: 0.6, kesan: { ip: -12, reputasi: -4, kesetiaan: { akarUmbi: -10 } }, mesej: 'Bukti baharu muncul dan anda dituduh bersubahat. Sokongan akar umbi jatuh.' } ] },
        { id: 'c', label: 'Serahkan kepada Jawatankuasa Disiplin (AP)', huraian: 'Ikut saluran rasmi. Stress +2.', kesan: { ap: -1, ip: -2, reputasi: 2, kesetiaan: { ajk: 2 } }, etika: { modal: 2 }, stres: { stress: 2 }, mesej: 'Anda menyerahkan perkara itu kepada parti. Prosesnya lambat tetapi anda dilihat adil.' }
      ]
    },
    /* --- v6.4: Peristiwa khas sayap (hanya untuk laluan sayap berkenaan) --- */
    {
      id: 'sayap_pemuda_siswazah', kategori: 'sayap', ikon: '🎓', tajuk: 'Siswazah Belia Menganggur Mengadu',
      syarat: function (p) { return sayapIni(p, 'pemuda'); }, berat: 1.5,
      huraian: 'Sekumpulan siswazah belia di {cawangan} sudah berbulan menganggur dan mengadu gaji permulaan yang ditawarkan terlalu rendah. Mereka bertanya apa yang Pemuda boleh buat untuk mereka.',
      pilihan: [
        { id: 'a', label: 'Anjur bengkel kerjaya dan temu duga (Dana + AP)', huraian: 'Kos sederhana, kesan jelas. Stress +1.', kesan: { myr: -500, ap: -1, ip: 8, kesetiaan: { akarUmbi: 5 } }, stres: { stress: 1 }, mesej: 'Bengkel itu dipenuhi belia. Beberapa orang mendapat temu duga dan nama Pemuda disebut baik.' },
        { id: 'b', label: 'Hubungi rakan korporat mencari jawatan kosong (AP)', huraian: 'Bergantung pada hubungan anda.', kesan: { ap: -2 }, hasil: [
            { peluang: 0.5, kesan: { ip: 10, reputasi: 2, kesetiaan: { akarUmbi: 5 } }, mesej: 'Dua syarikat menawarkan jawatan kosong. Belia pulang dengan harapan.' },
            { peluang: 0.5, kesan: { ip: -3 }, mesej: 'Tiada syarikat menjawab. Belia kecewa dengan hasilnya.' } ] },
        { id: 'c', label: 'Nasihatkan mereka bersabar', huraian: 'Tiada kos, tetapi mereka kecewa.', kesan: { ip: -6, kesetiaan: { akarUmbi: -6 } }, mesej: 'Belia merasakan Pemuda tidak peduli dan sebahagian mula menjauhkan diri.' }
      ]
    },
    {
      id: 'sayap_pemuda_tular', kategori: 'sayap', ikon: '📱', tajuk: 'Pengkritik Belia Tular di Media Sosial',
      syarat: function (p) { return sayapIni(p, 'pemuda'); }, berat: 1.5,
      huraian: 'Seorang penjana kandungan belia menyiarkan video yang mengkritik parti dan menuduh Pemuda hanya pandai berpidato. Video itu sudah ditonton ratusan ribu kali.',
      pilihan: [
        { id: 'a', label: 'Balas dengan video kreatif (AP)', huraian: 'Berisiko, tetapi boleh meletup.', kesan: { ap: -1 }, hasil: [
            { peluang: 0.55, kesan: { ip: 9, reputasi: 2, kesetiaan: { akarUmbi: 4 } }, mesej: 'Balasan anda disambut ramai dan ramai belia mula melihat Pemuda dengan pandangan baharu.' },
            { peluang: 0.45, kesan: { ip: -5, reputasi: -1 }, mesej: 'Balasan anda dianggap defensif dan menjadi bahan sindiran.' } ] },
        { id: 'b', label: 'Jemput pengkritik berdialog di Balai (AP)', huraian: 'Matang tetapi memenatkan. Stress +2.', kesan: { ap: -2, ip: 5, reputasi: 2, kesetiaan: { akarUmbi: 3 } }, stres: { stress: 2 }, mesej: 'Dialog berlangsung terbuka. Pengkritik itu mengakui ada isu yang wajar diperbaiki.' },
        { id: 'c', label: 'Buat laporan dan minta video diturunkan', huraian: 'Nampak lemah. Stress +2.', kesan: { ip: -7, reputasi: -2 }, stres: { stress: 2 }, mesej: 'Tindakan itu dianggap menyekat suara belia. Kemarahan bertambah.' }
      ]
    },
    {
      id: 'sayap_pemuda_gig', kategori: 'sayap', ikon: '🛵', tajuk: 'Rider dan Pekerja Gig Minta Perlindungan',
      syarat: function (p) { return sayapIni(p, 'pemuda'); }, berat: 1.5,
      huraian: 'Sekumpulan rider penghantaran dan pekerja gig belia di {dun} mahu Pemuda memperjuangkan caruman dan perlindungan kemalangan. Mereka menunggu jawapan anda.',
      pilihan: [
        { id: 'a', label: 'Tajai kursus kemahiran digital penuh (Dana)', huraian: 'Pelaburan untuk masa depan mereka.', kesan: { myr: -800, ip: 10, kesetiaan: { akarUmbi: 6 } }, mesej: 'Kursus penuh dengan peserta. Belia melihat Pemuda benar-benar membantu.' },
        { id: 'b', label: 'Rundingkan skim dengan platform gig (AP)', huraian: 'Bergantung pada kesediaan platform. Stress +2.', kesan: { ap: -2 }, stres: { stress: 2 }, hasil: [
            { peluang: 0.6, kesan: { ip: 12, reputasi: 3, kesetiaan: { akarUmbi: 5 } }, mesej: 'Platform bersetuju melancarkan skim perlindungan percubaan. Nama anda dipuji.' },
            { peluang: 0.4, kesan: { ip: -2 }, mesej: 'Rundingan buntu, tetapi anda dilihat mencuba.' } ] },
        { id: 'c', label: 'Katakan itu urusan kerajaan', huraian: 'Tiada kos.', kesan: { ip: -5, kesetiaan: { akarUmbi: -5 } }, mesej: 'Rider berasa Pemuda lepas tangan. Sokongan di kalangan mereka turun.' }
      ]
    },
    {
      id: 'sayap_puteri_gangguan', kategori: 'sayap', ikon: '🛡️', tajuk: 'Aduan Gangguan dalam Kalangan Ahli',
      syarat: function (p) { return sayapIni(p, 'puteri'); }, berat: 1.5,
      huraian: 'Seorang ahli Puteri di {cawangan} mengadu dia diganggu oleh seorang pemimpin muda. Dia takut membuat laporan rasmi, kerana pemimpin itu rapat dengan ramai AJK.',
      pilihan: [
        { id: 'a', label: 'Bela mangsa dan lapor kepada Bahagian (AP)', huraian: 'Tegas dan bersih. Stress +4.', kesan: { ap: -2, ip: -2, reputasi: 4, kesetiaan: { akarUmbi: 6, ajk: -4 } }, etika: { modal: 3 }, stres: { stress: 4 }, mesej: 'Anda berpihak kepada mangsa. Sebahagian AJK tidak senang, tetapi ahli Puteri semakin yakin kepada anda.' },
        { id: 'b', label: 'Selesaikan secara dalaman (AP)', huraian: 'Cepat, tetapi berisiko bocor. Stress +3.', kesan: { ap: -1 }, stres: { stress: 3 }, hasil: [
            { peluang: 0.5, kesan: { ip: 3, kesetiaan: { ajk: 3 } }, mesej: 'Isu diselesaikan secara senyap dan pemimpin itu dipindahkan.' },
            { peluang: 0.5, kesan: { ip: -10, reputasi: -4, kesetiaan: { akarUmbi: -8 } }, mesej: 'Isu bocor. Anda dituduh melindungi pemimpin berkenaan.' } ] },
        { id: 'c', label: 'Abaikan, takut menimbulkan masalah', huraian: 'Tiada kos, tetapi sangat memudaratkan. Stress +3.', kesan: { ip: -8, reputasi: -3, kesetiaan: { akarUmbi: -10 } }, etika: { modal: -2 }, stres: { stress: 3 }, mesej: 'Mangsa berasa ditinggalkan. Ahli Puteri mula meragui kepimpinan anda.' }
      ]
    },
    {
      id: 'sayap_puteri_geran', kategori: 'sayap', ikon: '💼', tajuk: 'Peluang Geran Usahawan Muda',
      syarat: function (p) { return sayapIni(p, 'puteri'); }, berat: 1.5,
      huraian: 'Sebuah agensi membuka geran kecil untuk usahawan perempuan muda, tetapi permohonannya rumit. Ramai ahli Puteri di {dun} berminat tetapi tidak tahu bermula dari mana.',
      pilihan: [
        { id: 'a', label: 'Tulis cadangan geran bagi sayap (AP)', huraian: 'Boleh menambah Dana sayap. Stress +2.', kesan: { ap: -2 }, stres: { stress: 2 }, hasil: [
            { peluang: 0.55, kesan: { myr: 1200, ip: 8, reputasi: 2, kesetiaan: { akarUmbi: 4 } }, mesej: 'Cadangan anda berjaya dan geran masuk. Program usahawan Puteri dapat dimulakan.' },
            { peluang: 0.45, kesan: { ip: 1 }, mesej: 'Permohonan ditolak, tetapi anda belajar banyak untuk percubaan seterusnya.' } ] },
        { id: 'b', label: 'Bantu tiga usahawan mengisi permohonan (AP)', huraian: 'Kecil tetapi bermakna.', kesan: { ap: -1, ip: 6, kesetiaan: { akarUmbi: 5 } }, mesej: 'Tiga usahawan muda mendapat bantuan permulaan. Mereka menjadi penyokong setia anda.' },
        { id: 'c', label: 'Biarkan mereka cuba sendiri', huraian: 'Tiada kos.', kesan: { ip: -3, kesetiaan: { akarUmbi: -3 } }, mesej: 'Hanya segelintir yang berjaya memohon. Peluang itu terlepas begitu sahaja.' }
      ]
    },
    {
      id: 'sayap_puteri_mental', kategori: 'sayap', ikon: '💬', tajuk: 'Ahli Muda Tertekan dan Dibuli Siber',
      syarat: function (p) { return sayapIni(p, 'puteri'); }, berat: 1.5,
      huraian: 'Beberapa ahli Puteri muda di {cawangan} dilaporkan tertekan akibat buli siber dan tekanan kerja. Seorang daripadanya berhenti hadir semua aktiviti.',
      pilihan: [
        { id: 'a', label: 'Anjur sesi sokongan rakan sebaya (Dana + AP)', huraian: 'Selamat dan mesra. Stress -2.', kesan: { myr: -300, ap: -1, ip: 7, kesetiaan: { akarUmbi: 6 } }, stres: { stress: -2 }, mesej: 'Sesi itu menjadi ruang selamat. Ahli yang menyepi mula kembali hadir.' },
        { id: 'b', label: 'Rujuk kepada kaunselor profesional (Dana)', huraian: 'Lebih berkesan, tetapi mahal.', kesan: { myr: -700, ip: 9, reputasi: 2, kesetiaan: { akarUmbi: 4 } }, etika: { modal: 2 }, mesej: 'Kaunselor memberi bantuan kepada beberapa ahli. Program itu dipuji dan dicontohi cawangan lain.' },
        { id: 'c', label: 'Anggap itu masalah peribadi', huraian: 'Tiada kos.', kesan: { ip: -5, kesetiaan: { akarUmbi: -6 } }, mesej: 'Ahli muda berasa tidak difahami. Sebahagiannya berhenti menyertai Puteri.' }
      ]
    },
    {
      id: 'sayap_wanita_penjaga', kategori: 'sayap', ikon: '🧓', tajuk: 'Penjaga Warga Emas Meminta Bantuan',
      syarat: function (p) { return sayapIni(p, 'wanita'); }, berat: 1.5,
      huraian: 'Ramai ahli Wanita di {cawangan} menjaga ibu bapa yang uzur dan tidak mampu bekerja. Mereka meluahkan keletihan dan bertanya adakah parti boleh membantu.',
      pilihan: [
        { id: 'a', label: 'Wujudkan pusat jagaan harian sukarela (Dana + AP)', huraian: 'Beban berat tetapi bermakna. Stress +2.', kesan: { myr: -500, ap: -1, ip: 8, kesetiaan: { akarUmbi: 7 } }, stres: { stress: 2 }, mesej: 'Pusat jagaan itu menjadi sandaran keluarga. Ahli Wanita menghargai usaha anda.' },
        { id: 'b', label: 'Rujuk Jabatan Kebajikan dan uruskan permohonan (AP)', huraian: 'Perlukan kesabaran.', kesan: { ap: -2, ip: 5, reputasi: 2, kesetiaan: { akarUmbi: 4 } }, mesej: 'Beberapa keluarga mendapat bantuan bulanan. Anda dikenali sebagai pemimpin yang prihatin.' },
        { id: 'c', label: 'Nasihatkan mereka bersabar', huraian: 'Tiada kos.', kesan: { ip: -5, kesetiaan: { akarUmbi: -6 } }, mesej: 'Ahli merasakan keluh-kesah mereka tidak didengari.' }
      ]
    },
    {
      id: 'sayap_wanita_dapur', kategori: 'sayap', ikon: '🛒', tajuk: 'Harga Barang Dapur Naik Mendadak',
      syarat: function (p) { return sayapIni(p, 'wanita'); }, berat: 1.5,
      huraian: 'Harga ayam, telur dan minyak masak melonjak. Ibu rumah di {dun} menyerbu pejabat Wanita bertanya apa yang parti boleh lakukan.',
      pilihan: [
        { id: 'a', label: 'Anjur jualan murah bersama peniaga (Dana)', huraian: 'Bantuan segera yang dilihat jelas.', kesan: { myr: -900, ip: 10, reputasi: 1, kesetiaan: { akarUmbi: 8 } }, mesej: 'Jualan murah sesak dengan pembeli. Wanita dipuji kerana turun padang.' },
        { id: 'b', label: 'Bawa isu ini kepada ADUN dan pegawai harga (AP)', huraian: 'Bergantung pada tindak balas mereka. Stress +2.', kesan: { ap: -2 }, stres: { stress: 2 }, hasil: [
            { peluang: 0.55, kesan: { ip: 9, reputasi: 2, kesetiaan: { akarUmbi: 4 } }, mesej: 'Pemantauan harga diperketatkan dan peniaga nakal ditegur.' },
            { peluang: 0.45, kesan: { ip: -1 }, mesej: 'Aduan itu hanya dicatat tanpa tindakan.' } ] },
        { id: 'c', label: 'Katakan harga di luar kawalan parti', huraian: 'Tiada kos.', kesan: { ip: -6, kesetiaan: { akarUmbi: -7 } }, mesej: 'Ibu rumah merasakan Wanita tidak berguna ketika mereka paling memerlukan.' }
      ]
    },
    {
      id: 'sayap_wanita_saringan', kategori: 'sayap', ikon: '🩺', tajuk: 'Kempen Saringan Kesihatan Wanita',
      syarat: function (p) { return sayapIni(p, 'wanita'); }, berat: 1.5,
      huraian: 'Seorang ahli Wanita di {cawangan} disahkan menghidap kanser peringkat awal selepas saringan yang lewat. Ahli lain mula meminta kempen saringan dianjurkan.',
      pilihan: [
        { id: 'a', label: 'Anjur kempen saringan percuma (Dana + AP)', huraian: 'Kos tinggi, nama baik tinggi. Stress +2.', kesan: { myr: -600, ap: -2, ip: 10, reputasi: 3, kesetiaan: { akarUmbi: 6 } }, stres: { stress: 2 }, mesej: 'Ratusan wanita hadir untuk saringan. Beberapa kes awal dikesan dan anda menerima ucapan terima kasih.' },
        { id: 'b', label: 'Sertai kempen yang dianjurkan klinik (AP)', huraian: 'Murah dan mudah.', kesan: { ap: -1, ip: 6, kesetiaan: { akarUmbi: 3 } }, mesej: 'Wanita menjadi rakan program klinik. Kehadiran memuaskan.' },
        { id: 'c', label: 'Tangguh ke tahun depan', huraian: 'Tiada kos.', kesan: { ip: -3, kesetiaan: { akarUmbi: -3 } }, mesej: 'Ahli kecewa kerana kempen ditangguhkan.' }
      ]
    },
    /* --- v6.4: Krisis khas Ketua sayap (pemegang jawatan Ketua sayap sahaja) --- */
    {
      id: 'krisis_sayap_pemuda_himpunan', kategori: 'krisis', krisis: true, hanyaKrisis: true, ikon: '🔥', tajuk: 'Himpunan Belia Hampir Tidak Terkawal',
      syarat: function (p) { return ketuaSayap(p, 'pemuda'); }, berat: 4,
      huraian: 'Himpunan belia anjuran Pemuda di {dun} menjadi tegang apabila sekumpulan belia mula memprovokasi pihak lawan. Polis memerhati dan kamera media sudah menyala.',
      pilihan: [
        { id: 'a', label: 'Henti program dan minta polis kawal (AP)', huraian: 'Selamat tetapi mengecewakan. Stress +4.', kesan: { ap: -2, ip: -3, reputasi: 1, kesetiaan: { akarUmbi: -2 } }, stres: { stress: 4 }, mesej: 'Himpunan dibubarkan tanpa kecederaan. Sebahagian belia kecewa tetapi imej Pemuda terpelihara.' },
        { id: 'b', label: 'Turun sendiri menenangkan belia (AP)', huraian: 'Berisiko, tetapi menunjukkan kepimpinan. Stress +5.', kesan: { ap: -2 }, stres: { stress: 5 }, hasil: [
            { peluang: 0.6, kesan: { ip: 10, reputasi: 2, kesetiaan: { akarUmbi: 5, perwakilan: 3 } }, mesej: 'Belia mendengar kata-kata anda dan keadaan reda. Kepimpinan anda dipuji.' },
            { peluang: 0.4, kesan: { ip: -10, reputasi: -3, kesetiaan: { akarUmbi: -6 } }, mesej: 'Belia tidak mendengar kata anda. Insiden itu tular dan anda dipersalahkan.' } ] },
        { id: 'c', label: 'Biarkan, mereka hanya bersemangat', huraian: 'Tiada kos, tetapi sangat berisiko. Stress +3.', kesan: { ip: -12, reputasi: -3, kesetiaan: { akarUmbi: -8, perwakilan: -4 } }, stres: { stress: 3 }, mesej: 'Keadaan menjadi kecoh dan Pemuda dipersalahkan oleh Bahagian dan media.' }
      ]
    },
    {
      id: 'krisis_sayap_puteri_kuota', kategori: 'krisis', krisis: true, hanyaKrisis: true, ikon: '📣', tajuk: 'Puteri Tuntut Kuota Calon, Ancam Boikot',
      syarat: function (p) { return ketuaSayap(p, 'puteri'); }, berat: 4,
      huraian: 'Ahli Puteri menuduh Bahagian mengabaikan kuota calon perempuan muda. Sebahagian mengancam memboikot jentera pilihan raya jika tuntutan itu tidak dipenuhi.',
      pilihan: [
        { id: 'a', label: 'Bawa tuntutan ke mesyuarat Bahagian (AP)', huraian: 'Bergantung pada sambutan Bahagian. Stress +3.', kesan: { ap: -2 }, stres: { stress: 3 }, hasil: [
            { peluang: 0.55, kesan: { ip: 10, reputasi: 3, kesetiaan: { akarUmbi: 4, perwakilan: 3 } }, mesej: 'Bahagian bersetuju mengkaji kuota. Puteri melihat anda sebagai pejuang mereka.' },
            { peluang: 0.45, kesan: { ip: -4, kesetiaan: { ajk: -3 } }, mesej: 'Tuntutan itu ditolak buat sementara. Suasana tegang di Bahagian.' } ] },
        { id: 'b', label: 'Pujuk ahli supaya bersabar', huraian: 'Tiada kos. Stress +2.', kesan: { ip: -3, kesetiaan: { akarUmbi: -5 } }, stres: { stress: 2 }, mesej: 'Sebahagian ahli menerima, tetapi ramai merasakan suara mereka diperkecilkan.' },
        { id: 'c', label: 'Sokong boikot secara terbuka', huraian: 'Garang, dan tegang dengan Bahagian. Stress +4.', kesan: { ip: -12, reputasi: -3, kesetiaan: { ajk: -8, perwakilan: -4 } }, stres: { stress: 4 }, mesej: 'Hubungan anda dengan Bahagian memburuk. Sebahagian ahli menyokong, tetapi ramai menganggap anda melampaui batas.' }
      ]
    },
    {
      id: 'krisis_sayap_wanita_senior', kategori: 'krisis', krisis: true, hanyaKrisis: true, ikon: '👵', tajuk: 'Ahli Senior Wanita Kecewa, Ugut Keluar',
      syarat: function (p) { return ketuaSayap(p, 'wanita'); }, berat: 4,
      huraian: 'Sekumpulan ahli Wanita warga emas kecewa kerana program sayap kini lebih menumpukan anak muda. Mereka mengugut untuk meninggalkan parti dan membawa pengikut bersama.',
      pilihan: [
        { id: 'a', label: 'Jumpa dan dengar luahan mereka (AP)', huraian: 'Perlukan kesabaran. Stress +3.', kesan: { ap: -2, ip: 4, kesetiaan: { akarUmbi: 6 } }, stres: { stress: 3 }, mesej: 'Mereka berasa dihargai dan bersetuju memberi anda peluang.' },
        { id: 'b', label: 'Anjur program khas untuk ahli senior (Dana)', huraian: 'Tunjukkan sikap prihatin.', kesan: { myr: -700, ip: 6, reputasi: 1, kesetiaan: { akarUmbi: 8 } }, mesej: 'Program itu meriah. Ahli senior kembali menyokong dan ramai membawa rakan baharu.' },
        { id: 'c', label: 'Biarkan, parti perlukan darah muda', huraian: 'Tiada kos. Stress +2.', kesan: { ip: -10, kesetiaan: { akarUmbi: -12, perwakilan: -3 } }, stres: { stress: 2 }, mesej: 'Sebahagian ahli senior keluar dan membawa pengikut mereka bersama.' }
      ]
    }

  ];

  /* ------------------------------------------------------------------------
     STATE (localStorage, berasingan daripada profil)
     ------------------------------------------------------------------------ */
  function storan() { try { return root.localStorage || null; } catch (e) { return null; } }
  var memori = null;            // sandaran jika localStorage tidak tersedia

  function lalai() { return { pemilik: '', sejarah: [], tertunggak: null, kiraBulan: {}, bil: 0, krisisTerakhir: 0 }; }
  function muat() {
    var s = storan(), d = null;
    if (s) { try { d = JSON.parse(s.getItem(KEY)); } catch (e) { d = null; } }
    else { d = memori; }
    if (!d || typeof d !== 'object') { d = lalai(); }
    d.sejarah = Array.isArray(d.sejarah) ? d.sejarah : [];
    d.kiraBulan = d.kiraBulan && typeof d.kiraBulan === 'object' ? d.kiraBulan : {};
    return d;
  }
  function simpan(d) {
    memori = d;
    var s = storan();
    if (s) { try { s.setItem(KEY, JSON.stringify(d)); } catch (e) { /* abaikan */ } }
  }
  /** State dipadankan dengan pemain semasa; jika pemain baharu, mula semula. */
  function muatUntuk(p) {
    var d = muat(), pemilik = p ? String(p.nama || '') + '|' + String(p.cawangan || '') : '';
    if (d.pemilik !== pemilik) { d = lalai(); d.pemilik = pemilik; simpan(d); }
    return d;
  }
  function reset() {
    memori = null;
    var s = storan();
    if (s) { try { s.removeItem(KEY); } catch (e) { /* abaikan */ } }
  }

  /* ------------------------------------------------------------------------
     PEMBANTU
     ------------------------------------------------------------------------ */
  function salin(o) { return JSON.parse(JSON.stringify(o)); }
  function def(id) { for (var i = 0; i < ACARA.length; i++) { if (ACARA[i].id === id) { return ACARA[i]; } } return null; }
  function isi(teks, p) {
    return String(teks || '')
      .replace(/\{cawangan\}/g, p.cawangan || 'anda')
      .replace(/\{bahagian\}/g, p.bahagian || 'anda')
      .replace(/\{dun\}/g, p.dun || 'kawasan anda');
  }
  function beratAcara(a, p) {
    if (a.syarat && !a.syarat(p)) { return 0; }
    var b = typeof a.berat === 'function' ? a.berat(p) : (a.berat == null ? 1 : a.berat);
    return b > 0 ? b : 0;
  }
  function kosPilihan(k) { return { ap: Math.abs(Math.min(0, k.ap || 0)), myr: Math.abs(Math.min(0, k.myr || 0)) }; }

  function bina(a, p, uid) {
    return {
      uid: uid, id: a.id, kategori: a.kategori, ikon: a.ikon, krisis: !!a.krisis,
      tajuk: a.tajuk, huraian: isi(a.huraian, p),
      bulan: p.bulan, tahun: p.tahun
    };
  }
  /** Sifat pilihan (boleh/sebab/ringkas) dikira semasa dipaparkan, ikut sumber semasa. */
  function huraikanPilihan(acara, p) {
    var a = def(acara.id);
    if (!a) { return []; }
    return a.pilihan.map(function (c) {
      var kos = kosPilihan(c.kesan || {}), boleh = true, sebab = '';
      if (p.ap < kos.ap) { boleh = false; sebab = 'AP tidak mencukupi (perlu ' + kos.ap + ').'; }
      else if (p.myr < kos.myr) { boleh = false; sebab = 'Dana tidak mencukupi (perlu RM ' + kos.myr + ').'; }
      var ringkas = S.ringkasPerubahan({ ip: (c.kesan || {}).ip || 0, myr: (c.kesan || {}).myr || 0, ap: (c.kesan || {}).ap || 0, reputasi: (c.kesan || {}).reputasi || 0, kesetiaan: (c.kesan || {}).kesetiaan || {} });
      return { id: c.id, label: c.label, huraian: c.huraian || '', ringkas: ((ringkas || '') + (c.stres && c.stres.stress ? (ringkas ? ', ' : '') + 'Stress ' + (c.stres.stress > 0 ? '+' : '') + c.stres.stress : '') + ((c.lepasJawatan || c.lucut) ? (ringkas || (c.stres && c.stres.stress) ? ', ' : '') + (c.lucut ? 'Jawatan dilucutkan' : 'Lepas jawatan') : '')) || 'Tiada kos', berisiko: !!c.hasil, kos: kos, boleh: boleh, sebab: sebab };
    });
  }
  function papar(acara, p) {
    var o = salin(acara);
    o.pilihan = huraikanPilihan(acara, p);
    return o;
  }

  /* ------------------------------------------------------------------------
     JANA ACARA
     opts: { pencetus:'bulan'|'aktiviti', rng, paksa:idAcara, abaikanPeluang }
     Pulang acara siap paparan, atau null (tiada acara kali ini).
     ------------------------------------------------------------------------ */
  function janaAcara(opts) {
    opts = opts || {};
    var p = S.loadPlayer();
    if (!p) { return null; }
    var rng = opts.rng || Math.random, d = muatUntuk(p);
    if (d.tertunggak) { return papar(d.tertunggak, p); }          // satu acara pada satu masa

    var wajib = !opts.paksa ? ACARA.filter(function (x) { return beratAcara(x, p) >= 1000; })[0] : null;   // cth. pendengaran disiplin
    if (wajib) { opts.paksa = wajib.id; }
    var kunciBulan = p.tahun + '-' + p.bulan;
    if (opts.pencetus === 'aktiviti' && (d.kiraBulan[kunciBulan] || 0) >= CONFIG.MAKS_AKTIVITI_SEBULAN) { return null; }
    var a = null;
    var indeksBulan = p.tahun * 12 + p.bulan, adaJawatan = p.jawatan && p.jawatan !== 'Ahli Biasa';
    if (!opts.paksa && opts.pencetus !== 'aktiviti') {                 // v5.8: undian krisis bulanan (pemegang jawatan sahaja)
      var layakKrisis = adaJawatan && (opts.krisis === true || (!opts.abaikanPeluang && indeksBulan - (d.krisisTerakhir || 0) >= CONFIG.KRISIS_JARAK_BULAN && rng() < CONFIG.PELUANG_KRISIS));
      if (layakKrisis) {
        var kolam = ACARA.filter(function (x) { return x.krisis && d.sejarah.slice(-CONFIG.ELAK_ULANG).indexOf(x.id) < 0 && beratAcara(x, p) > 0; });
        if (!kolam.length) { kolam = ACARA.filter(function (x) { return x.krisis && beratAcara(x, p) > 0; }); }
        if (kolam.length) {
          var jk = kolam.reduce(function (n, x) { return n + beratAcara(x, p); }, 0), tk = rng() * jk;
          for (var k = 0; k < kolam.length; k++) { tk -= beratAcara(kolam[k], p); if (tk < 0) { a = kolam[k]; break; } }
          a = a || kolam[kolam.length - 1]; d.krisisTerakhir = indeksBulan;
        }
      }
    }
    if (!a && !opts.paksa && !opts.abaikanPeluang) {                   // acara biasa: peluang bulanan / aktiviti
      var peluang = opts.pencetus === 'aktiviti' ? CONFIG.PELUANG_AKTIVITI : CONFIG.PELUANG_BULAN;
      if (rng() >= peluang) { return null; }
    }
    if (a) { /* krisis dipilih */ }
    else if (opts.paksa) { a = def(opts.paksa); if (!a) { return null; } }
    else {
      var calon = ACARA.filter(function (x) { return !x.hanyaKrisis && d.sejarah.slice(-CONFIG.ELAK_ULANG).indexOf(x.id) < 0 && beratAcara(x, p) > 0; });
      if (!calon.length) { calon = ACARA.filter(function (x) { return !x.hanyaKrisis && beratAcara(x, p) > 0; }); }
      var jumlah = calon.reduce(function (n, x) { return n + beratAcara(x, p); }, 0), t = rng() * jumlah;
      for (var i = 0; i < calon.length; i++) { t -= beratAcara(calon[i], p); if (t < 0) { a = calon[i]; break; } }
      a = a || calon[calon.length - 1];
    }

    d.bil += 1;
    var inst = bina(a, p, 'ev' + d.bil + '-' + a.id);
    d.tertunggak = inst;
    d.sejarah.push(a.id); d.sejarah = d.sejarah.slice(-20);
    if (opts.pencetus === 'aktiviti') { d.kiraBulan[kunciBulan] = (d.kiraBulan[kunciBulan] || 0) + 1; }
    simpan(d);
    return papar(inst, p);
  }

  /** Cuba cetus acara selepas aktiviti. Pulang acara atau null. */
  function selepasAktiviti(opts) {
    opts = opts || {}; opts.pencetus = 'aktiviti'; return janaAcara(opts);
  }

  function getTertunggak() {
    var p = S.loadPlayer();
    if (!p) { return null; }
    var d = muatUntuk(p);
    return d.tertunggak ? papar(d.tertunggak, p) : null;
  }

  /* ------------------------------------------------------------------------
     PILIH TINDAKAN
     Pulang { ok, mesej, ringkas, perubahan, acara, pilihan, berisiko } atau { ok:false, ralat }
     ------------------------------------------------------------------------ */
  function pilih(idPilihan, opts) {
    opts = opts || {};
    var p = S.loadPlayer();
    if (!p) { return { ok: false, kod: 'tiada_profil', ralat: 'Tiada profil pemain.' }; }
    var d = muatUntuk(p), t = d.tertunggak;
    if (!t) { return { ok: false, kod: 'tiada_acara', ralat: 'Tiada acara yang menunggu keputusan.' }; }
    var a = def(t.id), c = null;
    for (var i = 0; a && i < a.pilihan.length; i++) { if (a.pilihan[i].id === idPilihan) { c = a.pilihan[i]; break; } }
    if (!c) { return { ok: false, kod: 'pilihan', ralat: 'Pilihan tidak sah.' }; }

    var rng = opts.rng || Math.random, kesan = salin(c.kesan || {}), mesej = c.mesej || '', lucutHasil = false;
    if (c.hasil && c.hasil.length) {                              // keputusan berisiko
      var r = rng(), kum = 0, pilihanHasil = c.hasil[c.hasil.length - 1];
      for (var j = 0; j < c.hasil.length; j++) { kum += c.hasil[j].peluang; if (r < kum) { pilihanHasil = c.hasil[j]; break; } }
      var h = pilihanHasil.kesan || {};
      ['ip', 'myr', 'ap', 'reputasi'].forEach(function (k) { if (h[k]) { kesan[k] = (kesan[k] || 0) + h[k]; } });
      if (h.kesetiaan) { kesan.kesetiaan = kesan.kesetiaan || {}; for (var n in h.kesetiaan) { kesan.kesetiaan[n] = (kesan.kesetiaan[n] || 0) + h.kesetiaan[n]; } }
      mesej = pilihanHasil.mesej || mesej; lucutHasil = !!pilihanHasil.lucut;
    }

    var Et = etika(), eo = Et && c.etika ? Et.selepasAcara(p, c.etika, { rng: rng }) : null;
    var res = S.applyEffects(kesan, {
      kiraTindakan: false,
      patch: eo ? { etika: eo.etika } : undefined,
      log: { tindakan: 'acara:' + t.id, acara: t.tajuk, pilihan: c.label }
    });
    if (!res.ok) { return { ok: false, kod: res.kod, ralat: res.ralat }; }   // cth AP/Dana tidak cukup: acara kekal menunggu
    var STr = root.MyPolitikStres || (typeof require === 'function' ? (function () { try { return require('./stress.js'); } catch (e) { return null; } })() : null);
    if (STr) {                                                    // v5.6: kesan Stress/Kesihatan dan melepaskan jawatan
      if (c.lepasJawatan) { var lp = STr.lepasJawatan(c.lepasJawatan === 'terendah' ? { terendah: true } : undefined); if (lp && lp.jawatanLama) { mesej += ' (Dilepaskan: ' + lp.jawatanLama + '.)'; } }
      if (c.lucut || lucutHasil) { var lc = STr.lucutJawatan(); if (lc && lc.jawatanLama) { mesej += ' (Dilucutkan: ' + lc.jawatanLama + '.)'; } }
      if (c.stres) { STr.laras(c.stres); }
    }
    if (Et && c.pendengaran) { Et.responsPendengaran(c.pendengaran); }
    if (eo && eo.mesej) { mesej += eo.mesej; }

    d.tertunggak = null; simpan(d);
    return {
      ok: true, mesej: mesej, perubahan: res.perubahan,
      ringkas: [S.ringkasPerubahan(res.perubahan), c.stres && c.stres.stress ? 'Stress ' + (c.stres.stress > 0 ? '+' : '') + c.stres.stress : ''].filter(Boolean).join(', ') || 'Tiada perubahan sumber',
      acara: { id: t.id, tajuk: t.tajuk, ikon: t.ikon }, pilihan: { id: c.id, label: c.label }, berisiko: !!c.hasil
    };
  }

  /** Buang acara tertunggak tanpa kesan (cth. untuk ujian). */
  function buangTertunggak() { var p = S.loadPlayer(), d = muatUntuk(p); d.tertunggak = null; simpan(d); }

  return {
    KEY: KEY, CONFIG: CONFIG,
    senaraiAcara: function () { return ACARA.map(function (a) { return { id: a.id, kategori: a.kategori, tajuk: a.tajuk }; }); },
    janaAcara: janaAcara,
    selepasAktiviti: selepasAktiviti,
    getTertunggak: getTertunggak,
    pilih: pilih,
    buangTertunggak: buangTertunggak,
    reset: reset
  };
});
