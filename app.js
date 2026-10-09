/* ==========================================================================
   MyPolitik: UMNO — js/app.js
   Borang pendaftaran di index.html:
   - muat data Google Sheets (js/data.js)
   - dropdown 4 peringkat: Negeri > Bahagian (Parlimen) > DUN > Cawangan (Lokaliti)
   - simpan profil pemain (js/save.js) dan beralih ke dashboard.html

   Fail ini mengandungi DUA pengawal; hanya satu aktif bergantung pada halaman:
     1. index.html     (ada #reg-form)  — borang pendaftaran
     2. dashboard.html (ada #btn-tahun) — pengawal dashboard (bahagian kedua fail ini)

   URL Google Sheets ditetapkan dalam index.html:
     window.MYPOLITIK_CONFIG = { sheetCsvUrl: 'https://docs.google.com/.../pub?output=csv' };
   ========================================================================== */
(function () {
  'use strict';
  if (!document.getElementById('reg-form')) { return; }      // halaman lain (dashboard.html): lihat pengawal dashboard di bawah

  var D = window.MyPolitikData, S = window.MyPolitikSave;
  var CFG = window.MYPOLITIK_CONFIG || {};
  var DASHBOARD_URL = CFG.dashboardUrl || 'dashboard.html';

  function $(id) { return document.getElementById(id); }
  function fmt(n) { return Number(n || 0).toLocaleString('ms-MY'); }
  function fmtN(n) { return n === null || n === undefined ? '\u2013' : fmt(n); }   // tanda sempang jika tiada data

  var el = {
    form: $('reg-form'), nama: $('f-nama'), umur: $('f-umur'),
    negeri: $('s-negeri'), bahagian: $('s-bahagian'), dun: $('s-dun'), cawangan: $('s-cawangan'),
    status: $('status'), statusText: $('status-text'), retry: $('btn-retry'),
    info: $('info'), submit: $('btn-submit'), formError: $('form-error'),
    resume: $('resume'), resumeText: $('resume-text'), resumeNew: $('btn-resume-new')
  };

  var state = { data: null, negeri: null, bahagian: null, dun: null, cawangan: null };

  /* ---------- Pembantu UI ---------- */
  function cari(senarai, id) {
    for (var i = 0; i < senarai.length; i++) { if (senarai[i].id === id) { return senarai[i]; } }
    return null;
  }

  function reset(sel, teks) {
    sel.innerHTML = '';
    sel.appendChild(new Option(teks, ''));
    sel.value = '';
    sel.disabled = true;
  }

  function isi(sel, teks, senarai, labelFn) {
    sel.innerHTML = '';
    sel.appendChild(new Option(teks, ''));
    senarai.forEach(function (it) { sel.appendChild(new Option(labelFn(it), it.id)); });
    sel.value = '';
    sel.disabled = senarai.length === 0;
  }

  function setError(kunci, mesej) {
    var p = $('e-' + kunci), ctl = $('f-' + kunci) || $('s-' + kunci);
    if (p) { p.textContent = mesej || ''; }
    if (ctl) {
      if (mesej) { ctl.setAttribute('aria-invalid', 'true'); } else { ctl.removeAttribute('aria-invalid'); }
    }
  }

  function setStatus(keadaan, teks) {
    el.status.setAttribute('data-state', keadaan);
    el.statusText.textContent = teks;
    el.retry.hidden = !(keadaan === 'fallback' || keadaan === 'cache');
  }

  function sembunyiInfo() { el.info.hidden = true; }

  function tunjukInfo(c) {
    $('i-nama').textContent = c.nama + ', ' + c.dunNama;
    $('i-jumlah').textContent = fmt(c.jumlahAhli);
    $('i-lelaki').textContent = fmtN(c.lelaki);
    $('i-perempuan').textContent = fmtN(c.perempuan);
    $('i-bawah40').textContent = fmtN(c.bawah40);
    $('i-atas40').textContent = fmtN(c.atas40);
    $('i-kod').textContent = c.idSheet || c.id;
    el.info.hidden = false;
  }

  /* ---------- Cascade 4 peringkat ---------- */
  function kosongkanSemua(teksMuat) {
    reset(el.negeri, teksMuat || 'Pilih negeri');
    reset(el.bahagian, 'Pilih negeri dahulu');
    reset(el.dun, 'Pilih bahagian dahulu');
    reset(el.cawangan, 'Pilih DUN dahulu');
    state.negeri = state.bahagian = state.dun = state.cawangan = null;
    sembunyiInfo();
  }

  function isiNegeri() {
    kosongkanSemua();
    isi(el.negeri, 'Pilih negeri', state.data.negeri, function (n) { return n.nama; });
  }

  el.negeri.addEventListener('change', function () {
    state.negeri = cari(state.data.negeri, el.negeri.value);
    state.bahagian = state.dun = state.cawangan = null;
    setError('negeri'); sembunyiInfo();
    reset(el.dun, 'Pilih bahagian dahulu');
    reset(el.cawangan, 'Pilih DUN dahulu');
    if (state.negeri) {
      isi(el.bahagian, 'Pilih bahagian (parlimen)', state.negeri.bahagian,
        function (p) { return p.nama + ' (P.' + p.kod + ')'; });
    } else { reset(el.bahagian, 'Pilih negeri dahulu'); }
  });

  el.bahagian.addEventListener('change', function () {
    state.bahagian = state.negeri ? cari(state.negeri.bahagian, el.bahagian.value) : null;
    state.dun = state.cawangan = null;
    setError('bahagian'); sembunyiInfo();
    reset(el.cawangan, 'Pilih DUN dahulu');
    if (state.bahagian) {
      isi(el.dun, 'Pilih DUN', state.bahagian.dun, function (d) { return d.nama + ' (N.' + d.kod + ')'; });
    } else { reset(el.dun, 'Pilih bahagian dahulu'); }
  });

  el.dun.addEventListener('change', function () {
    state.dun = state.bahagian ? cari(state.bahagian.dun, el.dun.value) : null;
    state.cawangan = null;
    setError('dun'); sembunyiInfo();
    if (state.dun) {
      isi(el.cawangan, 'Pilih cawangan (lokaliti)', state.dun.cawangan, function (c) { return c.nama + ' (' + c.kod + ')'; });
    } else { reset(el.cawangan, 'Pilih DUN dahulu'); }
  });

  el.cawangan.addEventListener('change', function () {
    state.cawangan = state.dun ? cari(state.dun.cawangan, el.cawangan.value) : null;
    setError('cawangan');
    if (state.cawangan) { tunjukInfo(state.cawangan); } else { sembunyiInfo(); }
  });

  /* ---------- Muat data ---------- */
  function ringkasan(h) {
    return fmt(h.jumlah.bahagian) + ' bahagian, ' + fmt(h.jumlah.cawangan) + ' cawangan';
  }

  async function muatData() {
    kosongkanSemua('Memuatkan data...');
    el.submit.disabled = true;
    setStatus('loading', 'Memuatkan data daripada Google Sheets...');
    var url = CFG.sheetCsvUrl || D.CONFIG.SHEET_CSV_URL;
    var h;
    try {
      h = await D.loadPartyData({ url: url });
    } catch (e) {
      setStatus('fallback', 'Data tidak dapat dimuatkan: ' + (e && e.message ? e.message : e));
      el.retry.hidden = false;
      return;
    }
    state.data = h;
    if (h.source === 'sheet') {
      setStatus('sheet', 'Data langsung daripada Google Sheets (' + ringkasan(h) + ').');
    } else if (h.source === 'cache') {
      setStatus('cache', 'Tiada sambungan ke Google Sheets. Menggunakan salinan tersimpan (' + ringkasan(h) + ').');
    } else {
      setStatus('fallback', 'Mod luar talian dengan data contoh (' + ringkasan(h) + '). ' + (h.amaran[0] || ''));
    }
    isiNegeri();
    el.submit.disabled = false;
  }

  el.retry.addEventListener('click', muatData);

  /* ---------- Padam ralat sebaik pengguna membetulkan medan ---------- */
  el.nama.addEventListener('input', function () { if (el.nama.value.trim().length >= 3) { setError('nama'); } });
  el.umur.addEventListener('input', function () {
    var u = parseInt(el.umur.value, 10);
    if (isFinite(u) && u >= 18 && u <= 100) { setError('umur'); }
  });
  Array.prototype.forEach.call(el.form.querySelectorAll('input[name="jantina"]'), function (r) {
    r.addEventListener('change', function () { setError('jantina'); });
  });

  /* ---------- Pengesahan dan hantar ---------- */
  function sahkan() {
    var salah = [], nama = el.nama.value.trim();
    var jantinaEl = el.form.querySelector('input[name="jantina"]:checked');
    var umur = parseInt(el.umur.value, 10);

    setError('nama'); setError('jantina'); setError('umur');
    setError('negeri'); setError('bahagian'); setError('dun'); setError('cawangan');

    if (nama.length < 3) { setError('nama', 'Masukkan nama sekurang-kurangnya 3 huruf.'); salah.push(el.nama); }
    if (!jantinaEl) { setError('jantina', 'Pilih jantina.'); salah.push(el.form.querySelector('input[name="jantina"]')); }
    if (!isFinite(umur) || umur < 18 || umur > 100) { setError('umur', 'Umur mesti antara 18 dan 100 tahun.'); salah.push(el.umur); }
    if (!state.negeri) { setError('negeri', 'Pilih negeri.'); salah.push(el.negeri); }
    else if (!state.bahagian) { setError('bahagian', 'Pilih bahagian.'); salah.push(el.bahagian); }
    else if (!state.dun) { setError('dun', 'Pilih DUN.'); salah.push(el.dun); }
    else if (!state.cawangan) { setError('cawangan', 'Pilih cawangan.'); salah.push(el.cawangan); }

    if (salah.length) { salah[0].focus(); return null; }
    return { nama: nama, jantina: jantinaEl.value, umur: umur };
  }

  el.form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    el.formError.textContent = '';
    var v = sahkan();
    if (!v) { return; }

    var demografik = D.tentukanDemografi(v.jantina, v.umur);
    if (!demografik) { setError('umur', 'Umur dan jantina tidak sah.'); el.umur.focus(); return; }

    var profil = S.buildPlayerProfile({ nama: v.nama, demografik: demografik, cawangan: state.cawangan });
    var hasil = S.savePlayer(profil);
    if (!hasil.ok) { el.formError.textContent = hasil.ralat; return; }

    el.submit.disabled = true;
    el.submit.textContent = 'Mendaftar...';
    window.location.assign(DASHBOARD_URL);
  });

  /* ---------- Pemain sedia ada ---------- */
  function semakPemain() {
    var p = S.loadPlayer();
    if (!p) { el.resume.hidden = true; return; }
    el.resumeText.textContent = p.nama + ', ' + p.jawatan + ' Cawangan ' + p.cawangan + ' (' + p.bahagian + ', ' + p.negeri + ')';
    el.resume.hidden = false;
  }

  el.resumeNew.addEventListener('click', function () {
    S.clearPlayer();
    el.resume.hidden = true;
    el.nama.focus();
  });

  /* ---------- Mula ---------- */
  function segerakNilaiMula() {
    var d = S.DEFAULTS;
    $('m-jawatan').textContent = d.jawatan;
    $('m-ip').textContent = fmt(d.ip);
    $('m-myr').textContent = 'RM ' + fmt(d.myr);
    $('m-ap').textContent = fmt(d.ap);
    $('m-tahun').textContent = d.tahun;
  }

  segerakNilaiMula();
  semakPemain();
  muatData();
})();


