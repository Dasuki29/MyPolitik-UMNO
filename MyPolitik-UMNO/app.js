/* ==========================================================================
   MyPolitik: UMNO — js/app.js
   Borang pendaftaran di index.html:
   - muat data Google Sheets (js/data.js)
   - dropdown 4 peringkat: Negeri > Bahagian (Parlimen) > DUN > Cawangan (Lokaliti)
   - simpan profil pemain (js/save.js) dan beralih ke dashboard.html

   URL Google Sheets ditetapkan dalam index.html:
     window.MYPOLITIK_CONFIG = { sheetCsvUrl: 'https://docs.google.com/.../pub?output=csv' };
   ========================================================================== */
(function () {
  'use strict';

  var D = window.MyPolitikData, S = window.MyPolitikSave;
  var CFG = window.MYPOLITIK_CONFIG || {};
  var DASHBOARD_URL = CFG.dashboardUrl || 'dashboard.html';

  function $(id) { return document.getElementById(id); }
  function fmt(n) { return Number(n || 0).toLocaleString('ms-MY'); }

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
    $('i-lelaki').textContent = fmt(c.lelaki);
    $('i-perempuan').textContent = fmt(c.perempuan);
    $('i-bawah40').textContent = fmt(c.bawah40);
    $('i-atas40').textContent = fmt(c.atas40);
    $('i-kod').textContent = c.id;
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