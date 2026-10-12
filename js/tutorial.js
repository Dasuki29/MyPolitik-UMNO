/* ==========================================================================
   Nusa Politik — js/tutorial.js
   Mod Tutorial untuk pemain baharu.

   1. Tutorial interaktif pertama kali (Quick Onboarding)
        Overlay "spotlight" yang menerangkan AP, Dana, Pengaruh (IP), Masa Bulanan,
        butang bulan seterusnya, Tindakan dan Peranan Sayap. Ada butang
        "Skip Tutorial". Langkah bertanda interaktif menunggu pemain menekan
        elemen yang disorot (cth. tab Tindakan). Muncul sekali sahaja.
   2. Menu Bantuan / Codex (?)
        Butang (?) di penjuru skrin. Panel penerangan mendalam: mekanik bulanan,
        peranan sayap, strategi pemilihan, mesyuarat & perwakilan, acara rawak.
        Ada carian dan tutorial boleh diulang.

   Modul berdiri sendiri (CSS disuntik sendiri; tiada kebergantungan wajib).
   Jika js/save.js ada, teks disesuaikan dengan profil pemain.

   API (window.MyPolitikTutorial):
     init({ profil })            pasang butang (?) dan mulakan tutorial jika kali pertama
     mula(opts)                  mulakan tutorial (opts.paksa = ulang walaupun sudah selesai)
     skip()                      langkau & tandakan selesai
     bukaBantuan(topik) / tutupBantuan()
     sudahSelesai() / reset()
   ========================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikTutorial = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  var KEY = 'myPolitik_tutorial';
  var SAYAP = {
    pemuda: { nama: 'Pemuda', jawatan: 'Ketua Pemuda Cawangan', huraian: 'lelaki berumur 18–40 tahun' },
    puteri: { nama: 'Puteri', jawatan: 'Ketua Puteri Cawangan', huraian: 'perempuan berumur 18–35 tahun' },
    wanita: { nama: 'Wanita', jawatan: 'Ketua Wanita Cawangan', huraian: 'perempuan berumur 36–65 tahun' },
    veteran: { nama: 'Veteran/Ahli Biasa', jawatan: null, huraian: 'lelaki 41 tahun ke atas dan perempuan 66 tahun ke atas' }
  };

  /* ------------------------------------------------------------------------
     STORAN
     ------------------------------------------------------------------------ */
  var memori = null;
  function storan() { try { return root.localStorage || null; } catch (e) { return null; } }
  function muat() {
    var s = storan(), d = null;
    if (s) { try { d = JSON.parse(s.getItem(KEY)); } catch (e) { d = null; } } else { d = memori; }
    return d && typeof d === 'object' ? d : { selesai: false, pemilik: '' };
  }
  function simpan(d) {
    memori = d;
    var s = storan();
    if (s) { try { s.setItem(KEY, JSON.stringify(d)); } catch (e) { /* abaikan */ } }
  }
  function pemilikDari(p) { return p ? String(p.nama || '') + '|' + String(p.cawangan || '') : ''; }
  function sudahSelesai(p) {
    var d = muat();
    return !!d.selesai && (!p || d.pemilik === pemilikDari(p));
  }
  function reset() { memori = null; var s = storan(); if (s) { try { s.removeItem(KEY); } catch (e) { /* abaikan */ } } }
  function tanda(p) { simpan({ selesai: true, pemilik: pemilikDari(p), masa: new Date().toISOString() }); }

  /* ------------------------------------------------------------------------
     PEMBANTU DOM
     ------------------------------------------------------------------------ */
  function doc() { return root.document || null; }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function el(tag, kelas, html) {
    var e = doc().createElement(tag);
    if (kelas) { e.className = kelas; }
    if (html != null) { e.innerHTML = html; }
    return e;
  }
  function profilSemasa() {
    var S = root.MyPolitikSave;
    try { return S && S.loadPlayer ? S.loadPlayer() : null; } catch (e) { return null; }
  }

  var CSS = [
    '.tut-blok{position:fixed;z-index:300;background:transparent}',
    '.tut-lubang{position:fixed;z-index:301;border-radius:12px;box-shadow:0 0 0 9999px rgba(5,6,9,.78),0 0 0 3px var(--gold,#F2B705);pointer-events:none;transition:all .25s ease}',
    '.tut-kad{position:fixed;z-index:302;width:min(360px,calc(100vw - 24px));background:var(--bg-elev-2,#1D2028);color:var(--text,#F4F5F7);border:1px solid var(--gold-dark,#C99700);border-radius:14px;padding:16px 16px 12px;box-shadow:0 12px 40px rgba(0,0,0,.55);font-size:.92rem;line-height:1.5}',
    '.tut-kad h2{margin:0 0 6px;font-size:1.05rem;color:var(--gold,#F2B705)}',
    '.tut-kad p{margin:0 0 8px}',
    '.tut-kad .tut-petua{font-size:.82rem;color:var(--text-muted,#A3A9B8)}',
    '.tut-kad .tut-tunggu{font-size:.82rem;font-weight:700;color:var(--gold-light,#FFD84D)}',
    '.tut-bar{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}',
    '.tut-bar .tut-gap{flex:1}',
    '.tut-titik{display:flex;gap:4px;margin-bottom:8px}',
    '.tut-titik i{width:7px;height:7px;border-radius:50%;background:var(--border,#2E333F)}',
    '.tut-titik i.is-on{background:var(--gold,#F2B705)}',
    '.tut-btn{font:inherit;cursor:pointer;border-radius:8px;border:1px solid var(--border,#2E333F);background:transparent;color:inherit;padding:6px 12px}',
    '.tut-btn--emas{background:var(--gold,#F2B705);border-color:var(--gold,#F2B705);color:#17130A;font-weight:700}',
    '.tut-btn--skip{border-color:transparent;color:var(--text-muted,#A3A9B8);text-decoration:underline;padding-left:0}',
    '.tut-btn:focus-visible{outline:2px solid var(--gold-light,#FFD84D);outline-offset:2px}',
    '.tut-btn[disabled]{opacity:.45;cursor:default}',
    '@media (max-width:560px){.tut-kad{left:12px!important;right:12px;bottom:12px;top:auto!important;width:auto}}',
    /* butang (?) dan codex */
    '.tut-fab{position:fixed;left:16px;bottom:16px;z-index:60;width:44px;height:44px;border-radius:50%;border:2px solid var(--gold,#F2B705);background:var(--bg-elev-2,#1D2028);color:var(--gold,#F2B705);font:700 1.25rem/1 inherit;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.45)}',
    '.tut-fab:hover{background:var(--gold,#F2B705);color:#17130A}',
    '.tut-fab:focus-visible{outline:3px solid var(--gold-light,#FFD84D);outline-offset:2px}',
    '.tut-kodeks{position:fixed;inset:0;z-index:250;display:none;background:rgba(5,6,9,.72)}',
    '.tut-kodeks.is-open{display:flex;align-items:stretch;justify-content:center}',
    '.tut-panel{margin:auto;width:min(860px,100%);height:min(640px,100%);display:grid;grid-template-columns:210px 1fr;grid-template-rows:auto 1fr;background:var(--bg-elev-1,#16181E);color:var(--text,#F4F5F7);border:1px solid var(--border,#2E333F);border-radius:14px;overflow:hidden}',
    '.tut-panel header{grid-column:1/3;display:flex;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border,#2E333F)}',
    '.tut-panel header h2{margin:0;font-size:1.05rem;flex:1;color:var(--gold,#F2B705)}',
    '.tut-cari{font:inherit;padding:6px 10px;border-radius:8px;border:1px solid var(--border,#2E333F);background:var(--bg,#0E0F13);color:inherit;width:170px;max-width:40vw}',
    '.tut-nav{overflow:auto;border-right:1px solid var(--border,#2E333F);padding:8px;display:flex;flex-direction:column;gap:4px}',
    '.tut-nav button{font:inherit;text-align:left;cursor:pointer;color:inherit;background:transparent;border:1px solid transparent;border-radius:8px;padding:8px 10px}',
    '.tut-nav button.is-on{background:var(--bg-elev-3,#262A34);border-color:var(--gold-dark,#C99700);color:var(--gold-light,#FFD84D)}',
    '.tut-isi{overflow:auto;padding:14px 18px 22px;font-size:.92rem;line-height:1.6}',
    '.tut-isi h3{margin:0 0 8px;font-size:1.1rem}',
    '.tut-isi h4{margin:16px 0 4px;font-size:.95rem;color:var(--gold-light,#FFD84D)}',
    '.tut-isi ul{margin:4px 0 8px;padding-left:20px}',
    '.tut-isi table{border-collapse:collapse;width:100%;margin:6px 0;font-size:.86rem}',
    '.tut-isi th,.tut-isi td{border:1px solid var(--border,#2E333F);padding:5px 8px;text-align:left}',
    '.tut-isi .tut-kotak{border:1px solid var(--gold-dark,#C99700);background:rgba(242,183,5,.08);border-radius:10px;padding:8px 12px;margin:10px 0}',
    '.tut-kosong{opacity:.75}',
    '@media (max-width:640px){.tut-panel{grid-template-columns:1fr;grid-template-rows:auto auto 1fr;height:100%;border-radius:0}.tut-panel header{grid-column:1}.tut-nav{flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--border,#2E333F)}.tut-nav button{white-space:nowrap}}'
  ].join('\n');

  function suntikCSS() {
    var d = doc();
    if (!d || d.getElementById('tut-css')) { return; }
    var s = d.createElement('style'); s.id = 'tut-css'; s.textContent = CSS; d.head.appendChild(s);
  }

  /* ------------------------------------------------------------------------
     1. LANGKAH TUTORIAL
     sasaran : pemilih CSS (kosong = tengah skrin)
     bekas   : pemilih elemen yang disorot (jika berbeza daripada sasaran)
     klik    : true -> pemain mesti menekan elemen yang disorot untuk menyambung
     ------------------------------------------------------------------------ */
  function langkah(p) {
    var kod = p && (p.avatar || (p.demografik && p.demografik.kategoriKod)) || null, sy = SAYAP[kod] || null;
    var sayapTeks = sy
      ? (sy.jawatan
          ? 'Anda dalam kategori <b>' + esc(sy.nama) + '</b> (' + esc(sy.huraian) + '). Selepas mencapai <b>50 IP</b>, anda boleh bertanding <b>' + esc(sy.jawatan) + '</b> pada tab ini.'
          : 'Anda dalam kategori <b>' + esc(sy.nama) + '</b>. Kategori ini tiada pertandingan Ketua Sayap, tetapi anda masih boleh bertanding AJK Cawangan dan Perwakilan.')
      : 'Pemuda, Puteri dan Wanita mempunyai Ketua Sayap Cawangan masing-masing. Kategori anda ditentukan oleh jantina dan umur semasa pendaftaran.';
    return [
      { id: 'mula', tajuk: 'Selamat datang ke Nusa Politik', isi: 'Anda bermula sebagai <b>Ahli Biasa</b> di cawangan anda. Matlamat: bina pengaruh, menang pemilihan, dan naik hingga ke Perhimpunan Agung. Tutorial ringkas ini mengambil kira-kira dua minit.' },
      { id: 'ip', sasaran: '#r-ip', bekas: '.stat', tajuk: 'Pengaruh (IP)', isi: 'IP ialah kekuatan politik anda. IP menentukan kelayakan bertanding (AJK dan Sayap perlu <b>50 IP</b>) dan menjadi faktor utama kemenangan dalam pemilihan.', petua: 'Cara paling mudah menambah IP: Ziarah Kasih (+10 IP).' },
      { id: 'myr', sasaran: '#r-myr', bekas: '.stat', tajuk: 'Dana (MYR)', isi: 'Dana digunakan untuk kempen, jamuan dan menyumbang kepada program. Dana <b>terkumpul</b> dan <b>tidak</b> ditetapkan semula; setiap bulan anda menerima elaun (RM 600 asas, ditambah elaun jawatan).' },
      { id: 'ap', sasaran: '#r-ap', bekas: '.stat', tajuk: 'Mata Tindakan (AP)', isi: 'Setiap tindakan menggunakan AP. AP <b>ditetapkan semula kepada 5</b> pada permulaan setiap bulan, jadi AP yang tidak digunakan tidak dibawa ke bulan berikutnya.', petua: 'Gunakan AP anda sebelum menekan Teruskan ke Bulan Seterusnya.' },
      { id: 'bulan', sasaran: '.takwim', tajuk: 'Masa Bulanan', isi: 'Permainan bergerak <b>bulan demi bulan</b> (Bulan 1–12). <b>Bulan 1–3</b>: kerja akar umbi, bonus +25% IP. <b>Bulan 4–6</b>: Mesyuarat dan Pemilihan Cawangan &amp; Sayap. <b>Bulan 7</b>: Mesyuarat dan Pemilihan Bahagian &amp; Sayap. <b>Bulan 8</b>: Perhimpunan Agung (PAU) dan Pemilihan Pusat. <b>Bulan 9–12</b>: Pasca-PAU dan khidmat masyarakat.' },
      { id: 'lanjut', sasaran: '#btn-tahun', tajuk: 'Teruskan ke Bulan Seterusnya', isi: 'Tekan butang ini bila anda selesai dengan bulan semasa. Anda akan melihat pratonton: AP diset semula dan elaun masuk. Anda tidak boleh kembali ke bulan sebelumnya.' },
      { id: 'tindakan', sasaran: '#tab-tindakan', tajuk: 'Cuba: Tab Tindakan', isi: 'Di sinilah anda melakukan kerja akar umbi. <b>Tekan tab ini sekarang</b> untuk meneruskan.', klik: true, tunggu: 'Menunggu anda menekan tab ⚡ Tindakan Pemain…' },
      { id: 'sayap', sasaran: '#tab-pemilihan', tajuk: 'Peranan Sayap & Pemilihan', isi: sayapTeks + ' <b>Tekan tab ini</b> untuk meneruskan.', klik: true, tunggu: 'Menunggu anda menekan tab 🗳️ Pemilihan…' },
      { id: 'etika', tajuk: 'Tataetika & Disiplin', isi: 'Kempen <b>bersih</b> (Ziarah Kasih, Khidmat Masyarakat) membina <b>Modal Sosial</b> yang menambah kekuatan undi dan melindungi anda. Politik wang, fitnah dan janji jawatan memberi mata kempen pantas, tetapi boleh diadu kepada <b>Jawatankuasa Disiplin</b> dan dihukum: amaran, gantung, dilarang bertanding atau dipecat (Fasal 20). Calon AJK Bahagian juga perlu ahli sekurang-kurangnya <b>3 tahun</b> (Fasal 15.5), dan calon MKT perlu satu penggal AJK Bahagian/MKT (Fasal 9.5).' },
      { id: 'bantuan', sasaran: '.tut-fab', tajuk: 'Perlukan bantuan?', isi: 'Butang <b>(?)</b> ini sentiasa ada. Ia menjelaskan mekanik bulanan, peranan sayap, strategi pemilihan dan acara rawak. Anda juga boleh mengulang tutorial ini dari sana. Semoga berjaya!' }
    ];
  }

  var ov = null;   // keadaan overlay aktif

  function elemen(sel) { var d = doc(); if (!sel || !d) { return null; } try { return d.querySelector(sel); } catch (e) { return null; } }
  function nampak(e) { if (!e) { return false; } var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }

  function tutupOverlay() {
    if (!ov) { return; }
    ov.pembersih.forEach(function (f) { try { f(); } catch (e) { /* abaikan */ } });
    ov.nod.forEach(function (n) { if (n.parentNode) { n.parentNode.removeChild(n); } });
    var fokus = ov.fokusAsal; ov = null;
    if (fokus && fokus.focus) { try { fokus.focus(); } catch (e) { /* abaikan */ } }
  }

  function skip() {
    var p = profilSemasa();
    tanda(p); tutupOverlay();
  }

  function mula(opts) {
    opts = opts || {};
    var d = doc();
    if (!d || !d.body) { return false; }
    var p = opts.profil || profilSemasa();
    if (!opts.paksa && sudahSelesai(p)) { return false; }
    if (ov) { return true; }
    suntikCSS();
    tutupBantuan();
    var senarai = langkah(p), idx = 0;
    ov = { nod: [], pembersih: [], fokusAsal: d.activeElement };

    var lubang = el('div', 'tut-lubang'), kad = el('div', 'tut-kad');
    kad.setAttribute('role', 'dialog'); kad.setAttribute('aria-modal', 'true'); kad.setAttribute('aria-label', 'Tutorial permainan');
    var blok = [el('div', 'tut-blok'), el('div', 'tut-blok'), el('div', 'tut-blok'), el('div', 'tut-blok'), el('div', 'tut-blok')];
    blok.forEach(function (b) { d.body.appendChild(b); ov.nod.push(b); });
    d.body.appendChild(lubang); d.body.appendChild(kad); ov.nod.push(lubang, kad);

    function letak(b, x, y, l, t) { b.style.left = x + 'px'; b.style.top = y + 'px'; b.style.width = Math.max(0, l) + 'px'; b.style.height = Math.max(0, t) + 'px'; }

    function susun() {
      var s = senarai[idx], t = s.sasaran ? elemen(s.bekas ? null : s.sasaran) : null;
      if (s.sasaran) { t = elemen(s.sasaran); if (t && s.bekas && t.closest) { t = t.closest(s.bekas) || t; } }
      var W = root.innerWidth, H = root.innerHeight, r;
      if (t && nampak(t)) {
        r = t.getBoundingClientRect();
        var pad = 6, x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad), w = Math.min(W - x, r.width + pad * 2), h = Math.min(H - y, r.height + pad * 2);
        lubang.style.display = 'block';
        lubang.style.left = x + 'px'; lubang.style.top = y + 'px'; lubang.style.width = w + 'px'; lubang.style.height = h + 'px';
        letak(blok[0], 0, 0, W, y); letak(blok[1], 0, y + h, W, H - y - h);
        letak(blok[2], 0, y, x, h); letak(blok[3], x + w, y, W - x - w, h);
        letak(blok[4], x, y, s.klik ? 0 : w, s.klik ? 0 : h);           // penutup lubang (tidak interaktif)
        // kedudukan kad: bawah sasaran jika muat, jika tidak atas
        var kh = kad.offsetHeight || 220, kw = Math.min(360, W - 24);
        var kiri = Math.min(Math.max(12, x + w / 2 - kw / 2), W - kw - 12);
        var bawah = y + h + 12, atas = y - kh - 12;
        var top = bawah + kh <= H - 8 ? bawah : (atas >= 8 ? atas : Math.max(8, H - kh - 8));
        kad.style.left = kiri + 'px'; kad.style.top = top + 'px';
      } else {                                                          // langkah tengah skrin
        lubang.style.display = 'none';
        letak(blok[0], 0, 0, W, H); [1, 2, 3, 4].forEach(function (i) { letak(blok[i], 0, 0, 0, 0); });
        var kh2 = kad.offsetHeight || 220, kw2 = Math.min(360, W - 24);
        kad.style.left = Math.max(12, (W - kw2) / 2) + 'px'; kad.style.top = Math.max(12, (H - kh2) / 2) + 'px';
      }
    }

    var pendengarKlik = null;
    function lepasKlik() { if (pendengarKlik) { pendengarKlik.t.removeEventListener('click', pendengarKlik.f, true); pendengarKlik = null; } }

    function papar() {
      lepasKlik();
      var s = senarai[idx], akhir = idx === senarai.length - 1;
      var t = s.sasaran ? elemen(s.sasaran) : null;
      if (t && t.scrollIntoView && s.sasaran !== '.tut-fab') { try { t.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) { /* abaikan */ } }
      var titik = senarai.map(function (_, i) { return '<i class="' + (i <= idx ? 'is-on' : '') + '"></i>'; }).join('');
      var interaktif = !!(s.klik && t && nampak(t));
      kad.innerHTML = '<div class="tut-titik" aria-hidden="true">' + titik + '</div>' +
        '<h2>' + esc(s.tajuk) + '</h2><p>' + s.isi + '</p>' +
        (s.petua ? '<p class="tut-petua">💡 ' + esc(s.petua) + '</p>' : '') +
        (interaktif ? '<p class="tut-tunggu">' + esc(s.tunggu || 'Tekan elemen yang disorot untuk meneruskan.') + '</p>' : '') +
        '<div class="tut-bar"><button type="button" class="tut-btn tut-btn--skip" data-tut="skip">Skip Tutorial</button><span class="tut-gap"></span>' +
        '<span style="font-size:.8rem;opacity:.7">' + (idx + 1) + '/' + senarai.length + '</span>' +
        (idx > 0 ? '<button type="button" class="tut-btn" data-tut="balik">Kembali</button>' : '') +
        '<button type="button" class="tut-btn tut-btn--emas" data-tut="depan">' + (akhir ? 'Selesai' : (interaktif ? 'Langkau Langkah' : 'Seterusnya')) + '</button></div>';
      susun();
      if (interaktif) {
        var f = function () { root.setTimeout(function () { if (ov) { idx = Math.min(senarai.length - 1, idx + 1); papar(); } }, 120); };
        t.addEventListener('click', f, true); pendengarKlik = { t: t, f: f };
      }
      var btn = kad.querySelector('[data-tut=depan]'); if (btn) { btn.focus(); }
    }

    function maju() { if (idx >= senarai.length - 1) { tanda(profilSemasa()); tutupOverlay(); return; } idx += 1; papar(); }
    function undur() { if (idx > 0) { idx -= 1; papar(); } }

    kad.addEventListener('click', function (ev) {
      var a = ev.target.closest ? ev.target.closest('[data-tut]') : null; if (!a) { return; }
      var v = a.getAttribute('data-tut');
      if (v === 'skip') { skip(); } else if (v === 'depan') { maju(); } else if (v === 'balik') { undur(); }
    });
    function kunci(ev) {
      if (!ov) { return; }
      if (ev.key === 'Escape') { ev.preventDefault(); skip(); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); maju(); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); undur(); }
      else if (ev.key === 'Tab') {                                       // perangkap fokus dalam kad
        var f = kad.querySelectorAll('button'); if (!f.length) { return; }
        var a = f[0], z = f[f.length - 1];
        if (ev.shiftKey && d.activeElement === a) { ev.preventDefault(); z.focus(); }
        else if (!ev.shiftKey && d.activeElement === z) { ev.preventDefault(); a.focus(); }
        else if (!kad.contains(d.activeElement)) { ev.preventDefault(); a.focus(); }
      }
    }
    var ubahSaiz = function () { if (ov) { susun(); } };
    d.addEventListener('keydown', kunci, true);
    root.addEventListener('resize', ubahSaiz); root.addEventListener('scroll', ubahSaiz, true);
    ov.pembersih.push(function () { d.removeEventListener('keydown', kunci, true); root.removeEventListener('resize', ubahSaiz); root.removeEventListener('scroll', ubahSaiz, true); lepasKlik(); });
    papar();
    return true;
  }

  /* ------------------------------------------------------------------------
     2. CODEX BANTUAN
     ------------------------------------------------------------------------ */
  function jadual(baris) {
    return '<table><thead><tr>' + baris[0].map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      baris.slice(1).map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }

  function topikTopik(p) {
    var kod = p && (p.avatar || (p.demografik && p.demografik.kategoriKod)) || null, sy = SAYAP[kod] || null;
    return [
      { id: 'asas', tajuk: 'Asas Permainan', html:
        '<h3>Asas Permainan</h3><p>Anda ialah ahli biasa sebuah cawangan UMNO. Tujuan: kumpul <b>Pengaruh (IP)</b>, menang pemilihan, dan mendaki hierarki: Cawangan → Bahagian → Pusat.</p>' +
        '<h4>Tiga sumber utama</h4>' + jadual([['Sumber', 'Fungsi', 'Pembaharuan'],
          ['<b>IP</b> Pengaruh', 'Kelayakan bertanding dan kekuatan undi', 'Kekal; tidak reput'],
          ['<b>MYR</b> Dana', 'Kempen, jamuan, sumbangan acara', 'Terkumpul; elaun bulanan masuk'],
          ['<b>AP</b> Mata Tindakan', 'Kos setiap tindakan, usul dan sebahagian acara', 'Diset semula kepada 5 setiap bulan']]) +
        '<h4>Empat tab</h4><ul><li><b>Peta Pengaruh</b>: lihat kawasan dan peringkat parti.</li><li><b>Tindakan Pemain</b>: kerja akar umbi (Ziarah Kasih, Gotong-Royong, Sembang Warung, Kerja Sampingan).</li><li><b>Pemilihan</b>: daftar bertanding, kempen, hari mengundi.</li><li><b>Mesyuarat &amp; Usul</b>: bahas usul, tutup mesyuarat, lihat kelayakan perwakilan.</li></ul>' },
      { id: 'bulanan', tajuk: 'Mekanik Bulanan', html:
        '<h3>Mekanik Bulanan</h3><p>Masa bergerak <b>satu bulan setiap kali</b> anda menekan <i>Teruskan ke Bulan Seterusnya</i>. Selepas Bulan 12, tahun bertambah dan Bulan 1 bermula semula.</p>' +
        '<h4>Takwim</h4>' + jadual([['Bulan', 'Fasa', 'Apa yang dibuka'],
          ['1–3', 'Akar Umbi', 'Bonus +25% pada IP dan kesetiaan positif daripada tindakan'],
          ['4–6', 'Musim Cawangan', 'Mesyuarat Cawangan; pemilihan jawatan Cawangan, Sayap Cawangan dan Perwakilan ke Bahagian'],
          ['7', 'Musim Bahagian', 'Mesyuarat Bahagian (perwakilan tahun ini sahaja); pemilihan jawatan Bahagian, Sayap Bahagian dan Perwakilan ke PAU'],
          ['8', 'PAU & Pusat', 'Perhimpunan Agung; pemilihan Presiden, Timbalan Presiden, 3 Naib Presiden, MKT dan Ketua Sayap (tahun pemilihan)'],
          ['9–12', 'Pasca-PAU', 'Kembali ke akar umbi; laksana tanggungjawab jawatan']]) +
        '<h4>Pembaharuan setiap bulan</h4><ul><li><b>AP</b> ditetapkan semula kepada 5 (baki lama hilang).</li><li><b>Dana</b> bertambah: RM 600 asas, ditambah RM 300 (Cawangan), RM 800 (Bahagian) dan RM 2,000 (Pusat) bagi <b>setiap peringkat</b> yang anda pegang.</li></ul>' +
        '<div class="tut-kotak"><b>Tahun pemilihan</b>: setiap 3 tahun bermula 2026 (pertandingan jawatan). <b>Perwakilan</b> dipilih semula <b>setiap tahun</b> di Cawangan; mandat tahun lalu luput pada Bulan 1.</div>' +
        '<h4>Jika terlepas musim</h4><p>Mesyuarat yang masih berjalan apabila tetingkapnya tamat <b>ditutup secara automatik</b>. Mesyuarat yang tidak sempat dimulakan ditandakan <i>Terlepas</i>. Pertandingan yang anda daftar akan tetap diundi oleh urus setia.</p>' +
        '<h4>Petua</h4><ul><li>Habiskan AP sebelum menekan bulan seterusnya.</li><li>Rancang tindakan IP besar pada Bulan 1–3 untuk bonus.</li></ul>' },
      { id: 'sayap', tajuk: 'Peranan Sayap', html:
        '<h3>Peranan Sayap: Pemuda, Puteri, Wanita</h3><p>Kategori anda ditentukan semasa pendaftaran berdasarkan jantina dan umur.</p>' +
        jadual([['Kategori', 'Siapa', 'Jawatan sayap cawangan'],
          ['Pemuda', 'Lelaki 18–40', 'Ketua Pemuda Cawangan'], ['Puteri', 'Perempuan 18–35', 'Ketua Puteri Cawangan'],
          ['Wanita', 'Perempuan 36–65', 'Ketua Wanita Cawangan'], ['Veteran/Ahli Biasa', 'Lelaki 41+, perempuan 66+', 'Tiada (sayap)']]) +
        (sy ? '<div class="tut-kotak"><b>Kategori anda: ' + esc(sy.nama) + '</b> (' + esc(sy.huraian) + ').' + (sy.jawatan ? ' Anda boleh bertanding <b>' + esc(sy.jawatan) + '</b> apabila IP mencapai 50.' : ' Fokus pada AJK Cawangan dan Perwakilan.') + '</div>' : '') +
        '<h4>Mengapa sayap penting?</h4><ul><li>Hanya jawatan sayap <b>sayap anda</b> dibuka di setiap peringkat: Cawangan, Bahagian dan Pusat (Ketua Pemuda / Puteri / Wanita).</li><li>Anda mendapat bonus kekuatan dalam pertandingan sayap sendiri. Pemain Veteran/Ahli Biasa tiada jawatan sayap.</li><li>Jawatan sayap dipegang <b>serentak</b> dengan satu jawatan utama pada peringkat yang sama.</li><li>Ketua Sayap Cawangan tidak lagi hadir Bahagian secara automatik; menangi Perwakilan Cawangan tahun itu.</li></ul>' },
      { id: 'pemilihan', tajuk: 'Strategi Pemilihan', html:
        '<h3>Strategi Pemilihan</h3><h4>Langkah</h4><ol><li>Kumpul IP: AJK/Sayap Cawangan <b>50</b>, Ketua Cawangan 65, jawatan Bahagian 70–85, Pusat 80–98 (Presiden).</li><li>Pada tab Pemilihan, <b>daftar</b> sebagai calon sebelum atau semasa tetingkap peringkat itu (Cawangan bulan 4–6, Bahagian bulan 7, Pusat bulan 8).</li><li>Jalankan <b>kempen</b> untuk menambah mata kempen.</li><li>Pengundian berlaku apabila anda menekan Hari Mengundi (dalam tetingkap) atau apabila mesyuarat ditutup.</li></ol>' +
        '<h4>Apa yang mempengaruhi undi</h4>' + jadual([['Faktor', 'Pemilihan Cawangan', 'Pemilihan Bahagian'],
          ['IP', '30%', '30%'], ['Kesetiaan Akar Umbi', '25%', '–'], ['Kesetiaan Ketua Cawangan', '15%', '15%'], ['Kesetiaan AJK', '10%', '–'], ['Kesetiaan Perwakilan', '–', '35%'], ['Mata kempen', '20%', '20%']]) +
        '<h4>Kempen</h4><ul><li><b>Jamuan Mesyuarat</b> dan <b>Siri Jelajah</b>: tambah mata dan sokongan.</li><li><b>Lobi Ketua Bahagian</b>: tingkatkan kesetiaan perwakilan.</li><li><b>Simulasi Pengundian</b>: anggaran peluang menang sebelum bertaruh.</li></ul>' +
        '<h4>Jawatan berbilang peringkat</h4><ul><li>Anda boleh memegang jawatan di <b>Cawangan, Bahagian dan Pusat serentak</b>. Jawatan paling tinggi dipaparkan sebagai jawatan utama anda.</li><li>Pada satu peringkat: satu jawatan utama + satu jawatan sayap. Jawatan lebih tinggi menggantikan yang lebih rendah pada peringkat yang sama.</li><li>Jawatan Bahagian memerlukan Perwakilan Cawangan tahun itu; jawatan Pusat memerlukan Perwakilan PAU (atau Ketua Bahagian / jawatan Pusat), dan jawatan lebih rendah dahulu (cth. Presiden perlukan Ketua Bahagian).</li></ul>' +
        '<h4>Perwakilan (1 tahun sahaja)</h4><ul><li>Cawangan memilih <b>5</b> perwakilan ke Bahagian; Bahagian memilih <b>10</b> ke PAU.</li><li>Mandat hanya sah untuk <b>tahun semasa</b>. Setiap tahun baharu anda mesti bertanding semula di Cawangan.</li><li>Pemegang jawatan Bahagian/Pusat hadir secara automatik (ex-officio).</li></ul>' +
        '<div class="tut-kotak"><b>Strategi:</b> menang jawatan +20 IP (Cawangan), +30 (Bahagian), +50 (Pusat) atau +10 IP (perwakilan); kalah -5/-8/-10 atau -3. Bina kesetiaan melalui Gotong-Royong dan Ziarah sebelum Bulan 4.</div>' },
      { id: 'mesyuarat', tajuk: 'Mesyuarat & Usul', html:
        '<h3>Mesyuarat &amp; Usul</h3><p>Setiap mesyuarat mempunyai agenda usul. Untuk setiap usul pilih peranan:</p>' +
        jadual([['Peranan', 'Kos AP', 'Kesan'], ['Pembawa Usul', '2', 'Lulus +12 IP; ditolak -4 IP; kredit Reputasi penuh'], ['Pembahas', '1', 'Sokong/bantah; kredit separuh'], ['Mengundi', '0', 'Kesan kecil dan percuma']]) +
        '<p>Menutup mesyuarat memutuskan baki usul tanpa kesan kepada anda, mengundi pemilihan peringkat itu, lalu memaparkan <b>ringkasan</b> (usul, pemilihan, perubahan IP/Dana) dan langkah seterusnya.</p>' +
        '<h4>Siapa boleh hadir?</h4><ul><li><b>Cawangan</b>: semua.</li><li><b>Bahagian</b> (bulan 7): Perwakilan Cawangan terpilih <b>tahun ini</b>, atau pemegang jawatan Bahagian/Pusat.</li><li><b>PAU</b> (bulan 8): Perwakilan Bahagian terpilih tahun ini, Ketua Bahagian atau pemegang jawatan Pusat.</li></ul>' },
      { id: 'acara', tajuk: 'Acara Rawak', html:
        '<h3>Pengurusan Acara Rawak</h3><p>Pop-up acara muncul <b>kira-kira 70%</b> pada pergantian bulan, dan <b>15%</b> selepas tindakan akar umbi (maksimum 2 sebulan). Hanya satu acara pada satu masa.</p>' +
        '<h4>Jenis acara</h4><ul><li><b>Isu cawangan</b>: dana program kering, keahlian tertunggak, pertikaian AJK.</li><li><b>Projek</b>: program kebajikan, Sukaneka Pemuda, Konvensyen Puteri, Kursus Kepimpinan.</li><li><b>Isu tempatan</b>: banjir (lebih kerap Nov–Feb), kebakaran, jalan berlubang.</li><li><b>Politik</b>: fitnah media sosial, tawaran penaja, temu bual.</li></ul>' +
        '<h4>Cara memilih</h4><ul><li><b>Pilihan Dana</b>: mahal tetapi kesan besar dan pasti.</li><li><b>Pilihan AP</b>: murah, kesan sederhana.</li><li><b>Abaikan</b>: percuma, tetapi sering mengurangkan IP atau kesetiaan.</li><li>Pilihan bertanda <i>berisiko</i> mempunyai hasil rawak.</li></ul>' +
        '<div class="tut-kotak"><b>Petua:</b> simpan sedikit Dana untuk acara banjir pada hujung tahun. Jika anda menutup pop-up tanpa memilih, acara kekal menunggu dalam bar di dashboard dan boleh dibuka semula.</div>' },
      { id: 'soalan', tajuk: 'Soalan Lazim', html:
        '<h3>Soalan Lazim</h3><h4>Mengapa saya tidak boleh mula Mesyuarat Bahagian?</h4><p>Anda mesti menjadi perwakilan atau pemegang jawatan yang layak, dan bulan semasa mesti 7. Mandat perwakilan tahun lalu sudah luput. Semak kad Kelayakan Perwakilan di tab Mesyuarat.</p>' +
        '<h4>Mengapa AP saya kembali kepada 5?</h4><p>AP diset semula setiap bulan. Ia tidak terkumpul.</p>' +
        '<h4>Bolehkah saya kembali ke bulan sebelumnya?</h4><p>Tidak. Pastikan anda sudah berpuas hati sebelum menekan butang bulan seterusnya.</p>' +
        '<h4>Kemajuan saya hilang?</h4><p>Kemajuan disimpan dalam pelayar ini sahaja. Butang Reset memadam semuanya.</p>' +
        '<p style="margin-top:14px"><button type="button" class="tut-btn tut-btn--emas" data-tut-ulang="1">▶ Ulang Tutorial Interaktif</button></p>' }
    ];
  }

  var kodeks = null;
  function teksBiasa(html) { var t = doc().createElement('div'); t.innerHTML = html; return (t.textContent || '').toLowerCase(); }

  function bukaBantuan(topikId) {
    var d = doc();
    if (!d || !d.body) { return false; }
    suntikCSS();
    if (!kodeks) { binaKodeks(); }
    kodeks.fokusAsal = d.activeElement;
    kodeks.nod.classList.add('is-open');
    kodeks.nod.setAttribute('aria-hidden', 'false');
    kodeks.topik = topikTopik(profilSemasa());
    kodeks.cari.value = '';
    pilihTopik(topikId || kodeks.semasa || 'asas');
    kodeks.cari.focus();
    return true;
  }

  function tutupBantuan() {
    if (!kodeks || !kodeks.nod.classList.contains('is-open')) { return; }
    kodeks.nod.classList.remove('is-open'); kodeks.nod.setAttribute('aria-hidden', 'true');
    var f = kodeks.fokusAsal; if (f && f.focus) { try { f.focus(); } catch (e) { /* abaikan */ } }
  }

  function pilihTopik(id) {
    var k = kodeks, ada = k.topik.filter(function (t) { return t.id === id; })[0] || k.topik[0];
    k.semasa = ada.id;
    Array.prototype.forEach.call(k.nav.children, function (b) { b.classList.toggle('is-on', b.getAttribute('data-topik') === ada.id); b.setAttribute('aria-current', b.getAttribute('data-topik') === ada.id ? 'true' : 'false'); });
    k.isi.innerHTML = ada.html; k.isi.scrollTop = 0;
  }

  function cariTeks(q) {
    var k = kodeks; q = String(q || '').trim().toLowerCase();
    if (!q) { pilihTopik(k.semasa); return; }
    var padan = k.topik.filter(function (t) { return teksBiasa(t.html).indexOf(q) >= 0 || t.tajuk.toLowerCase().indexOf(q) >= 0; });
    k.isi.innerHTML = padan.length
      ? '<h3>Hasil carian "' + esc(q) + '"</h3>' + padan.map(function (t) { return '<p><button type="button" class="tut-btn" data-topik="' + t.id + '">' + esc(t.tajuk) + '</button></p>'; }).join('')
      : '<p class="tut-kosong">Tiada hasil untuk "' + esc(q) + '".</p>';
  }

  function binaKodeks() {
    var d = doc();
    var nod = el('div', 'tut-kodeks'); nod.setAttribute('role', 'dialog'); nod.setAttribute('aria-modal', 'true'); nod.setAttribute('aria-label', 'Bantuan dan Codex'); nod.setAttribute('aria-hidden', 'true');
    var panel = el('div', 'tut-panel');
    var kepala = el('header', null, '<h2>📖 Bantuan &amp; Codex</h2>');
    var cari = el('input', 'tut-cari'); cari.type = 'search'; cari.placeholder = 'Cari…'; cari.setAttribute('aria-label', 'Cari dalam bantuan');
    var tutup = el('button', 'tut-btn', '✕'); tutup.type = 'button'; tutup.setAttribute('aria-label', 'Tutup bantuan');
    kepala.appendChild(cari); kepala.appendChild(tutup);
    var nav = el('nav', 'tut-nav'); nav.setAttribute('aria-label', 'Topik bantuan');
    var isi = el('div', 'tut-isi'); isi.setAttribute('tabindex', '0');
    panel.appendChild(kepala); panel.appendChild(nav); panel.appendChild(isi); nod.appendChild(panel);
    d.body.appendChild(nod);
    kodeks = { nod: nod, nav: nav, isi: isi, cari: cari, topik: topikTopik(profilSemasa()), semasa: 'asas', fokusAsal: null };
    nav.innerHTML = kodeks.topik.map(function (t) { return '<button type="button" data-topik="' + t.id + '">' + esc(t.tajuk) + '</button>'; }).join('');
    tutup.addEventListener('click', tutupBantuan);
    nod.addEventListener('click', function (ev) {
      if (ev.target === nod) { tutupBantuan(); return; }
      var b = ev.target.closest ? ev.target.closest('[data-topik]') : null;
      if (b) { cari.value = ''; pilihTopik(b.getAttribute('data-topik')); return; }
      if (ev.target.closest && ev.target.closest('[data-tut-ulang]')) { tutupBantuan(); mula({ paksa: true }); }
    });
    cari.addEventListener('input', function () { cariTeks(cari.value); });
    d.addEventListener('keydown', function (ev) {
      if (!nod.classList.contains('is-open')) { return; }
      if (ev.key === 'Escape') { ev.preventDefault(); tutupBantuan(); }
      else if (ev.key === 'Tab') {
        var f = Array.prototype.slice.call(nod.querySelectorAll('button,input,[tabindex="0"]')).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) { return; }
        var a = f[0], z = f[f.length - 1];
        if (ev.shiftKey && d.activeElement === a) { ev.preventDefault(); z.focus(); }
        else if (!ev.shiftKey && d.activeElement === z) { ev.preventDefault(); a.focus(); }
      }
    });
  }

  function pasangButang() {
    var d = doc();
    if (!d || d.getElementById('tut-fab')) { return; }
    suntikCSS();
    var b = el('button', 'tut-fab', '?'); b.id = 'tut-fab'; b.type = 'button';
    b.setAttribute('aria-label', 'Buka Bantuan dan Codex'); b.title = 'Bantuan (?)';
    b.addEventListener('click', function () { bukaBantuan(); });
    d.body.appendChild(b);
    d.addEventListener('keydown', function (ev) {                       // pintasan: ? atau F1 di luar medan input
      var t = ev.target, tag = t && t.tagName ? t.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) { return; }
      if (ev.key === '?' && !ov && !(kodeks && kodeks.nod.classList.contains('is-open'))) { ev.preventDefault(); bukaBantuan(); }
    });
  }

  /** Pasang butang (?) dan mulakan tutorial jika pemain baharu. opts: { profil, tangguh (ms, lalai 600) } */
  function init(opts) {
    opts = opts || {};
    var d = doc();
    if (!d) { return false; }
    function jalan() {
      pasangButang();
      var p = opts.profil || profilSemasa();
      if (p && !sudahSelesai(p)) { root.setTimeout(function () { mula({ profil: p }); }, opts.tangguh == null ? 600 : opts.tangguh); }
    }
    if (d.body) { jalan(); } else { d.addEventListener('DOMContentLoaded', jalan); }
    return true;
  }

  return {
    KEY: KEY, init: init, mula: mula, skip: skip,
    bukaBantuan: bukaBantuan, tutupBantuan: tutupBantuan,
    sudahSelesai: sudahSelesai, reset: reset,
    langkah: langkah, topik: topikTopik
  };
});
