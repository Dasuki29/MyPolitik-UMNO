/* ==========================================================================
   Nusa Politik — js/latihan.js   (v7.13)
   Mod Latihan "Amir": permainan contoh berpandu daripada ahli biasa hingga Rumusan Kerjaya.

   Reka bentuk:
   - Simpanan latihan BERASINGAN. Semasa mula, tiga kunci aktif (pemain, acara, tutorial)
     disalin ke 'myPolitik_latihan_asal', kemudian watak "Amir" ditulis ke kunci biasa.
     Apabila keluar / tamat, kunci asal dipulihkan. Modul lain tidak berubah.
   - Enjin sebenar digunakan. Pemandu hanya menyorot butang. Pemain boleh menekan butang
     yang disorot, atau menekan "Seterusnya". Selepas itu, langkah berikut menyediakan
     keadaan (tarikh, IP, jawatan, kemenangan) supaya cerita sentiasa sampai ke legacy.
   - Pemandu tidak menghalang klik (lubang sorotan ialah bayang sahaja) dan bersembunyi
     apabila modal permainan dibuka.

   API (window.MyPolitikLatihan):
     aktif()                 true jika mod latihan sedang berjalan
     tawar(opts)             tawarkan latihan kepada pemain baharu; pulang true jika ditawarkan
     init(opts)              pasang pemandu jika latihan aktif (dashboard)
     mula() / keluar(opts)   mula / tamat dan pulihkan simpanan asal
     pulihJikaPerlu()        (menu utama) pulihkan simpanan asal jika latihan tertinggal
     pasangLegasi(nod)       tambah penutup latihan pada skrin Rumusan Kerjaya
     LANGKAH                 skrip langkah (untuk ujian)
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikLatihan = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  var K_BANDERA = 'myPolitik_latihan', K_ASAL = 'myPolitik_latihan_asal', K_TAWAR = 'myPolitik_latihan_tawar';
  var KUNCI = { player: 'myPolitik_player', events: 'myPolitik_events', tutorial: 'myPolitik_tutorial' };

  /* ---------- storan & modul ---------- */
  function stor() { try { return root.localStorage || null; } catch (e) { return null; } }
  function baca(k) { var s = stor(); try { return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function tulis(k, v) { var s = stor(); if (!s) { return; } try { if (v === null || v === undefined) { s.removeItem(k); } else { s.setItem(k, v); } } catch (e) { /* abaikan */ } }
  function S() { return root.MyPolitikSave || null; }
  function D() { return root.MyPolitikData || null; }
  function m(n) { return root['MyPolitik' + n] || null; }
  function doc() { return root.document || null; }
  function bendera() { try { return JSON.parse(baca(K_BANDERA) || 'null'); } catch (e) { return null; } }
  function aktif() { var b = bendera(); return !!(b && b.aktif); }

  /* ---------- simpanan berasingan ---------- */
  function sandar() {
    var asal = {};
    Object.keys(KUNCI).forEach(function (j) { asal[j] = baca(KUNCI[j]); });
    tulis(K_ASAL, JSON.stringify(asal));
  }
  function pulih() {
    var a; try { a = JSON.parse(baca(K_ASAL) || 'null'); } catch (e) { a = null; }
    if (a) { Object.keys(KUNCI).forEach(function (j) { tulis(KUNCI[j], a[j] === undefined ? null : a[j]); }); }
    tulis(K_ASAL, null); tulis(K_BANDERA, null);
    return !!a;
  }

  function binaAmir(p) {
    var d = D().tentukanDemografi('L', 28), ci = p.cawanganInfo || {};
    var c = { id: p.id, idSheet: p.id, nama: p.cawangan, dunNama: p.dun, bahagianNama: p.bahagian, negeri: p.negeri,
      jumlahAhli: ci.jumlahAhli, lelaki: ci.lelaki, perempuan: ci.perempuan, bawah40: ci.bawah40, atas40: ci.atas40, kumpulan: ci.kumpulan };
    return S().buildPlayerProfile({ nama: 'Amir', demografik: d, cawangan: c, sayap: 'utama', tahunAhli: 0 });
  }

  function mula() {
    var s = S(), p = s && s.loadPlayer();
    if (!p || aktif()) { return false; }
    sandar();
    var amir = binaAmir(p);
    var r = s.savePlayer(amir);
    if (!r.ok) { tulis(K_ASAL, null); return false; }
    tulis(KUNCI.events, null); tulis(KUNCI.tutorial, null);
    tulis(K_BANDERA, JSON.stringify({ aktif: true, langkah: 0 }));
    return true;
  }

  function keluar(opts) {
    pulih();
    if (doc()) { var n = doc().getElementById('lat-ov'); if (n && n.parentNode) { n.parentNode.removeChild(n); } }
    if (!(opts && opts.diam) && root.location) { root.location.assign('dashboard.html'); }
  }

  function pulihJikaPerlu() { if (aktif() || baca(K_ASAL)) { return pulih(); } return false; }

  /* ---------- pembantu penyediaan keadaan (menolak hasil ke enjin sebenar) ---------- */
  function tampal(patch) {
    var s = S(); if (!s) { return false; }
    var r = s.applyEffects({}, { kiraTindakan: false, patch: patch });
    return !!(r && r.ok);
  }
  function pemain() { return S().loadPlayer(); }
  function salin(o) { return JSON.parse(JSON.stringify(o)); }
  function jawatan(kod, nama, per, pang, tahun) { return { kod: kod, jawatan: nama, peringkat: per, kumpulan: 'utama', sayap: null, pangkat: pang, tahun: tahun }; }

  function sediaPemilihan() { tampal({ ip: 90, myr: 3000 }); }
  function sediaPRU() {
    var P = m('PRU'); if (!P) { return; }
    var p = pemain(), pru = salin(P.getPRU(p));
    pru.aktif = null; pru.tahunPRU = 2031; pru.bulanPRU = 3;
    tampal({ tahun: 2031, bulan: 2, ip: 700, myr: 30000, reputasi: 70, ap: 5, pru: pru,
      jawatan: 'Ketua Bahagian', jawatanList: [jawatan('ketua_bahagian', 'Ketua Bahagian', 'bahagian', 7, 2029)] });
  }
  function sediaMusimPRU() {                                       // pastikan PRU sedang berjalan supaya tab Pilihan Raya muncul
    var P = m('PRU'); if (!P) { return; }
    var p = pemain(); if (P.getPRU(p).aktif || (P.getPRU(p).sejarah || []).length) { return; }
    tampal({ tahun: 2031, bulan: 3 });
    try { P.prosesBulan({ rng: function () { return 0.99; } }); } catch (e) { /* abaikan */ }
  }
  function sediaKemenangan() {
    var P = m('PRU'); if (!P) { return; }
    var p = pemain(), pru = salin(P.getPRU(p)), sj = pru.sejarah || [];
    pru.aktif = null;
    var ada = sj.filter(function (r) { return r.hasil === 'menang'; })[0];
    if (!ada) {
      sj = sj.concat([{ jenis: 'PARLIMEN', kerusi: 'Parlimen ' + (p.bahagian || ''), hasil: 'menang', anda: 54.2, majoriti: 4200, tahun: 2031, bulan: 3 }]);
    }
    pru.sejarah = sj;
    pru.status = pru.status || { jenis: 'MP', kerusi: 'Parlimen ' + (p.bahagian || ''), sejakTahun: 2031, sejakBulan: 3, kerajaan: true };
    pru.tahunPRU = 2036; pru.bulanPRU = 3;
    tampal({ pru: pru, ip: Math.max(Number(p.ip) || 0, 700) });
    var Kb = m('Kabinet'); p = pemain();
    if (Kb && Kb.getKabinet && Kb.bukaLobi && !Kb.getKabinet(p).hasGovernmentRole && !Kb.getKabinet(p).lobi) { try { Kb.bukaLobi('PARLIMEN'); } catch (e) { /* abaikan */ } }
  }
  function sediaKabinet() {
    var Kb = m('Kabinet'); if (!Kb) { return; }
    var p = pemain(), k = salin(Kb.getKabinet(p));
    if (k.hasGovernmentRole) { return; }
    k.hasGovernmentRole = true; k.roleLevel = 'MENTERI_PENUH'; k.portfolioName = 'Menteri Pembangunan Luar Bandar'; k.portfolioId = 'm_luarbandar';
    k.governanceRating = 62; k.ratingLalu = 58; k.tekananPolitik = 25; k.bulanBerjawatan = 4; k.ratingRendah = 0; k.lobi = null; k.acara = null;
    k.popularitiNasional = 55; k.risikoRombak = 6; k.cdfBaki = 8000; k.cdfBulan = 0; k.cdfJumlah = 0;
    k.sejarah = (k.sejarah || []).concat([{ tahun: 2031, bulan: 6, nama: k.portfolioName, hasil: 'dilantik' }]);
    tampal({ kabinet: k, tahun: 2031, bulan: 8 });
  }
  function sediaPRK() {
    var K = m('PRK'); if (!K) { return; }
    var p = pemain(), pk = salin(K.getPRK(p));
    if (pk.aktif) { return; }
    tampal({ tahun: 2033, bulan: 5 });
    try { K.triggerByElection({ paksa: true, jenis: 'DUN', sebab: 'kematian', pertahan: true }); } catch (e) { /* abaikan */ }
  }
  function sediaPenutup() {
    var K = m('PRK'), P = m('PRU'); if (!K || !P) { return; }
    var p = pemain(), pk = salin(K.getPRK(p)), pru = salin(P.getPRU(p));
    pk.aktif = null; pru.aktif = null;
    if (!(pk.sejarah || []).some(function (r) { return r.hasil === 'menang'; })) {
      pk.sejarah = (pk.sejarah || []).concat([{ jenis: 'DUN', kerusi: 'DUN ' + (p.dun || ''), hasil: 'menang', anda: 53.1, majoriti: 900, pertahan: true, tahun: 2033, bulan: 5 }]);
    }
    tampal({ prk: pk, pru: pru, reputasi: Math.max(Number(p.reputasi) || 0, 70) });
  }

  /* ---------- skrip langkah ----------
     tab     : tab dashboard untuk dibuka
     sasaran : pemilih CSS yang disorot (tiada / tidak kelihatan = kad di tengah)
     klik    : menekan sasaran memajukan langkah
     sedia   : fungsi yang menyediakan keadaan sebelum langkah dipaparkan                         */
  var LANGKAH = [
    { tajuk: 'Kenali Amir', teks: 'Saya <b>Amir</b>, ahli biasa sebuah cawangan UMNO pada 2026. Ikut saya dari awal hingga <b>Rumusan Kerjaya</b>. Tekan butang yang bercahaya, atau <b>Seterusnya</b> bila-bila masa. Simpanan anda sendiri selamat dan tidak disentuh.' },
    { tajuk: 'Tiga sumber utama', sasaran: '#r-ip', bekas: '.stat', teks: '<b>IP</b> ialah kekuatan politik. <b>Dana (MYR)</b> untuk kempen dan jamuan. <b>AP</b> ialah mata tindakan: 5 setiap bulan, tidak dibawa ke bulan depan.' },
    { tajuk: 'Buka tab Tindakan', sasaran: '#tab-tindakan', klik: true, teks: 'Kerja akar umbi bermula di sini. Tekan tab <b>Tindakan</b>.' },
    { tajuk: 'Guna AP anda', tab: 'tindakan', sasaran: '.choice[data-act="tindakan"]:not([disabled])', klik: true, teks: 'Pilih satu tindakan, contohnya <b>Ziarah Kasih</b>. Ia menambah IP dan sokongan akar umbi.' },
    { tajuk: 'Teruskan ke bulan seterusnya', sasaran: '#btn-tahun', klik: true, teks: 'Bila AP habis, tekan <b>Teruskan ke Bulan Seterusnya</b>. Elaun masuk dan AP bertambah 5 (AP yang tidak digunakan dibawa, sehingga 15). Kalau muncul acara atau krisis, baca dan pilih.' },
    { tajuk: 'Pemilihan parti', sedia: sediaPemilihan, tab: 'pemilihan', sasaran: '[data-act="daftar"]:not([disabled])', klik: true, teks: '2026 ialah tahun pemilihan. Dengan <b>50 IP</b> ke atas, Amir daftar bertanding <b>AJK Cawangan</b>. Kemudian berkempen dan tekan <b>Hari Mengundi</b> bila dibuka. Dalam latihan, anda tidak perlu menyiapkannya.' },
    { tajuk: 'Mesyuarat & usul', tab: 'mesyuarat', sasaran: '[data-act="mula"]:not([disabled])', klik: true, teks: 'Mesyuarat Cawangan, Bahagian dan PAU diadakan setiap tahun. Mulakan mesyuarat, bahaskan usul, dan <b>Tutup Mesyuarat</b> untuk lihat ringkasan. Titik kuning pada tab bermakna ada mesyuarat.' },
    { tajuk: 'Lompat ke 2031', sedia: sediaPRU, tab: 'tindakan', teks: 'Bertahun-tahun berlalu. Amir kini <b>Ketua Bahagian</b> dengan 700 IP dan Dana yang cukup. PRU akan diisytiharkan bulan depan (Mac 2031).' },
    { tajuk: 'PRU diisytiharkan', sasaran: '#btn-tahun', klik: true, teks: 'Tekan <b>Teruskan</b>. PRU diisytiharkan dan tab 📣 <b>Pilihan Raya</b> muncul sendiri.' },
    { tajuk: 'Tab Pilihan Raya', sedia: sediaMusimPRU, tab: 'pilihanraya', sasaran: '#tab-pilihanraya', teks: 'Tab ini hanya muncul semasa musim pilihan raya. Pilih <b>Parlimen</b> atau DUN, tetapkan peruntukan kempen, lalu bertanding. Anda boleh cuba kempen sebenar sekarang, atau tekan <b>Seterusnya</b> untuk melompat ke keputusan.' },
    { tajuk: 'Amir menang!', sedia: sediaKemenangan, tab: 'tindakan', teks: 'Dalam latihan ini kemenangan Amir dijamin. Sebagai <b>MP</b>, Amir kini boleh melobi portfolio <b>Kabinet</b> (tekan Lobi jika kad itu kelihatan).', sasaran: '[data-pru="lobi"]' },
    { tajuk: 'Kabinet: KPI, dilema, CDF', sedia: sediaKabinet, tab: 'tindakan', teks: 'Amir dilantik <b>Menteri</b>. Jaga <b>KPI</b> portfolio, jawab <b>dilema bulanan</b>, dan salurkan <b>CDF</b> kepada projek kawasan. KPI rendah boleh membawa kepada rombakan.', sasaran: '[data-pru="cdf"]' },
    { tajuk: 'Pilihan Raya Kecil (PRK)', sedia: sediaPRK, tab: 'pilihanraya', sasaran: '[data-pru="prk-buka"]', teks: 'Kadang-kadang kerusi kosong dan PRK diadakan. Pemimpin parti memohon pencalonan, menetapkan peruntukan kempen kilat, dan menentukan hasil. Ia mempengaruhi sentimen nasional.' },
    { tajuk: 'Bersara', sedia: sediaPenutup, tab: 'tindakan', sasaran: '#btn-bersara', klik: true, teks: 'Setiap kerjaya ada penghujung. Tekan <b>Bersara</b> untuk melihat <b>Rumusan Kerjaya</b> Amir: rekod pilihan raya, kerusi, jawatan kerajaan dan gelaran politik.' }
  ];

  /* ---------- UI pemandu ---------- */
  var CSS = [
    '#lat-ov{position:fixed;inset:0;z-index:290;pointer-events:none}',
    '#lat-ov[hidden]{display:none}',
    '.lat-lubang{position:fixed;border-radius:12px;box-shadow:0 0 0 9999px rgba(5,6,9,.62),0 0 0 3px var(--gold,#F2B705);pointer-events:none;transition:all .25s ease;z-index:1}',
    '.lat-kad{z-index:2;position:fixed;left:12px;right:12px;bottom:calc(var(--bottom-nav-h,0px) + 12px + env(safe-area-inset-bottom,0px));margin:0 auto;max-width:420px;pointer-events:auto;background:#17130A;color:#fff;border:3px solid var(--gold,#F2B705);border-radius:14px;padding:12px 14px;box-shadow:4px 4px 0 rgba(0,0,0,.5);font-size:.9rem;line-height:1.5}',
    '.lat-kad--atas{bottom:auto;top:12px}',
    '.lat-lencana{display:inline-block;background:#C8102E;color:#fff;font-weight:800;font-size:.68rem;letter-spacing:.04em;padding:2px 8px;border-radius:99px;margin-bottom:6px}',
    '.lat-kad,.lat-kad p{color:#fff}',
    '.lat-kad h2{margin:0 0 4px;font-size:1rem;color:var(--gold,#F2B705)}',
    '.lat-kad p{margin:0 0 6px}',
    '.lat-bar{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:.74rem;color:#bbb}',
    '.lat-bar .lat-gap{flex:1}',
    '.lat-btn{font:inherit;cursor:pointer;border-radius:8px;border:1px solid #555;background:transparent;color:inherit;padding:5px 10px}',
    '.lat-btn--emas{background:var(--gold,#F2B705);border-color:var(--gold,#F2B705);color:#17130A;font-weight:800}',
    '.lat-btn--kecil{border-color:transparent;text-decoration:underline;padding-left:0;color:#bbb}',
    '.lat-legasi{margin:14px 0;padding:12px;border:3px solid var(--gold,#F2B705);border-radius:12px;background:rgba(242,183,5,.12);text-align:center}',
    '.lat-legasi .btn{margin:4px}'
  ].join('\n');

  var ui = { ov: null, kad: null, lubang: null, i: 0, tunggu: null, selesai: false, masaPoll: null, klikPasang: false };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function suntikCSS() { var d = doc(); if (!d || d.getElementById('lat-css')) { return; } var s = d.createElement('style'); s.id = 'lat-css'; s.textContent = CSS; d.head.appendChild(s); }
  function simpanLangkah(i) { tulis(K_BANDERA, JSON.stringify({ aktif: true, langkah: i })); }

  function modalBuka() { var d = doc(), mo = d && d.getElementById('modal'); return !!(mo && mo.classList.contains('is-open')); }

  function cariSasaran(l) {
    var d = doc(); if (!d || !l.sasaran) { return null; }
    var e = null; try { e = d.querySelector(l.sasaran); } catch (x) { e = null; }
    if (!e) { return null; }
    var r = e.getBoundingClientRect();
    if (!r.width || !r.height) { return null; }
    return l.bekas && e.closest(l.bekas) ? e.closest(l.bekas) : e;
  }

  function lukis() {
    var d = doc(); if (!d || !ui.ov) { return; }
    var l = LANGKAH[ui.i]; if (!l) { return; }
    var e = cariSasaran(l), lub = ui.lubang, kad = ui.kad;
    if (e) {
      try { e.scrollIntoView({ block: e.closest('.app-header') ? 'nearest' : 'center', inline: 'center', behavior: 'auto' }); } catch (x) { /* abaikan */ }
      var r = e.getBoundingClientRect(), pad = 6;
      lub.style.display = 'block'; lub.style.left = (r.left - pad) + 'px'; lub.style.top = (r.top - pad) + 'px';
      lub.style.width = (r.width + pad * 2) + 'px'; lub.style.height = (r.height + pad * 2) + 'px';
      var tinggi = root.innerHeight || 700;
      kad.classList.toggle('lat-kad--atas', r.top > tinggi * 0.5);
    } else {
      lub.style.display = 'none'; kad.classList.remove('lat-kad--atas');
    }
  }

  function paparLangkah() {
    var l = LANGKAH[ui.i], d = doc(); if (!l || !d) { return; }
    simpanLangkah(ui.i);
    if (typeof l.sedia === 'function') { try { l.sedia(); } catch (e) { /* abaikan */ } }
    if (l.tab) { var tb = d.getElementById('tab-' + l.tab); if (tb && !tb.hidden) { try { tb.click(); } catch (e) { /* abaikan */ } } }
    var akhir = ui.i === LANGKAH.length - 1;
    ui.kad.innerHTML = '<span class="lat-lencana">LATIHAN · AMIR · ' + (ui.i + 1) + '/' + LANGKAH.length + '</span><h2>' + esc(l.tajuk) + '</h2><p>' + l.teks + '</p>' +
      '<div class="lat-bar"><button type="button" class="lat-btn lat-btn--kecil" data-lat="keluar">Keluar latihan</button><span class="lat-gap"></span>' +
      (ui.i > 0 ? '<button type="button" class="lat-btn" data-lat="balik">‹ Balik</button>' : '') +
      (akhir ? '' : '<button type="button" class="lat-btn lat-btn--emas" data-lat="seterus">Seterusnya ›</button>') + '</div>';
    setTimeout(lukis, 60); setTimeout(lukis, 400);
  }

  function ke(i) {
    if (i < 0 || i >= LANGKAH.length) { return; }
    ui.i = i; paparLangkah();
  }

  function pasang() {
    var d = doc(); if (!d || d.getElementById('lat-ov')) { return; }
    suntikCSS();
    var ov = d.createElement('div'); ov.id = 'lat-ov'; ov.setAttribute('aria-live', 'polite');
    ov.innerHTML = '<div class="lat-lubang" style="display:none"></div><div class="lat-kad" role="dialog" aria-label="Latihan bersama Amir"></div>';
    d.body.appendChild(ov);
    ui.ov = ov; ui.lubang = ov.querySelector('.lat-lubang'); ui.kad = ov.querySelector('.lat-kad');
    ov.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-lat]'); if (!b) { return; }
      var a = b.getAttribute('data-lat');
      if (a === 'seterus') { ke(ui.i + 1); }
      else if (a === 'balik') { ke(ui.i - 1); }
      else if (a === 'keluar') { if (!root.confirm || root.confirm('Keluar daripada latihan? Simpanan anda sendiri akan dipulihkan.')) { keluar(); } }
    });
    if (!ui.klikPasang) {
      ui.klikPasang = true;
      d.addEventListener('click', function (ev) {
        if (!aktif() || !ui.ov) { return; }
        var l = LANGKAH[ui.i];
        if (!l || !l.klik || !l.sasaran || ev.target.closest('#lat-ov')) { return; }
        var t = null; try { t = ev.target.closest(l.sasaran); } catch (e) { t = null; }
        if (t) { var n = ui.i; setTimeout(function () { if (ui.i === n && aktif()) { ke(n + 1); } }, 700); }
      }, true);
    }
    ui.masaPoll = setInterval(function () {
      if (!ui.ov || ui.selesai) { return; }
      var tersembunyi = modalBuka();
      ui.ov.hidden = tersembunyi;
      if (!tersembunyi) { lukis(); }
    }, 500);
    root.addEventListener && root.addEventListener('resize', lukis);
  }

  function init() {
    var b = bendera(); if (!b || !b.aktif || !doc()) { return false; }
    pasang();
    ui.i = Math.min(Math.max(0, b.langkah | 0), LANGKAH.length - 1);
    paparLangkah();
    return true;
  }

  /* ---------- tawaran selepas daftar ---------- */
  function tawar(opts) {
    opts = opts || {};
    var p = opts.profil, UI = root.NusaUI;
    if (!p || aktif() || !UI || !UI.modal) { return false; }
    if (baca(K_TAWAR) === p.id) { return false; }
    tulis(K_TAWAR, p.id);
    UI.modal({
      tajuk: 'Belajar dahulu bersama Amir?',
      isi: '<p>Cuba permainan contoh berpandu (kira-kira 10 minit): daripada ahli biasa hingga <b>Rumusan Kerjaya</b>.</p><p>Simpanan watak anda <b>selamat</b> dan dipulihkan selepas latihan.</p>',
      butang: [{ label: 'Terus main', nilai: false }, { label: 'Mula Latihan', nilai: true, kelas: 'btn--gold' }]
    }).then(function (ya) {
      if (ya && mula()) { root.location.reload(); }
      else if (opts.lepas) { opts.lepas(); }
    });
    return true;
  }

  /* ---------- penutup di skrin Rumusan Kerjaya ---------- */
  function pasangLegasi(nod) {
    if (!aktif() || !nod) { return; }
    var kotak = doc().createElement('div'); kotak.className = 'lat-legasi';
    kotak.innerHTML = '<b>Tamat latihan bersama Amir.</b><p>Itulah perjalanan penuh: daripada ahli biasa hingga Rumusan Kerjaya. Simpanan anda sendiri akan dipulihkan.</p>' +
      '<button type="button" class="btn btn--gold" data-lat-akhir="sebenar">Kembali ke Permainan Saya</button>' +
      '<button type="button" class="btn btn--ghost" data-lat-akhir="ulang">Ulang Latihan</button>';
    nod.insertBefore(kotak, nod.firstChild);
    kotak.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-lat-akhir]'); if (!b) { return; }
      if (b.getAttribute('data-lat-akhir') === 'ulang') {
        keluar({ diam: true }); mula(); root.location.assign('dashboard.html');
      } else { keluar(); }
    });
    ui.selesai = true; var ov = doc().getElementById('lat-ov'); if (ov) { ov.hidden = true; }
  }

  return { aktif: aktif, tawar: tawar, init: init, mula: mula, keluar: keluar, pulihJikaPerlu: pulihJikaPerlu, pasangLegasi: pasangLegasi, LANGKAH: LANGKAH };
});
