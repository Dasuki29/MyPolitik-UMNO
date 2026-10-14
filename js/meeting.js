/* ==========================================================================
   Nusa Politik — js/meeting.js
   Simulasi Mesyuarat Tahunan dan Usul.

   Peringkat dalam satu tahun, mengikut urutan:
     1. Mesyuarat Cawangan   Usul Lokaliti. Pada tahun pemilihan: undi 5 perwakilan ke Bahagian.
     1b. Mesyuarat Sayap     (v6.0) Bulan 5-6, sebelum Bahagian. Hanya laluan sayap (Pemuda / Puteri / Wanita).
                             Usul isu golongan sayap itu. Tiada pemilihan (jawatan sayap dipilih dalam mesyuarat lain).
     2. Mesyuarat Bahagian   Usul Kerusi PRU / Politik. Pada tahun pemilihan: undi 10 perwakilan ke PAU.
     3. PAU                  Usul Dasar Nasional dan Ucapan Dasar.

   Bagi setiap usul pemain memilih satu peranan:
     Pembawa Usul   membawa usul (kos 2 AP). Kredit penuh dan risiko terbesar.
     Pembahas       berbahas menyokong atau membantah (kos 1 AP).
     Mengundi       mengundi sokong, bantah atau berkecuali (percuma).
   Peranan, pendirian, pengaruh (IP) dan sokongan menentukan sama ada usul lulus
   serta perubahan IP dan Reputasi Parti pemain.

   Hanya perwakilan yang dipilih (atau pemegang jawatan yang berkaitan) menghadiri
   mesyuarat Bahagian dan PAU. Usul Lokaliti mengambil isu daripada Sembang Warung.

   Disimpan dalam profil.mesyuarat (localStorage) melalui MyPolitikSave.applyEffects().
   Perlu dimuatkan selepas js/save.js. js/election.js adalah pilihan tetapi diperlukan
   untuk pemilihan perwakilan dan penentuan kelayakan hadir.

   Cara guna dalam dashboard.html:
     var M = MyPolitikMeeting;
     M.getKeadaanMesyuarat();                       // status tiga peringkat
     M.mulaMesyuarat('cawangan');                   // jana agenda
     M.pilihPeranan('cawangan', usulId, 'pembawa'); // 'pembahas' + 'sokong', 'undi' + 'bantah'
     M.tutupMesyuarat('cawangan');                  // selesaikan baki dan pemilihan perwakilan
   ========================================================================== */
