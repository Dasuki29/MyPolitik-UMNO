/* ==========================================================================
   Nusa Politik — js/perlembagaan.js   (v4.7)
   Rujukan Perlembagaan UMNO: modal dengan fasal boleh lipat (accordion).
   Dibuka oleh sebarang elemen berkaitan [data-perlembagaan] (menu utama dan dashboard).
   Berdiri sendiri: CSS dan modal disuntik oleh fail ini; tiada kebergantungan.

   Sumber: "Perlembagaan UMNO 2025" (PDF yang dirujuk dalam projek ini). Teks di bawah ialah
   RINGKASAN untuk rujukan permainan, bukan teks undang-undang penuh. Nombor fasal/sub-fasal
   mengikut dokumen. Nota "Dalam permainan" menerangkan bagaimana permainan menggunakannya
   (termasuk bila permainan memudahkan sesuatu).

   Tambah fasal lain dengan menokok satu objek ke dalam FASAL.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
  else { root.MyPolitikPerlembagaan = factory(root); }
})(typeof window !== 'undefined' ? window : this, function (W) {
  'use strict';

  var SUMBER = 'Perlembagaan UMNO 2025';

  /* kod = rujukan sub-fasal; t = ringkasan. */
  var FASAL = [
    {
      no: 3, tajuk: 'Asas dan Tujuan',
      ringkas: 'UMNO ialah parti politik yang berjuang mendukung cita-cita Agama Islam, Kebangsaan Melayu, Bumiputera, Anak Negeri Sabah dan Orang Asli serta perpaduan Malaysia demi kemakmuran dan kestabilan negara.',
      poin: [
        ['3.1', 'Menegak, mempertahan dan mengembangkan Islam sebagai Agama Persekutuan, serta menghormati kebebasan beragama seperti dalam Perlembagaan Persekutuan.'],
        ['3.2', 'Mempertahankan kemerdekaan dan kedaulatan negara.'],
        ['3.3', 'Mendukung asas-asas Perlembagaan Persekutuan selagi ia membela kepentingan Raja-raja Melayu, Bangsa Melayu, Bumiputera, Anak Negeri Sabah dan Orang Asli (termasuk Perkara 153), prinsip Kontrak Sosial dan Undang-Undang Tubuh Negeri.'],
        ['3.4', 'Membela nasib rakyat Malaysia tanpa mengira latar belakang kaum.'],
        ['3.5', 'Mempertahankan kedaulatan rakyat dan keadilan sosial melalui Demokrasi Berparlimen, serta memajukan ekonomi Melayu, Bumiputera, Anak Negeri Sabah dan Orang Asli khasnya dan rakyat Malaysia amnya.'],
        ['3.6', 'Menjamin Bahasa Melayu sebagai Bahasa Rasmi tunggal negara dan Kebudayaan Kebangsaan yang berteraskan Kebudayaan Melayu.'],
        ['3.7', 'Mewujudkan kerjasama antara kaum bagi melahirkan rakyat Malaysia yang kuat dan bersatu, berasaskan prinsip hak asasi manusia dan hak keistimewaan yang terkandung.']
      ],
      permainan: 'Fasal ini ialah latar nilai parti. Ia tidak mempengaruhi pengiraan permainan secara langsung.'
    },
    {
      no: 6, tajuk: 'Tanggungjawab dan Hak Ahli',
      ringkas: 'Menetapkan tanggungjawab, hak dan perkara yang ahli biasa tidak berhak lakukan. Ahli Bergabung dan Ahli Bersekutu mempunyai tanggungjawab hampir sama sebagai pemerhati (6.4, 6.5).',
      poin: [
        ['6.1', 'Tanggungjawab ahli biasa: memegang teguh dasar parti; mendaftar dan mengundi dalam pilihan raya (kecuali sebab yang diterima MKT); menghadiri mesyuarat dan kegiatan parti; mematuhi tataetika, perintah dan disiplin; menyokong calon parti; berkhidmat kepada orang ramai; bersedia menentang musuh negara.'],
        ['6.2.1–6.2.3', 'Hak ahli biasa: bercakap, mengemukakan pendapat dan mengundi dalam mesyuarat parti; memilih, dipilih dan dilantik ke sebarang jawatan; mengambil bahagian dalam pilihan raya dan menerima lantikan sebagai calon.'],
        ['6.2.4', 'Ahli yang sedang dalam cadangan untuk digantung atau dipecat tidak hilang hak keahliannya (hak hanya terjejas selepas hukuman dikenakan).'],
        ['6.2.5–6.2.6', 'Ahli yang bukan wakil ke Perwakilan Bahagian atau Perhimpunan Agung boleh dicalonkan dan bertanding jika memenuhi syarat Fasal 9.5 dan 15.5. Ahli yang tidak hadir Persidangan Cawangan boleh dicalonkan dengan persetujuan bertulis.'],
        ['6.3.1–6.3.2', 'Ahli tidak berhak menjadi ahli lebih daripada satu Cawangan dan tidak boleh mewakilkan hak mengundinya kepada sesiapa.'],
        ['6.3.3', 'Ahli tidak boleh menggunakan hak di bawah Fasal 6.2 jika tidak menjelaskan yuran mengikut Perlembagaan.'],
        ['6.3.4', 'Ahli tidak boleh menggunakan hak di bawah Fasal 6.2 jika dilarang di bawah Akta Pertubuhan 1966, atau setakat mana ia dikenakan hukuman disiplin di bawah Fasal 20.10 dan 20.11.'],
        ['6.3.5–6.3.6', 'Tidak boleh memegang jawatan Pengerusi Tetap, Timbalan Pengerusi Tetap, Pemeriksa Kira-kira atau AJK di lebih satu Cawangan/Bahagian tanpa kebenaran bertulis MKT; dan tidak boleh menjadi AJK di peringkat yang sama dengan jawatan-jawatan tersebut.'],
        ['6.3.7–6.3.8', 'Tidak boleh bercakap, mengundi, memilih dan dipilih dalam Persidangan Cawangan dan Perwakilan Bahagian selain Cawangan dan Bahagian di mana ia menjadi ahli; dan tidak boleh menggunakan hak yang sama di Cawangan/Bahagian baharu jika sudah menggunakannya di tempat asal pada tahun itu.']
      ],
      permainan: 'Ahli yang dikenakan hukuman gantung hilang hak mencalon, mengundi dan bertanding, dan dilucutkan jawatan, selaras dengan 6.3.4 dan 20.10(b). Ahli yang hanya dalam siasatan masih mempunyai hak penuh (6.2.4).'
    },
    {
      no: 8, tajuk: 'Perhimpunan Agung',
      ringkas: 'Perhimpunan Agung ialah kuasa tertinggi parti. Perjalanan parti berasaskan kuasa dan perintahnya, tertakluk kepada Perlembagaan dan Peraturan UMNO.',
      poin: [
        ['8.1', 'Perhimpunan Agung ialah kuasa tertinggi parti.'],
        ['8.2', 'Perhimpunan Agung Tahunan diadakan sekali setahun pada masa yang ditetapkan MKT, dengan syarat tidak lewat 18 bulan daripada tarikh Perhimpunan Agung yang lalu.'],
        ['8.3', 'Tugas: menentukan dasar parti, mengkaji kerja MKT dan melantik Juruaudit untuk tempoh MKT.'],
        ['8.4.1–8.4.2', 'Anggota: Pengerusi Tetap dan Timbalan Pengerusi Tetap, serta ahli-ahli MKT.'],
        ['8.4.3', 'Wakil yang dipilih oleh Perwakilan Tahunan Bahagian: seorang wakil bagi setiap 500 ahli, tidak lebih tujuh (7) orang dari satu Bahagian.'],
        ['8.4.4', 'Ketua, Timbalan Ketua, Naib Ketua, Ketua Wanita, Ketua Pemuda, Ketua Puteri, Setiausaha dan Ketua Penerangan Bahagian yang telah mengadakan Perwakilan Bahagiannya.'],
        ['8.4.5', 'Tidak lebih sepuluh (10) wakil masing-masing daripada Wanita UMNO, Pergerakan Pemuda dan Pergerakan Puteri, dipilih oleh Perhimpunan Agung sayap berkenaan.']
      ],
      permainan: 'Perhimpunan Agung diadakan pada bulan 8 setiap tahun. Kuota perwakilan Bahagian ke PAU dikira 1 bagi setiap 500 ahli, minimum 1 dan maksimum 7 (diringkaskan oleh permainan).'
    },
    {
      no: 14, tajuk: 'Bahagian',
      ringkas: 'Bahagian ditubuhkan oleh MKT di setiap kawasan Parlimen. Perjalanan Bahagian berasaskan kuasa dan perintah Perwakilan Bahagian.',
      poin: [
        ['14.1', 'MKT berkuasa menubuhkan sebuah Bahagian di setiap kawasan Pilihanraya Dewan Rakyat.'],
        ['14.2', 'Perjalanan Bahagian berasaskan kuasa dan perintah Perwakilan Bahagian, tertakluk kepada Perlembagaan dan Peraturan Persidangan.'],
        ['14.3', 'Perwakilan Bahagian diadakan sekali setahun, tidak kurang enam puluh (60) hari sebelum Perhimpunan Agung. MKT boleh memberi kelonggaran.'],
        ['14.4', 'Anggota Perwakilan Bahagian: Pengerusi Tetap dan Timbalannya; AJK Bahagian; Ketua Cawangan yang Cawangannya telah bersidang pada tahun itu; wakil Cawangan; wakil dan Ketua sayap Cawangan.'],
        ['14.4.4', 'Wakil Cawangan dilantik oleh Persidangan Cawangan: seorang bagi setiap lima puluh (50) ahli, tidak lebih lima (5) orang dari satu Cawangan.'],
        ['14.4.5', 'Tidak lebih sepuluh (10) wakil Wanita UMNO, sepuluh (10) wakil Pemuda dan sepuluh (10) wakil Puteri yang dipilih oleh Perwakilan Bahagian masing-masing.'],
        ['14.5', 'Tugas Perwakilan Bahagian: memilih AJK Bahagian, memilih tujuh (7) wakil Bahagian ke Perhimpunan Agung daripada penama yang telah mendaftar, dan membincangkan dasar untuk dikemukakan di Perhimpunan Agung. Wakil yang tidak dipilih atau diubah kemudian tidak sah.']
      ],
      permainan: 'Perwakilan Bahagian diadakan pada bulan 7. Kuota wakil Cawangan dalam permainan: 1 bagi setiap 50 ahli, minimum 1, maksimum 5 (14.4.4). Pemain mesti memenangi mandat perwakilan untuk bertanding di peringkat Bahagian.'
    },
    {
      no: 17, tajuk: 'Cawangan',
      ringkas: 'Cawangan ditubuhkan, digantung atau dibubarkan oleh MKT selepas berunding dengan Jawatankuasa Bahagian. Perjalanan Cawangan berasaskan kuasa dan perintah Persidangan Cawangan.',
      poin: [
        ['17.1', 'MKT berkuasa menubuhkan, menggantung dan membubarkan Cawangan selepas berunding dan merujuk kepada Jawatankuasa Bahagian berkenaan.'],
        ['17.3', 'Persidangan Cawangan diadakan setahun sekali, tidak lewat empat belas (14) hari sebelum tarikh Perwakilan Bahagian.'],
        ['17.4', 'Persidangan Cawangan terdiri daripada Pengerusi Tetap dan Timbalannya, AJK Cawangan, dan ahli UMNO yang telah menjelaskan yuran mengikut Fasal 25.1.'],
        ['17.5', 'Tugas: membincangkan dasar untuk Perwakilan Bahagian; mengkaji kerja Jawatankuasa Cawangan; mengadakan rancangan kerja untuk faedah rakyat; memilih AJK (tertakluk Fasal 18.2); memilih Pengerusi Tetap, Timbalan Pengerusi Tetap dan dua Pemeriksa Kira-kira; dan memilih wakil ke Perwakilan Bahagian.'],
        ['17.5.6', 'Wakil yang tidak dipilih dalam Persidangan Cawangan, atau sebarang pertukaran selepas itu, tidak sah.'],
        ['17.6', 'Persidangan Khas Cawangan diadakan atas permintaan bertulis satu perdua jumlah ahli. Jika Setiausaha tidak memanggilnya dalam 14 hari, Jawatankuasa Bahagian memanggilnya.']
      ],
      permainan: 'Persidangan Cawangan diadakan antara bulan 4 hingga 6. Setiap Cawangan dalam permainan diwakili oleh satu Daerah Mengundi (Lokaliti), dengan bilangan ahli rekaan permainan.'
    },
    {
      no: 20, tajuk: 'Disiplin',
      ringkas: 'Menubuhkan Lembaga Disiplin (Pusat) dan Jawatankuasa Disiplin (Negeri), menetapkan hukuman, rayuan dan kes keahlian gugur.',
      poin: [
        ['20.1–20.3', 'MKT menubuhkan Lembaga Disiplin di Pusat dan Jawatankuasa Disiplin di peringkat negeri serta menetapkan peraturan dan bidang kuasanya. Ahli Jawatankuasa Disiplin Negeri terdiri daripada ahli yang tidak berjawatan dalam parti dan tidak mempunyai kepentingan dalam pemilihan (20.2).'],
        ['20.4', 'Selepas mendengar dan berpuas hati terhadap pelanggaran Perlembagaan atau Tataetika Ahli, hukuman boleh dikenakan mengikut kuasa Perlembagaan.'],
        ['20.5', 'Setiap peringkat parti melaporkan kepada Jawatankuasa Disiplin dahulu sebelum dibawa ke Lembaga Disiplin.'],
        ['20.6', 'Ahli yang tidak berpuas hati merayu kepada Lembaga Disiplin dahulu; rayuan terakhir ke MKT untuk keputusan muktamad.'],
        ['20.7', 'Ahli yang membawa perkara parti atau hak keahliannya ke mahkamah sebelum mematuhi sepenuhnya peraturan parti, keahliannya gugur dengan sendirinya.'],
        ['20.8', 'Ahli yang menjadi ahli berdaftar parti politik lain, keahliannya gugur setelah disahkan MKT.'],
        ['20.9', 'Kewajipan ahli: patuh Perlembagaan dan Tataetika, ikut perintah parti, jalankan dasar, hormati keputusan, jaga rahsia, pelihara nama baik dan maruah parti, dan sentiasa bertatalaku sopan.'],
        ['20.10', 'Hukuman: (a) amaran; (b) gantung hak dalam parti; (c) dilarang bertanding jawatan parti atau sebagai calon pilihan raya, bagi tempoh yang ditentukan MKT; (d) dipecat setelah disahkan MKT; (e) tindakan lain yang wajar.'],
        ['20.11', 'Keahlian gugur automatik jika ahli yang dipilih sebagai Ahli Dewan Rakyat/DUN menyertai pakatan politik yang tidak dianggotai UMNO atau menjadi wakil bebas, atau bertanding sebagai calon bebas atau calon pakatan politik yang tidak dianggotai UMNO.'],
        ['20.12', 'Rayuan: penggantungan boleh dirayu selepas dua (2) tahun daripada tarikh dihukum; pemecatan selepas tiga (3) tahun; pengguguran dari tarikh keahlian gugur.'],
        ['20.13', 'MKT berkuasa membuat kaedah Tataetika Ahli, termasuk melarang penyalahgunaan kuasa dan wang untuk mendapat undi atau sokongan atau mempengaruhi pemilihan.']
      ],
      permainan: 'Kempen kotor (politik wang dan sebagainya) boleh mencetuskan aduan, pendengaran dan hukuman 20.10(a)–(d). Tempoh gantung 12 bulan dan larangan bertanding 36 bulan ialah angka permainan (Perlembagaan menyerahkan tempoh kepada MKT). Rayuan hanya dimodelkan bagi pemecatan (3 tahun, 20.12.2).'
    }
  ];

  /* ------------------------------------------------------------------ */
  var doc = W && W.document, kandungan = null, terbuka = false, pemicu = null;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var CSS = [
    '.plb{position:fixed;inset:0;z-index:350;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(5,6,9,.78)}',
    '.plb.is-buka{display:flex}',
    '.plb__kotak{width:min(720px,100%);max-height:min(88vh,860px);display:flex;flex-direction:column;background:var(--bg-elev-2,#1D2028);color:var(--text,#F4F5F7);border:1px solid var(--gold-dark,#C99700);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.6);overflow:hidden;font-family:inherit}',
    '.plb__kepala{display:flex;align-items:flex-start;gap:12px;padding:16px 18px 12px;border-bottom:1px solid var(--border,#2E333F)}',
    '.plb__kepala h2{margin:0;font-size:1.15rem;line-height:1.25}',
    '.plb__kepala p{margin:4px 0 0;font-size:.8rem;color:var(--text-muted,#A3A9B8)}',
    '.plb__tutup{margin-left:auto;flex:none;width:36px;height:36px;border-radius:50%;border:1px solid var(--border,#2E333F);background:transparent;color:inherit;font:700 1.1rem/1 inherit;cursor:pointer}',
    '.plb__tutup:hover{border-color:var(--gold,#F2B705)}',
    '.plb__alat{display:flex;gap:8px;padding:10px 18px;border-bottom:1px solid var(--border,#2E333F)}',
    '.plb__alat button{font:inherit;font-size:.78rem;padding:6px 12px;border-radius:999px;border:1px solid var(--border,#2E333F);background:transparent;color:var(--text-muted,#A3A9B8);cursor:pointer}',
    '.plb__alat button:hover{color:var(--gold,#F2B705);border-color:var(--gold,#F2B705)}',
    '.plb__isi{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 18px 8px;display:grid;gap:8px}',
    '.plb-fasal{border:1px solid var(--border,#2E333F);border-radius:12px;background:rgba(255,255,255,.02)}',
    '.plb-fasal.is-buka{border-color:rgba(242,183,5,.45)}',
    '.plb-fasal__btn{width:100%;display:flex;align-items:center;gap:12px;text-align:left;padding:12px 14px;background:transparent;border:0;color:inherit;font:inherit;cursor:pointer;border-radius:12px}',
    '.plb-fasal__no{flex:none;min-width:64px;font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gold,#F2B705)}',
    '.plb-fasal__tajuk{font-weight:600;font-size:.98rem}',
    '.plb-fasal__ikon{margin-left:auto;flex:none;transition:transform .2s;color:var(--text-muted,#A3A9B8)}',
    '.plb-fasal.is-buka .plb-fasal__ikon{transform:rotate(180deg)}',
    '.plb-fasal__btn:focus-visible,.plb__tutup:focus-visible,.plb__alat button:focus-visible{outline:2px solid var(--gold,#F2B705);outline-offset:2px}',
    '.plb-fasal__badan{padding:0 14px 14px;font-size:.9rem;line-height:1.55}',
    '.plb-fasal__badan[hidden]{display:none}',
    '.plb-fasal__ringkas{margin:0 0 10px;color:var(--text-muted,#A3A9B8)}',
    '.plb-fasal__senarai{margin:0;padding:0;list-style:none;display:grid;gap:8px}',
    '.plb-fasal__senarai li{display:grid;grid-template-columns:72px 1fr;gap:10px}',
    '.plb-fasal__senarai b{font-size:.78rem;color:var(--gold,#F2B705);font-variant-numeric:tabular-nums;padding-top:1px}',
    '.plb-fasal__main{margin:12px 0 0;padding:10px 12px;border-radius:10px;background:rgba(242,183,5,.07);border:1px solid rgba(242,183,5,.3);font-size:.84rem}',
    '.plb-fasal__main b{display:block;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--gold,#F2B705);margin-bottom:2px}',
    '.plb__kaki{padding:10px 18px 14px;border-top:1px solid var(--border,#2E333F);font-size:.74rem;color:var(--text-muted,#A3A9B8)}',
    '.plb-btn-teks{display:none}',
    '@media(min-width:620px){.plb-btn-teks{display:inline}}',
    '@media(max-width:520px){.plb-fasal__senarai li{grid-template-columns:1fr;gap:0}.plb-fasal__no{min-width:52px}}',
    '@media(prefers-reduced-motion:reduce){.plb-fasal__ikon{transition:none}}',
    'body.plb-kunci{overflow:hidden}'
  ].join('\n');

  function binaFasal(f, i) {
    var id = 'plb-f' + f.no;
    return '<section class="plb-fasal" data-fasal="' + f.no + '">' +
      '<h3 style="margin:0"><button type="button" class="plb-fasal__btn" aria-expanded="false" aria-controls="' + id + '" id="' + id + '-btn">' +
        '<span class="plb-fasal__no">Fasal ' + f.no + '</span><span class="plb-fasal__tajuk">' + esc(f.tajuk) + '</span>' +
        '<svg class="plb-fasal__ikon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
      '</button></h3>' +
      '<div class="plb-fasal__badan" id="' + id + '" role="region" aria-labelledby="' + id + '-btn" hidden>' +
        '<p class="plb-fasal__ringkas">' + esc(f.ringkas) + '</p>' +
        '<ul class="plb-fasal__senarai">' + f.poin.map(function (x) { return '<li><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ul>' +
        (f.permainan ? '<p class="plb-fasal__main"><b>Dalam permainan</b>' + esc(f.permainan) + '</p>' : '') +
      '</div></section>';
  }

  function sediakan() {
    if (kandungan || !doc) { return kandungan; }
    kandungan = doc.createElement('div');
    kandungan.className = 'plb'; kandungan.setAttribute('role', 'dialog'); kandungan.setAttribute('aria-modal', 'true'); kandungan.setAttribute('aria-labelledby', 'plb-tajuk');
    kandungan.innerHTML =
      '<div class="plb__kotak">' +
        '<div class="plb__kepala"><div><h2 id="plb-tajuk">📜 Perlembagaan Parti</h2><p>Ringkasan fasal utama daripada ' + esc(SUMBER) + '. Tekan satu fasal untuk membuka atau menutupnya.</p></div>' +
        '<button type="button" class="plb__tutup" data-plb="tutup" aria-label="Tutup">&times;</button></div>' +
        '<div class="plb__alat"><button type="button" data-plb="buka-semua">Buka semua</button><button type="button" data-plb="tutup-semua">Tutup semua</button></div>' +
        '<div class="plb__isi">' + FASAL.map(binaFasal).join('') + '</div>' +
        '<div class="plb__kaki">Ini ringkasan untuk rujukan dalam permainan, bukan teks undang-undang penuh. Rujuk dokumen Perlembagaan UMNO yang sah untuk teks lengkap. Permainan ini simulasi dan bukan laman rasmi parti.</div>' +
      '</div>';
    doc.body.appendChild(kandungan);

    kandungan.addEventListener('click', function (e) {
      var t = e.target;
      if (t === kandungan) { tutup(); return; }                                   // klik latar
      var a = t.closest ? t.closest('[data-plb]') : null;
      if (a) {
        var v = a.getAttribute('data-plb');
        if (v === 'tutup') { tutup(); } else if (v === 'buka-semua') { semua(true); } else if (v === 'tutup-semua') { semua(false); }
        return;
      }
      var b = t.closest ? t.closest('.plb-fasal__btn') : null;
      if (b) { togol(b.parentNode.parentNode, null); }
    });
    return kandungan;
  }

  function togol(seksyen, paksa) {
    var btn = seksyen.querySelector('.plb-fasal__btn'), badan = seksyen.querySelector('.plb-fasal__badan');
    var buka = paksa === null ? btn.getAttribute('aria-expanded') !== 'true' : !!paksa;
    btn.setAttribute('aria-expanded', String(buka)); badan.hidden = !buka; seksyen.classList.toggle('is-buka', buka);
  }
  function semua(buka) { Array.prototype.forEach.call(kandungan.querySelectorAll('.plb-fasal'), function (s) { togol(s, buka); }); }

  function kekunci(e) {
    if (e.key === 'Escape') { e.stopPropagation(); tutup(); return; }
    if (e.key !== 'Tab') { return; }
    var f = kandungan.querySelectorAll('button:not([hidden])'), a = Array.prototype.filter.call(f, function (x) { return x.offsetParent !== null; });
    if (!a.length) { return; }
    var p = a[0], q = a[a.length - 1];
    if (e.shiftKey && doc.activeElement === p) { e.preventDefault(); q.focus(); }
    else if (!e.shiftKey && doc.activeElement === q) { e.preventDefault(); p.focus(); }
  }

  /** Buka modal. fasal (pilihan): nombor fasal yang dibuka terus. */
  function buka(fasal) {
    if (!sediakan()) { return; }
    pemicu = doc.activeElement;
    kandungan.classList.add('is-buka'); doc.body.classList.add('plb-kunci'); terbuka = true;
    semua(false);
    if (fasal) { var s = kandungan.querySelector('[data-fasal="' + fasal + '"]'); if (s) { togol(s, true); s.scrollIntoView({ block: 'nearest' }); } }
    doc.addEventListener('keydown', kekunci, true);
    var x = kandungan.querySelector('.plb__tutup'); if (x) { x.focus(); }
  }
  function tutup() {
    if (!kandungan || !terbuka) { return; }
    kandungan.classList.remove('is-buka'); doc.body.classList.remove('plb-kunci'); terbuka = false;
    doc.removeEventListener('keydown', kekunci, true);
    if (pemicu && pemicu.focus) { try { pemicu.focus(); } catch (e) { /* abaikan */ } }
  }

  if (doc) {
    var st = doc.createElement('style'); st.setAttribute('data-plb', ''); st.textContent = CSS; doc.head.appendChild(st);   // awal, supaya .plb-btn-teks berfungsi
    doc.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-perlembagaan]') : null;
      if (!b) { return; }
      e.preventDefault();
      var f = parseInt(b.getAttribute('data-perlembagaan'), 10);
      buka(isNaN(f) ? null : f);
    });
  }

  return { FASAL: FASAL, SUMBER: SUMBER, buka: buka, tutup: tutup };
});