/* ==========================================================================
   PENGAWAL DASHBOARD (dashboard.html)
   Menggabungkan: save.js, ordinaryMember.js, incumbent.js, election.js,
   meeting.js, map.js. Semua keadaan dibaca daripada localStorage
   ('myPolitik_player') dan UI dilukis semula pada setiap perubahan profil.
   ========================================================================== */
(function () {
  'use strict';
  if (!document.getElementById('btn-tahun')) { return; }

  var W = window, S = W.MyPolitikSave, D = W.MyPolitikData, O = W.MyPolitikOrdinaryMember,
      I = W.MyPolitikIncumbent, E = W.MyPolitikElection, M = W.MyPolitikMeeting, MAP = W.MyPolitikMap;
  var CFG = W.MYPOLITIK_CONFIG || {};
  var INDEX_URL = CFG.indexUrl || 'index.html';

  function $(id) { return document.getElementById(id); }
  function fmt(n) { return Number(n || 0).toLocaleString('ms-MY'); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  var TABS = ['peta', 'tindakan', 'pemilihan', 'mesyuarat'];
  var state = {
    tab: 'peta', kodSimulasi: '', anggaran: {}, mesej: {},
    peta: { status: 'kosong', instance: null, data: null }, renderTerjadual: false
  };

  /* ---------- Toast & modal ---------- */
  function toast(teks, jenis) {
    var st = $('toasts'), t = document.createElement('div');
    t.className = 'toast' + (jenis === 'ok' ? ' toast--success' : jenis === 'ralat' ? ' toast--danger' : '');
    t.textContent = teks;
    st.appendChild(t);
    setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, jenis === 'ralat' ? 6500 : 4500);
    while (st.children.length > 4) { st.removeChild(st.firstChild); }
  }

  var modalAktif = null;
  /** modal({tajuk, isi(html), butang:[{label, nilai, kelas}]}) -> Promise<nilai | null> */
  function modal(o) {
    return new Promise(function (selesai) {
      var ov = $('modal'), kaki = $('modal-kaki'), lama = document.activeElement;
      $('modal-tajuk').textContent = o.tajuk || '';
      $('modal-isi').innerHTML = o.isi || '';
      kaki.innerHTML = '';
      (o.butang || [{ label: 'Tutup', nilai: true, kelas: 'btn--gold' }]).forEach(function (b) {
        var bt = document.createElement('button');
        bt.type = 'button'; bt.className = 'btn ' + (b.kelas || 'btn--ghost'); bt.textContent = b.label;
        bt.addEventListener('click', function () { tutup(b.nilai); });
        kaki.appendChild(bt);
      });
      function tutup(v) {
        ov.classList.remove('is-open'); ov.setAttribute('aria-hidden', 'true'); document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', kunci); ov.removeEventListener('click', luar); $('modal-tutup').removeEventListener('click', x);
        modalAktif = null;
        if (lama && lama.focus) { try { lama.focus(); } catch (e) { /* abaikan */ } }
        selesai(v === undefined ? null : v);
      }
      function x() { tutup(null); }
      function luar(ev) { if (ev.target === ov) { tutup(null); } }
      function kunci(ev) {
        if (ev.key === 'Escape') { tutup(null); return; }
        if (ev.key === 'Tab') {                                   // perangkap fokus
          var f = ov.querySelectorAll('button:not([disabled])');
          if (!f.length) { return; }
          var a = f[0], z = f[f.length - 1];
          if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); z.focus(); }
          else if (!ev.shiftKey && document.activeElement === z) { ev.preventDefault(); a.focus(); }
        }
      }
      modalAktif = tutup;
      document.addEventListener('keydown', kunci); ov.addEventListener('click', luar); $('modal-tutup').addEventListener('click', x);
      ov.classList.add('is-open'); ov.setAttribute('aria-hidden', 'false'); document.body.classList.add('modal-open');
      var fb = kaki.querySelector('button:last-child'); if (fb) { fb.focus(); }
    });
  }

  /** Paparkan peristiwa penting (jawatan, cabaran) sebagai modal, selebihnya toast. */
  async function urusPeristiwa(senarai) {
    var penting = { jawatan_baharu: 'Jawatan Baharu', jawatan_hilang: 'Kehilangan Jawatan', cabaran_jawatan: 'Jawatan Anda Dicabar',
                    kelayakan_dibuka: 'Kelayakan Dibuka', perwakilan_terpilih: 'Terpilih Sebagai Perwakilan',
                    pemilihan_dibuka: 'Tahun Pemilihan', tahun_pentadbiran: 'Tahun Pentadbiran' };
    for (var i = 0; i < (senarai || []).length; i++) {
      var e = senarai[i];
      if (!e || !e.mesej) { continue; }
      if (penting[e.jenis]) { await modal({ tajuk: penting[e.jenis], isi: '<p>' + esc(e.mesej) + '</p>' }); }
      else { toast(e.mesej); }
    }
  }

  /** Papar hasil tindakan: toast + peristiwa. */
  async function lapor(r, sendiri) {
    if (!r) { return; }
    if (!r.ok) { toast(r.ralat || 'Tindakan gagal.', 'ralat'); return; }
    if (!sendiri) { toast(r.mesej || 'Berjaya.', 'ok'); }
    var amaran = r.amaran && r.amaran.amaran ? [{ jenis: 'amaran_kesetiaan', mesej: r.amaran.mesej }] : [];
    await urusPeristiwa((r.peristiwa || []).concat(amaran.filter(function (a) {
      return !(r.peristiwa || []).some(function (p) { return p.jenis === 'cabaran_jawatan'; });
    })));
  }

  /* ---------- Pembantu profil ---------- */
  function adalahTahunPemilihan(tahun) {
    return E ? E.adalahTahunPemilihan(tahun) : ((tahun - 2026) % 3 === 0);
  }
  function labelTahun(tahun) { return tahun + ' - ' + (adalahTahunPemilihan(tahun) ? 'TAHUN PEMILIHAN' : 'PENTADBIRAN'); }
  function kelasLencana(j) {
    j = String(j || '');
    if (/Cawangan/i.test(j)) { return 'cawangan'; }
    if (/Bahagian/i.test(j)) { return 'bahagian'; }
    if (/MKT/i.test(j)) { return 'mt'; }
    if (/Timbalan Presiden/i.test(j)) { return 'timbalan'; }
    if (/Naib Presiden/i.test(j)) { return 'naib'; }
    if (/Presiden/i.test(j)) { return 'presiden'; }
    if (/Menteri/i.test(j)) { return 'menteri'; }
    return j === 'Ahli Biasa' || !j ? 'ahli' : 'mt';
  }
  function pemegang(p) { return !!(I && I.adalahPemegangJawatan(p)); }
  function inisial(nama) {
    var k = String(nama || '?').trim().split(/\s+/);
    return ((k[0] || '?').charAt(0) + (k.length > 1 ? k[k.length - 1].charAt(0) : '')).toUpperCase();
  }

  /* ---------- Header & bar sumber ---------- */
  function renderHeader(p) {
    $('p-nama').textContent = p.nama;
    $('p-avatar').textContent = inisial(p.nama);
    var l = $('p-jawatan'); l.textContent = p.jawatan; l.className = 'badge-office badge-office--' + kelasLencana(p.jawatan);
    $('p-negeri').textContent = p.negeri || '–'; $('p-bahagian').textContent = p.bahagian || '–';
    $('p-dun').textContent = p.dun || '–'; $('p-cawangan').textContent = p.cawangan || '–';
    var pem = adalahTahunPemilihan(p.tahun);
    var tp = $('p-tahun'); tp.textContent = labelTahun(p.tahun); tp.setAttribute('data-fasa', pem ? 'pemilihan' : 'pentadbiran');
    $('r-ip').textContent = fmt(p.ip); $('r-myr').textContent = 'RM ' + fmt(p.myr); $('r-ap').textContent = fmt(p.ap);
    $('r-tahun').textContent = labelTahun(p.tahun);
    var seterusnya = E ? E.tahunPemilihanSeterusnya(p.tahun) : p.tahun;
    $('r-tahun-sub').textContent = pem ? 'Pertandingan & kempen dibuka' : 'Pemilihan seterusnya ' + seterusnya + ' (' + (seterusnya - p.tahun) + ' tahun lagi)';
    $('t-info').textContent = 'Tahun ' + p.tahun + '. Lanjut ke ' + (p.tahun + 1) + ' untuk memulihkan AP kepada ' + S.DEFAULTS.ap + ' dan mengemas kini kitaran 3 tahun.';
    document.title = p.nama + ' | MyPolitik: UMNO';
  }

  /* ---------- Sidebar ---------- */
  function bar(label, nilai, bahaya) {
    return '<div class="loy__row"><div class="loy__label"><span>' + esc(label) + '</span><b>' + nilai + '%</b></div>' +
      '<div class="progress progress--sm' + (bahaya ? ' progress--danger' : '') + '" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + nilai + '">' +
      '<div class="progress__bar" style="width:' + clamp(nilai, 0, 100) + '%"></div></div></div>';
  }

  function renderSisi(p) {
    var h = '';
    Object.keys(S.KESETIAAN_LABEL).forEach(function (k) {
      var v = p.kesetiaan[k];
      h += bar('Kesetiaan ' + S.KESETIAAN_LABEL[k], v, k === 'akarUmbi' && v < 40);
    });
    h += bar('Reputasi Parti', p.reputasi, false);
    $('s-kesetiaan').innerHTML = h;

    var isu = p.isu || [];
    $('s-isu').innerHTML = isu.length
      ? '<ul style="margin:0;padding-left:1.1rem;color:var(--text-muted);font-size:.88rem">' + isu.slice(0, 6).map(function (x) {
          return '<li>' + esc(x && x.tajuk ? x.tajuk : x) + '</li>'; }).join('') + '</ul>'
      : '<p class="empty">Belum ada isu. Berbual di warung untuk mengumpul isu tempatan.</p>';

    var log = p.log || [];
    $('s-log').innerHTML = log.length ? log.slice(0, 10).map(function (e) {
      var d = e.perubahan || {}, baik = (d.ip || 0) > 0 || (d.reputasi || 0) > 0, buruk = (d.ip || 0) < 0;
      return '<div class="event-log__item' + (baik ? ' is-good' : buruk ? ' is-bad' : '') + '"><time>' + esc(e.tahun) + ' · ' +
        esc(e.masa ? new Date(e.masa).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }) : '') + '</time>' + esc(e.nama || e.tindakan) + '</div>';
    }).join('') : '<p class="empty">Tiada peristiwa lagi.</p>';
  }

  /* ---------- Panel: Tindakan Pemain ---------- */
  function fx(t) { return t ? '<span class="badge badge--gold">' + esc(t) + '</span>' : ''; }

  function panelTindakan(p) {
    var peg = pemegang(p), mod = peg ? I : O;
    if (!mod) { return '<div class="card"><p class="empty">Modul tindakan tidak dimuatkan.</p></div>'; }
    var senarai = mod.senaraiTindakan(p), h = '';

    if (peg) {
      var c = I.getCabaranAktif();
      if (c) {
        h += '<div class="banner banner--warn" role="alert"><strong>Jawatan anda dicabar</strong>' + esc((c.penentang && c.penentang.nama ? c.penentang.nama + ': ' : '') + (c.mesej || 'Seorang penentang mencabar jawatan anda.')) +
          ' Pulihkan Kesetiaan Akar Umbi sebelum pemilihan berikutnya.</div>';
      } else if (p.kesetiaan.akarUmbi < 40) {
        h += '<div class="banner banner--warn" role="alert"><strong>Amaran kesetiaan</strong>Kesetiaan Akar Umbi tinggal ' + p.kesetiaan.akarUmbi + '%. Di bawah 40%, penentang boleh mencabar jawatan anda.</div>';
      }
    }

    h += '<section class="card"><h2 class="card__title" style="margin:0 0 4px">' + (peg ? 'Tindakan Pemegang Jawatan' : 'Tindakan Akar Umbi') + '</h2>' +
      '<p class="note">' + (peg ? 'Jawatan semasa: <b>' + esc(p.jawatan) + '</b>. Jaga sokongan akar umbi dan perwakilan.' : 'Bina pengaruh di peringkat cawangan untuk membuka kelayakan bertanding.') + '</p><div class="choice-list">';
    senarai.forEach(function (t) {
      h += '<button type="button" class="choice" data-act="tindakan" data-id="' + esc(t.id) + '" data-fk="t:' + esc(t.id) + '"' + (t.boleh ? '' : ' disabled') + '>' +
        '<span class="choice__title">' + esc(t.nama) + '</span><span class="choice__desc">' + esc(t.penerangan) + '</span>' +
        '<span class="choice__fx">' + fx(t.ringkas) + '</span>' +
        (t.boleh ? '' : '<span class="choice__desc" style="color:var(--danger)">' + esc(t.sebab) + '</span>') + '</button>';
    });
    h += '</div>' + (state.mesej.tindakan ? '<p class="result" style="margin-top:12px">' + esc(state.mesej.tindakan) + '</p>' : '') + '</section>';

    if (!peg && O) {
      var k = O.getKelayakanBertanding(p), peratus = clamp(Math.round(k.ip / k.ipMin * 100), 0, 100);
      h += '<section class="card"><h2 class="card__title" style="margin:0 0 4px">Kelayakan Bertanding</h2>' +
        '<p class="note">Capai ' + k.ipMin + ' IP untuk membuka pertandingan AJK / Sayap Cawangan. Jawatan Bahagian dan Pusat masih terkunci.</p>' +
        '<div class="progress-wrap"><div class="progress__label"><span>Pengaruh</span><b>' + fmt(k.ip) + ' / ' + k.ipMin + '</b></div>' +
        '<div class="progress"><div class="progress__bar" style="width:' + peratus + '%"></div></div></div>' +
        '<div style="margin-top:12px">' + k.senarai.map(function (e) {
          return '<div class="kv"><span>' + esc(e.jawatan) + '</span><b>' + (e.terbuka ? 'Terbuka' : 'Terkunci') + '</b></div>'; }).join('') + '</div>' +
        '<div style="margin-top:12px"><button type="button" class="btn btn--primary btn--sm" data-act="ke-tab" data-v="pemilihan">Ke Pemilihan &amp; Kempen</button></div></section>';
    }
    return h;
  }

  /* ---------- Panel: Pemilihan & Kempen ---------- */
  function chipPertandingan(e) {
    if (e.selesai) { return '<span class="status-chip is-done">Selesai</span>'; }
    if (e.didaftar) { return '<span class="status-chip is-open">Berdaftar</span>'; }
    return e.terbuka ? '<span class="status-chip is-open">Terbuka</span>' : '<span class="status-chip is-lock">Terkunci</span>';
  }

  function panelPemilihan(p) {
    if (!E) { return '<div class="card"><p class="empty">Modul pemilihan tidak dimuatkan.</p></div>'; }
    var st = E.getStatusModul(p), f = st.fokus, h = '';
    h += '<div class="banner ' + (f.fasa === 'pemilihan' ? 'banner--gold' : '') + '"><strong>' + esc(p.tahun + ': ' + f.tajuk) + '</strong>' + esc(f.fokus.join(' · ')) +
      (f.fasa === 'pemilihan' ? '' : '. Pemilihan seterusnya pada ' + f.pemilihanBerikutnya + '.') + '</div>';

    if (f.fasa !== 'pemilihan') {
      return h + '<section class="card"><h2 class="card__title" style="margin:0 0 4px">Pertandingan Ditutup</h2>' +
        '<p class="note">Tahun pentadbiran: tumpukan pada tindakan, perbahasan usul di Mesyuarat, serta mengumpul IP dan MYR. Pendaftaran dan kempen dibuka semula pada tahun ' + f.pemilihanBerikutnya + '.</p>' +
        '<div class="btn-group"><button type="button" class="btn btn--primary btn--sm" data-act="ke-tab" data-v="tindakan">Ke Tindakan</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-act="ke-tab" data-v="mesyuarat">Ke Mesyuarat</button></div></section>';
    }

    var daftar = st.pertandingan.filter(function (e) { return e.didaftar && !e.selesai; });
    if (!daftar.some(function (e) { return e.kod === state.kodSimulasi; })) { state.kodSimulasi = daftar.length ? daftar[0].kod : ''; }

    h += '<section class="card"><h2 class="card__title" style="margin:0 0 4px">Pertandingan</h2><p class="note">Hanya satu jawatan boleh dipertandingkan pada satu masa. Perwakilan boleh dipertandingkan bersama.</p>';
    st.pertandingan.forEach(function (e) {
      var a = state.anggaran[e.kod], kep = e.keputusan;
      h += '<div class="item"><div class="item__head"><div><div class="item__title">' + esc(e.jawatan) + '</div>' +
        '<p class="item__desc">' + fmt(e.kerusi) + ' kerusi' + (e.ipPerlu ? ' · perlu ' + e.ipPerlu + ' IP' : '') + (e.sebab && !e.terbuka ? ' · ' + esc(e.sebab) : '') + '</p></div>' + chipPertandingan(e) + '</div>';
      if (kep) {
        h += '<p class="result ' + (kep.menang ? 'is-good' : 'is-bad') + '">' + (kep.menang ? 'Menang' : 'Kalah') + ': kedudukan ' + kep.kedudukan + ' daripada ' + kep.jumlahCalon + ' calon, ' + fmt(kep.undi) + ' undi.</p>';
      } else {
        h += '<div class="item__row">';
        if (!e.didaftar) { h += '<button type="button" class="btn btn--primary btn--sm" data-act="daftar" data-kod="' + esc(e.kod) + '" data-fk="d:' + esc(e.kod) + '"' + (e.terbuka ? '' : ' disabled') + '>Daftar Bertanding</button>'; }
        else {
          h += '<button type="button" class="btn btn--gold btn--sm" data-act="undi" data-kod="' + esc(e.kod) + '" data-fk="u:' + esc(e.kod) + '">Hari Mengundi</button>' +
               '<button type="button" class="btn btn--ghost btn--sm" data-act="peluang" data-kod="' + esc(e.kod) + '" data-fk="p:' + esc(e.kod) + '">Anggar Peluang</button>' +
               '<button type="button" class="btn btn--ghost btn--sm" data-act="tarik" data-kod="' + esc(e.kod) + '" data-fk="x:' + esc(e.kod) + '">Tarik Balik</button>';
        }
        h += '</div>';
        if (a) { h += '<p class="result">' + (a.ok ? 'Anggaran peluang menang: <b>' + a.peluangMenang + '%</b> (kekuatan anda ' + a.kekuatan + '/100, ' + a.jumlahCalon + ' calon, kedudukan purata ' + a.kedudukanPurata + ').' : esc(a.ralat)) + '</p>'; }
      }
      h += '</div>';
    });
    h += '</section>';

    h += '<section class="card"><h2 class="card__title" style="margin:0 0 4px">Kempen Pemilihan</h2><p class="note">Mata kempen terkumpul: <b>' + fmt(st.mataKempen) + '</b>. Kempen meningkatkan kekuatan anda dalam pengundian.</p>';
    if (daftar.length) {
      h += '<label class="note" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">Untuk simulasi pengundian: <select data-act="pilih-kod" class="item" style="padding:.3rem .6rem">' +
        daftar.map(function (e) { return '<option value="' + esc(e.kod) + '"' + (e.kod === state.kodSimulasi ? ' selected' : '') + '>' + esc(e.jawatan) + '</option>'; }).join('') + '</select></label>';
    }
    h += '<div class="choice-list">';
    st.kempen.forEach(function (k) {
      var boleh = k.boleh && (!k.perluKod || !!state.kodSimulasi);
      var sebab = !k.boleh ? k.sebab : (k.perluKod && !state.kodSimulasi ? 'Daftar bertanding dahulu.' : '');
      h += '<button type="button" class="choice" data-act="kempen" data-id="' + esc(k.id) + '" data-fk="k:' + esc(k.id) + '"' + (boleh ? '' : ' disabled') + '>' +
        '<span class="choice__title">' + esc(k.nama) + '</span><span class="choice__desc">' + esc(k.penerangan) + '</span>' +
        '<span class="choice__fx">' + fx(k.ringkas) + (k.maksKali ? '<span class="badge">' + k.kali + '/' + k.maksKali + ' kali</span>' : '') + '</span>' +
        (sebab ? '<span class="choice__desc" style="color:var(--danger)">' + esc(sebab) + '</span>' : '') + '</button>';
    });
    h += '</div>' + (state.mesej.kempen ? '<p class="result" style="margin-top:12px">' + state.mesej.kempen + '</p>' : '') + '</section>';
    return h;
  }

  /* ---------- Panel: Mesyuarat & Usul ---------- */
  var STATUS_MES = { terkunci: ['Terkunci', 'is-lock'], tidak_layak: ['Tidak Layak', 'is-lock'], boleh_mula: ['Sedia', 'is-open'], sedang: ['Berlangsung', 'is-open'], selesai: ['Selesai', 'is-done'] };

  function butangPeranan(lvl, u, ap) {
    var pr = M.senaraiPeranan(), h = '<div class="roles" role="group" aria-label="Peranan anda">';
    function b(id, pend, label) {
      var kos = pr.filter(function (x) { return x.id === id; })[0].kosAP;
      var cukup = ap >= kos;
      return '<button type="button" class="btn btn--sm ' + (id === 'pembawa' ? 'btn--primary' : id === 'pembahas' ? 'btn--gold' : 'btn--ghost') + '" data-act="peranan" data-lvl="' + lvl + '" data-u="' + esc(u.id) + '" data-r="' + id + '" data-p="' + pend + '"' +
        ' data-fk="m:' + esc(u.id) + ':' + id + ':' + pend + '"' + (cukup ? '' : ' disabled title="AP tidak mencukupi"') + '>' + label + (kos ? ' (-' + kos + ' AP)' : '') + '</button>';
    }
    if (u.jenis !== 'ucapan_dasar') { h += b('pembawa', 'sokong', 'Bawa Usul'); }
    h += b('pembahas', 'sokong', 'Bahas: Sokong') + b('pembahas', 'bantah', 'Bahas: Bantah') +
         b('undi', 'sokong', 'Undi Sokong') + b('undi', 'bantah', 'Undi Bantah') + b('undi', 'berkecuali', 'Berkecuali');
    return h + '</div>';
  }

  function panelMesyuarat(p) {
    if (!M) { return '<div class="card"><p class="empty">Modul mesyuarat tidak dimuatkan.</p></div>'; }
    var k = M.getKeadaanMesyuarat(p), h = '';
    h += '<div class="banner"><strong>Mesyuarat Tahun ' + p.tahun + '</strong>Mesyuarat berlangsung mengikut urutan: Cawangan, Bahagian, kemudian Perhimpunan Agung (PAU). Pilih peranan anda bagi setiap usul: Pembawa, Pembahas atau Pengundi. Setiap pilihan mempengaruhi IP dan Reputasi Parti.</div>';
    k.peringkat.forEach(function (lv) {
      var cs = STATUS_MES[lv.status] || [lv.status, ''];
      h += '<section class="card"><div class="item__head"><div><h2 class="card__title" style="margin:0">' + esc(lv.nama) + '</h2><p class="item__desc">' + esc(lv.jenisUsul) + '</p></div>' +
        '<span class="status-chip ' + cs[1] + '">' + cs[0] + '</span></div>';
      if (lv.status === 'terkunci' || lv.status === 'tidak_layak') { h += '<p class="note" style="margin-top:12px">' + esc(lv.sebab) + '</p>'; }
      if (lv.status === 'boleh_mula') {
        h += '<div style="margin-top:12px"><button type="button" class="btn btn--primary" data-act="mula" data-lvl="' + lv.kod + '" data-fk="mula:' + lv.kod + '">Mulakan ' + esc(lv.nama) + '</button></div>';
      }
      if (lv.status === 'sedang' || lv.status === 'selesai') {
        (lv.agenda || []).forEach(function (u) {
          h += '<div class="item" style="margin-top:12px"><div class="item__head"><div class="item__title">' + esc(u.tajuk) + '</div>' +
            '<span class="status-chip' + (u.status === 'selesai' ? ' is-done' : '') + '">' + (u.jenis === 'pemilihan' ? 'Pemilihan' : u.jenis === 'ucapan_dasar' ? 'Ucapan Dasar' : u.status === 'selesai' ? 'Diputuskan' : 'Terbuka') + '</span></div>' +
            '<p class="item__desc">' + esc(u.penerangan || '') + '</p>';
          if (u.jenis === 'pemilihan') { h += '<p class="item__desc">Keputusan pemilihan perwakilan dikira apabila mesyuarat ditutup.</p>'; }
          else if (u.status === 'selesai' && u.keputusan) {
            var kp = u.keputusan, pil = u.pilihan;
            h += '<p class="result ' + (kp.padan ? 'is-good' : pil ? 'is-bad' : '') + '">' + (kp.lulus ? 'LULUS' : 'DITOLAK') + ': ' + fmt(kp.undiSokong) + ' sokong, ' + fmt(kp.undiBantah) + ' bantah' +
              (pil ? ' · anda: ' + esc(pil.peranan) + ' (' + esc(pil.pendirian) + '): ' + (kp.ip >= 0 ? '+' : '') + kp.ip + ' IP, ' + (kp.reputasi >= 0 ? '+' : '') + kp.reputasi + ' Reputasi' : ' · tiada penyertaan') + '</p>';
          } else if (lv.status === 'sedang') { h += butangPeranan(lv.kod, u, p.ap); }
          h += '</div>';
        });
        if (lv.status === 'sedang') {
          h += '<div style="margin-top:12px"><button type="button" class="btn btn--gold" data-act="tutup" data-lvl="' + lv.kod + '" data-fk="tutup:' + lv.kod + '">Tutup Mesyuarat</button></div>';
        }
        if (lv.status === 'selesai' && lv.ringkasan) {
          var r = lv.ringkasan;
          h += '<p class="note" style="margin-top:12px">Ringkasan: ' + r.lulus + ' lulus, ' + r.ditolak + ' ditolak, ' + r.disertai + ' anda sertai.' +
            (r.pemilihan && r.pemilihan.length ? ' ' + r.pemilihan.map(function (x) { return (x.menang ? 'Menang' : 'Kalah') + ' perwakilan (kedudukan ' + x.kedudukan + ')'; }).join('; ') + '.' : '') + '</p>';
        }
      }
      h += '</section>';
    });
    return h;
  }

  /* ---------- Peta ---------- */
  async function muatPeta(paksa) {
    var pt = state.peta, host = $('peta-host');
    if (pt.status === 'memuat' || (pt.status === 'siap' && !paksa)) { return; }
    if (!MAP || !D) { host.innerHTML = '<div class="banner banner--warn">Modul peta tidak dimuatkan.</div>'; return; }
    pt.status = 'memuat';
    host.innerHTML = '<div class="loading" role="status">Memuatkan data peta...</div>';
    try {
      if (!pt.data) { pt.data = await D.loadPartyData({ url: CFG.sheetCsvUrl }); }
      host.innerHTML = '';
      if (pt.instance) { pt.instance.destroy(); }
      pt.instance = await MAP.mount(host, { data: pt.data, mode: 'negeri' });
      pt.status = 'siap';
    } catch (e) {
      pt.status = 'kosong';
      host.innerHTML = '<div class="banner banner--warn"><strong>Peta tidak dapat dimuatkan</strong>' + esc(e && e.message ? e.message : e) +
        '</div><button type="button" class="btn btn--primary" data-act="ulang-peta">Cuba Lagi</button>';
    }
  }

  /* ---------- Render utama ---------- */
  function renderPanel(p) {
    var id = state.tab, el = $('panel-' + id);
    if (id === 'peta') { return; }
    var fk = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute('data-fk') : null;
    el.innerHTML = id === 'tindakan' ? panelTindakan(p) : id === 'pemilihan' ? panelPemilihan(p) : panelMesyuarat(p);
    if (fk) { var f = el.querySelector('[data-fk="' + fk.replace(/"/g, '\\"') + '"]'); if (f && !f.disabled) { f.focus({ preventScroll: true }); } }
  }

  function renderTabs(p) {
    TABS.forEach(function (t) {
      var b = $('tab-' + t), a = t === state.tab;
      b.setAttribute('aria-selected', String(a)); b.tabIndex = a ? 0 : -1;
      $('panel-' + t).hidden = !a;
    });
    Array.prototype.forEach.call($('bottom-nav').querySelectorAll('button'), function (b) { b.classList.toggle('is-active', b.getAttribute('data-tab') === state.tab); });
    var tp = $('tab-pemilihan'); tp.innerHTML = '🗳️ Pemilihan &amp; Kempen' + (adalahTahunPemilihan(p.tahun) ? '<span class="dot" title="Tahun pemilihan"></span>' : '');
    var tm = $('tab-mesyuarat'), sedia = M && M.getKeadaanMesyuarat(p).peringkat.some(function (x) { return x.status === 'boleh_mula' || x.status === 'sedang'; });
    tm.innerHTML = '📜 Mesyuarat &amp; Usul' + (sedia ? '<span class="dot" title="Mesyuarat tersedia"></span>' : '');
  }

  function render() {
    state.renderTerjadual = false;
    var p = S.loadPlayer();
    if (!p) { W.location.replace(INDEX_URL); return; }
    renderHeader(p); renderSisi(p); renderTabs(p); renderPanel(p);
  }
  function jadualRender() {
    if (state.renderTerjadual) { return; }
    state.renderTerjadual = true;
    (W.requestAnimationFrame || setTimeout)(render);
  }

  function setTab(t, fokus) {
    if (TABS.indexOf(t) < 0) { return; }
    state.tab = t;
    try { W.history.replaceState(null, '', '#' + t); } catch (e) { /* abaikan */ }
    render();
    if (t === 'peta') { muatPeta(); }
    if (fokus) { $('tab-' + t).focus(); }
  }

  /* ---------- Tindakan pengguna ---------- */
  async function tindakan(id) {
    var p = S.loadPlayer(), r = (pemegang(p) ? I : O).jalankanTindakan(id);
    state.mesej.tindakan = r.ok ? r.mesej : '';
    render(); await lapor(r);
  }

  async function operasiPemilihan(fn, kunciMesej) {
    var r = fn(); if (kunciMesej) { state.mesej[kunciMesej] = r.ok ? esc(r.mesej) : ''; }
    render(); await lapor(r);
  }

  async function lanjutTahun() {
    var p = S.loadPlayer(), baru = p.tahun + 1, pemB = adalahTahunPemilihan(baru), amaran = [];
    if (E && adalahTahunPemilihan(p.tahun)) {
      var tertunggak = E.getStatusModul(p).pertandingan.filter(function (e) { return e.didaftar && !e.selesai; });
      if (tertunggak.length) { amaran.push('Pertandingan belum diundi akan terbatal: ' + tertunggak.map(function (e) { return esc(e.jawatan); }).join(', ') + '.'); }
    }
    if (M) {
      var belum = M.getKeadaanMesyuarat(p).peringkat.filter(function (x) { return x.status === 'boleh_mula' || x.status === 'sedang'; });
      if (belum.length) { amaran.push('Mesyuarat belum selesai tahun ini: ' + belum.map(function (x) { return esc(x.nama); }).join(', ') + '.'); }
    }
    var ya = await modal({
      tajuk: 'Lanjut ke Tahun ' + baru + '?',
      isi: '<div class="kv"><span>Tahun</span><b>' + p.tahun + ' &rarr; ' + baru + '</b></div>' +
        '<div class="kv"><span>Status</span><b>' + esc(labelTahun(baru)) + '</b></div>' +
        '<div class="kv"><span>AP</span><b>' + p.ap + ' &rarr; ' + S.DEFAULTS.ap + '</b></div>' +
        (amaran.length ? '<ul style="margin-top:12px">' + amaran.map(function (a) { return '<li>' + a + '</li>'; }).join('') + '</ul>' : '') +
        '<p style="margin-top:12px">Anda tidak boleh kembali ke tahun sebelumnya.</p>',
      butang: [{ label: 'Batal', nilai: false }, { label: 'Lanjut ke ' + baru, nilai: true, kelas: 'btn--gold' }]
    });
    if (!ya) { return; }
    var r;
    if (E) { r = E.majuTahun(); }
    else { r = S.applyEffects({ ap: S.DEFAULTS.ap - p.ap }, { kiraTindakan: false, patch: { tahun: baru }, log: { tindakan: 'maju_tahun', nama: 'Tahun ' + baru, peringkat: 'masa' } }); r.mesej = 'Tahun ' + baru + '.'; r.peristiwa = []; }
    if (!r.ok) { toast(r.ralat, 'ralat'); return; }
    state.anggaran = {}; state.mesej = {}; state.kodSimulasi = '';
    render();
    toast('Tahun ' + baru + ': AP dipulihkan kepada ' + S.DEFAULTS.ap + '.', 'ok');
    var pBaru = S.loadPlayer();
    if (I && pemegang(pBaru)) {                                    // semakan kesetiaan tahunan
      var a = I.semakAmaranKesetiaan();
      if (a && a.amaran && a.cabaranBaru) { r.peristiwa = (r.peristiwa || []).concat([{ jenis: 'cabaran_jawatan', mesej: a.cabaranBaru.mesej }]); }
      else if (a && a.amaran) { toast(a.mesej, 'ralat'); }
    }
    await urusPeristiwa(r.peristiwa);
  }

  async function reset() {
    var ya = await modal({
      tajuk: 'Reset Permainan?',
      isi: '<p>Semua kemajuan akan dipadam daripada pelayar ini (profil, sumber, pemilihan, mesyuarat dan peta). Anda akan kembali ke halaman pendaftaran.</p><p><b>Tindakan ini tidak boleh dibatalkan.</b></p>',
      butang: [{ label: 'Batal', nilai: false }, { label: 'Padam & Mula Semula', nilai: true, kelas: 'btn--danger' }]
    });
    if (!ya) { return; }
    S.clearPlayer();
    W.location.assign(INDEX_URL);
  }

  function simpan() {
    var p = S.loadPlayer();
    if (!p) { toast('Tiada profil untuk disimpan.', 'ralat'); return; }
    var h = S.savePlayer(p);
    if (!h.ok) { toast(h.ralat || 'Gagal menyimpan.', 'ralat'); return; }
    toast('Permainan disimpan pada ' + new Date().toLocaleTimeString('ms-MY') + '. (Kemajuan juga disimpan automatik.)', 'ok');
  }

  /* ---------- Acara ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-act],[data-tab]') : null;
    if (!t) { return; }
    var act = t.getAttribute('data-act');
    if (!act) { var tb = t.getAttribute('data-tab'); if (tb) { setTab(tb); } return; }
    var kod = t.getAttribute('data-kod'), lvl = t.getAttribute('data-lvl');
    if (act === 'tindakan') { tindakan(t.getAttribute('data-id')); }
    else if (act === 'ke-tab') { setTab(t.getAttribute('data-v')); }
    else if (act === 'ulang-peta') { muatPeta(true); }
    else if (act === 'daftar') { operasiPemilihan(function () { return E.daftarBertanding(kod); }); }
    else if (act === 'tarik') { operasiPemilihan(function () { return E.tarikBalik(kod); }); }
    else if (act === 'peluang') { state.anggaran[kod] = E.anggarkanPeluang(kod); render(); }
    else if (act === 'undi') {
      modal({ tajuk: 'Hari Mengundi', isi: '<p>Jalankan pengundian sekarang? Keputusan tidak boleh diubah, dan kemenangan atau kekalahan mempengaruhi jawatan anda.</p>',
        butang: [{ label: 'Belum', nilai: false }, { label: 'Undi Sekarang', nilai: true, kelas: 'btn--gold' }] })
        .then(function (ya) { if (ya) { operasiPemilihan(function () { return E.jalankanPemilihan(kod); }); } });
    }
    else if (act === 'kempen') {
      var r = E.jalankanKempen(t.getAttribute('data-id'), { kod: state.kodSimulasi || undefined });
      state.mesej.kempen = r.ok ? esc(r.mesej) : ''; render(); lapor(r);
    }
    else if (act === 'mula') { var m = M.mulaMesyuarat(lvl); if (!m.ok) { toast(m.ralat, 'ralat'); } else { toast('Mesyuarat dimulakan.', 'ok'); } render(); }
    else if (act === 'peranan') {
      var pr = M.pilihPeranan(lvl, t.getAttribute('data-u'), t.getAttribute('data-r'), t.getAttribute('data-p'));
      render(); lapor(pr);
    }
    else if (act === 'tutup') {
      modal({ tajuk: 'Tutup Mesyuarat?', isi: '<p>Usul yang belum anda sertai akan diputuskan tanpa kesan kepada anda' + (adalahTahunPemilihan(S.loadPlayer().tahun) ? ', dan pemilihan perwakilan peringkat ini akan diundi' : '') + '.</p>',
        butang: [{ label: 'Batal', nilai: false }, { label: 'Tutup Mesyuarat', nilai: true, kelas: 'btn--gold' }] })
        .then(function (ya) { if (!ya) { return; } var r2 = M.tutupMesyuarat(lvl); render(); lapor(r2); });
    }
  });

  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.getAttribute && t.getAttribute('data-act') === 'pilih-kod') { state.kodSimulasi = t.value; render(); }
  });

  $('tab-peta').parentNode.addEventListener('keydown', function (ev) {                    // navigasi papan kekunci tab
    var t = ev.target; if (!t.getAttribute || t.getAttribute('role') !== 'tab') { return; }
    var i = TABS.indexOf(t.getAttribute('data-tab')), n = -1;
    if (ev.key === 'ArrowRight') { n = (i + 1) % TABS.length; } else if (ev.key === 'ArrowLeft') { n = (i + TABS.length - 1) % TABS.length; }
    else if (ev.key === 'Home') { n = 0; } else if (ev.key === 'End') { n = TABS.length - 1; }
    if (n >= 0) { ev.preventDefault(); setTab(TABS[n], true); }
  });

  $('btn-tahun').addEventListener('click', lanjutTahun);
  $('btn-reset').addEventListener('click', reset);
  $('btn-simpan').addEventListener('click', simpan);

  /* ---------- Mula ---------- */
  function mula() {
    var p = S && S.loadPlayer();
    if (!p) { W.location.replace(INDEX_URL); return; }
    $('kandungan').hidden = false;
    var h = (W.location.hash || '').replace('#', '');
    if (TABS.indexOf(h) >= 0) { state.tab = h; }
    render();
    if (state.tab === 'peta') { muatPeta(); }
    S.subscribe(jadualRender);                                      // kemas kini masa nyata (juga antara tab pelayar)
  }
  mula();
})();