(function (root, factory) {
  function muat(fail, nama) {
    if (root[nama]) { return root[nama]; }
    if (typeof module === 'object' && typeof require === 'function') {
      try { return require('./' + fail); } catch (e) { return null; }
    }
    return null;
  }
  var S = muat('save.js', 'MyPolitikSave');
  if (!S) { throw new Error('meeting.js memerlukan js/save.js dimuatkan dahulu.'); }
  var E = muat('election.js', 'MyPolitikElection');   // pilihan
  var J = muat('jawatan.js', 'MyPolitikJawatan');     // pilihan (v3.0: pegangan berbilang, perwakilan tahunan)
  var api = factory(S, E, J);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikMeeting = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (S, E, J) {
  'use strict';

  var CONFIG = {
    BIL_USUL: 3,
    ASAS_LULUS: 50,                                   // sokongan (0 hingga 100) untuk lulus
    SISIHAN_RAWAK: 8,
    KOS_AP: { pembawa: 2, pembahas: 1, undi: 0 },
    KREDIT: { pembawa: 1, pembahas: 0.5, undi: 0.25 }, // bahagian kredit Reputasi Parti
    GANJARAN_IP: {
      pembawa: { lulus: 12, ditolak: -4 },
      pembahas: { padan: 6, tidakPadan: 2 },
      undi: { padan: 2, tidakPadan: 0 }
    },
    HADIR: { cawangan: null, sayap_cawangan: null, sayap_bahagian: 60, sayap_pau: 300, bahagian: 125, pau: 1500 },
    TAHAP_HADIR_SAYAP: 0.2,                           // kehadiran sayap = 20% ahli cawangan, minimum 20 // pengundi simulasi (cawangan = 35% ahli, min 30)
    TAHAP_HADIR_CAWANGAN: 0.35
  };

  // v6.1: setiap peringkat utama didahului mesyuarat sayap yang membawa SATU usul ke mesyuarat utama (laluan sayap sahaja).
  var URUTAN = ['sayap_cawangan', 'cawangan', 'sayap_bahagian', 'bahagian', 'sayap_pau', 'pau'];
  var INDUK = { sayap_cawangan: 'cawangan', sayap_bahagian: 'bahagian', sayap_pau: 'pau' };      // sayap -> mesyuarat utama
  var SAYAP_UNTUK = { cawangan: 'sayap_cawangan', bahagian: 'sayap_bahagian', pau: 'sayap_pau' };
  function adalahSayap(k) { return !!INDUK[k]; }

  var PERINGKAT = {
    cawangan: { kod: 'cawangan', nama: 'Mesyuarat Cawangan', jenisUsul: 'Usul Lokaliti', kesetiaan: ['akarUmbi', 'ketuaCawangan'], perwakilan: { kerusi: 5, ke: 'Bahagian', kod: 'perwakilan_cawangan' } },
    sayap_cawangan: { kod: 'sayap_cawangan', nama: 'Mesyuarat Sayap Cawangan', jenisUsul: 'Usul Isu Golongan Sayap', kesetiaan: ['akarUmbi', 'ajk'], perwakilan: null, sayapSahaja: true },
    sayap_bahagian: { kod: 'sayap_bahagian', nama: 'Mesyuarat Sayap Bahagian', jenisUsul: 'Usul Isu Golongan Sayap', kesetiaan: ['perwakilan'], perwakilan: null, sayapSahaja: true },
    sayap_pau: { kod: 'sayap_pau', nama: 'Perhimpunan Sayap (Pra-PAU)', jenisUsul: 'Usul Isu Golongan Sayap', kesetiaan: ['perwakilan'], perwakilan: null, sayapSahaja: true },
    bahagian: { kod: 'bahagian', nama: 'Mesyuarat Bahagian', jenisUsul: 'Usul Kerusi PRU dan Politik', kesetiaan: ['perwakilan'], perwakilan: { kerusi: 10, ke: 'PAU', kod: 'perwakilan_bahagian' } },
    pau: { kod: 'pau', nama: 'Perhimpunan Agung UMNO (PAU)', jenisUsul: 'Usul Dasar Nasional', kesetiaan: ['perwakilan'], perwakilan: null, pusat: true }
  };

  /* ------------------------------------------------------------------------
     1. KOLAM USUL
     populariti: sokongan asas (0 hingga 100). nilai: kesan pada Reputasi Parti jika diluluskan.
     ------------------------------------------------------------------------ */
  var KOLAM = {
    cawangan: [
      { kod: 'jalan_longkang',  tajuk: 'Baik pulih jalan dan longkang kawasan lokaliti', penerangan: 'Memohon peruntukan segera bagi jalan berlubang dan longkang tersumbat.', populariti: 70, nilai: 3 },
      { kod: 'dewan_surau',     tajuk: 'Naik taraf dewan komuniti dan surau', penerangan: 'Membaiki bumbung dan kemudahan asas untuk kegunaan majlis dan kenduri.', populariti: 65, nilai: 2 },
      { kod: 'latihan_belia',   tajuk: 'Program latihan kemahiran untuk belia lokaliti', penerangan: 'Bekerjasama dengan institusi latihan bagi belia yang menganggur.', populariti: 60, nilai: 4 },
      { kod: 'bantuan_warga',   tajuk: 'Bantuan bulanan tambahan untuk warga emas', penerangan: 'Menyalurkan bantuan kepada warga emas yang tinggal bersendirian.', populariti: 62, nilai: 3 },
      { kod: 'lampu_cctv',      tajuk: 'Pasang lampu jalan dan CCTV di taman perumahan', penerangan: 'Mengurangkan kes kecurian dan meningkatkan keselamatan.', populariti: 66, nilai: 3 },
      { kod: 'naik_yuran',      tajuk: 'Naikkan yuran keahlian cawangan', penerangan: 'Menaikkan yuran bagi menampung kos aktiviti cawangan.', populariti: 30, nilai: -3 },
      { kod: 'sumbangan_wajib', tajuk: 'Wajibkan sumbangan dana tahunan setiap ahli', penerangan: 'Setiap ahli diwajibkan menyumbang kepada dana kempen cawangan.', populariti: 28, nilai: -4 },
      { kod: 'had_gerai',       tajuk: 'Hadkan waktu operasi gerai malam', penerangan: 'Gerai ditutup awal bagi mengurangkan aduan kebisingan.', populariti: 35, nilai: -2 }
    ],
    bahagian: [
      { kod: 'calon_muda',      tajuk: 'Tampilkan calon muda untuk kerusi PRU bahagian', penerangan: 'Memberi ruang kepada pemimpin muda yang aktif di peringkat cawangan.', populariti: 55, nilai: 4 },
      { kod: 'kerusi_adil',     tajuk: 'Tuntut rundingan agihan kerusi PRU yang adil dalam gabungan', penerangan: 'Bahagian mahu pendirian jelas mengenai agihan kerusi sebelum PRU.', populariti: 60, nilai: 2 },
      { kod: 'pusat_khidmat',   tajuk: 'Wujudkan pusat khidmat penduduk di setiap DUN', penerangan: 'Pusat khidmat tetap untuk aduan dan bantuan penduduk.', populariti: 68, nilai: 4 },
      { kod: 'jentera_cawangan', tajuk: 'Mantapkan jentera pilihan raya peringkat cawangan', penerangan: 'Latihan dan pemetaan pengundi dibuat lebih awal.', populariti: 64, nilai: 3 },
      { kod: 'calon_luar',      tajuk: 'Terima calon luar bahagian untuk kerusi DUN', penerangan: 'Calon dibawa dari luar walaupun ada pemimpin setempat.', populariti: 32, nilai: -3 },
      { kod: 'kempen_awal',     tajuk: 'Mulakan kempen PRU 18 bulan lebih awal', penerangan: 'Kempen awal berisiko meletihkan jentera dan membazir dana.', populariti: 40, nilai: -1 }
    ],
    pau: [
      { kod: 'sara_hidup',      tajuk: 'Bantuan sara hidup bersasar untuk isi rumah berpendapatan rendah', penerangan: 'Bantuan diberi kepada kumpulan yang paling terkesan oleh kos sara hidup.', populariti: 70, nilai: 4 },
      { kod: 'latihan_teknikal', tajuk: 'Perluas biasiswa dan latihan teknikal untuk anak muda', penerangan: 'Menambah tempat latihan teknikal dan biasiswa di luar bandar.', populariti: 66, nilai: 4 },
      { kod: 'rumah_belia',     tajuk: 'Skim pemilikan rumah mampu milik untuk belia', penerangan: 'Skim pembiayaan dengan bayaran awal rendah untuk pembeli pertama.', populariti: 64, nilai: 3 },
      { kod: 'digital_luar',    tajuk: 'Pendigitalan perkhidmatan kerajaan di luar bandar', penerangan: 'Menambah akses internet dan kaunter digital di kawasan luar bandar.', populariti: 62, nilai: 3 },
      { kod: 'had_tempoh',      tajuk: 'Had tempoh memegang jawatan utama parti', penerangan: 'Pemegang jawatan utama dihadkan kepada dua penggal berturut-turut.', populariti: 45, nilai: 2 },
      { kod: 'cukai_baharu',    tajuk: 'Perkenalkan cukai baharu bagi menampung subsidi', penerangan: 'Cukai baharu dicadang untuk membiayai bantuan, dengan risiko bantahan awam.', populariti: 30, nilai: -3 }
    ],
    /* v6.0: usul isu golongan bagi Mesyuarat Sayap. Setiap sayap membincangkan isu kumpulannya sendiri. */
    sayap_cawangan_pemuda: [
      { kod: 'kerja_siswazah',  tajuk: 'Skim penempatan kerja dan gaji permulaan siswazah', penerangan: 'Siswazah muda sukar mendapat pekerjaan setimpal. Sayap mahu skim penempatan dengan gaji permulaan yang adil.', populariti: 70, nilai: 4 },
      { kod: 'rumah_pertama',   tajuk: 'Pembiayaan rumah pertama dengan bayaran muka rendah', penerangan: 'Belia berpendapatan sederhana gagal memiliki rumah pertama akibat harga dan syarat pembiayaan.', populariti: 66, nilai: 3 },
      { kod: 'kemahiran_gig',   tajuk: 'Latihan kemahiran digital dan perlindungan pekerja gig', penerangan: 'Ramai belia bergantung kepada kerja gig tanpa caruman dan perlindungan.', populariti: 64, nilai: 3 },
      { kod: 'dana_usahawan_belia', tajuk: 'Dana pemula untuk usahawan belia', penerangan: 'Modal kecil dan bimbingan untuk belia yang mahu memulakan perniagaan.', populariti: 62, nilai: 3 },
      { kod: 'had_umur_pemuda', tajuk: 'Turunkan had umur keahlian Pemuda kepada 35 tahun', penerangan: 'Cadangan yang mengasingkan ramai ahli yang kini berusia 36 hingga 40 tahun.', populariti: 28, nilai: -3 },
      { kod: 'yuran_program',   tajuk: 'Kenakan yuran lebih tinggi untuk program Pemuda', penerangan: 'Yuran dinaikkan bagi menampung kos, walaupun ramai ahli belum bekerja tetap.', populariti: 33, nilai: -2 }
    ],
    sayap_cawangan_puteri: [
      { kod: 'keselamatan_muda', tajuk: 'Keselamatan dan pencegahan gangguan di tempat kerja dan kampus', penerangan: 'Ahli Puteri mahu saluran aduan yang selamat dan tindakan tegas terhadap gangguan.', populariti: 70, nilai: 4 },
      { kod: 'gaji_setara',     tajuk: 'Perjuangkan gaji dan peluang kerjaya yang setara', penerangan: 'Perempuan muda sering terlepas kenaikan pangkat dan gaji yang sama dengan rakan lelaki.', populariti: 66, nilai: 3 },
      { kod: 'geran_usahawan_puteri', tajuk: 'Geran perniagaan kecil untuk usahawan muda perempuan', penerangan: 'Menyediakan modal permulaan dan latihan untuk usahawan perempuan muda.', populariti: 64, nilai: 3 },
      { kod: 'kesihatan_mental', tajuk: 'Program kesihatan mental dan sokongan rakan sebaya', penerangan: 'Tekanan kerja dan buli siber menjejaskan ramai perempuan muda.', populariti: 60, nilai: 3 },
      { kod: 'kurang_rangkaian', tajuk: 'Kurangkan peruntukan program rangkaian Puteri', penerangan: 'Peruntukan dikurangkan walaupun program rangkaian menjadi nadi sayap.', populariti: 30, nilai: -2 },
      { kod: 'wajib_hadir',     tajuk: 'Wajibkan kehadiran semua aktiviti sayap', penerangan: 'Ahli yang bekerja dan belajar merungut tidak mampu hadir semua program.', populariti: 32, nilai: -2 }
    ],
    sayap_cawangan_wanita: [
      { kod: 'jagaan_warga',    tajuk: 'Pusat jagaan harian dan elaun penjaga warga emas', penerangan: 'Ramai wanita menjaga ibu bapa dan mentua tanpa sokongan kewangan atau kemudahan jagaan.', populariti: 70, nilai: 4 },
      { kod: 'harga_dapur',     tajuk: 'Kawalan harga barang keperluan dapur', penerangan: 'Kos makanan isi rumah naik dan ibu rumah tangga menanggung bebannya.', populariti: 68, nilai: 4 },
      { kod: 'saringan_wanita', tajuk: 'Saringan kesihatan wanita percuma (payudara dan serviks)', penerangan: 'Saringan awal menyelamatkan nyawa tetapi kosnya membebankan golongan berpendapatan rendah.', populariti: 66, nilai: 3 },
      { kod: 'ibu_tunggal',     tajuk: 'Bantuan modal dan latihan untuk ibu tunggal', penerangan: 'Ibu tunggal memerlukan modal kecil dan kemahiran untuk menjana pendapatan sendiri.', populariti: 64, nilai: 3 },
      { kod: 'kurang_taska',    tajuk: 'Kurangkan subsidi tadika dan taska komuniti', penerangan: 'Subsidi dikurangkan bagi menjimatkan peruntukan, walaupun ibu bekerja bergantung kepadanya.', populariti: 28, nilai: -3 },
      { kod: 'caj_klinik',      tajuk: 'Naikkan caj klinik komuniti', penerangan: 'Caj dinaikkan bagi menampung kos, tetapi warga emas dan isi rumah miskin terkesan.', populariti: 30, nilai: -3 }
    ],
    sayap_bahagian_pemuda: [
      { kod: 'bhg_pemuda_latihan', tajuk: 'Pusat latihan kemahiran belia di setiap DUN', penerangan: 'Bahagian diminta menaja pusat latihan kemahiran untuk belia menganggur di kawasan DUN.', populariti: 68, nilai: 3 },
      { kod: 'bhg_pemuda_calon', tajuk: 'Beri kuota calon muda dalam senarai calon PRU', penerangan: 'Pemuda mahu sekurang-kurangnya satu pertiga calon bahagian terdiri daripada belia.', populariti: 64, nilai: 4 },
      { kod: 'bhg_pemuda_sukan', tajuk: 'Dana tetap sukan dan kerja sukarela belia', penerangan: 'Peruntukan tahunan bahagian bagi program sukan dan khidmat komuniti belia.', populariti: 60, nilai: 2 },
      { kod: 'bhg_pemuda_skim_rumah', tajuk: 'Skim sewa-beli rumah belia di kawasan bahagian', penerangan: 'Bahagian mendesak kerajaan negeri menyediakan rumah mampu milik untuk belia.', populariti: 66, nilai: 3 },
      { kod: 'bhg_pemuda_potong', tajuk: 'Potong peruntukan aktiviti Pemuda bahagian', penerangan: 'Peruntukan dikurangkan bagi menampung kos jentera pilihan raya.', populariti: 27, nilai: -3 }
    ],
    sayap_bahagian_puteri: [
      { kod: 'bhg_puteri_selamat', tajuk: 'Pusat aduan dan bantuan guaman percuma untuk perempuan muda', penerangan: 'Bahagian menyediakan kaunter aduan gangguan dan bantuan guaman asas.', populariti: 68, nilai: 3 },
      { kod: 'bhg_puteri_calon', tajuk: 'Kuota calon perempuan muda dalam pilihan raya', penerangan: 'Puteri mahu wakil perempuan muda dalam senarai calon bahagian.', populariti: 63, nilai: 4 },
      { kod: 'bhg_puteri_biasiswa', tajuk: 'Dana latihan kerjaya dan mentor untuk Puteri', penerangan: 'Program mentor dengan pemimpin wanita untuk perempuan muda bekerjaya.', populariti: 61, nilai: 3 },
      { kod: 'bhg_puteri_ruang', tajuk: 'Ruang kerja bersama dan taska di pejabat bahagian', penerangan: 'Menyediakan ruang yang mesra keluarga untuk ahli yang bekerja.', populariti: 58, nilai: 2 },
      { kod: 'bhg_puteri_hapus', tajuk: 'Hapuskan jawatankuasa kebajikan Puteri bahagian', penerangan: 'Jawatankuasa dibubarkan bagi menjimatkan kos pentadbiran.', populariti: 26, nilai: -3 }
    ],
    sayap_bahagian_wanita: [
      { kod: 'bhg_wanita_klinik', tajuk: 'Klinik bergerak untuk warga emas dan ibu mengandung', penerangan: 'Bahagian menaja klinik bergerak ke kampung dan taman perumahan.', populariti: 69, nilai: 3 },
      { kod: 'bhg_wanita_bantuan', tajuk: 'Dana kecemasan isi rumah untuk ibu tunggal', penerangan: 'Tabung bantuan segera bagi ibu tunggal dan isi rumah berpendapatan rendah.', populariti: 66, nilai: 3 },
      { kod: 'bhg_wanita_calon', tajuk: 'Kuota calon wanita dalam senarai calon bahagian', penerangan: 'Wanita mahu lebih ramai calon wanita bagi kerusi DUN dan Parlimen.', populariti: 62, nilai: 4 },
      { kod: 'bhg_wanita_koperasi', tajuk: 'Koperasi dan pasar mini usahawan wanita', penerangan: 'Menyediakan tapak niaga dan koperasi untuk usahawan mikro wanita.', populariti: 60, nilai: 2 },
      { kod: 'bhg_wanita_yuran', tajuk: 'Naikkan yuran keahlian Wanita bahagian', penerangan: 'Yuran dinaikkan walaupun ramai ahli warga emas berpendapatan tetap.', populariti: 25, nilai: -3 }
    ],
    sayap_pau_pemuda: [
      { kod: 'pau_pemuda_gaji', tajuk: 'Gaji minimum belia dan skim latihan industri kebangsaan', penerangan: 'Pemuda membawa usul dasar gaji permulaan dan latihan industri ke peringkat nasional.', populariti: 70, nilai: 4 },
      { kod: 'pau_pemuda_umur', tajuk: 'Turunkan umur layak mengundi dan bertanding', penerangan: 'Belia mahu penyertaan politik yang lebih awal.', populariti: 55, nilai: 3 },
      { kod: 'pau_pemuda_digital', tajuk: 'Dasar ekonomi digital dan perlindungan pekerja gig', penerangan: 'Dasar nasional bagi caruman dan perlindungan sosial pekerja gig.', populariti: 66, nilai: 3 },
      { kod: 'pau_pemuda_perumahan', tajuk: 'Dasar perumahan belia kebangsaan', penerangan: 'Pembiayaan dan bayaran muka rendah bagi pembeli rumah pertama.', populariti: 65, nilai: 3 },
      { kod: 'pau_pemuda_hadkan', tajuk: 'Hadkan jawatan Pemuda kepada mereka di bawah 30 tahun', penerangan: 'Usul yang menyingkirkan ramai pemimpin Pemuda yang sedia ada.', populariti: 24, nilai: -4 }
    ],
    sayap_pau_puteri: [
      { kod: 'pau_puteri_undang', tajuk: 'Akta anti-gangguan yang lebih tegas', penerangan: 'Puteri membawa usul pindaan undang-undang gangguan ke peringkat nasional.', populariti: 70, nilai: 4 },
      { kod: 'pau_puteri_gaji', tajuk: 'Dasar gaji setara dan cuti keluarga', penerangan: 'Dasar nasional bagi pembayaran setara dan cuti keluarga yang adil.', populariti: 66, nilai: 3 },
      { kod: 'pau_puteri_usahawan', tajuk: 'Dana usahawan perempuan muda kebangsaan', penerangan: 'Dana pembiayaan mudah untuk usahawan perempuan muda.', populariti: 63, nilai: 3 },
      { kod: 'pau_puteri_mental', tajuk: 'Perkhidmatan kesihatan mental dalam sistem awam', penerangan: 'Kaunseling dan sokongan kesihatan mental di klinik kerajaan.', populariti: 64, nilai: 3 },
      { kod: 'pau_puteri_kuota', tajuk: 'Kurangkan kuota sayap Puteri dalam MKT', penerangan: 'Usul yang melemahkan perwakilan sayap Puteri dalam Majlis Kerja Tertinggi.', populariti: 22, nilai: -4 }
    ],
    sayap_pau_wanita: [
      { kod: 'pau_wanita_penjaga', tajuk: 'Elaun penjaga dan skim jagaan warga emas nasional', penerangan: 'Wanita membawa usul bantuan penjaga keluarga ke peringkat nasional.', populariti: 70, nilai: 4 },
      { kod: 'pau_wanita_harga', tajuk: 'Kawalan harga barang asas dan subsidi dapur', penerangan: 'Dasar nasional bagi mengawal kos sara hidup isi rumah.', populariti: 67, nilai: 3 },
      { kod: 'pau_wanita_saringan', tajuk: 'Saringan kesihatan wanita percuma peringkat nasional', penerangan: 'Saringan kanser payudara dan serviks percuma untuk semua wanita.', populariti: 65, nilai: 3 },
      { kod: 'pau_wanita_taska', tajuk: 'Subsidi taska dan tadika komuniti nasional', penerangan: 'Mengurangkan beban penjagaan anak bagi ibu bekerja.', populariti: 62, nilai: 3 },
      { kod: 'pau_wanita_cukai', tajuk: 'Kenakan cukai tambahan ke atas barang keperluan wanita', penerangan: 'Cukai dikenakan bagi menambah hasil negara, tetapi membebankan isi rumah.', populariti: 20, nilai: -4 }
    ]
  };

  var TEMA_UCAPAN = ['Perpaduan dan Pembangunan', 'Ekonomi Rakyat', 'Kesinambungan dan Pembaharuan', 'Parti Dekat dengan Akar Umbi'];

  /* ------------------------------------------------------------------------
     2. PEMBANTU
     ------------------------------------------------------------------------ */
  function salin(o) { return JSON.parse(JSON.stringify(o)); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function gagal(kod, ralat) { return { ok: false, kod: kod, ralat: ralat }; }

  function normal(rng, min, sd) {
    var u = 1 - rng(), v = rng();
    return min + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function peringkatJawatan(jawatan) {
    var j = String(jawatan || '');
    if (/Bahagian/i.test(j)) { return 'bahagian'; }
    if (/Cawangan/i.test(j)) { return 'cawangan'; }
    return 'pusat';
  }

  /** v6.0: sayap pemain (pemuda | puteri | wanita) atau null (laluan Utama). */
  function sayapPemain(p) {
    var Sy = typeof globalThis !== 'undefined' ? globalThis.MyPolitikSayap : null;
    if (Sy && Sy.sayapJawatan) { return Sy.sayapJawatan(p); }
    return J && J.sayapPemain ? J.sayapPemain(p) : null;
  }
  var NAMA_SAYAP = { pemuda: 'Pemuda', puteri: 'Puteri', wanita: 'Wanita' };
  /** Namakan Mesyuarat Sayap mengikut sayap pemain. */
  function labelSayap(p) {
    var s = sayapPemain(p), N = s ? NAMA_SAYAP[s] : 'Sayap', u = 'Usul Isu Golongan ' + N;
    PERINGKAT.sayap_cawangan.nama = 'Mesyuarat ' + N + ' Cawangan';
    PERINGKAT.sayap_bahagian.nama = 'Mesyuarat ' + N + ' Bahagian';
    PERINGKAT.sayap_pau.nama = 'Perhimpunan ' + N + ' (Pra-PAU)';
    ['sayap_cawangan', 'sayap_bahagian', 'sayap_pau'].forEach(function (k) { PERINGKAT[k].jenisUsul = u; });
  }

  function keadaanMesyuarat(p) {
    var m = p.mesyuarat;
    if (!m || m.tahun !== p.tahun) { return { tahun: p.tahun, cawangan: null, bahagian: null, pau: null }; }   // peringkat sayap_* dicipta apabila dimulakan
    return salin(m);
  }

  function pemilihanAktif(p) { return !!(E && E.adalahTahunPemilihan(p.tahun)); }

  /** Adakah mesyuarat peringkat ini mengadakan pengundian? Perwakilan: setiap tahun. Pusat (PAU): tahun pemilihan sahaja. */
  function adaPemilihan(p, peringkat) { return !!E && peringkat !== 'sayap_pau' && (peringkat === 'pau' ? pemilihanAktif(p) : true); }   // v6.2: sayap Cawangan dan Bahagian memilih wakil

  function pegangan(p) {
    if (J) { return { per: J.peringkatTertinggi(p), pw: J.perwakilanSah(p, 'cawangan'), pp: J.perwakilanSah(p, 'bahagian'), exB: J.exOfficio(p, 'bahagian'), exP: J.exOfficio(p, 'pau') }; }
    var per = p.jawatan === 'Ahli Biasa' ? null : peringkatJawatan(p.jawatan), perw = E ? E.getKeadaanPemilihan(p).perwakilan : { cawangan: false, bahagian: false };
    return { per: per, pw: { sah: perw.cawangan }, pp: { sah: perw.bahagian },
             exB: { sah: per === 'bahagian' || per === 'pusat', sumber: p.jawatan }, exP: { sah: per === 'pusat' || p.jawatan === 'Ketua Bahagian', sumber: p.jawatan } };
  }

  /** Siapa boleh hadir. Bahagian dan PAU: perwakilan TAHUN INI atau pemegang jawatan ex-officio. */
  function bolehHadir(p, peringkat) {
    if (peringkat === 'cawangan') { return { ok: true }; }
    if (adalahSayap(peringkat)) {                                         // v6.1: mesyuarat sayap
      if (!sayapPemain(p)) { return { ok: false, sebab: 'Mesyuarat sayap hanya untuk laluan sayap (Pemuda, Puteri atau Wanita). Laluan anda ialah Utama / Induk.' }; }
      if (peringkat === 'sayap_cawangan') { return { ok: true }; }            // mesyuarat peringkat Cawangan: semua ahli sayap boleh hadir
      var gs = pegangan(p), pws = p.perwakilan || {}, N = NAMA_SAYAP[sayapPemain(p)];
      if (peringkat === 'sayap_bahagian') {                                  // hanya wakil sayap Cawangan tahun ini atau pemegang jawatan Bahagian/Pusat
        return (pws.sayapCawangan === p.tahun || gs.exB.sah || (J && J.pegang && J.pegang(p, 'sayap_cawangan_' + sayapPemain(p)))) ? { ok: true }
          : { ok: false, sebab: 'Hanya wakil ' + N + ' Cawangan tahun ' + p.tahun + ' yang terpilih, Ketua ' + N + ' Cawangan dan pemegang jawatan Bahagian/Pusat boleh hadir Mesyuarat ' + N + ' Bahagian.' };
      }
      return (pws.g2 === p.tahun || gs.exP.sah || (J && J.pegang && J.pegang(p, 'sayap_bahagian_' + sayapPemain(p)))) ? { ok: true }               // sayap_pau: G2 tahun ini atau pemegang jawatan ex-officio
        : { ok: false, sebab: 'Hanya G2 ' + N + ' (2 wakil Bahagian) tahun ' + p.tahun + ', Ketua ' + N + ' Bahagian, Ketua Bahagian dan pemegang jawatan Pusat boleh hadir Perhimpunan ' + N + ' Pusat.' };
    }
    var g = pegangan(p);
    if (peringkat === 'bahagian') {
      return (g.pw.sah || g.exB.sah || (p.perwakilan && p.perwakilan.g10 === p.tahun)) ? { ok: true }
        : { ok: false, sebab: 'Hanya Perwakilan Cawangan atau G10 sayap tahun ' + p.tahun + ' yang terpilih dan pemegang jawatan Bahagian/Pusat boleh hadir. Mandat tahun lepas sudah luput.' };
    }
    return (g.pp.sah || g.exP.sah) ? { ok: true }
      : { ok: false, sebab: 'Hanya Perwakilan Bahagian tahun ' + p.tahun + ' yang terpilih, Ketua Bahagian dan pemegang jawatan Pusat boleh hadir PAU.' };
  }

  /* ---- Takwim bulanan (js/calendar.js, pilihan) ---- */
  function kalendar() { var g = typeof globalThis !== 'undefined' ? globalThis : null; return g && g.MyPolitikCalendar ? g.MyPolitikCalendar : null; }
  function tetingkap(p, peringkat) { var K = kalendar(); return K ? K.getTetingkap(peringkat, p.bulan) : null; }

  function statusPeringkat(p, ms, peringkat) {
    var s = ms[peringkat];
    if (s && s.status === 'selesai') { return { status: 'selesai', sebab: '' }; }
    if (s && s.status === 'sedang') { return { status: 'sedang', sebab: '' }; }
    var w = tetingkap(p, peringkat);
    var h = bolehHadir(p, peringkat);
    if (!h.ok) { return { status: 'tidak_layak', sebab: h.sebab }; }          // kelayakan disemak dahulu supaya sebab sebenar dipaparkan
    if (w && w.status === 'belum_tiba') {
      return { status: 'belum_tiba', sebab: PERINGKAT[peringkat].nama + ' dibuka pada ' + w.label.toLowerCase() + '. Sekarang bulan ' + p.bulan + '.' +
        (peringkat !== 'cawangan' ? ' Anda layak hadir.' : '') };
    }
    if (w && w.status === 'tamat') {
      return { status: 'terlepas', sebab: 'Musim ' + PERINGKAT[peringkat].nama + ' (' + w.label.toLowerCase() + ') tahun ' + p.tahun + ' sudah tamat.' };
    }
    var sy = SAYAP_UNTUK[peringkat];                                            // v6.1: mesyuarat utama terkunci sehingga mesyuarat sayap selesai
    if (sy && sayapPemain(p) && bolehHadir(p, sy).ok && !(ms[sy] && ms[sy].status === 'selesai')) {
      return { status: 'terkunci', sebab: 'Mulakan dan selesaikan ' + PERINGKAT[sy].nama + ' dahulu. Sayap anda membawa satu usul ke ' + PERINGKAT[peringkat].nama + '.' };
    }
    for (var i = 0; !w && i < URUTAN.indexOf(peringkat); i++) {            // tanpa takwim: urutan peringkat dikuatkuasakan
      var sebelum = URUTAN[i], ss = ms[sebelum];
      if (bolehHadir(p, sebelum).ok && !(ss && ss.status === 'selesai')) {
        return { status: 'terkunci', sebab: 'Selesaikan ' + PERINGKAT[sebelum].nama + ' dahulu.' };
      }
    }
    return { status: 'boleh_mula', sebab: '' };
  }

  function bilHadir(p, peringkat) {
    if (peringkat === 'sayap_cawangan') {
      var Eh = typeof globalThis !== 'undefined' ? globalThis.MyPolitikElection : null;     // v6.3: hadir = 35% ahli sayap dalam Cawangan
      if (Eh && Eh.ahliSayap) { return Math.max(10, Math.round(Eh.ahliSayap(p) * CONFIG.TAHAP_HADIR_CAWANGAN)); }
      var j2 = p.cawanganInfo && p.cawanganInfo.jumlahAhli ? p.cawanganInfo.jumlahAhli : 100;
      return Math.max(20, Math.round(j2 * CONFIG.TAHAP_HADIR_SAYAP));
    }
    if (peringkat === 'cawangan') {
      var jumlah = p.cawanganInfo && p.cawanganInfo.jumlahAhli ? p.cawanganInfo.jumlahAhli : 100;
      return Math.max(30, Math.round(jumlah * CONFIG.TAHAP_HADIR_CAWANGAN));
    }
    return CONFIG.HADIR[peringkat];
  }

  /** v6.1: usul yang dibawa oleh sayap ke mesyuarat utama (daripada ringkasan mesyuarat sayap yang selesai), atau null. */
  function usulDibawa(p, peringkat) {
    var sk = SAYAP_UNTUK[peringkat], m = p.mesyuarat && p.mesyuarat.tahun === p.tahun ? p.mesyuarat[sk] : null;
    return m && m.status === 'selesai' && m.ringkasan && m.ringkasan.usulDibawa ? m.ringkasan.usulDibawa : null;
  }

  /* ------------------------------------------------------------------------
     3. AGENDA
     ------------------------------------------------------------------------ */
  function janaAgenda(p, peringkat) {
    var rng = S.rngBerbenih(p.id + '|' + p.tahun + '|mesyuarat|' + peringkat);
    var agenda = [], pool = (adalahSayap(peringkat) ? KOLAM[peringkat + '_' + sayapPemain(p)] : KOLAM[peringkat]).slice(), dipakai = {};

    // Usul Lokaliti bermula daripada isu tempatan yang dicatat melalui Sembang Warung.
    if (peringkat === 'cawangan') {
      (p.isu || []).filter(function (i) { return !i.selesai; }).slice(0, 2).forEach(function (i) {
        agenda.push({
          id: 'cawangan-' + p.tahun + '-isu-' + i.kod, jenis: 'usul', kod: 'isu_' + i.kod, sumber: 'sembang_warung',
          tajuk: 'Atasi isu: ' + i.tajuk, penerangan: i.penerangan,
          populariti: clamp(55 + i.tahap * 5, 0, 100), nilai: i.tahap, status: 'terbuka', pilihan: null, keputusan: null
        });
        dipakai['isu_' + i.kod] = true;
      });
    }

    // v6.1: usul yang dibawa oleh sayap (lulus dalam mesyuarat sayap) ialah usul pertama dalam mesyuarat utama.
    var bawa = usulDibawa(p, peringkat);
    if (bawa) {
      agenda.push({
        id: peringkat + '-' + p.tahun + '-sayap-' + bawa.kod, jenis: 'usul', kod: bawa.kod, sumber: 'sayap', sayap: bawa.sayap,
        tajuk: 'Usul ' + NAMA_SAYAP[bawa.sayap] + ': ' + bawa.tajuk, penerangan: bawa.penerangan + ' (Dibawa oleh sayap ' + NAMA_SAYAP[bawa.sayap] + ' selepas diluluskan dalam mesyuarat sayap.)',
        populariti: clamp(bawa.populariti + 6, 5, 95), nilai: bawa.nilai, status: 'terbuka', pilihan: null, keputusan: null
      });
    }

    // Isi baki daripada kolam, susunan berbenih supaya tetap sepanjang tahun.
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    for (var k = 0; k < pool.length && agenda.length < CONFIG.BIL_USUL; k++) {
      var u = pool[k];
      agenda.push({
        id: peringkat + '-' + p.tahun + '-' + u.kod, jenis: 'usul', kod: u.kod, sumber: 'kolam',
        tajuk: u.tajuk, penerangan: u.penerangan,
        populariti: clamp(Math.round(u.populariti + (rng() * 16 - 8)), 5, 95), nilai: u.nilai,
        status: 'terbuka', pilihan: null, keputusan: null
      });
    }

    if (peringkat === 'pau') {
      agenda.push({
        id: 'pau-' + p.tahun + '-ucapan', jenis: 'ucapan_dasar', kod: 'ucapan_dasar', sumber: 'presiden',
        tajuk: 'Ucapan Dasar Presiden: ' + TEMA_UCAPAN[Math.floor(rng() * TEMA_UCAPAN.length)],
        penerangan: 'Presiden menyampaikan hala tuju parti. Perwakilan berbahas dan mengundi sokongan terhadap ucapan.',
        populariti: 72, nilai: 3, status: 'terbuka', pilihan: null, keputusan: null
      });
    }

    if (adaPemilihan(p, peringkat) && adalahSayap(peringkat)) {            // v6.2: pemilihan wakil sayap
      var Ns = NAMA_SAYAP[sayapPemain(p)], Es = typeof globalThis !== 'undefined' ? globalThis.MyPolitikElection : null;
      agenda.push({
        id: peringkat + '-' + p.tahun + '-pemilihan', jenis: 'pemilihan', kod: 'pemilihan_' + peringkat, sumber: 'pemilihan',
        tajuk: peringkat === 'sayap_cawangan' ? 'Pemilihan wakil ' + Ns + ' Cawangan ke Mesyuarat ' + Ns + ' Bahagian (' + (Es && Es.kuotaSayapCawangan ? Es.kuotaSayapCawangan(p) : 3) + ' kerusi)'
                                              : 'Pemilihan G10 (10 wakil ke Mesyuarat Bahagian) dan G2 (2 wakil ke Perhimpunan ' + Ns + ' Pusat)',
        penerangan: 'Pengundian dijalankan apabila mesyuarat ditutup. Daftar pencalonan anda melalui tab Pemilihan sebelum itu.',
        kerusi: null, status: 'menunggu', keputusan: null
      });
    }
    else if (adaPemilihan(p, peringkat)) {
      var buka = pemilihanAktif(p), tajuk, perw = PERINGKAT[peringkat].perwakilan;
      var Eg = typeof globalThis !== 'undefined' ? globalThis.MyPolitikElection : null;      // kuota sebenar (Fasal 14.4.4 / 8.4.3)
      if (perw && Eg && Eg.kuotaCawangan) { perw = { kerusi: peringkat === 'cawangan' ? Eg.kuotaCawangan(p) : Eg.kuotaBahagian(p) }; }
      if (peringkat === 'cawangan') { tajuk = 'Pemilihan Cawangan: ' + (buka ? 'jawatan Cawangan dan Sayap, serta ' : '') + 'perwakilan ke Bahagian (' + perw.kerusi + ' kerusi)'; }
      else if (peringkat === 'bahagian') { tajuk = 'Pemilihan Bahagian: ' + (buka ? 'jawatan Bahagian dan Sayap, serta ' : '') + 'perwakilan ke PAU (' + perw.kerusi + ' kerusi)'; }
      else { tajuk = 'Pemilihan Pusat: Presiden, Timbalan Presiden, 3 Naib Presiden, MKT dan Ketua Sayap'; }
      agenda.push({
        id: peringkat + '-' + p.tahun + '-pemilihan', jenis: 'pemilihan', kod: 'pemilihan_' + peringkat, sumber: 'pemilihan', tajuk: tajuk,
        penerangan: 'Pengundian dijalankan apabila mesyuarat ditutup. Daftar pencalonan anda melalui tab Pemilihan sebelum itu.',
        kerusi: perw ? perw.kerusi : null, status: 'menunggu', keputusan: null
      });
    }
    return agenda;
  }

  /* ------------------------------------------------------------------------
     4. MODEL KEPUTUSAN USUL
     ------------------------------------------------------------------------ */
  function pengaruhPemain(p, peringkat, peranan, pendirian) {
    if (pendirian !== 'sokong' && pendirian !== 'bantah') { return 0; }
    var tanda = pendirian === 'sokong' ? 1 : -1, ipN = Math.min(100, p.ip) / 100;
    var kes = PERINGKAT[peringkat].kesetiaan.map(function (k) { return p.kesetiaan[k]; });
    var lyl = kes.reduce(function (a, b) { return a + b; }, 0) / kes.length / 100;   // 0 hingga 1
    var asas = peranan === 'pembawa' ? 6 + 24 * ipN : (peranan === 'pembahas' ? 3 + 14 * ipN : 2);
    return tanda * asas * (0.6 + 0.8 * lyl);
  }

  function selesaikanUsul(usul, pengaruh, hadir, rng) {
    var sokongan = clamp(Math.round(usul.populariti + pengaruh + normal(rng, 0, CONFIG.SISIHAN_RAWAK)), 0, 100);
    var sokong = Math.round(hadir * clamp(sokongan / 100, 0.02, 0.98));
    return { lulus: sokong > hadir - sokong, sokongan: sokongan, hadir: hadir, undiSokong: sokong, undiBantah: hadir - sokong };
  }

  function kesanPeranan(peranan, pendirian, lulus, usul) {
    var padan = pendirian === 'sokong' || pendirian === 'bantah' ? ((pendirian === 'sokong') === lulus) : false;
    var ip = 0, reputasi = 0, g = CONFIG.GANJARAN_IP[peranan];
    if (peranan === 'pembawa') { ip = lulus ? g.lulus : g.ditolak; }
    else if (pendirian === 'berkecuali') { ip = 0; }
    else { ip = padan ? g.padan : g.tidakPadan; }
    if (padan) { reputasi = Math.round((pendirian === 'sokong' ? 1 : -1) * usul.nilai * CONFIG.KREDIT[peranan]); }
    return { ip: ip, reputasi: reputasi, padan: padan };
  }


  /* ------------------------------------------------------------------------
     4b. STATUS PERWAKILAN DAN LANGKAH SETERUSNYA
     ------------------------------------------------------------------------ */
  function bulanKe(p, peringkat) {
    var w = tetingkap(p, peringkat);
    return w ? { label: w.label, mula: w.mula, tamat: w.tamat, status: w.status, jarak: w.status === 'belum_tiba' ? w.mula - p.bulan : 0 } : null;
  }

  /**
   * Status kelayakan hadir ke Mesyuarat Bahagian dan PAU.
   * Pulang { bahagian:{layak,lencana,sumber,sebab,tetingkap}, pau:{...} }
   * lencana = "Perwakilan Bahagian" / "Perwakilan PAU" (null jika bukan perwakilan, cth. pemegang jawatan Bahagian).
   */
  function getStatusPerwakilan(profil) {
    var p = profil || S.loadPlayer();
    if (!p) { return null; }
    var g = pegangan(p);
    var b = { layak: false, lencana: null, sumber: '', sebab: '', tetingkap: bulanKe(p, 'bahagian') };
    if (g.pw.sah) { b.layak = true; b.lencana = 'Perwakilan Bahagian ' + p.tahun; b.sumber = 'Menang kerusi Perwakilan Cawangan ke Bahagian (sah tahun ' + p.tahun + ' sahaja)'; }
    else if (p.perwakilan && p.perwakilan.g10 === p.tahun) { b.layak = true; b.lencana = 'G10 ' + (NAMA_SAYAP[sayapPemain(p)] || 'Sayap') + ' ' + p.tahun; b.sumber = 'Terpilih dalam G10 (10 wakil sayap) di Mesyuarat Sayap Bahagian (sah tahun ' + p.tahun + ' sahaja)'; }
    else if (g.exB.sah) { b.layak = true; b.sumber = 'Ex-officio sebagai ' + g.exB.sumber; }
    else { b.sebab = (g.pw.luput ? 'Mandat perwakilan tahun lepas sudah luput. ' : '') + 'Menangi kerusi Perwakilan Cawangan semasa Mesyuarat Cawangan (bulan 4-6) tahun ' + p.tahun + '.'; }

    var u = { layak: false, lencana: null, sumber: '', sebab: '', tetingkap: bulanKe(p, 'pau') };
    if (g.pp.sah) { u.layak = true; u.lencana = 'Perwakilan PAU ' + p.tahun; u.sumber = 'Menang kerusi Perwakilan Bahagian ke PAU (sah tahun ' + p.tahun + ' sahaja)'; }
    else if (g.exP.sah) { u.layak = true; u.sumber = 'Ex-officio sebagai ' + g.exP.sumber; }
    else { u.sebab = 'Menangi kerusi Perwakilan Bahagian semasa Mesyuarat Bahagian (bulan 7) tahun ' + p.tahun + ', atau pegang jawatan Ketua Bahagian / Pusat.'; }
    return { tahun: p.tahun, bulan: p.bulan, bahagian: b, pau: u };
  }

  /** Senarai langkah yang disyorkan selepas satu mesyuarat ditutup. */
  function langkahSeterusnya(p, peringkat) {
    var langkah = [], sp = getStatusPerwakilan(p), K = kalendar();
    function buka(sasaran, nama, st) {
      var w = st.tetingkap;
      if (st.layak) {
        langkah.push('Anda layak hadir ' + nama + (st.lencana ? ' sebagai ' + st.lencana : '') + '. ' +
          (w ? (w.status === 'dibuka' ? 'Dibuka sekarang (' + w.label.toLowerCase() + ').' : w.status === 'belum_tiba' ? 'Dibuka pada ' + w.label.toLowerCase() + ', ' + w.jarak + ' bulan lagi.' : 'Musim tahun ini sudah tamat.') : ''));
      } else { langkah.push('Anda belum layak hadir ' + nama + '. ' + st.sebab); }
    }
    if (adalahSayap(peringkat)) {                                          // v6.1: selepas mesyuarat sayap, mesyuarat utama dibuka
      var ut = INDUK[peringkat], db = usulDibawa(p, ut), wu = tetingkap(p, ut);
      langkah.push(db ? 'Usul "' + db.tajuk + '" diluluskan dan akan dibawa oleh sayap anda ke ' + PERINGKAT[ut].nama + '.' : 'Tiada usul sayap yang diluluskan, jadi tiada usul sayap dibawa ke ' + PERINGKAT[ut].nama + '.');
      var pw = p.perwakilan || {}, Nn = NAMA_SAYAP[sayapPemain(p)] || 'Sayap';
      if (peringkat === 'sayap_cawangan') { langkah.push(pw.sayapCawangan === p.tahun ? 'Anda terpilih sebagai wakil ' + Nn + ' Cawangan ke Mesyuarat ' + Nn + ' Bahagian (bulan 7).' : 'Anda bukan wakil ' + Nn + ' Cawangan tahun ini, jadi tidak boleh hadir Mesyuarat ' + Nn + ' Bahagian kecuali memegang jawatan Bahagian/Pusat.'); }
      if (peringkat === 'sayap_bahagian') {
        langkah.push(pw.g10 === p.tahun ? 'Anda terpilih dalam G10 ' + Nn + ' dan layak hadir Mesyuarat Bahagian.' : 'Anda tidak termasuk dalam G10 ' + Nn + ' tahun ini.');
        langkah.push(pw.g2 === p.tahun ? 'Anda terpilih dalam G2 ' + Nn + ' dan layak hadir Perhimpunan ' + Nn + ' Pusat (bulan 8).' : 'Anda tidak termasuk dalam G2 ' + Nn + ' tahun ini.');
      }
      if (bolehHadir(p, ut).ok) { langkah.push('Anda kini boleh memulakan ' + PERINGKAT[ut].nama + (wu && wu.status === 'belum_tiba' ? ' (dibuka pada ' + wu.label.toLowerCase() + ').' : '.')); }
      else { langkah.push('Anda belum layak hadir ' + PERINGKAT[ut].nama + ' melalui laluan sayap. ' + bolehHadir(p, ut).sebab); }
    }
    else if (peringkat === 'cawangan') { buka('bahagian', 'Mesyuarat Bahagian', sp.bahagian); }
    else if (peringkat === 'bahagian') { buka('pau', 'Perhimpunan Agung (PAU)', sp.pau); }
    else { langkah.push('Perhimpunan Agung tahun ' + p.tahun + ' selesai. Bulan 9 hingga 12 ialah fasa pasca-PAU. Mandat perwakilan anda tamat pada hujung tahun; bertanding semula di Cawangan tahun depan.'); }
    if (K) {
      var tk = K.getTakwim(p);
      langkah.push('Tekan "Teruskan ke Bulan ' + tk.bulanSeterusnya + '" untuk menyambung permainan; AP dan Dana akan diperbaharui.');
    }
    return langkah;
  }

  function nilaiSumber(p) { return { ip: p.ip, myr: p.myr, ap: p.ap, reputasi: p.reputasi }; }
  function beza(a, b) { return { ip: b.ip - a.ip, myr: b.myr - a.myr, ap: b.ap - a.ap, reputasi: b.reputasi - a.reputasi }; }

  /** Ringkasan tersimpan bagi peringkat yang sudah selesai (dengan langkah dikira semula). */
  function getRingkasan(peringkat, profil) {
    var p = profil || S.loadPlayer();
    if (!p || !PERINGKAT[peringkat]) { return null; }
    labelSayap(p);
    var m = keadaanMesyuarat(p)[peringkat];
    if (!m || m.status !== 'selesai' || !m.ringkasan) { return null; }
    var r = salin(m.ringkasan);
    r.peringkat = peringkat; r.nama = PERINGKAT[peringkat].nama; r.tahun = p.tahun;
    r.perwakilanStatus = getStatusPerwakilan(p);
    r.langkah = langkahSeterusnya(p, peringkat);
    r.baki = nilaiSumber(p);
    return r;
  }

  /* ------------------------------------------------------------------------
     5. API
     ------------------------------------------------------------------------ */

  /** Senarai peranan dan kos untuk melukis butang. */
  function senaraiPeranan() {
    return [
      { id: 'pembawa', nama: 'Pembawa Usul', kosAP: CONFIG.KOS_AP.pembawa, pendirian: ['sokong'], penerangan: 'Membawa usul. Kredit penuh jika lulus, IP berkurang jika ditolak.' },
      { id: 'pembahas', nama: 'Pembahas', kosAP: CONFIG.KOS_AP.pembahas, pendirian: ['sokong', 'bantah'], penerangan: 'Berbahas menyokong atau membantah. Kredit separuh.' },
      { id: 'undi', nama: 'Mengundi', kosAP: CONFIG.KOS_AP.undi, pendirian: ['sokong', 'bantah', 'berkecuali'], penerangan: 'Mengundi sahaja. Kesan kecil dan percuma.' }
    ];
  }

  /** Status ketiga-tiga peringkat. Untuk lukisan dashboard. */
  function getKeadaanMesyuarat(profil) {
    var p = profil || S.loadPlayer();
    if (!p) { return null; }
    var ms = keadaanMesyuarat(p); labelSayap(p);
    var sy = sayapPemain(p);
    return {
      tahun: p.tahun, pemilihan: pemilihanAktif(p),
      peringkat: URUTAN.filter(function (k) { return !adalahSayap(k) || !!sy; }).map(function (k) {
        var st = statusPeringkat(p, ms, k), m = ms[k], agenda = m ? m.agenda : null;
        return {
          kod: k, nama: PERINGKAT[k].nama, jenisUsul: PERINGKAT[k].jenisUsul,
          status: st.status, sebab: st.sebab, tetingkap: tetingkap(p, k),
          bilUsul: agenda ? agenda.filter(function (a) { return a.jenis !== 'pemilihan'; }).length : null,
          bilSelesai: agenda ? agenda.filter(function (a) { return a.jenis !== 'pemilihan' && a.status === 'selesai'; }).length : null,
          agenda: agenda, ringkasan: m && m.ringkasan ? m.ringkasan : null, sayap: adalahSayap(k), induk: INDUK[k] || null
        };
      })
    };
  }

  function mulaMesyuarat(peringkat) {
    if (!PERINGKAT[peringkat]) { return gagal('tidak_dikenali', 'Peringkat tidak dikenali: ' + peringkat); }
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    labelSayap(p);
    var Et = typeof globalThis !== 'undefined' ? globalThis.MyPolitikEtika : null;     // hak keahlian (Fasal 20.10)
    if (Et) { var hak = Et.semakHak(p, 'perwakilan'); if (!hak.boleh) { return gagal('hak_dicabut', hak.sebab); } }
    var ms = keadaanMesyuarat(p), st = statusPeringkat(p, ms, peringkat);
    if (st.status === 'selesai') { return gagal('selesai', PERINGKAT[peringkat].nama + ' tahun ' + p.tahun + ' sudah selesai.'); }
    if (st.status === 'sedang') { return gagal('sedang', PERINGKAT[peringkat].nama + ' sedang berjalan.'); }
    if (st.status !== 'boleh_mula') { return gagal(st.status, st.sebab); }

    ms[peringkat] = { status: 'sedang', mula: new Date().toISOString(), bulanMula: p.bulan, asas: nilaiSumber(p), agenda: janaAgenda(p, peringkat), ringkasan: null };
    var r = S.applyEffects({}, {
      kiraTindakan: false, patch: { mesyuarat: ms },
      log: { tindakan: 'mula_mesyuarat', nama: PERINGKAT[peringkat].nama + ' ' + p.tahun, peringkat: peringkat }
    });
    if (!r.ok) { return r; }
    return { ok: true, mesej: PERINGKAT[peringkat].nama + ' dimulakan. ' + ms[peringkat].agenda.length + ' perkara dalam agenda.', mesyuarat: ms[peringkat], profil: r.profil };
  }

  /**
   * Pilih peranan bagi satu usul dan selesaikan usul itu serta-merta.
   * peranan: 'pembawa' | 'pembahas' | 'undi'
   * pendirian: 'sokong' | 'bantah' | 'berkecuali' (berkecuali hanya untuk peranan 'undi').
   * Pembawa sentiasa menyokong. Pembawa tidak boleh dipilih untuk Ucapan Dasar.
   * opts: { rng } untuk ujian.
   */
  function pilihPeranan(peringkat, usulId, peranan, pendirian, opts) {
    opts = opts || {};
    if (!PERINGKAT[peringkat]) { return gagal('tidak_dikenali', 'Peringkat tidak dikenali: ' + peringkat); }
    if (!CONFIG.KOS_AP.hasOwnProperty(peranan)) { return gagal('peranan', 'Peranan tidak sah: ' + peranan); }
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    labelSayap(p);
    var ms = keadaanMesyuarat(p), m = ms[peringkat];
    if (!m || m.status !== 'sedang') { return gagal('belum_mula', 'Mulakan ' + PERINGKAT[peringkat].nama + ' dahulu.'); }

    var usul = null;
    m.agenda.forEach(function (a) { if (a.id === usulId) { usul = a; } });
    if (!usul || usul.jenis === 'pemilihan') { return gagal('tiada_usul', 'Usul tidak ditemui: ' + usulId); }
    if (usul.status === 'selesai') { return gagal('sudah_selesai', 'Usul ini sudah diputuskan.'); }
    if (peranan === 'pembawa' && usul.jenis === 'ucapan_dasar') { return gagal('peranan', 'Ucapan Dasar disampaikan oleh Presiden. Pilih Pembahas atau Mengundi.'); }

    if (peranan === 'pembawa') { pendirian = 'sokong'; }
    var sah = peranan === 'pembahas' ? ['sokong', 'bantah'] : ['sokong', 'bantah', 'berkecuali'];
    if (sah.indexOf(pendirian) < 0) { return gagal('pendirian', 'Pendirian tidak sah untuk ' + peranan + ': ' + pendirian); }
    if (p.ap < CONFIG.KOS_AP[peranan]) { return gagal('ap', 'AP tidak mencukupi (perlu ' + CONFIG.KOS_AP[peranan] + ').'); }

    var rng = opts.rng || Math.random;
    var hasil = selesaikanUsul(usul, pengaruhPemain(p, peringkat, peranan, pendirian), bilHadir(p, peringkat), rng);
    var kesan = kesanPeranan(peranan, pendirian, hasil.lulus, usul);

    usul.status = 'selesai';
    usul.pilihan = { peranan: peranan, pendirian: pendirian };
    usul.keputusan = { lulus: hasil.lulus, sokongan: hasil.sokongan, hadir: hasil.hadir, undiSokong: hasil.undiSokong, undiBantah: hasil.undiBantah, padan: kesan.padan, ip: kesan.ip, reputasi: kesan.reputasi };

    var r = S.applyEffects({ ap: -CONFIG.KOS_AP[peranan], ip: kesan.ip, reputasi: kesan.reputasi }, {
      patch: { mesyuarat: ms },
      log: { tindakan: 'usul_' + peranan, nama: usul.tajuk + ' (' + peranan + ', ' + pendirian + ')', peringkat: peringkat }
    });
    if (!r.ok) { return r; }

    var nama = { pembawa: 'Pembawa', pembahas: 'Pembahas', undi: 'Mengundi' }[peranan];
    var mesej = nama + ' (' + pendirian + '): usul ' + (hasil.lulus ? 'LULUS' : 'DITOLAK') + ' dengan ' + hasil.undiSokong + ' sokong dan ' +
                hasil.undiBantah + ' bantah. ' + S.ringkasPerubahan(r.perubahan) + '.';
    return { ok: true, mesej: mesej, keputusan: usul.keputusan, usul: usul, perubahan: r.perubahan, profil: r.profil };
  }

  /**
   * Tutup mesyuarat: usul yang tidak disertai diputuskan tanpa kesan pada pemain,
   * kemudian pemilihan perwakilan peringkat itu dijalankan (tahun pemilihan sahaja).
   * opts: { rng }
   */
  function tutupMesyuarat(peringkat, opts) {
    opts = opts || {};
    if (!PERINGKAT[peringkat]) { return gagal('tidak_dikenali', 'Peringkat tidak dikenali: ' + peringkat); }
    var p = S.loadPlayer();
    if (!p) { return gagal('tiada_profil', 'Tiada profil pemain.'); }
    labelSayap(p);
    var ms = keadaanMesyuarat(p), m = ms[peringkat];
    if (!m || m.status !== 'sedang') { return gagal('belum_mula', PERINGKAT[peringkat].nama + ' tidak sedang berjalan.'); }

    // 1. Pemilihan dijalankan dahulu kerana ia mengubah profil (jawatan, perwakilan).
    var pemilihan = [], sebelumPemilihan = nilaiSumber(p);
    if (adaPemilihan(p, peringkat)) {
      pemilihan = E.jalankanPemilihanPeringkat(peringkat, { rng: opts.rng });
    }

    // 2. Muat semula profil dan putuskan baki usul.
    p = S.loadPlayer();
    var kesanPemilihan = beza(sebelumPemilihan, nilaiSumber(p));
    ms = keadaanMesyuarat(p); m = ms[peringkat];
    var rng = opts.rng || Math.random, hadir = bilHadir(p, peringkat), tanpaPenyertaan = [];
    m.agenda.forEach(function (a) {
      if (a.jenis === 'pemilihan') {
        var hs = pemilihan.filter(function (x) { return x.ok; });
        a.status = 'selesai';
        a.keputusan = hs.length ? { dijalankan: true, bil: hs.length, menang: hs.filter(function (x) { return x.keputusan.menang; }).length } : { dijalankan: false, bil: 0, menang: 0 };
      } else if (a.status !== 'selesai') {
        var k = selesaikanUsul(a, 0, hadir, rng);
        a.status = 'selesai'; a.pilihan = null;
        a.keputusan = { lulus: k.lulus, sokongan: k.sokongan, hadir: k.hadir, undiSokong: k.undiSokong, undiBantah: k.undiBantah, padan: false, ip: 0, reputasi: 0 };
        tanpaPenyertaan.push(a.tajuk);
      }
    });

    var usulList = m.agenda.filter(function (a) { return a.jenis !== 'pemilihan'; });
    var ringkasan = {
      lulus: usulList.filter(function (a) { return a.keputusan.lulus; }).length,
      ditolak: usulList.filter(function (a) { return !a.keputusan.lulus; }).length,
      disertai: usulList.filter(function (a) { return a.pilihan; }).length,
      tanpaPenyertaan: tanpaPenyertaan.length,
      pemilihan: pemilihan.filter(function (x) { return x.ok; }).map(function (x) {
        var k = x.keputusan;
        return { kod: k.kod, jawatan: k.jawatan, menang: k.menang, kedudukan: k.kedudukan, jumlahCalon: k.jumlahCalon, kerusi: k.kerusi, undi: k.undi, ip: x.perubahan ? x.perubahan.ip : 0 };
      }),
      bulanTutup: p.bulan,
      usul: usulList.map(function (a) {
        var k = a.keputusan, pl = a.pilihan;
        return { tajuk: a.tajuk, lulus: k.lulus, undiSokong: k.undiSokong, undiBantah: k.undiBantah, hadir: k.hadir,
                 pilihan: pl ? { peranan: pl.peranan, pendirian: pl.pendirian } : null, padan: !!k.padan, ip: k.ip || 0, reputasi: k.reputasi || 0 };
      }),
      tidakDidaftar: (E && adaPemilihan(p, peringkat) ? E.senaraiPertandingan(p) : []).filter(function (c) {
        return c.peringkat === (peringkat === 'pau' ? 'pusat' : peringkat) && c.terbuka && !c.didaftar && !c.selesai && !c.pertahan;
      }).map(function (c) { return c.jawatan; }),
      peristiwa: []
    };
    ringkasan.usulDibawa = null;                                              // v6.1: satu usul sayap dibawa ke mesyuarat utama
    if (adalahSayap(peringkat)) {
      var calon = m.agenda.filter(function (a) { return a.jenis === 'usul' && a.keputusan && a.keputusan.lulus && a.nilai > 0; });
      calon.sort(function (a, b) {
        var pa = a.pilihan && a.pilihan.peranan === 'pembawa' ? 1 : 0, pb = b.pilihan && b.pilihan.peranan === 'pembawa' ? 1 : 0;
        return pb - pa || b.keputusan.sokongan - a.keputusan.sokongan;
      });
      if (calon.length) {
        var c = calon[0];
        ringkasan.usulDibawa = { kod: c.kod, tajuk: c.tajuk, penerangan: c.penerangan, populariti: c.populariti, nilai: c.nilai, sayap: sayapPemain(p), ke: PERINGKAT[INDUK[peringkat]].nama };
      }
    }
    var apUsul = 0;
    usulList.forEach(function (a) { if (a.pilihan) { apUsul += CONFIG.KOS_AP[a.pilihan.peranan] || 0; } });
    ringkasan.perubahan = {
      ip: ringkasan.usul.reduce(function (n, u) { return n + u.ip; }, 0) + kesanPemilihan.ip,
      reputasi: ringkasan.usul.reduce(function (n, u) { return n + u.reputasi; }, 0) + kesanPemilihan.reputasi,
      ap: -apUsul + kesanPemilihan.ap,
      myr: kesanPemilihan.myr
    };
    ringkasan.perubahanUsulIP = ringkasan.usul.reduce(function (n, u) { return n + u.ip; }, 0);
    ringkasan.perubahanPemilihanIP = kesanPemilihan.ip;
    pemilihan.forEach(function (x) { if (x.ok) { x.peristiwa.forEach(function (e) { ringkasan.peristiwa.push(e.mesej); }); } });
    m.status = 'selesai'; m.tamat = new Date().toISOString(); m.ringkasan = ringkasan;

    var r = S.applyEffects({}, {
      kiraTindakan: false, patch: { mesyuarat: ms },
      log: { tindakan: 'tutup_mesyuarat', nama: PERINGKAT[peringkat].nama + ' ' + p.tahun + ' ditutup', peringkat: peringkat }
    });
    if (!r.ok) { return r; }

    var peristiwa = [];
    pemilihan.forEach(function (x) { if (x.ok) { x.peristiwa.forEach(function (e) { peristiwa.push(e); }); } });
    var mesej = PERINGKAT[peringkat].nama + ' ditutup. ' + ringkasan.lulus + ' usul lulus, ' + ringkasan.ditolak + ' ditolak.' +
      (adalahSayap(peringkat) ? (ringkasan.usulDibawa ? ' Usul dibawa ke ' + ringkasan.usulDibawa.ke + ': ' + ringkasan.usulDibawa.tajuk + '.' : ' Tiada usul dibawa ke mesyuarat utama.') : '');
    pemilihan.forEach(function (x) { if (x.ok) { mesej += ' ' + x.mesej; } else { mesej += ' ' + x.ralat; } });
    var penuh = getRingkasan(peringkat, r.profil);
    return { ok: true, mesej: mesej, ringkasan: penuh || ringkasan, pemilihan: pemilihan, peristiwa: peristiwa, profil: r.profil };
  }

  return {
    CONFIG: CONFIG,
    PERINGKAT: PERINGKAT,
    KOLAM: KOLAM,
    senaraiPeranan: senaraiPeranan,
    getKeadaanMesyuarat: getKeadaanMesyuarat,
    getStatusPerwakilan: getStatusPerwakilan,
    getRingkasan: getRingkasan,
    mulaMesyuarat: mulaMesyuarat,
    pilihPeranan: pilihPeranan,
    tutupMesyuarat: tutupMesyuarat
  };
});
