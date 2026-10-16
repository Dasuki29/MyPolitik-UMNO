/* ==========================================================================
   Nusa Politik — js/app.js
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
    $('i-nama').textContent = c.nama + (c.dunNama ? ', ' + c.dunNama : '');
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

  /* v7.14: Sheet berbilang tab. Setiap tab = satu negeri, dimuat apabila dipilih. */
  state.tab = null; state.cacheTab = {};
  async function pilihNegeriTab() {
    var nama = el.negeri.value;
    state.negeri = null; state.bahagian = state.dun = state.cawangan = null;
    setError('negeri'); sembunyiInfo();
    reset(el.dun, 'Pilih bahagian dahulu'); reset(el.cawangan, 'Pilih DUN dahulu');
    if (!nama) { reset(el.bahagian, 'Pilih negeri dahulu'); return; }
    reset(el.bahagian, 'Memuatkan data ' + nama + '...');
    el.submit.disabled = true; setStatus('loading', 'Memuatkan data ' + nama + '...');
    var h = state.cacheTab[nama];
    if (!h) {
      try { h = await D.loadPartyData({ appsScriptUrl: CFG.appsScriptUrl, tab: nama }); state.cacheTab[nama] = h; }
      catch (e) {
        if (el.negeri.value !== nama) { return; }
        reset(el.bahagian, 'Data gagal dimuatkan'); setStatus('fallback', (e && e.message ? e.message : e) + ' Tekan Cuba Semula.'); el.retry.hidden = false; return;
      }
    }
    if (el.negeri.value !== nama) { return; }                    // pemain sudah menukar negeri semasa memuat
    state.data = h; state.negeri = { id: nama, nama: nama, bahagian: h.bahagian };
    setStatus(h.source === 'cache' ? 'cache' : 'sheet', (h.source === 'cache' ? 'Salinan tersimpan: ' : 'Data langsung: ') + nama + ' (' + ringkasan(h) + ').');
    el.submit.disabled = false;
    isi(el.bahagian, 'Pilih bahagian (parlimen)', state.negeri.bahagian, function (p) { return p.nama + ' (P.' + p.kod + ')'; });
  }

  el.negeri.addEventListener('change', function () {
    if (state.tab) { pilihNegeriTab(); return; }
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
    if (state.bahagian && state.bahagian.tiadaDUN) {            // v7.14: Wilayah Persekutuan: tiada DUN, terus pilih cawangan
      state.dun = state.bahagian.dun[0];
      reset(el.dun, 'Tiada DUN (Wilayah Persekutuan)');
      isi(el.cawangan, 'Pilih cawangan (lokaliti)', state.dun.cawangan, function (c) { return c.nama + ' (' + c.kod + ')'; });
    } else if (state.bahagian) {
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

  /* ---------- Pilihan avatar ---------- */
  var AV = window.MyPolitikAvatar;
  var avatarState = { kod: 'pemuda', manual: false };

  function avatarTerpilih() {
    var r = el.form.querySelector('input[name="avatar"]:checked');
    return r ? r.value : avatarState.kod;
  }

  function kemaskiniPratonton() {
    var box = $('preview-avatar');
    if (!box || !AV) { return; }
    var kod = avatarTerpilih(), info = AV.LIST.filter(function (a) { return a.kod === kod; })[0];
    box.innerHTML = AV.svg(kod, { saiz: 64 }) + '<div><b></b><span></span></div>';
    box.querySelector('b').textContent = el.nama.value.trim() || 'Nama anda';
    box.querySelector('span').textContent = 'Watak ' + (info ? info.label : '');
  }

  function pilihAvatar(kod, manual) {
    avatarState.kod = kod; if (manual) { avatarState.manual = true; }
    var r = el.form.querySelector('input[name="avatar"][value="' + kod + '"]');
    if (r) { r.checked = true; }
    Array.prototype.forEach.call(document.querySelectorAll('#avatar-grid .av'), function (l) {
      l.classList.toggle('is-saran', !avatarState.manual && l.getAttribute('data-kod') === kod);
    });
    setError('avatar'); kemaskiniPratonton();
  }

  function cadangkanAvatar() {
    if (avatarState.manual || !AV || !D) { return; }
    var j = el.form.querySelector('input[name="jantina"]:checked'), u = parseInt(el.umur.value, 10);
    if (!j || !isFinite(u) || u < 18 || u > 100) { return; }
    var dem = D.tentukanDemografi(j.value, u);
    if (dem) { pilihAvatar(AV.cadangan(dem), false); }
  }

  function binaPemilihAvatar() {
    var grid = $('avatar-grid');
    if (!grid || !AV) { if (grid && grid.parentNode) { grid.parentNode.hidden = true; } return; }
    grid.innerHTML = AV.LIST.map(function (a) {
      return '<label class="av" data-kod="' + a.kod + '"><input type="radio" name="avatar" value="' + a.kod + '"' + (a.kod === avatarState.kod ? ' checked' : '') + '>' +
        '<span class="av__box">' + AV.svg(a.kod, { saiz: 72 }) + '<span class="av__nama">' + a.label + '</span><span class="av__desc">' + a.penerangan + '</span><span class="av__saran">Dicadangkan</span></span></label>';
    }).join('');
    grid.addEventListener('click', function (ev) { if (ev.target && ev.target.name === 'avatar') { pilihAvatar(ev.target.value, true); } });   // 'click' (bukan 'change') supaya klik pada kad yang sudah dicadangkan pun mengunci pilihan
    Array.prototype.forEach.call(el.form.querySelectorAll('input[name="jantina"]'), function (r) { r.addEventListener('change', cadangkanAvatar); });
    el.umur.addEventListener('input', cadangkanAvatar);
    el.nama.addEventListener('input', kemaskiniPratonton);
    kemaskiniPratonton();
  }
  binaPemilihAvatar();

  /* ---------- Pilihan sayap / laluan kerjaya (v5.9) ---------- */
  var SYP = window.MyPolitikSayap;
  var sayapState = { kod: 'utama', manual: false };

  function sayapTerpilih() {
    var r = el.form.querySelector('input[name="sayap"]:checked');
    return r ? r.value : sayapState.kod;
  }

  function pilihSayap(kod, manual) {
    sayapState.kod = kod; if (manual) { sayapState.manual = true; }
    var r = el.form.querySelector('input[name="sayap"][value="' + kod + '"]');
    if (r) { r.checked = true; }
    Array.prototype.forEach.call(document.querySelectorAll('#sayap-grid .sy'), function (l) {
      l.classList.toggle('is-saran', !sayapState.manual && l.getAttribute('data-kod') === kod);
    });
    setError('sayap');
  }

  /** Kemas kini kelayakan setiap laluan mengikut jantina dan umur; cadangkan laluan lalai. */
  function kemaskiniSayap() {
    if (!SYP || !$('sayap-grid')) { return; }
    var j = el.form.querySelector('input[name="jantina"]:checked'), u = parseInt(el.umur.value, 10);
    var ok = !!j && isFinite(u) && u >= 18 && u <= 100, kel = ok ? SYP.kelayakan(j.value, u) : SYP.kelayakan('', 0);
    Array.prototype.forEach.call(document.querySelectorAll('#sayap-grid .sy'), function (l) {
      var k = l.getAttribute('data-kod'), inp = l.querySelector('input'), sy = l.querySelector('.sy__syarat');
      inp.disabled = !kel[k].boleh; sy.textContent = kel[k].boleh ? '' : kel[k].sebab;
    });
    if (!(kel[sayapState.kod] && kel[sayapState.kod].boleh)) { sayapState.manual = false; }       // pilihan manual tidak lagi sah selepas jantina/umur diubah
    if (!sayapState.manual) { pilihSayap(ok ? SYP.cadangan(j.value, u) : 'utama', false); }
  }

  function escS(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function binaPemilihSayap() {
    var grid = $('sayap-grid');
    if (!grid || !SYP) { if (grid && grid.parentNode) { grid.parentNode.hidden = true; } return; }
    grid.innerHTML = SYP.SENARAI.map(function (k) {
      var i = SYP.INFO[k];
      return '<label class="sy" data-kod="' + k + '"><input type="radio" name="sayap" value="' + k + '"' + (k === sayapState.kod ? ' checked' : '') + '>' +
        '<span class="sy__box"><span class="sy__ikon" aria-hidden="true">' + i.ikon + '</span><span class="sy__nama">' + escS(i.nama) + '</span><span class="sy__desc">' + escS(i.ringkas) + '</span>' +
        '<ul class="sy__buff">' + i.kelebihan.map(function (b) { return '<li>' + escS(b) + '</li>'; }).join('') + '</ul>' +
        '<span class="sy__syarat"></span><span class="sy__saran">Dicadangkan</span></span></label>';
    }).join('');
    grid.addEventListener('click', function (ev) { if (ev.target && ev.target.name === 'sayap' && !ev.target.disabled) { pilihSayap(ev.target.value, true); } });
    Array.prototype.forEach.call(el.form.querySelectorAll('input[name="jantina"]'), function (r) { r.addEventListener('change', kemaskiniSayap); });
    el.umur.addEventListener('input', kemaskiniSayap);
    kemaskiniSayap();
  }
  binaPemilihSayap();
  try { var um0 = window.sessionStorage.getItem('myPolitik_umurMula'); if (um0 && el.umur) { el.umur.value = um0; window.sessionStorage.removeItem('myPolitik_umurMula'); cadangkanAvatar(); kemaskiniSayap(); } } catch (e) { /* abaikan */ }   // v5.2: Main Semula bermula umur 18

  /* ---------- Muat data ---------- */
  function ringkasan(h) {
    return fmt(h.jumlah.bahagian) + ' bahagian, ' + fmt(h.jumlah.cawangan) + ' cawangan';
  }

  async function muatData() {
    kosongkanSemua('Memuatkan data...');
    el.submit.disabled = true;
    setStatus('loading', 'Memuatkan data daripada Google Sheets...');
    var url = CFG.sheetCsvUrl || D.CONFIG.SHEET_CSV_URL;
    var h, sen = null;
    try { sen = D.loadSenaraiTab ? await D.loadSenaraiTab({ appsScriptUrl: CFG.appsScriptUrl }) : null; } catch (e) { sen = null; }
    if (sen && sen.tab.length) {                                  // v7.14: Sheet berbilang tab (satu tab = satu negeri)
      state.tab = sen.tab; state.cacheTab = {}; state.data = { negeri: [], bahagian: [] };
      kosongkanSemua();
      isi(el.negeri, 'Pilih negeri', sen.tab.map(function (n) { return { id: n, nama: D.namaNegeriTab(n) }; }), function (n) { return n.nama; });
      setStatus(sen.sumber === 'cache' ? 'cache' : 'sheet', (sen.sumber === 'cache' ? 'Senarai negeri daripada salinan tersimpan' : 'Data langsung daripada Google Sheets') + ' (' + sen.tab.length + ' negeri). Data negeri dimuat apabila dipilih.');
      el.submit.disabled = false;
      return;
    }
    state.tab = null;
    try {
      h = await D.loadPartyData({ url: url, appsScriptUrl: CFG.appsScriptUrl });
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
      setStatus('fallback', 'Tidak dapat menyambung ke Google Sheets, jadi data contoh digunakan (' + ringkasan(h) + '). Sebab: ' + (h.amaran.join(' ') || 'tidak diketahui') + ' Tekan "Cuba lagi" selepas membetulkan.');
    }
    isiNegeri();
    el.submit.disabled = false;
  }

  el.retry.addEventListener('click', function () { if (state.tab && el.negeri.value) { pilihNegeriTab(); } else { muatData(); } });

  /* ---------- Padam ralat sebaik pengguna membetulkan medan ---------- */
  el.nama.addEventListener('input', function () { if (el.nama.value.trim().length >= 3) { setError('nama'); } });
  el.umur.addEventListener('input', function () {
    var u = parseInt(el.umur.value, 10);
    if (isFinite(u) && u >= 18 && u <= 60) { setError('umur'); }
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
    if (!isFinite(umur) || umur < 18 || umur > 60) { setError('umur', 'Umur permulaan mesti antara 18 dan 60 tahun.'); salah.push(el.umur); }
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

    var ahliEl = document.getElementById('s-ahli');
    var profil = S.buildPlayerProfile({ nama: v.nama, demografik: demografik, cawangan: state.cawangan, avatar: avatarTerpilih(), sayap: sayapTerpilih(), tahunAhli: ahliEl ? ahliEl.value : 0 });
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
    var Sl = window.MyPolitikSlot;                                   // v5.4: guna slot kosong supaya watak sedia ada tidak terpadam
    if (Sl) {
      var k = Sl.slotKosong();
      if (k && k !== Sl.aktif() && Sl.aktifkan(k).ok) { window.location.reload(); return; }
      if (!k && !window.confirm('Semua slot penuh. Padam watak di slot ' + Sl.aktif() + ' dan daftar watak baharu?')) { return; }
    }
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
      I = W.MyPolitikIncumbent, J = W.MyPolitikJawatan, E = W.MyPolitikElection, M = W.MyPolitikMeeting, MAP = W.MyPolitikMap, ET = W.MyPolitikEtika, WK = W.MyPolitikWatak, HY = W.MyPolitikHayat, ST = W.MyPolitikStres, K = W.MyPolitikCalendar, EV = W.MyPolitikEvents, TUT = W.MyPolitikTutorial, LAT = W.MyPolitikLatihan;
  var SYP = W.MyPolitikSayap, BLK = W.MyPolitikBlok, MIS = W.MyPolitikMisi;
  function PUIh(p, jenis) { var u = W.NusaPRU_UI; return u && u.kad ? u.kad(p, jenis) : ''; }
  function musimPR(p) { var u = W.NusaPRU_UI; return !!(u && u.musim && u.musim(p)); }                    // v7.10: tab khas Pilihan Raya                      // v7.3: kad PRU/PRN & Kabinet (js/pru-ui.js)                          // v6.5/v6.6 (Dashboard)
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

  var TABS = ['peta', 'tindakan', 'pemilihan', 'mesyuarat', 'pilihanraya'];
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
      kaki.innerHTML = ''; kaki.hidden = !!(o.butang && !o.butang.length);
      Array.prototype.forEach.call($('modal-isi').querySelectorAll('[data-pilih]'), function (el) { el.addEventListener('click', function () { tutup(el.getAttribute('data-pilih')); }); });
      (o.butang || [{ label: 'Tutup', nilai: true, kelas: 'btn--gold' }]).forEach(function (b) {
        var bt = document.createElement('button');
        bt.type = 'button'; bt.className = 'btn ' + (b.kelas || 'btn--ghost'); bt.textContent = b.label; bt.disabled = !!b.nonaktif;
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
      var fb = kaki.querySelector('button:last-child') || $('modal-isi').querySelector('[data-pilih]:not([disabled])'); if (fb) { fb.focus(); }
    });
  }

  /** Paparkan peristiwa penting (jawatan, cabaran) sebagai modal, selebihnya toast. */
  async function urusPeristiwa(senarai) {
    var penting = { pru_isytihar: 'Pilihan Raya Diisytiharkan', prk_isytihar: 'Pilihan Raya Kecil (PRK)', kabinet_rombak: 'Rombakan Kabinet', janji_nilai: 'Penilaian Manifesto', disiplin: 'Tataetika & Disiplin', hukuman: 'Keputusan Lembaga Disiplin', jawatan_baharu: 'Jawatan Baharu', jawatan_hilang: 'Kehilangan Jawatan', cabaran_jawatan: 'Jawatan Anda Dicabar',
                    kelayakan_dibuka: 'Kelayakan Dibuka', perwakilan_terpilih: 'Terpilih Sebagai Perwakilan',
                    pemilihan_dibuka: 'Tahun Pemilihan', tahun_pentadbiran: 'Tahun Pentadbiran',
                    kategori_bertukar: 'Kategori Keahlian Bertukar', fasa_bulan: 'Takwim Bulan Baharu', mesyuarat_ditutup_auto: 'Mesyuarat Ditutup Automatik', mesyuarat_terlepas: 'Mesyuarat Terlepas', pemilihan_auto: 'Pengundian Dijalankan', blok_janji_tunai: 'Janji Kuota Ditunaikan', transisi_rasmi: 'Upacara Graduasi Sayap', transisi_amaran: 'Notis Rasmi Transisi', undi_tp_amaran: 'Amaran Undi Tidak Percaya', undi_tp_kalah: 'Kalah Undi Tidak Percaya', undi_tp_menang: 'Selamat Undi Tidak Percaya', blok_janji_mungkir: 'Janji Kuota Dimungkiri', penggal_tamat: 'Penggal Jawatan Tamat' };
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
    if (W.MyPolitikAvatar) { W.MyPolitikAvatar.pasang($('p-avatar'), p.avatar || (p.demografik && p.demografik.kategoriKod), { saiz: 84 }); }
    else { $('p-avatar').textContent = inisial(p.nama); }
    var lp = $('p-perwakilan'), sp = M ? M.getStatusPerwakilan(p) : null;
    if (lp) { var lb = sp && (sp.pau.lencana || sp.bahagian.lencana); lp.hidden = !lb; lp.textContent = lb || ''; }
    var l = $('p-jawatan'); l.textContent = p.jawatan; l.className = 'badge-office badge-office--' + kelasLencana(p.jawatan);
    var rg = ET ? ET.ringkasan(p) : null, gantung = !!(rg && rg.status === 'digantung');
    if (gantung) { l.textContent = 'Ahli (Digantung)'; l.className = 'badge-office badge-office--gantung'; if (lp) { lp.hidden = true; } }     // v4.6
    var kg = $('p-gantung');
    if (kg) {
      kg.hidden = !gantung;
      kg.innerHTML = gantung ? '<strong>⛔ Keahlian anda DIGANTUNG</strong>Sehingga bulan ' + esc(rg.hukuman ? rg.hukuman.tamatBulan + '/' + rg.hukuman.tamatTahun : '') +
        ' (Fasal 20.10b). Semua jawatan anda telah dilucutkan' + (rg.hukuman && rg.hukuman.jawatanDilucut ? ' (' + esc(rg.hukuman.jawatanDilucut) + ')' : '') +
        '. Anda tidak boleh mencalon, mengundi atau bertanding dalam pemilihan parti, dan tidak boleh menggunakan AP untuk tugas rasmi jawatan.' : '';
    }
    var jl = $('p-jawatan-lain');
    if (jl) {
      var semua = J ? J.ringkas(p) : [];
      jl.innerHTML = semua.length > 1 ? semua.slice(1).map(function (j) {
        return '<span class="badge-office badge-office--' + kelasLencana(j.jawatan) + '" title="' + esc(j.label) + '">' + esc(j.jawatan) + '</span>'; }).join(' ') : '';
      var lcn = W.NusaPRU_UI && W.NusaPRU_UI.lencana ? W.NusaPRU_UI.lencana(p) : '';                          // v7.3: lencana ADUN / MP / EXCO / Menteri
      jl.innerHTML += lcn;
      jl.hidden = semua.length <= 1 && !lcn;
    }
    var sb = $('p-sayap'), SYd = W.MyPolitikSayap;                                       // v5.9: lencana laluan sayap
    if (sb && SYd) {
      var si = SYd.info(p);
      sb.className = 'badge-sayap badge-sayap--' + si.kod;
      sb.textContent = si.ikon + ' Laluan ' + si.nama;
      sb.title = si.ringkas + '. Kelebihan: ' + si.kelebihan.join('; ');
      sb.setAttribute('aria-label', 'Laluan kerjaya ' + si.nama + '. Kelebihan: ' + si.kelebihan.join(', '));
      sb.hidden = false;
    }
    var um = $('p-umur');                                                                // v5.0: umur sentiasa dipaparkan
    if (um) {
      var hr = HY ? HY.ringkasan(p) : null;
      um.textContent = hr && hr.umur !== null ? hr.umur + ' tahun' + (hr.nampakRisiko ? ' · risiko kesihatan ' + hr.label.toLowerCase() : '') : '–';
      um.title = hr && hr.nampakRisiko ? 'Risiko tamat kerjaya (kesihatan) tahun depan: ' + hr.peratus + '%' : '';
      um.parentNode.classList.toggle('is-risiko', !!(hr && hr.label === 'Tinggi'));
    }
    $('p-negeri').textContent = p.negeri || '–'; $('p-bahagian').textContent = p.bahagian || '–';
    $('p-dun').textContent = p.dun || '–'; if ($('p-dun-li')) { $('p-dun-li').hidden = !p.dun; } $('p-cawangan').textContent = p.cawangan || '–';
    var pem = adalahTahunPemilihan(p.tahun);
    var tk = K ? K.getTakwim(p) : null;
    var tp = $('p-tahun'); tp.textContent = labelTahun(p.tahun) + (tk ? ' · BULAN ' + tk.bulan : ''); tp.setAttribute('data-fasa', pem ? 'pemilihan' : 'pentadbiran');
    $('r-ip').textContent = fmt(p.ip); $('r-myr').textContent = 'RM ' + fmt(p.myr); $('r-ap').textContent = fmt(p.ap);
    var stm = ST ? ST.ringkasan(p) : null, mb = $('meter-bar');                               // v5.6: meter Stress dan Kesihatan
    if (mb) {
      mb.hidden = !stm;
      if (stm) {
        var kelas = function (l) { return l === 'Kritikal' ? 'is-kritikal' : l === 'Tinggi' || l === 'Lemah' ? 'is-tinggi' : l === 'Sederhana' ? 'is-sederhana' : ''; };
        $('m-stress').style.width = stm.stress + '%'; $('m-stress').className = kelas(stm.labelStress);
        $('m-stress-teks').textContent = stm.stress + ' · ' + stm.labelStress;
        $('m-stress-info').textContent = 'Beban ' + (stm.bilJawatan > 1 ? stm.bilJawatan + ' jawatan ' : 'jawatan ') + '+' + stm.beban + ', pulih -' + (stm.pulih || ST.CONFIG.PEMULIHAN) + ' sebulan' + (stm.pecahan && stm.pecahan.length > 1 ? ' (' + stm.pecahan.map(function (x) { return '+' + x.beban; }).join(' ') + ')' : '');
        var kl = stm.labelKesihatan === 'Kritikal' ? 'is-kritikal' : stm.labelKesihatan === 'Lemah' ? 'is-tinggi' : stm.labelKesihatan === 'Sederhana' ? 'is-sederhana' : '';
        $('m-kes').style.width = stm.kesihatan + '%'; $('m-kes').className = kl;
        $('m-kes-teks').textContent = stm.kesihatan + '% · ' + stm.labelKesihatan;
        $('m-kes-info').textContent = (stm.kadarKesihatan > 0 ? 'Pulih +' : stm.kadarKesihatan < 0 ? 'Merosot ' : 'Stabil ') + (stm.kadarKesihatan ? stm.kadarKesihatan : '') + (stm.kadarKesihatan ? ' sebulan' : '') + (stm.risikoTambahan > 0 ? ' · risiko tamat +' + Math.round(stm.risikoTambahan * 1000) / 10 + '%/tahun' : '');
      }
    }
    $('r-tahun').textContent = labelTahun(p.tahun);
    var seterusnya = E ? E.tahunPemilihanSeterusnya(p.tahun) : p.tahun;
    $('r-tahun-sub').textContent = (tk ? 'Bulan ' + tk.bulan + ' (' + tk.namaBulan + ') · ' : '') + (pem ? 'Pertandingan & kempen dibuka' : 'Perwakilan tahunan dibuka · jawatan ' + seterusnya);
    renderTakwim(p, tk);
    document.title = p.nama + ' | Nusa Politik';
  }

  /* ---------- Takwim bulanan ---------- */
  function renderTakwim(p, tk) {
    var btn = $('btn-tahun');
    if (!K || !tk) { $('tk-strip').innerHTML = ''; $('t-info').textContent = 'Modul takwim (js/calendar.js) tidak dimuatkan.'; btn.disabled = true; return; }
    $('tk-judul').textContent = 'Bulan ' + tk.bulan + ' (' + tk.namaBulan + ') ' + tk.tahun;
    $('tk-fasa').textContent = tk.fasa.tajuk + ': ' + tk.fasa.ringkas;
    $('tk-strip').innerHTML = tk.jadual.map(function (j) {
      var kelas = j.fasa;
      return '<li class="f-' + kelas + (j.semasa ? ' is-semasa' : '') + (j.lepas ? ' is-lepas' : '') + '"' + (j.semasa ? ' aria-current="date"' : '') +
        ' title="' + esc(j.nama + (j.acara.length ? ': ' + j.acara.join(', ') : '')) + '"><b>' + j.bulan + '</b>' + esc(j.pendek) + '</li>';
    }).join('');
    $('t-info').textContent = 'Setiap bulan baharu: AP bertambah ' + K.CONFIG.AP_BULANAN + ' (baki dibawa, had ' + K.CONFIG.AP_MAKS + ') dan elaun bulanan ditambah ke dana.' +
      (tk.bonusAkarUmbi ? ' Bonus +' + Math.round(tk.bonusAkarUmbi * 100) + '% IP dan sokongan bagi tindakan sehingga bulan 3.' : '');
    btn.disabled = false;
    btn.innerHTML = tk.tahunBaharuSeterusnya
      ? 'Teruskan ke Bulan 1, ' + tk.tahunSeterusnya + ' &rarr;'
      : 'Teruskan ke Bulan ' + tk.bulanSeterusnya + ' (' + K.namaBulan(tk.bulanSeterusnya) + ') &rarr;';
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
      h += bar('Sokongan ' + S.KESETIAAN_LABEL[k], v, k === 'akarUmbi' && v < 40);
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

  /* ---------- v6.5: Tindakan khas sayap, notis transisi dan Legacy Loyalty ---------- */
  function bannerTransisi(p) {
    var n = SYP && SYP.notisTransisi ? SYP.notisTransisi(p) : null;
    return n ? '<div class="banner banner--warn" role="alert"><strong>' + esc(n.tajuk) + ' (umur ' + n.umur + '/' + n.had + ')</strong>' + esc(n.mesej) + '</div>' : '';
  }
  /* ---------- v6.7: Misi bulanan sayap dan amaran Undi Tidak Percaya ---------- */
  function bannerUndiTP(p) {
    var a = MIS && MIS.amaranUndi ? MIS.amaranUndi(p) : null;
    return a ? '<div class="banner banner--warn" role="alert"><strong>' + (a.tahap === 'kritikal' ? 'Undi Tidak Percaya Menghampiri' : 'Amaran Sokongan Sayap') + '</strong>' + esc(a.mesej) + '</div>' : '';
  }
  function kadMisi(p) {
    var m = MIS && MIS.getMisi ? MIS.getMisi(p) : null;
    if (!m) { return ''; }
    var h = '<section class="card"><h2 class="card__title" style="margin:0 0 4px">Misi Bulanan Sayap ' + esc(SYP.INFO[m.sayap].nama) + '</h2>' +
      '<p class="note">Satu misi baharu setiap bulan. Rentetan <b>' + m.rentetan + '/' + m.sasaranRentetan + '</b> bulan berturut-turut memberi bonus. Bulan terlepas hanya memutuskan rentetan.</p><div class="choice-list">' +
      '<button type="button" class="choice" data-act="misi-sayap" data-id="' + esc(m.id) + '" data-fk="ms:' + esc(m.id) + '"' + (m.boleh ? '' : ' disabled') + '>' +
      '<span class="choice__title">' + esc(m.ikon) + ' ' + esc(m.nama) + (m.selesai ? ' (selesai bulan ini)' : '') + '</span><span class="choice__desc">' + esc(m.penerangan) + '</span>' +
      '<span class="choice__fx">' + fx(m.ringkas) + '</span>' + (m.boleh ? '' : '<span class="choice__desc" style="color:var(--danger)">' + esc(m.sebab) + '</span>') + '</button></div>' +
      (state.mesej.misi ? '<p class="result" style="margin-top:12px">' + esc(state.mesej.misi) + '</p>' : '') + '</section>';
    return h;
  }
  async function misiSayap(id) {
    var r = MIS.jalankanMisi(id);
    state.mesej.misi = r.ok ? r.mesej : '';
    render(); await lapor(r);
    if (r.ok && EV) { await tunjukAcara(EV.selepasAktiviti()); }
  }

  function kadSayap(p) {
    var h = bannerTransisi(p), lw = SYP && SYP.ringkasWarisan ? SYP.ringkasWarisan(p) : null;
    if (lw) {
      h += '<div class="banner banner--gold"><strong>Legacy Loyalty aktif: +' + lw.bonus + ' kekuatan undi</strong>Dibawa dari sayap ' + esc(SYP.INFO[lw.dari].nama) + ' (asal +' + lw.awal + ', susut beransur sehingga tahun ' + lw.tamatTahun + '). Dikira dalam pertandingan Induk: jawatan utama dan perwakilan.</div>';
    }
    var ts = SYP && SYP.senaraiTindakanSayap ? SYP.senaraiTindakanSayap(p) : [];
    if (!ts.length) { return h; }
    h += '<section class="card"><h2 class="card__title" style="margin:0 0 4px">Tindakan Khas Sayap ' + esc(SYP.INFO[SYP.kod(p)].nama) + '</h2>' +
      '<p class="note">Kebolehan istimewa sayap anda. Boleh digunakan <b>sekali sebulan</b>.</p><div class="choice-list">';
    ts.forEach(function (t) {
      h += '<button type="button" class="choice" data-act="tindakan-sayap" data-id="' + esc(t.id) + '" data-fk="ts:' + esc(t.id) + '"' + (t.boleh ? '' : ' disabled') + '>' +
        '<span class="choice__title">' + esc(t.ikon) + ' ' + esc(t.nama) + '</span><span class="choice__desc">' + esc(t.penerangan) + '</span>' +
        '<span class="choice__fx">' + fx(t.ringkas) + '</span>' + (t.boleh ? '' : '<span class="choice__desc" style="color:var(--danger)">' + esc(t.sebab) + '</span>') + '</button>';
    });
    return h + '</div>' + (state.mesej.sayap ? '<p class="result" style="margin-top:12px">' + esc(state.mesej.sayap) + '</p>' : '') + '</section>';
  }
  async function tindakanSayap(id) {
    var r = SYP.jalankanTindakanSayap(id);
    state.mesej.sayap = r.ok ? r.mesej : '';
    render(); await lapor(r);
    if (r.ok && EV) { await tunjukAcara(EV.selepasAktiviti()); }
  }

  /* ---------- v6.6: Pengaruh Blok Sayap & tawar-menawar Ketua Bahagian ---------- */
  function kadBlok(p) {
    var r = BLK && BLK.ringkasan ? BLK.ringkasan(p) : null;
    if (!r) { return ''; }
    var m = r.meter;
    var h = '<section class="card blok"><h2 class="card__title" style="margin:0 0 4px">Blok Undi Sayap ' + esc(m.nama) + ' Bahagian</h2>' +
      '<p class="note">Sebagai Ketua Sayap Bahagian, anda mengawal satu blok undi dalam pemilihan Ketua Bahagian. Calon merisik sokongan anda dan boleh dirunding: sokongan ditukar dengan janji kuota tempat bertanding untuk ahli sayap pada pilihan raya akan datang.</p>' +
      '<div class="kv"><span>Meter Pengaruh Blok</span><b>' + m.nilai + '/100 · ' + esc(m.label) + '</b></div>' +
      '<div class="meter__track" role="progressbar" aria-valuenow="' + m.nilai + '" aria-valuemin="0" aria-valuemax="100"><i class="' + (m.nilai >= 55 ? '' : m.nilai >= 35 ? 'is-sederhana' : 'is-kritikal') + '" style="width:' + m.nilai + '%"></i></div>' +
      '<div class="kv"><span>Saiz blok (anggaran)</span><b>' + fmt(m.blokUndi) + ' undi · ' + m.peratusPemilih + '% pemilih Bahagian</b></div>' +
      '<details class="note" style="margin-top:6px"><summary>Apa yang membina blok?</summary><ul style="margin:6px 0 0;padding-left:18px">' +
      '<li>IP: ' + m.komponen.ip + ' · Sokongan: ' + m.komponen.kesetiaan + ' · Reputasi: ' + m.komponen.reputasi + ' · Ahli sayap: ' + m.komponen.ahli + '</li>' +
      '<li>Wakil G10: +' + m.komponen.g10 + ' · Rekod janji: ' + (m.komponen.laras >= 0 ? '+' : '') + m.komponen.laras + '</li></ul></details>';
    if (r.keputusan) {
      h += '<div class="banner ' + (r.keputusan.disokongMenang ? 'banner--gold' : '') + '" style="margin-top:10px"><strong>Keputusan Ketua Bahagian ' + r.keputusan.tahun + '</strong>' + esc(r.keputusan.mesej || '') + '</div>';
    } else if (r.tutup) {
      h += '<p class="note" style="margin-top:10px">' + esc(r.tutup) + '</p>';
    } else {
      if (r.sokongan) {
        var sk = r.sokongan;
        h += '<div class="banner banner--gold" style="margin-top:10px"><strong>Sokongan diikat: ' + esc(sk.nama) + '</strong>' +
          (sk.mata ? 'Janji kuota ' + (sk.parlimen ? sk.parlimen + ' Parlimen' : '') + (sk.parlimen && sk.dun ? ' + ' : '') + (sk.dun ? sk.dun + ' DUN' : '') + ' (kemungkinan ditunaikan ' + sk.kemungkinan + '%). ' : 'Tanpa syarat. ') +
          'Undi dikira apabila Mesyuarat Bahagian ditutup.</div>';
      } else {
        h += '<p class="note" style="margin-top:10px">Calon datang merisik anda. Setiap pusingan rundingan memakan ' + r.apKos + ' AP. Tuntutan terlalu tinggi akan ditolak. Jika anda tidak berikat dengan sesiapa, blok undi mengikut kehendak sendiri.</p>';
      }
      r.calon.forEach(function (c) {
        h += '<div class="item" style="margin-top:8px"><div class="item__head"><strong>' + esc(c.nama) + '</strong><span class="status-chip' + (c.disokong ? ' is-done' : '') + '">' +
          (c.disokong ? 'Disokong' : c.ditolak ? 'Menolak' : 'Merisik') + '</span></div>' +
          '<p class="item__desc">' + esc(c.gaya) + ' · kekuatan ' + c.kekuatan + '. ' + (c.maksMata >= 4 ? 'Terdesak, sanggup menjanjikan banyak kuota.' : c.maksMata === 3 ? 'Sederhana, boleh berunding.' : 'Yakin dengan sokongan sendiri, kuota dihadkan.') + '</p>';
        if (!r.sokongan && !c.ditolak) {
          h += '<div class="choice-list" style="margin-top:6px">';
          r.menu.forEach(function (t) {
            h += '<button type="button" class="btn btn--sm' + (t.mata ? '' : ' btn--primary') + '" data-act="blok-runding" data-calon="' + esc(c.id) + '" data-tuntut="' + esc(t.id) + '" data-fk="b:' + esc(c.id) + t.id + '">' + esc(t.label) + '</button> ';
          });
          h += '</div>';
        }
        h += '</div>';
      });
    }
    if (r.janji.length) {
      h += '<details class="note" style="margin-top:10px" open><summary>Janji kuota (' + r.kerusiDiperoleh + ' mata diperoleh setakat ini)</summary><ul style="margin:6px 0 0;padding-left:18px">' +
        r.janji.map(function (j) { return '<li>' + esc(j.tahun + ': ' + j.nama + ', ' + (j.parlimen ? j.parlimen + ' Parlimen' : '') + (j.parlimen && j.dun ? ' + ' : '') + (j.dun ? j.dun + ' DUN' : '') + ' — ' + (j.status === 'menunggu' ? 'menunggu Penetapan Calon' : j.status === 'ditepati' ? 'ditunaikan' : 'dimungkiri')); }).join('</li>') + '</li></ul></details>';
    }
    return h + (state.mesej.blok ? '<p class="result" style="margin-top:12px">' + esc(state.mesej.blok) + '</p>' : '') + '</section>';
  }
  async function rundingBlok(calon, tuntut) {
    var r = BLK.runding(calon, tuntut);
    state.mesej.blok = r.ok ? r.mesej : '';
    render(); await lapor(r);
  }

  function panelTindakan(p) {
    var peg = pemegang(p), mod = peg ? I : O;
    if (!mod) { return '<div class="card"><p class="empty">Modul tindakan tidak dimuatkan.</p></div>'; }
    var senarai = mod.senaraiTindakan(p), h = '';
    var tkb = K ? K.getTakwim(p) : null;
    h += PUIh(p, 'tindakan') + bannerDisiplin(p) + bannerUndiTP(p) + kadMisi(p) + kadSayap(p);
    if (tkb && tkb.bonusAkarUmbi) {
      h += '<div class="banner banner--gold"><strong>Musim Akar Umbi (bulan 1-3)</strong>Setiap tindakan memberi bonus +' + Math.round(tkb.bonusAkarUmbi * 100) + '% IP dan kesetiaan. Manfaatkan sebelum musim mesyuarat bermula pada bulan 4.</div>';
    }

    if (peg) {
      var c = I.getCabaranAktif();
      if (c) {
        h += '<div class="banner banner--warn" role="alert"><strong>Jawatan anda dicabar</strong>' + esc((c.penentang && c.penentang.nama ? c.penentang.nama + ': ' : '') + (c.mesej || 'Seorang penentang mencabar jawatan anda.')) +
          ' Pulihkan Sokongan Akar Umbi sebelum pemilihan berikutnya.</div>';
      } else if (p.kesetiaan.akarUmbi < 40) {
        h += '<div class="banner banner--warn" role="alert"><strong>Amaran kesetiaan</strong>Sokongan Akar Umbi tinggal ' + p.kesetiaan.akarUmbi + '%. Di bawah 40%, penentang boleh mencabar jawatan anda.</div>';
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
        '<p class="note">Capai ' + k.ipMin + ' IP untuk membuka pertandingan AJK / Sayap Cawangan (tahun pemilihan). Jawatan Bahagian dan Pusat dibuka selepas anda memegang jawatan peringkat lebih rendah dan menang mandat perwakilan tahun itu.</p>' +
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

  /** Kad "Jawatan & Mandat": semua jawatan dipegang (berbilang peringkat) dan mandat perwakilan tahun ini. */
  /** Banner status disiplin: siasatan, gantung, larangan, pecat (Fasal 20). */
  function bannerDisiplin(p) {
    if (!ET) { return ''; }
    var r = ET.ringkasan(p), h = '';
    if (r.status === 'dipecat') {
      h += '<div class="banner banner--warn" role="alert"><strong>Keahlian anda dipecat</strong>' + esc(r.hukuman ? r.hukuman.perkara : '') + '. Semua jawatan hilang dan hak keahlian ditarik (Fasal 20.10d). ' +
        (r.rayuan && r.rayuan.boleh ? '<button type="button" class="btn btn--gold btn--sm" data-act="rayu" style="margin-top:8px">Hantar Rayuan Pemecatan</button>' : esc(r.rayuan ? r.rayuan.sebab : '')) + '</div>';
    } else if (r.status === 'digantung') {
      h += '<div class="banner banner--gantung" role="alert"><strong>Ahli (Digantung)</strong>Semua jawatan dilucutkan. Anda tidak boleh mencalon, mengundi, bertanding, berkempen atau menyertai mesyuarat sehingga bulan ' + esc(r.hukuman ? r.hukuman.tamatBulan + '/' + r.hukuman.tamatTahun : '') + ' (Fasal 20.10b). Anda masih boleh berkhidmat kepada masyarakat untuk membina Modal Sosial.</div>';
    } else if (r.status === 'dilarang') {
      h += '<div class="banner banner--warn" role="alert"><strong>Dilarang bertanding jawatan</strong>Sehingga bulan ' + esc(r.hukuman ? r.hukuman.tamatBulan + '/' + r.hukuman.tamatTahun : '') + ' (Fasal 20.10c). Anda masih boleh menjadi perwakilan dan berkhidmat.</div>';
    }
    if (r.siasatan) {
      h += '<div class="banner banner--warn" role="alert"><strong>Dalam siasatan Jawatankuasa Disiplin</strong>' + esc(r.siasatan.perkara) + '. ' +
        (r.siasatan.fasa === 'aduan' ? 'Aduan telah diterima; pendengaran bulan depan (Fasal 20.5).' : 'Pendengaran sedang dijalankan; keputusan bulan depan.') + '</div>';
    }
    return h;
  }

  function kadEtika(p) {
    if (!ET) { return ''; }
    var r = ET.ringkasan(p), cfg = ET.CONFIG;
    function bar(nilai, kelas, label) { return '<div class="kv"><span>' + label + '</span><b>' + nilai + '%</b></div><div class="meter__track" role="progressbar" aria-valuenow="' + nilai + '" aria-valuemin="0" aria-valuemax="100"><i class="' + (kelas === 'bahaya' ? 'is-kritikal' : kelas === 'amaran' ? 'is-sederhana' : '') + '" style="width:' + nilai + '%"></i></div>'; }
    var h = '<section class="card etika"><h2 class="card__title" style="margin:0 0 4px">Tataetika &amp; Tempoh Keahlian</h2>';
    h += '<p class="note">Kempen bersih membina <b>Modal Sosial</b> (kekuatan undi +' + r.bonusUndi + ') dan menurunkan risiko dilapor. Politik wang, fitnah dan ugutan melanggar Tataetika Ahli UMNO dan boleh dihukum Lembaga Disiplin (Fasal 20.10): amaran, gantung, dilarang bertanding atau dipecat.</p>';
    h += bar(r.modal, 'baik', 'Modal Sosial') + bar(r.risiko, r.risiko >= 45 ? 'bahaya' : r.risiko >= 20 ? 'amaran' : 'baik', 'Risiko Disiplin (' + r.labelRisiko + ')');
    h += '<div class="kv"><span>Tempoh keahlian</span><b class="' + (r.cukup3Tahun ? 'text-gold' : '') + '">' + Math.floor(r.bulanKeahlian / 12) + ' tahun ' + (r.bulanKeahlian % 12) + ' bulan' + (r.cukup3Tahun ? '' : ' (perlu 3 tahun untuk Bahagian, Fasal 15.5)') + '</b></div>';
    h += '<div class="kv"><span>Rekod disiplin</span><b>' + r.salah + ' hukuman' + (r.amaran ? ' · ' + r.amaran + ' amaran' : '') + '</b></div>';
    if (r.rekod && r.rekod.length) {
      h += '<details class="note" style="margin-top:6px"><summary>Sejarah disiplin</summary><ul style="margin:6px 0 0;padding-left:18px">' +
        r.rekod.slice(0, 6).map(function (x) { return '<li>' + esc(x.bulan + '/' + x.tahun + ': ' + x.mesej) + '</li>'; }).join('') + '</ul></details>';
    }
    return h + '</section>';
  }

  function kadJawatan(p) {
    if (!J) { return ''; }
    var senarai = J.ringkas(p), pc = J.perwakilanSah(p, 'cawangan'), pb = J.perwakilanSah(p, 'bahagian');
    function mandat(nama, x, peringkat) {
      var teks = x.sah ? 'Sah tahun ' + p.tahun + ' sahaja' : x.exOfficio ? 'Automatik (' + esc(x.sumberExOfficio) + ')' : x.luput ? 'Luput (tahun ' + x.tahun + ')' : 'Belum ada';
      return '<div class="kv"><span>' + esc(nama) + '</span><b class="' + (x.layak ? 'text-gold' : '') + '">' + teks + '</b></div>';
    }
    var h = '<section class="card"><h2 class="card__title" style="margin:0 0 4px">Jawatan &amp; Mandat Anda</h2>';
    h += '<p class="note">Anda boleh memegang jawatan di <b>peringkat berbeza</b> serentak (Cawangan + Bahagian + Pusat), tetapi hanya <b>satu jawatan bagi setiap peringkat</b>. Setiap jawatan menambah Stress bulanan; terlalu banyak jawatan mencetus cemburu dan sabotaj akar umbi. ' +
      (J.sayapPemain(p) ? 'Laluan anda: <b>Sayap ' + esc(J.NAMA_SAYAP[J.sayapPemain(p)]) + '</b>.' : 'Laluan anda: <b>Utama / Induk</b>, jadi jawatan sayap tidak dibuka.') + '</p>';
    h += senarai.length ? '<div class="btn-group" style="flex-wrap:wrap;margin-bottom:10px">' + senarai.map(function (j) {
      return '<span class="badge-office badge-office--' + kelasLencana(j.jawatan) + '" title="' + esc(j.label) + '">' + esc(j.jawatan) + ' &middot; ' + esc(j.label) + '</span>'; }).join('') + '</div>'
      : '<p class="empty">Belum memegang sebarang jawatan.</p>';
    h += mandat('Perwakilan Cawangan ke Bahagian', pc) + mandat('Perwakilan Bahagian ke PAU', pb);
    h += '<p class="note" style="margin-top:8px">Mandat perwakilan hanya sah untuk tahun berjalan. Setiap tahun baharu, bertanding semula di Cawangan (bulan 4-6).</p></section>';
    return h;
  }

  /* v3.9: Gaya Kepimpinan (daripada cara bermain) */
  function kadWatak(p) {
    if (!WK) { return ''; }
    var w = WK.tentukan(p);
    return '<section class="card"><h2 class="card__title" style="margin:0 0 4px">Gaya Kepimpinan Anda</h2>' +
      '<p style="margin:0 0 6px"><span class="badge badge--gold">' + esc(w.nama) + '</span></p>' +
      '<p class="note">' + esc(w.huraian) + '</p>' +
      (w.sebab.length ? '<p class="note">' + w.sebab.map(esc).join(' ') + '</p>' : '') +
      '<p class="note">Gaya ini dikira daripada pilihan anda dalam permainan dan boleh berubah.</p></section>';
  }

  /* v3.9: Laluan Karier Sebenar (maklumat neutral, bersumber, tidak mempengaruhi permainan) */
  function kadLaluan() {
    if (!WK) { return ''; }
    var h = '<section class="card"><details><summary class="card__title" style="cursor:pointer">Laluan Karier Sebenar: Presiden UMNO</summary>';
    h += '<p class="note" style="margin-top:8px">Tangga jawatan dalam permainan: ' + WK.TANGGA.map(function (t) { return esc(t.jawatan); }).join(' &rarr; ') + '.</p>';
    h += '<ul style="margin:6px 0 0;padding-left:18px">' + WK.LALUAN_TOKOH.map(function (t) {
      var src = t.sumber.map(function (k) { var s = WK.SUMBER[k]; return s ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.nama) + '</a>' : ''; }).join(', ');
      return '<li style="margin-bottom:6px"><b>' + esc(t.nama) + '</b> &middot; Presiden ' + esc(t.tempoh) +
        (t.sebelum.length ? '<br>Jawatan parti sebelum itu: ' + t.sebelum.map(esc).join(', ') : '') +
        (t.nota ? '<br><i>' + esc(t.nota) + '</i>' : '') + '<br><small>Sumber: ' + src + '</small></li>';
    }).join('') + '</ul>';
    h += '<p class="note" style="margin-top:8px">' + esc(WK.NOTA_UMUM) + '</p></details></section>';
    return h;
  }

  function barisPertandingan(e) {
    var a = state.anggaran[e.kod], kep = e.keputusan, h = '';
    h += '<div class="item"><div class="item__head"><div><div class="item__title">' + esc(e.jawatan) + (e.pertahan ? ' <span class="badge badge--gold">Pertahan</span>' : '') + (e.kumpulan === 'sayap' ? ' <span class="badge">Sayap</span>' : '') + '</div>' +
      '<p class="item__desc">' + fmt(e.kerusi) + ' kerusi' + (e.ipPerlu && !e.pertahan ? ' · perlu ' + e.ipPerlu + ' IP' : '') + (e.tetingkap ? ' · pengundian ' + esc(e.tetingkap.label.toLowerCase()) : '') + (e.sebab && !e.terbuka ? ' · ' + esc(e.sebab) : '') + '</p></div>' + chipPertandingan(e) + '</div>';
    if (kep) {
      h += '<p class="result ' + (kep.menang ? 'is-good' : 'is-bad') + '">' + (kep.menang ? 'Menang' : 'Kalah') + ': kedudukan ' + kep.kedudukan + ' daripada ' + kep.jumlahCalon + ' calon, ' + fmt(kep.undi) + ' undi.</p>';
    } else {
      h += '<div class="item__row">';
      if (!e.didaftar) { h += '<button type="button" class="btn btn--primary btn--sm" data-act="daftar" data-kod="' + esc(e.kod) + '" data-fk="d:' + esc(e.kod) + '"' + (e.terbuka ? '' : ' disabled') + '>' + (e.pertahan ? 'Pertahankan Jawatan' : 'Daftar Bertanding') + '</button>'; }
      else {
        h += '<button type="button" class="btn btn--gold btn--sm" data-act="undi" data-kod="' + esc(e.kod) + '" data-fk="u:' + esc(e.kod) + '"' + (e.bolehUndi ? '' : ' disabled') + '>Hari Mengundi' + (e.bolehUndi || !e.tetingkap ? '' : ' (' + esc(e.tetingkap.label.toLowerCase()) + ')') + '</button>' +
             '<button type="button" class="btn btn--ghost btn--sm" data-act="peluang" data-kod="' + esc(e.kod) + '" data-fk="p:' + esc(e.kod) + '">Anggar Peluang</button>' +
             '<button type="button" class="btn btn--ghost btn--sm" data-act="tarik" data-kod="' + esc(e.kod) + '" data-fk="x:' + esc(e.kod) + '">Tarik Balik</button>';
      }
      h += '</div>';
      if (a) { h += '<p class="result">' + (a.ok ? 'Anggaran peluang menang: <b>' + a.peluangMenang + '%</b> (kekuatan anda ' + a.kekuatan + '/100, ' + a.jumlahCalon + ' calon, kedudukan purata ' + a.kedudukanPurata + ').' : esc(a.ralat)) + '</p>'; }
    }
    return h + '</div>';
  }

  var TAJUK_PERINGKAT = {
    cawangan: ['Pemilihan Cawangan', 'Bulan 4-6 · jawatan Cawangan dan Perwakilan ke Bahagian (jawatan sayap dipilih dalam Mesyuarat Sayap)'],
    bahagian: ['Pemilihan Bahagian', 'Bulan 7 · jawatan Bahagian dan Perwakilan ke PAU (jawatan sayap dipilih dalam Mesyuarat Sayap)'],
    sayap_cawangan: ['Pemilihan Sayap Cawangan', 'Bulan 4-6 · Ketua Sayap Cawangan (tahun pemilihan) dan wakil sayap ke Mesyuarat Sayap Bahagian (laluan sayap sahaja)'],
    sayap_bahagian: ['Pemilihan Sayap Bahagian', 'Bulan 7 · Ketua Sayap Bahagian (tahun pemilihan), G10 (10 wakil) ke Mesyuarat Bahagian dan G2 (2 wakil) ke Perhimpunan Sayap Pusat'],
    sayap_pau: ['Pemilihan Ketua Sayap Pusat', 'Bulan 8 · dipilih dalam Perhimpunan Sayap (Pra-PAU), laluan sayap sahaja'],
    pusat: ['Pemilihan Pusat (PAU)', 'Bulan 8 · Presiden, Timbalan Presiden, 3 Naib Presiden dan MKT']
  };

  function panelPemilihan(p) {
    if (!E) { return '<div class="card"><p class="empty">Modul pemilihan tidak dimuatkan.</p></div>'; }
    var st = E.getStatusModul(p), f = st.fokus, h = '';
    h += '<div class="banner ' + (f.fasa === 'pemilihan' ? 'banner--gold' : '') + '"><strong>' + esc(p.tahun + ': ' + f.tajuk + (K ? ' · Bulan ' + p.bulan : '')) + '</strong>' + esc(f.fokus.join(' · ')) +
      (f.fasa === 'pemilihan' ? '' : '. Pertandingan jawatan seterusnya pada ' + f.pemilihanBerikutnya + '.') + '</div>';
    h += PUIh(p, 'pemilihan') + bannerDisiplin(p) + bannerUndiTP(p) + bannerTransisi(p) + kadBlok(p) + kadEtika(p) + kadJawatan(p) + kadWatak(p) + kadLaluan();
    if (f.fasa !== 'pemilihan') {
      h += '<div class="banner"><strong>Pertandingan jawatan ditutup</strong>Tahun pentadbiran: hanya pemilihan perwakilan tahunan yang dibuka. Pertandingan jawatan dan kempen dibuka semula pada tahun ' + f.pemilihanBerikutnya + '.</div>';
    }

    var daftar = st.pertandingan.filter(function (e) { return e.didaftar && !e.selesai; });
    if (!daftar.some(function (e) { return e.kod === state.kodSimulasi; })) { state.kodSimulasi = daftar.length ? daftar[0].kod : ''; }

    ['cawangan', 'sayap_cawangan', 'bahagian', 'sayap_bahagian', 'sayap_pau', 'pusat'].forEach(function (lv) {
      var baris = st.pertandingan.filter(function (e) { return e.peringkat === lv; });
      if (!baris.length) { return; }
      h += '<section class="card"><h2 class="card__title" style="margin:0 0 4px">' + TAJUK_PERINGKAT[lv][0] + '</h2><p class="note">' + TAJUK_PERINGKAT[lv][1] + '. Hanya satu jawatan bagi setiap peringkat boleh dipegang (jika kedua-dua jawatan utama dan sayap dimenangi, yang lebih tinggi dikekalkan); perwakilan dipertandingkan bersama.</p>';
      baris.forEach(function (e) { h += barisPertandingan(e); });
      h += '</section>';
    });

    h += '<section class="card"><h2 class="card__title" style="margin:0 0 4px">Kempen Pemilihan</h2><p class="note">Mata kempen terkumpul: <b>' + fmt(st.mataKempen) + '</b>. Kempen meningkatkan kekuatan anda dalam pengundian.</p>';
    if (daftar.length) {
      h += '<label class="note" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">Untuk simulasi pengundian: <select data-act="pilih-kod" class="item" style="padding:.3rem .6rem">' +
        daftar.map(function (e) { return '<option value="' + esc(e.kod) + '"' + (e.kod === state.kodSimulasi ? ' selected' : '') + '>' + esc(e.jawatan) + '</option>'; }).join('') + '</select></label>';
    }
    h += '<div class="choice-list">';
    st.kempen.forEach(function (k) {
      var boleh = k.boleh && (!k.perluKod || !!state.kodSimulasi);
      var sebab = !k.boleh ? k.sebab : (k.perluKod && !state.kodSimulasi ? 'Daftar bertanding dahulu.' : '');
      var tag = k.tahap === 'bersih' ? '<span class="badge badge--bersih">Bersih · +' + k.modalSosial + ' Modal Sosial</span>'
        : k.tahap === 'kotor' ? '<span class="badge badge--kotor">Risiko disiplin ~' + k.peluangLapor + '%</span>'
        : k.tahap === 'kelabu' ? '<span class="badge badge--kelabu">Zon kelabu ~' + k.peluangLapor + '%</span>' : '';
      h += '<button type="button" class="choice choice--' + esc(k.tahap || 'neutral') + '" data-act="kempen" data-id="' + esc(k.id) + '" data-fk="k:' + esc(k.id) + '"' + (boleh ? '' : ' disabled') + '>' +
        '<span class="choice__title">' + esc(k.nama) + ' ' + tag + '</span><span class="choice__desc">' + esc(k.penerangan) + '</span>' +
        '<span class="choice__fx">' + fx(k.ringkas) + (k.maksKali ? '<span class="badge">' + k.kali + '/' + k.maksKali + ' kali</span>' : '') + '</span>' +
        (sebab ? '<span class="choice__desc" style="color:var(--danger)">' + esc(sebab) + '</span>' : '') + '</button>';
    });
    h += '</div>' + (state.mesej.kempen ? '<p class="result" style="margin-top:12px">' + state.mesej.kempen + '</p>' : '') + '</section>';
    return h;
  }

  /* ---------- Panel: Mesyuarat & Usul ---------- */
  var STATUS_MES = { belum_tiba: ['Belum Tiba', 'is-lock'], terlepas: ['Terlepas', 'is-lock'], terkunci: ['Terkunci', 'is-lock'], tidak_layak: ['Tidak Layak', 'is-lock'], boleh_mula: ['Sedia', 'is-open'], sedang: ['Berlangsung', 'is-open'], selesai: ['Selesai', 'is-done'] };

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
    h += '<div class="banner"><strong>Mesyuarat Tahun ' + p.tahun + '</strong>Mesyuarat berlangsung mengikut urutan: Cawangan, Bahagian, kemudian Perhimpunan Agung (PAU). Jika anda dalam laluan Pemuda, Puteri atau Wanita, setiap peringkat didahului mesyuarat sayap anda; mesyuarat utama terkunci sehingga mesyuarat sayap selesai, dan sayap membawa satu usul ke mesyuarat utama. Pilih peranan anda bagi setiap usul: Pembawa, Pembahas atau Pengundi. Setiap pilihan mempengaruhi IP dan Reputasi Parti.</div>';
    var sp = M.getStatusPerwakilan(p);
    function kadPerw(nama, st) {
      var w = st.tetingkap, jarak = w ? (w.status === 'dibuka' ? 'Dibuka sekarang' : w.status === 'belum_tiba' ? 'Dibuka bulan ' + w.label.replace('Bulan ', '') + ' (' + w.jarak + ' bulan lagi)' : 'Musim tahun ini tamat') : '';
      return '<div class="item"><div class="item__head"><div class="item__title">' + esc(nama) + '</div><span class="status-chip ' + (st.layak ? 'is-open' : 'is-lock') + '">' + (st.layak ? 'Layak' : 'Belum layak') + '</span></div>' +
        '<p class="item__desc">' + esc(st.layak ? st.sumber + (st.lencana ? ' · status: ' + st.lencana : '') + (jarak ? ' · ' + jarak : '') : st.sebab) + '</p></div>';
    }
    h += '<section class="card perw"><h2 class="card__title" style="margin:0">Kelayakan Perwakilan</h2>' + kadPerw('Mesyuarat Bahagian', sp.bahagian) + kadPerw('Perhimpunan Agung (PAU)', sp.pau) + '</section>';
    k.peringkat.forEach(function (lv) {
      var cs = STATUS_MES[lv.status] || [lv.status, ''];
      h += '<section class="card"><div class="item__head"><div><h2 class="card__title" style="margin:0">' + esc(lv.nama) + '</h2><p class="item__desc">' + esc(lv.jenisUsul) + (lv.tetingkap ? ' · ' + esc(lv.tetingkap.label) : '') + '</p></div>' +
        '<span class="status-chip ' + cs[1] + '">' + cs[0] + '</span></div>';
      if (lv.status === 'terkunci' || lv.status === 'tidak_layak' || lv.status === 'belum_tiba' || lv.status === 'terlepas') { h += '<p class="note" style="margin-top:12px">' + esc(lv.sebab) + '</p>'; }
      if (lv.status === 'boleh_mula') {
        h += '<div style="margin-top:12px"><button type="button" class="btn btn--primary" data-act="mula" data-lvl="' + lv.kod + '" data-fk="mula:' + lv.kod + '">Mulakan ' + esc(lv.nama) + '</button></div>';
      }
      if (lv.status === 'sedang' || lv.status === 'selesai') {
        (lv.agenda || []).forEach(function (u) {
          h += '<div class="item" style="margin-top:12px"><div class="item__head"><div class="item__title">' + esc(u.tajuk) + (u.sumber === 'sayap' ? ' <span class="badge badge--gold">Usul Sayap</span>' : '') + '</div>' +
            '<span class="status-chip' + (u.status === 'selesai' ? ' is-done' : '') + '">' + (u.jenis === 'pemilihan' ? 'Pemilihan' : u.jenis === 'ucapan_dasar' ? 'Ucapan Dasar' : u.status === 'selesai' ? 'Diputuskan' : 'Terbuka') + '</span></div>' +
            '<p class="item__desc">' + esc(u.penerangan || '') + '</p>';
          if (u.jenis === 'pemilihan') { h += '<p class="item__desc">Keputusan pemilihan dikira apabila mesyuarat ditutup. Pastikan anda sudah mendaftar bertanding di tab Pemilihan &amp; Kempen.</p>'; }
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
          h += '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn--gold" data-act="ringkasan" data-lvl="' + lv.kod + '">Lihat Ringkasan</button><button type="button" class="btn btn--ghost" data-act="bulan">Teruskan ke Bulan Seterusnya →</button></div>';
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
      if (!pt.data) { var pp = S && S.loadPlayer(); pt.data = await D.loadSemuaNegeri(pp && pp.negeri, { url: CFG.sheetCsvUrl, appsScriptUrl: CFG.appsScriptUrl }); }
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
    el.innerHTML = id === 'tindakan' ? panelTindakan(p) : id === 'pemilihan' ? panelPemilihan(p) : id === 'pilihanraya' ? PUIh(p, 'pilihanraya') : panelMesyuarat(p);
    if (fk) { var f = el.querySelector('[data-fk="' + fk.replace(/"/g, '\\"') + '"]'); if (f && !f.disabled) { f.focus({ preventScroll: true }); } }
  }

  function renderTabs(p) {
    var musim = musimPR(p);                                                       // v7.10: tab Pilihan Raya hanya muncul semasa musim pilihan raya (PRU/PRN/PRK)
    if (musim && !state.musimLalu) { state.tab = 'pilihanraya'; }
    if (!musim && state.tab === 'pilihanraya') { state.tab = 'tindakan'; }
    state.musimLalu = musim;
    $('tab-pilihanraya').hidden = !musim; $('nav-pilihanraya').hidden = !musim;
    TABS.forEach(function (t) {
      var b = $('tab-' + t), a = t === state.tab;
      b.setAttribute('aria-selected', String(a)); b.tabIndex = a ? 0 : -1;
      $('panel-' + t).hidden = !a;
      if (a && t === 'pilihanraya' && b.scrollIntoView && !b.hidden) { try { b.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { /* abaikan */ } }
    });
    Array.prototype.forEach.call($('bottom-nav').querySelectorAll('button'), function (b) { b.classList.toggle('is-active', b.getAttribute('data-tab') === state.tab); });
    var tp = $('tab-pemilihan'); tp.innerHTML = '🗳️ Pemilihan &amp; Kempen' + (adalahTahunPemilihan(p.tahun) ? '<span class="dot" title="Tahun pemilihan"></span>' : '');
    var tm = $('tab-mesyuarat'), sedia = M && M.getKeadaanMesyuarat(p).peringkat.some(function (x) { return x.status === 'boleh_mula' || x.status === 'sedang'; });
    tm.innerHTML = '📜 Mesyuarat &amp; Usul' + (sedia ? '<span class="dot" title="Mesyuarat tersedia"></span>' : '');
  }

  function render() {
    state.renderTerjadual = false;
    if (J && J.selaraskan) { var pj = S.loadPlayer(), tj = pj && !pj.tamat ? J.selaraskan(pj) : null; if (tj) { S.applyEffects({}, { kiraTindakan: false, patch: tj }); } }     // v5.7: satu jawatan bagi setiap peringkat (simpanan lama)
    if (ET && ET.kuatkuasaGantung) { ET.kuatkuasaGantung(); }          // v4.6: lucut jawatan jika digantung
    if (HY) { HY.kemaskiniJawatanTertinggi(); }                         // v5.0: rekod jawatan tertinggi untuk Legacy Summary
    var p = S.loadPlayer();
    if (!p) { W.location.replace(INDEX_URL); return; }
    if (p.tamat) { paparLegasi(p); return; }                            // v5.0: kerjaya tamat
    renderHeader(p); renderSisi(p); renderTabs(p); renderPanel(p);
    var bt = $('acara-tunggu'); if (bt) { bt.hidden = !(EV && EV.getTertunggak()); }
  }
  /** v5.0: Legacy Summary apabila kerjaya tamat (meninggal, bersara paksa atau had umur). */
  function paparLegasi(p) {
    var t = p.tamat, k = $('kandungan'), l = $('legasi');
    if (!l) { return; }
    if (k) { k.hidden = true; }
    var DISIPLIN = { baik: 'Baik (tiada sekatan)', digantung: 'Digantung', dilarang: 'Dilarang bertanding', dipecat: 'Dipecat' };
    var gel = (t.gelarList && t.gelarList.length) ? t.gelarList : [{ ikon: '\uD83D\uDEA9', nama: t.gelaran, huraian: '' }];
    var baris = [['Umur terakhir', t.umur + ' tahun'], ['Tempoh berkhidmat', t.tahunBerkhidmat + ' tahun (' + t.tahunMula + '\u2013' + t.tahun + ')'],
      ['Jawatan tertinggi', t.jawatanTertinggi], ['Jawatan terakhir', t.jawatanAkhir],
      ['Sokongan akar umbi (akhir)', (t.kesetiaanAkarUmbi === undefined ? '\u2013' : t.kesetiaanAkarUmbi + '%')],
      ['Status disiplin', (DISIPLIN[t.statusDisiplin] || 'Baik') + (t.hukumanDisiplin ? ' \u00B7 ' + t.hukumanDisiplin + ' hukuman' : '')],
      ['Gaya kepimpinan', t.gaya || '\u2013'], ['Pengaruh (IP)', fmt(t.ip)], ['Reputasi Parti', t.reputasi + '%']];
    var pr = t.pilihanRaya;                                                   // v7.11: rekod pilihan raya & jawatan kerajaan
    if (pr) {
      baris.push(['Rekod pilihan raya', pr.bertanding ? pr.bertanding + ' kali bertanding \u00B7 ' + pr.menang + ' menang \u00B7 ' + pr.kalah + ' kalah' + (pr.prkBertanding ? ' (termasuk ' + pr.prkBertanding + ' PRK)' : '') : 'Tidak pernah bertanding']);
      if (pr.kerusi.length) { baris.push(['Kerusi dimenangi', pr.kerusi.join('; ')]); }
      if (pr.statusSemasa) { baris.push(['Kerusi semasa', pr.statusSemasa]); }
      if (pr.jawatanKerajaan.length || pr.kabinetSemasa) { baris.push(['Jawatan kerajaan', (pr.jawatanKerajaan.length ? pr.jawatanKerajaan : [pr.kabinetSemasa]).join('; ')]); }
    }
    l.setAttribute('role', 'dialog'); l.setAttribute('aria-modal', 'true'); l.setAttribute('aria-label', 'Rumusan Kerjaya');
    l.innerHTML = '<div class="legasi__kepala"><p class="legasi__kecil">Rumusan Kerjaya \u00B7 ' + esc(t.tajuk) + '</p><h1>' + esc(p.nama) + '</h1><p class="legasi__gelaran">' + esc(gel[0].nama) + '</p></div>' +
      '<p class="legasi__mesej">' + esc(t.mesej) + '</p>' +
      '<h2 class="legasi__sub">Gelaran Politik</h2><ul class="legasi__gelar">' + gel.map(function (g) { return '<li><span aria-hidden="true">' + g.ikon + '</span><div><b>' + esc(g.nama) + '</b><small>' + esc(g.huraian) + '</small></div></li>'; }).join('') + '</ul>' +
      '<h2 class="legasi__sub">Statistik Kerjaya</h2><div class="legasi__jadual">' + baris.map(function (b) { return '<div class="kv"><span>' + esc(b[0]) + '</span><b>' + esc(b[1]) + '</b></div>'; }).join('') + '</div>' +
      (t.gayaHuraian ? '<p class="note" style="margin-top:12px">' + esc(t.gayaHuraian) + '</p>' : '') +
      '<div class="legasi__butang"><button type="button" class="btn btn--gold" data-act="legasi-baharu">Main Semula (mula umur 18)</button> <a class="btn btn--ghost" href="' + INDEX_URL + '">Menu Utama</a></div>' +
      '<p class="legasi__nota">Simulasi permainan. Umur dan risiko kesihatan ialah angka permainan, bukan ramalan sebenar.</p>';
    l.hidden = false;
    if (LAT && LAT.aktif()) { var mb = l.querySelector('[data-act="legasi-baharu"]'); if (mb) { mb.hidden = true; } LAT.pasangLegasi(l); }   // v7.13
    var h = l.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); }
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
    if (r.ok && EV) { await tunjukAcara(EV.selepasAktiviti()); }              // acara rawak selepas aktiviti
  }

  async function operasiPemilihan(fn, kunciMesej) {
    var r = fn(); if (kunciMesej) { state.mesej[kunciMesej] = r.ok ? esc(r.mesej) : ''; }
    render(); await lapor(r);
  }


  /* ---------- Acara rawak (js/events.js) ---------- */
  var acaraSibuk = false;
  /** Papar pop-up acara & minta keputusan. Pulang selepas dijawab, atau jika ditutup acara kekal tertunggak. */
  async function tunjukAcara(acara) {
    if (!EV || !acara || acaraSibuk) { return; }
    acaraSibuk = true;
    try {
      var p = S.loadPlayer(), ps = EV.getTertunggak() || acara, abjad = ['A', 'B', 'C'];
      var senarai = ps.pilihan.map(function (c, i) {
        // v5.7: seluruh kad pilihan ialah butang; klik terus memilih (tiada butang berasingan di bawah)
        return '<li><button type="button" class="acara__opsi' + (i === 0 ? ' is-utama' : '') + (c.boleh ? '' : ' is-off') + '" data-pilih="' + esc(c.id) + '"' + (c.boleh ? '' : ' disabled') + '><b>' + abjad[i] + '. ' + esc(c.label) + '</b>' +
          '<small>' + esc(c.huraian) + (c.berisiko ? ' (berisiko)' : '') + '</small>' +
          '<small class="acara__kesan">' + esc(c.ringkas) + '</small>' +
          (c.boleh ? '' : '<small>' + esc(c.sebab) + '</small>') + '</button></li>';
      }).join('');
      var id = await modal({
        tajuk: (ps.krisis ? '\u26A0\uFE0F KRISIS: ' : '') + ps.tajuk,
        isi: (ps.krisis ? '<p class="acara__tag">Krisis Politik · Keputusan anda akan membawa akibat</p>' : '') + '<p class="acara__ikon" aria-hidden="true">' + esc(ps.ikon) + '</p><p>' + esc(ps.huraian) + '</p>' +
          '<p style="margin:8px 0 0;font-size:.82rem">AP: <b>' + p.ap + '</b> · Dana: <b>RM ' + fmt(p.myr) + '</b></p><ul class="acara__pil">' + senarai + '</ul>',
        butang: []
      });
      if (!id) { toast('Acara masih menunggu keputusan anda.'); render(); return; }
      var r = EV.pilih(id);
      if (!r.ok) { toast(r.ralat, 'ralat'); render(); return; }
      render();
      await modal({
        tajuk: (ps.krisis ? 'Krisis: ' : '') + r.acara.tajuk + ' — Keputusan',
        isi: '<p>' + esc(r.mesej) + '</p><p class="acara__kesan">' + esc(r.ringkas) + '</p>'
      });
    } finally { acaraSibuk = false; render(); }
  }
  async function bukaAcaraTertunggak() { var a = EV && EV.getTertunggak(); if (a) { await tunjukAcara(a); } }


  /* ---------- Ringkasan mesyuarat & aliran bulan (Fasa 4) ---------- */
  function tanda(n) { return (n > 0 ? '+' : n < 0 ? '-' : '') + fmt(Math.abs(n)); }
  function sel(label, d, baki, awalan) {
    return '<div><span>' + label + '</span><b class="' + (d > 0 ? 'ring__naik' : d < 0 ? 'ring__turun' : '') + '">' + (awalan || '') + tanda(d) + '</b>baki ' + (awalan || '') + fmt(baki) + '</div>';
  }
  function htmlRingkasan(r) {
    var h = '<div class="ring">';
    h += '<h3>Status Usul (' + r.lulus + ' lulus, ' + r.ditolak + ' ditolak, ' + r.disertai + ' anda sertai)</h3><ul class="ring__usul">';
    (r.usul || []).forEach(function (u) {
      h += '<li><span class="ring__tag ring__tag--' + (u.lulus ? 'ya' : 'tidak') + '">' + (u.lulus ? 'LULUS' : 'DITOLAK') + '</span><b>' + esc(u.tajuk) + '</b>' +
        '<small>' + fmt(u.undiSokong) + ' sokong, ' + fmt(u.undiBantah) + ' bantah · ' +
        (u.pilihan ? 'anda: ' + esc(u.pilihan.peranan) + ' (' + esc(u.pilihan.pendirian) + ') → ' + tanda(u.ip) + ' IP, ' + tanda(u.reputasi) + ' Reputasi' : 'tiada penyertaan') + '</small></li>';
    });
    h += '</ul>';
    if (r.pemilihan && r.pemilihan.length) {
      h += '<h3>Keputusan Pemilihan</h3><ul class="ring__usul">';
      r.pemilihan.forEach(function (x) {
        h += '<li><span class="ring__tag ring__tag--' + (x.menang ? 'ya' : 'tidak') + '">' + (x.menang ? 'MENANG' : 'KALAH') + '</span><b>' + esc(x.jawatan) + '</b>' +
          '<small>Kedudukan ' + x.kedudukan + ' daripada ' + x.jumlahCalon + ' calon (' + x.kerusi + ' kerusi, ' + fmt(x.undi) + ' undi) · ' + tanda(x.ip) + ' IP</small></li>';
      });
      h += '</ul>';
    }
    if (r.tidakDidaftar && r.tidakDidaftar.length) { h += '<p class="note">Anda tidak bertanding untuk: ' + r.tidakDidaftar.map(esc).join(', ') + '.</p>'; }
    (r.peristiwa || []).forEach(function (m) { h += '<p class="note"><b>' + esc(m) + '</b></p>'; });
    var d = r.perubahan || {}, b = r.baki || {};
    h += '<h3>Perubahan Sumber</h3><div class="ring__sumber">' + sel('Pengaruh (IP)', d.ip || 0, b.ip || 0) + sel('Dana (MYR)', d.myr || 0, b.myr || 0, 'RM ') +
      sel('AP', d.ap || 0, b.ap || 0) + sel('Reputasi', d.reputasi || 0, b.reputasi || 0) + '</div>';
    var sp = r.perwakilanStatus;
    if (r.usulDibawa) { h += '<div class="banner"><strong>Usul dibawa ke ' + esc(r.usulDibawa.ke) + '</strong>' + esc(r.usulDibawa.tajuk) + '</div>'; }
    else if (r.usulDibawa === null && r.peringkat && r.peringkat.indexOf('sayap_') === 0) { h += '<div class="banner banner--warn"><strong>Tiada usul dibawa</strong>Tiada usul sayap yang diluluskan, jadi sayap anda tidak membawa usul ke mesyuarat utama.</div>'; }
    if (sp && r.peringkat !== 'pau' && r.peringkat.indexOf('sayap_') !== 0) {
      var st = r.peringkat === 'cawangan' ? sp.bahagian : sp.pau, nama = r.peringkat === 'cawangan' ? 'Perwakilan Bahagian' : 'Perwakilan PAU';
      h += '<div class="banner' + (st.layak ? '' : ' banner--warn') + '"><strong>' + (st.layak ? '✔ ' + esc(st.lencana || nama) : 'Belum menjadi ' + esc(nama)) + '</strong>' +
        esc(st.layak ? st.sumber : st.sebab) + '</div>';
    }
    h += '<h3>Langkah Seterusnya</h3><ul class="ring__langkah">' + (r.langkah || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    return h;
  }
  /** Papar skrin ringkasan. Pilihan "Teruskan ke Bulan Seterusnya" terus melancarkan peralihan bulan. */
  async function tunjukRingkasan(r) {
    if (!r) { return; }
    var tk = K ? K.getTakwim(S.loadPlayer()) : null;
    var pilih = await modal({
      tajuk: 'Ringkasan ' + r.nama + ' ' + r.tahun,
      isi: htmlRingkasan(r),
      butang: [{ label: 'Kekal di Bulan Ini', nilai: false }].concat(tk && !r.tiadaLanjut ? [{ label: 'Teruskan ke Bulan ' + tk.bulanSeterusnya + ' →', nilai: 'bulan', kelas: 'btn--gold' }] : [])
    });
    render();
    if (pilih === 'bulan') { await lanjutBulan(); }
  }
  async function tutupDanRingkas(lvl) {
    var r = M.tutupMesyuarat(lvl);
    render();
    if (!r.ok) { toast(r.ralat, 'ralat'); return; }
    await tunjukRingkasan(r.ringkasan);
  }

  async function lanjutBulan() {
    if (!K) { toast('Modul takwim (js/calendar.js) tidak dimuatkan.', 'ralat'); return; }
    var pv = K.pratonton();
    if (!pv) { return; }
    var rg = pv.regenerasi, p0 = S.loadPlayer();
    var kepala = pv.tahunBaharu ? 'Teruskan ke Bulan 1, ' + pv.ke.tahun + '?' : 'Teruskan ke Bulan ' + pv.ke.bulan + ' (' + K.namaBulan(pv.ke.bulan) + ')?';
    var ya = await modal({
      tajuk: kepala,
      isi: '<div class="kv"><span>Bulan</span><b>' + pv.dari.bulan + '/' + pv.dari.tahun + ' &rarr; ' + pv.ke.bulan + '/' + pv.ke.tahun + '</b></div>' +
        '<div class="kv"><span>Fasa takwim</span><b>' + esc(pv.fasaBaharu.ringkas) + '</b></div>' +
        '<div class="kv"><span>AP (terkumpul, had ' + K.CONFIG.AP_MAKS + ')</span><b>' + p0.ap + ' &rarr; ' + rg.apBaharu + '</b></div>' +
        '<div class="kv"><span>Elaun bulanan</span><b>+RM ' + fmt(rg.myr) + '</b></div>' +
        (rg.butiran.length > 1 ? '<p style="margin:6px 0 0;font-size:.8rem">' + rg.butiran.map(function (b) { return esc(b.nama) + ' RM ' + fmt(b.jumlah); }).join(' + ') + '</p>' : '') +
        (pv.tahunBaharu ? '<p style="margin-top:12px">Tahun bertukar dan kitaran pemilihan 3 tahun dikemas kini.</p>' : '') +
        (pv.amaran.length ? '<ul style="margin-top:12px">' + pv.amaran.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        '<p style="margin-top:12px">Anda tidak boleh kembali ke bulan sebelumnya.</p>',
      butang: [{ label: 'Batal', nilai: false }, { label: 'Teruskan', nilai: true, kelas: 'btn--gold' }]
    });
    if (!ya) { return; }
    var r = K.majuBulan();
    if (!r.ok) { toast(r.ralat, 'ralat'); return; }
    state.anggaran = {}; state.mesej = {};
    if (r.tahunBaharu) { state.kodSimulasi = ''; }
    render();
    if (r.profil && r.profil.tamat) { return; }                       // v5.0: kerjaya tamat, Legacy Summary dipaparkan
    toast(r.mesej, 'ok');
    if (ET) { var dis = ET.prosesBulan(); r.peristiwa = (r.peristiwa || []).concat(dis.peristiwa || []); if (dis.berubah) { render(); } }
    var pBaru = S.loadPlayer();
    if (I && pemegang(pBaru)) {                                    // semakan sokongan bulanan
      var a = I.semakAmaranKesetiaan();
      if (a && a.amaran && a.cabaranBaru) { r.peristiwa = (r.peristiwa || []).concat([{ jenis: 'cabaran_jawatan', mesej: a.cabaranBaru.mesej }]); }
      else if (a && a.amaran) { toast(a.mesej, 'ralat'); }
    }
    await urusPeristiwa(r.peristiwa);
    if (W.NusaPRU_UI && W.NusaPRU_UI.selepasBulan) { await W.NusaPRU_UI.selepasBulan(r.peristiwa); }     // v7.3: PRU/PRN & Kabinet
    if (EV) { await tunjukAcara(EV.janaAcara({ pencetus: 'bulan' })); }       // acara rawak pergantian bulan
  }

  async function reset() {
    var ya = await modal({
      tajuk: 'Reset Permainan?',
      isi: '<p>Semua kemajuan akan dipadam daripada pelayar ini (profil, sumber, pemilihan, mesyuarat dan peta). Anda akan kembali ke halaman pendaftaran.</p><p><b>Tindakan ini tidak boleh dibatalkan.</b></p>',
      butang: [{ label: 'Batal', nilai: false }, { label: 'Padam & Mula Semula', nilai: true, kelas: 'btn--danger' }]
    });
    if (!ya) { return; }
    S.clearPlayer(); if (EV) { EV.reset(); } if (TUT) { TUT.reset(); }
    W.location.assign(INDEX_URL);
  }

  /* v6.0: Struktur organisasi (Induk dan Sayap) */
  function paparStruktur() {
    var OG = W.MyPolitikOrganisasi, p = S.loadPlayer();
    if (!OG || !p) { return; }
    var st = OG.getStruktur(p), tab = st.laluan === 'utama' ? 'induk' : st.laluan;
    function baris(x) { return '<div class="org-baris' + (x.pemain ? ' is-anda' : '') + '"><span>' + esc(x.jawatan) + '</span><span>' + esc(x.nama) + (x.pemain ? ' (anda)' : '') + '</span></div>'; }
    function blok(o) {
      var h = '<div class="org-peringkat"><h3>' + esc(o.label) + '</h3>' + baris(o.ketua) + baris(o.naib);
      o.tambahan.forEach(function (x) { h += baris(x); });
      h += '<details class="org-ajk"><summary>' + esc(o.ajk[0].jawatan.replace(/ 1$/, '')) + ' (' + o.bilAjk + ' orang)</summary>' + o.ajk.map(baris).join('') + '</details></div>';
      return h;
    }
    function isi() {
      var h = '<div class="org-tabs" role="tablist">' + [['induk', 'Induk'], ['pemuda', 'Pemuda'], ['puteri', 'Puteri'], ['wanita', 'Wanita']].map(function (t) {
        return '<button type="button" class="org-tab" role="tab" data-org="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + (st.laluan === t[0] || (t[0] === 'induk' && st.laluan === 'utama') ? ' ★' : '') + '</button>'; }).join('') + '</div>';
      if (tab === 'induk') {
        h += '<p class="note">Struktur Induk: Ketua, Naib Ketua dan AJK di setiap peringkat. Sayap meniru struktur ini.</p>' + OG.PERINGKAT.map(function (k) { return blok(st.induk[k]); }).join('');
      } else {
        var s = st.sayap[tab];
        h += '<p class="note"><strong>' + esc(s.nama) + '</strong>: ' + esc(s.penerangan) + ' Isu yang diperjuangkan:</p><ul class="org-isu">' + s.isu.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' +
          OG.PERINGKAT.map(function (k) { return blok(s.peringkat[k]); }).join('');
      }
      if (st.ahli) {
        h += '<p class="note"><b>Ahli Cawangan anda mengikut kumpulan:</b> Induk (lelaki atas 40) ' + fmt(st.ahli.induk) + ' · Pemuda (lelaki bawah 40) ' + fmt(st.ahli.pemuda) + ' · Puteri (perempuan bawah 40) ' + fmt(st.ahli.puteri) + ' · Wanita (perempuan atas 40) ' + fmt(st.ahli.wanita) +
          (st.ahli.langsung ? '' : '. Angka ini anggaran daripada data jantina dan umur (andaian kedua-duanya tidak bersandar)') + '.</p>';
      }
      return h + '<p class="note">Nama pemimpin lain ialah watak simulasi (bukan individu sebenar). Hanya jawatan Ketua sayap boleh dipegang oleh pemain.</p>';
    }
    var pr = modal({ tajuk: 'Struktur Organisasi', isi: isi() });
    $('modal-isi').addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-org]');
      if (b) { tab = b.getAttribute('data-org'); $('modal-isi').innerHTML = isi(); }
    });
    return pr;
  }

  async function bersaraAwal() {
    var p0 = S.loadPlayer();
    if (!p0 || p0.tamat || !HY) { return; }
    var ya = await modal({
      tajuk: 'Bersara Awal?',
      isi: '<p>Anda akan menamatkan kerjaya politik anda sekarang pada usia <b>' + HY.umurSemasa(p0) + ' tahun</b> dan melihat rumusan kerjaya serta gelaran anda.</p><p><b>Permainan ini tidak boleh diteruskan selepas bersara.</b> Anda boleh memulakan kerjaya baharu dari umur 18.</p>',
      butang: [{ label: 'Batal', nilai: false }, { label: 'Ya, Bersara', nilai: true, kelas: 'btn--gold' }]
    });
    if (!ya) { return; }
    var r = HY.bersaraAwal();
    if (!r.ok) { toast(r.ralat || 'Gagal bersara.', 'ralat'); return; }
    render();
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
    if (act === 'legasi-baharu') { try { W.sessionStorage.setItem('myPolitik_umurMula', '18'); } catch (e) { /* abaikan */ } S.clearPlayer(); if (EV) { EV.reset(); } if (TUT) { TUT.reset(); } W.location.assign(INDEX_URL + '#daftar'); return; }    // v5.0
    if (act === 'ringkasan') { tunjukRingkasan(M.getRingkasan(lvl)); return; }
    if (act === 'bulan') { lanjutBulan(); return; }
    if (act === 'acara-buka') { bukaAcaraTertunggak(); return; }
    if (act === 'misi-sayap') { misiSayap(t.getAttribute('data-id')); }
    else if (act === 'blok-runding') { rundingBlok(t.getAttribute('data-calon'), t.getAttribute('data-tuntut')); }
    else if (act === 'tindakan-sayap') { tindakanSayap(t.getAttribute('data-id')); }
    else if (act === 'tindakan') { tindakan(t.getAttribute('data-id')); }
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
      state.mesej.kempen = r.ok ? esc(r.mesej) : ''; render();
      if (r.ok && r.dilapor) { r.peristiwa = [{ jenis: 'disiplin', mesej: r.mesej }]; r.mesej = null; toast('Aduan disiplin dibuat terhadap anda.', 'ralat'); }
      lapor(r, r.dilapor);
    }
    else if (act === 'rayu') {
      var ry = ET.rayuPemecatan(); render();
      if (!ry.ok) { toast(ry.ralat, 'ralat'); } else { modal({ tajuk: 'Rayuan Diterima', isi: '<p>' + esc(ry.mesej) + '</p>' }); }
    }
    else if (act === 'mula') { var m = M.mulaMesyuarat(lvl); if (!m.ok) { toast(m.ralat, 'ralat'); } else { toast('Mesyuarat dimulakan.', 'ok'); } render(); }
    else if (act === 'peranan') {
      var pr = M.pilihPeranan(lvl, t.getAttribute('data-u'), t.getAttribute('data-r'), t.getAttribute('data-p'));
      render(); lapor(pr);
    }
    else if (act === 'tutup') {
      modal({ tajuk: 'Tutup Mesyuarat?', isi: '<p>Usul yang belum anda sertai akan diputuskan tanpa kesan kepada anda' + ', dan pencalonan yang telah anda daftar pada peringkat ini akan diundi' + '.</p>',
        butang: [{ label: 'Batal', nilai: false }, { label: 'Tutup Mesyuarat', nilai: true, kelas: 'btn--gold' }] })
        .then(function (ya) { if (ya) { tutupDanRingkas(lvl); } });
    }
  });

  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.getAttribute && t.getAttribute('data-act') === 'pilih-kod') { state.kodSimulasi = t.value; render(); }
  });

  $('tab-peta').parentNode.addEventListener('keydown', function (ev) {                    // navigasi papan kekunci tab
    var t = ev.target; if (!t.getAttribute || t.getAttribute('role') !== 'tab') { return; }
    var TN = TABS.filter(function (x) { return !$('tab-' + x).hidden; });                 // langkau tab yang disembunyikan
    var i = TN.indexOf(t.getAttribute('data-tab')), n = -1;
    if (ev.key === 'ArrowRight') { n = (i + 1) % TN.length; } else if (ev.key === 'ArrowLeft') { n = (i + TN.length - 1) % TN.length; }
    else if (ev.key === 'Home') { n = 0; } else if (ev.key === 'End') { n = TN.length - 1; }
    if (n >= 0) { ev.preventDefault(); setTab(TN[n], true); }
  });

  $('btn-tahun').addEventListener('click', lanjutBulan);
  $('btn-reset').addEventListener('click', reset);
  /* ----- v7.16: tetingkap Menu (rupa, struktur, perlembagaan, simpan, tukar watak tanpa ke menu utama) ----- */
  var SLT = W.MyPolitikSlot;
  function renderSlotMenu() {
    var h = $('menu-slot'); if (!h) { return; }
    if (LAT && LAT.aktif()) { h.innerHTML = '<p class="note">Latihan Amir sedang berjalan. Tamatkan atau keluar latihan dahulu untuk menukar watak.</p>'; return; }
    if (!SLT) { h.innerHTML = '<p class="note">Simpanan berbilang tidak tersedia.</p>'; return; }
    h.innerHTML = SLT.senarai().map(function (x) {
      var r = x.ringkas;
      if (!r) { return '<div class="menu-baris"><div class="menu-baris__teks"><b>Slot ' + x.no + '</b><small>(kosong)</small></div><button type="button" class="btn btn--ghost btn--sm" data-slot-baharu="' + x.no + '">Watak baharu</button></div>'; }
      return '<div class="menu-baris' + (x.aktif ? ' is-aktif' : '') + '"><div class="menu-baris__teks"><b>' + esc(r.nama) + (r.tamat ? ' (tamat)' : '') + '</b><small>' + esc(r.jawatan) + ' · ' + esc(r.cawangan) + ' · ' + r.tahun + ' B' + r.bulan + '</small></div>' +
        (x.aktif ? '<span class="note">Dimainkan</span>' : '<button type="button" class="btn btn--gold btn--sm" data-slot-main="' + x.no + '">Main</button>') + '</div>';
    }).join('');
  }
  function bukaMenu() { var o = $('menu-win'); if (!o) { return; } renderSlotMenu(); o.classList.add('is-open'); o.setAttribute('aria-hidden', 'false'); document.body.classList.add('modal-open'); var b = $('menu-tutup'); if (b) { b.focus(); } }
  function tutupMenu() { var o = $('menu-win'); if (!o || !o.classList.contains('is-open')) { return; } o.classList.remove('is-open'); o.setAttribute('aria-hidden', 'true'); document.body.classList.remove('modal-open'); var b = $('btn-menu'); if (b) { b.focus(); } }
  if ($('btn-menu')) {
    $('btn-menu').addEventListener('click', bukaMenu);
    $('menu-tutup').addEventListener('click', tutupMenu);
    $('menu-win').addEventListener('click', function (ev) {
      if (ev.target === $('menu-win')) { tutupMenu(); return; }
      var t = ev.target.closest ? ev.target.closest('button') : null; if (!t) { return; }
      if (t.id === 'btn-menu-utama') { W.location.assign(INDEX_URL); return; }
      if (t.hasAttribute('data-slot-main')) { var r = SLT.aktifkan(parseInt(t.getAttribute('data-slot-main'), 10)); if (r.ok) { W.location.reload(); } else { toast(r.ralat || 'Gagal menukar watak.', 'ralat'); } return; }
      if (t.hasAttribute('data-slot-baharu')) { var r2 = SLT.aktifkan(parseInt(t.getAttribute('data-slot-baharu'), 10)); if (r2.ok) { W.location.assign(INDEX_URL + '#daftar'); } else { toast(r2.ralat || 'Gagal membuka slot.', 'ralat'); } return; }
    });
    $('menu-win').addEventListener('click', function (ev) {       // fasa tangkap: butang tema menghentikan perambatan klik
      var t = ev.target.closest ? ev.target.closest('button') : null;
      if (t && (t.id === 'btn-tema' || t.id === 'btn-struktur' || t.id === 'btn-simpan' || t.hasAttribute('data-perlembagaan'))) { setTimeout(tutupMenu, 0); }   // panel/modal masing-masing dibuka selepas tetingkap ditutup
    }, true);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { tutupMenu(); } });
  }
  if ($('btn-struktur')) { $('btn-struktur').addEventListener('click', paparStruktur); }
  if ($('btn-bersara')) { $('btn-bersara').addEventListener('click', bersaraAwal); }
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
    S.subscribe(jadualRender);
    if (LAT && LAT.aktif()) { LAT.init(); }                          // v7.13: mod Latihan Amir (simpanan berasingan)
    else if (TUT) {                                                  // butang (?) + tutorial kali pertama
      var mulaTut = function () { TUT.init({ profil: p }); };
      if (!(LAT && !TUT.sudahSelesai(p) && LAT.tawar({ profil: p, lepas: mulaTut }))) { mulaTut(); }
    }
    if (EV && EV.getTertunggak()) { tunjukAcara(EV.getTertunggak()); }          // acara yang belum dijawab sebelum muat semula                                      // kemas kini masa nyata (juga antara tab pelayar)
  }
  W.NusaUI = { modal: modal, toast: toast, render: render, esc: esc, fmt: fmt, lapor: urusPeristiwa };   // v7.3: dikongsi dengan js/pru-ui.js
  mula();
})();
