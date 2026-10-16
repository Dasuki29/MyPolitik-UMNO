/* ==========================================================================
   Nusa Politik — js/paparan.js   (v7.26)  Visual & Scannability Upgrade
     1. Toast impak (kanan bawah): chip warna IP / MYR / AP / Reputasi / Stress / Sokongan. Dijana automatik daripada
        perubahan profil (S.subscribe), jadi semua tindakan tertangkap tanpa mengubah setiap fungsi. Perubahan berturutan
        dalam 0.4 saat digabung. toast(teks, jenis) lama masih berfungsi (mesej biasa).
     2. Log Aktiviti: butang loceng + drawer sisi; sumber data = p.log sedia ada (50 entri terakhir), tiada storan baharu.
     3. Kad Kerusi Parlimen / DUN (Kerajaan, Pembangkang, Bebas) dan Sentimen Pengundi (bar progres, langsung semasa kempen).
   Andaian: jumlah kerusi ialah ANGGARAN PERMAINAN daripada reputasi parti (paparan sahaja, tiada kesan pada keputusan
   permainan). Jika p.pru.nasional wujud (keputusan nasional Presiden), angkanya digunakan semula.
   Perlu dimuatkan SELEPAS js/save.js dan SEBELUM js/app.js.
   ========================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.NusaPaparan = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  var CONFIG = { JUMLAH_PARLIMEN: 222, MAJORITI: 112, GABUNG_MS: 400, MAKS_TOAST: 3, MAKS_BIASA: 4, TOAST_MS: 4000, BEBAS_MAKS: 8, KUNCI_LIHAT: 'myPolitik_logLihat', KUNCI_SENYAP: 'myPolitik_notifSenyap' };
  var BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  var DUN_NEGERI = { perlis: 15, kedah: 36, kelantan: 45, terengganu: 32, 'pulau pinang': 40, perak: 59, pahang: 42, selangor: 56, 'negeri sembilan': 36, melaka: 28, johor: 56, sabah: 73, sarawak: 82 };   // bilangan kerusi DUN dipilih (anggaran)

  function S() { return root.MyPolitikSave || null; }
  function dok() { return root.document || null; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function fmt(n) { return Math.abs(Number(n) || 0).toLocaleString('ms-MY'); }
  function tanda(n) { return n > 0 ? '+' : '−'; }

  /* ------------------------------------------------------------------------
     1. CHIP IMPAK (dikongsi oleh toast dan log)
     ------------------------------------------------------------------------ */
  /** perubahan: { ip, myr, ap, reputasi, stress, kesetiaan:{k:n} } -> [{ teks, kelas }] (kelas: g baik, r buruk, o amaran) */
  function chipDaripada(pb) {
    var c = [], lbl = (S() && S().KESETIAAN_LABEL) || {};
    function tambah(n, nama, baik, unit, pra) {
      if (!n) { return; }
      var teks = nama + ' ' + (pra ? pra + ' ' : '') + tanda(n) + (pra ? '' : '') + fmt(n) + (unit || '');
      c.push({ teks: pra ? nama + ' ' + tanda(n) + pra + ' ' + fmt(n) : teks, kelas: baik ? 'g' : 'r' });
    }
    if (pb.ip) { c.push({ teks: 'IP ' + tanda(pb.ip) + fmt(pb.ip), kelas: pb.ip > 0 ? 'g' : 'r' }); }
    if (pb.myr) { c.push({ teks: 'MYR ' + tanda(pb.myr) + fmt(pb.myr), kelas: pb.myr > 0 ? 'g' : 'r' }); }
    if (pb.ap) { c.push({ teks: 'AP ' + tanda(pb.ap) + fmt(pb.ap), kelas: pb.ap > 0 ? 'g' : 'r' }); }
    if (pb.reputasi) { c.push({ teks: 'Reputasi ' + tanda(pb.reputasi) + fmt(pb.reputasi), kelas: pb.reputasi > 0 ? 'g' : 'r' }); }
    if (pb.stress) { c.push({ teks: 'Stress ' + tanda(pb.stress) + fmt(pb.stress) + '%', kelas: pb.stress > 0 ? 'o' : 'g' }); }
    Object.keys(pb.kesetiaan || {}).forEach(function (k) {
      var n = pb.kesetiaan[k]; if (!n) { return; }
      c.push({ teks: (lbl[k] || k) + ' ' + tanda(n) + fmt(n), kelas: n > 0 ? 'g' : 'r' });
    });
    return c;
  }
  function chipHtml(c) { return c.map(function (x) { return '<span class="pp-chip pp-chip--' + x.kelas + '">' + esc(x.teks) + '</span>'; }).join(''); }

  /* ------------------------------------------------------------------------
     2. TOAST
     ------------------------------------------------------------------------ */
  function bekas() { var d = dok(); return d ? d.getElementById('toasts') : null; }
  function buangToast(t) { if (t && t.parentNode) { t.parentNode.removeChild(t); } }
  /* Mod senyap: pilihan per peranti (localStorage). Mesej ralat tetap dipaparkan. */
  function senyap() { try { return root.localStorage.getItem(CONFIG.KUNCI_SENYAP) === '1'; } catch (e) { return false; } }
  function setSenyap(v) {
    try { root.localStorage.setItem(CONFIG.KUNCI_SENYAP, v ? '1' : '0'); } catch (e) { /* abaikan */ }
    var st = bekas();
    if (v && st) { Array.prototype.slice.call(st.querySelectorAll('.pp-toast:not(.toast--danger)')).forEach(buangToast); }
    kemaskiniLoceng();
  }
  function letak(t, ms) {
    var st = bekas(); if (!st) { return; }
    st.appendChild(t);
    var maks = t.classList.contains('pp-toast--impak') ? CONFIG.MAKS_TOAST : CONFIG.MAKS_BIASA;
    var semua = Array.prototype.filter.call(st.children, function (x) { return x.classList.contains('pp-toast--impak') === t.classList.contains('pp-toast--impak'); });
    while (semua.length > maks) { buangToast(semua.shift()); }
    var timer = setTimeout(function () { buangToast(t); }, ms);
    var bt = dok().createElement('div'); bt.className = 'pp-toast__bt';
    bt.innerHTML = '<button type="button" class="pp-toast__min" aria-label="Kecilkan notifikasi (senyap)" title="Kecilkan">\u2014</button><button type="button" class="pp-toast__x" aria-label="Tutup notifikasi" title="Tutup">\u2715</button>';
    t.appendChild(bt);
    t.addEventListener('click', function (ev) {
      clearTimeout(timer);
      if (ev.target.closest && ev.target.closest('.pp-toast__min')) { setSenyap(true); }
      buangToast(t);
    });
  }
  /** Mesej biasa (serasi dengan toast(teks, jenis) lama). */
  function toast(teks, jenis) {
    var d = dok(); if (!d || !bekas()) { return; }
    if (senyap() && jenis !== 'ralat') { kemaskiniLoceng(); return; }
    var t = d.createElement('div');
    t.className = 'toast pp-toast' + (jenis === 'ok' ? ' toast--success' : jenis === 'ralat' ? ' toast--danger' : '');
    t.setAttribute('role', jenis === 'ralat' ? 'alert' : 'status');
    t.textContent = teks;
    letak(t, jenis === 'ralat' ? 5500 : CONFIG.TOAST_MS - 500);
  }
  /** Toast impak: tajuk + chip warna. */
  function toastImpak(tajuk, chip) {
    var d = dok(); if (!d || !bekas() || !chip.length || senyap()) { return; }
    var t = d.createElement('div');
    t.className = 'toast pp-toast pp-toast--impak';
    t.setAttribute('role', 'status');
    t.innerHTML = '<b class="pp-toast__tajuk">' + esc(tajuk) + '</b><div class="pp-chips">' + chipHtml(chip) + '</div><i class="pp-toast__masa" style="animation-duration:' + CONFIG.TOAST_MS + 'ms"></i>';
    letak(t, CONFIG.TOAST_MS);
  }

  /* Gabungan perubahan: kumpul dalam GABUNG_MS, kemudian satu toast. */
  var tunggu = null, timerGabung = null, snap = null, aktif = false;
  function kosong() { return { ip: 0, myr: 0, ap: 0, reputasi: 0, stress: 0, kesetiaan: {}, tajuk: '' }; }
  function tajukDaripadaLog(p) {
    var e = p && p.log && p.log[0];
    return e && e.masa && (Date.now() - new Date(e.masa).getTime() < 3000) ? (e.nama || e.tindakan || '') : '';
  }
  function siram() {
    timerGabung = null;
    var t = tunggu; tunggu = null;
    if (!t) { return; }
    var chip = chipDaripada(t);
    if (chip.length) { toastImpak(t.tajuk || 'Kemas kini', chip); }
    kemaskiniLoceng();
  }
  function ambilPerubahan(p, meta) {
    if (!aktif || !p || !meta || !meta.perubahan) { snap = p ? { stress: Number(p.stress) || 0 } : snap; return; }
    var pb = meta.perubahan, t = tunggu || (tunggu = kosong());
    ['ip', 'myr', 'ap', 'reputasi'].forEach(function (k) { t[k] += Number(pb[k]) || 0; });
    Object.keys(pb.kesetiaan || {}).forEach(function (k) { t.kesetiaan[k] = (t.kesetiaan[k] || 0) + pb.kesetiaan[k]; });
    var st = Number(p.stress) || 0;
    if (snap) { t.stress += st - snap.stress; }
    snap = { stress: st };
    var tj = tajukDaripadaLog(p); if (tj) { t.tajuk = tj; }
    if (timerGabung) { clearTimeout(timerGabung); }
    timerGabung = setTimeout(siram, CONFIG.GABUNG_MS);
  }

  /* ------------------------------------------------------------------------
     3. LOG AKTIVITI (drawer)
     ------------------------------------------------------------------------ */
  var penapis = 'semua';
  var PENAPIS = [
    ['semua', 'Semua', function () { return true; }],
    ['ip', 'IP', function (e) { return !!(e.perubahan && e.perubahan.ip); }],
    ['dana', 'Dana', function (e) { return !!(e.perubahan && e.perubahan.myr); }],
    ['pilihanraya', 'Pilihan raya', function (e) { return /^(pru|prk)/.test(e.tindakan || ''); }],
    ['kabinet', 'Kabinet', function (e) { return /(kabinet|lobi|rombak|elaun_kerajaan|lantik)/.test(e.tindakan || ''); }]
  ];
  function lihatTerakhir() { try { return root.localStorage.getItem(CONFIG.KUNCI_LIHAT) || ''; } catch (e) { return ''; } }
  function tandaLihat() { try { root.localStorage.setItem(CONFIG.KUNCI_LIHAT, new Date().toISOString()); } catch (e) { /* abaikan */ } }
  function bilBaharu(p) {
    var l = lihatTerakhir(); if (!p || !p.log) { return 0; }
    return p.log.filter(function (e) { return e.masa > l; }).length;
  }
  function kemaskiniLoceng() {
    var d = dok(), b = d && d.getElementById('pp-loceng'); if (!b || !S()) { return; }
    var n = bilBaharu(S().loadPlayer()), em = b.querySelector('em'), sy = senyap();
    if (em) { em.textContent = n > 99 ? '99+' : String(n); em.hidden = !n; }
    b.classList.toggle('pp-pil--penuh', n > 0 || sy);                       // teks \"Notifikasi\" hanya bila ada yang belum dibaca atau mod senyap
    b.classList.toggle('pp-pil--senyap', sy);
  }
  function htmlLog(p) {
    var log = (p && p.log) || [], fn = PENAPIS.filter(function (x) { return x[0] === penapis; })[0][2];
    var senarai = log.filter(fn), out = '', bulanSemasa = '';
    out += '<div class="pp-tapis" role="group" aria-label="Tapis log">' + PENAPIS.map(function (x) { return '<button type="button" data-pp-tapis="' + x[0] + '" aria-pressed="' + (x[0] === penapis) + '" class="' + (x[0] === penapis ? 'on' : '') + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>';
    if (!senarai.length) { return out + '<p class="pp-kosong">Tiada aktiviti untuk penapis ini.</p>'; }
    senarai.forEach(function (e) {
      var label = (BULAN[(e.bulan || 1) - 1] || '') + ' ' + (e.tahun || '');
      if (label !== bulanSemasa) { bulanSemasa = label; out += '<span class="pp-bulan">' + esc(label.toUpperCase()) + '</span>'; }
      var chip = e.perubahan ? chipDaripada(e.perubahan) : [];
      out += '<div class="pp-log"><b>' + esc(e.nama || e.tindakan || 'Aktiviti') + '</b>' + (chip.length ? '<div class="pp-chips">' + chipHtml(chip) + '</div>' : '') + '</div>';
    });
    return out;
  }
  function renderDrawer() {
    var d = dok(), isi = d && d.getElementById('pp-drawer-isi'); if (!isi || !S()) { return; }
    isi.innerHTML = htmlLog(S().loadPlayer());
  }
  function bukaLog() {
    var d = dok(), dr = d && d.getElementById('pp-drawer'); if (!dr) { return; }
    renderDrawer(); dr.classList.add('is-open'); dr.setAttribute('aria-hidden', 'false');
    tandaLihat(); kemaskiniLoceng();
    var t = d.getElementById('pp-drawer-tutup'); if (t) { t.focus(); }
  }
  function tutupLog() {
    var d = dok(), dr = d && d.getElementById('pp-drawer'); if (!dr || !dr.classList.contains('is-open')) { return; }
    dr.classList.remove('is-open'); dr.setAttribute('aria-hidden', 'true');
    var b = d.getElementById('pp-loceng'); if (b) { b.focus(); }
  }
  function htmlPop(p) {
    var log = ((p && p.log) || []).filter(function (e) { return e.perubahan && chipDaripada(e.perubahan).length; }).slice(0, 4);
    var h = '<div class="pp-pop__kepala"><b>Notifikasi terkini</b></div>';
    if (!log.length) { h += '<p class="pp-kosong">Tiada notifikasi baharu.</p>'; }
    log.forEach(function (e) { h += '<div class="pp-pop__baris"><b>' + esc(e.nama || e.tindakan || 'Aktiviti') + '</b><div class="pp-chips">' + chipHtml(chipDaripada(e.perubahan)) + '</div></div>'; });
    h += '<div class="pp-pop__kaki"><button type="button" data-pp-lihat>Lihat semua \u203A Log Aktiviti</button><button type="button" data-pp-senyap aria-pressed="' + senyap() + '">' + (senyap() ? '\uD83D\uDD14 Aktifkan pop-up semula' : '\uD83D\uDD15 Senyapkan pop-up') + '</button></div>';
    return h;
  }
  function tutupPop(fokus) {
    var d = dok(), po = d && d.getElementById('pp-pop'); if (!po || po.hidden) { return; }
    po.hidden = true; var b = d.getElementById('pp-loceng'); if (b) { b.setAttribute('aria-expanded', 'false'); if (fokus) { b.focus(); } }
  }
  function togolPop() {
    var d = dok(), po = d && d.getElementById('pp-pop'), b = d && d.getElementById('pp-loceng'); if (!po || !S()) { return; }
    if (!po.hidden) { tutupPop(true); return; }
    po.innerHTML = htmlPop(S().loadPlayer()); po.hidden = false; b.setAttribute('aria-expanded', 'true');
    tandaLihat(); kemaskiniLoceng();
  }
  function pasangUI() {
    var d = dok(); if (!d || d.getElementById('pp-loceng')) { return; }
    var b = d.createElement('button');
    b.type = 'button'; b.id = 'pp-loceng'; b.className = 'pp-loceng'; b.setAttribute('aria-label', 'Notifikasi'); b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false');
    b.innerHTML = '<span aria-hidden="true">🔔</span><span class="pp-pil__t">Notifikasi</span><em hidden>0</em><span class="pp-pil__a" aria-hidden="true">\u25B4</span>';
    d.body.appendChild(b);
    var po = d.createElement('div'); po.id = 'pp-pop'; po.className = 'pp-pop'; po.hidden = true; po.setAttribute('role', 'region'); po.setAttribute('aria-label', 'Notifikasi terkini');
    d.body.appendChild(po);
    po.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('button') : null; if (!t) { return; }
      if (t.hasAttribute('data-pp-lihat')) { tutupPop(false); bukaLog(); }
      else if (t.hasAttribute('data-pp-senyap')) { setSenyap(!senyap()); po.innerHTML = htmlPop(S().loadPlayer()); }
    });
    d.addEventListener('click', function (ev) { if (!po.hidden && !po.contains(ev.target) && !b.contains(ev.target)) { tutupPop(false); } });
    var dr = d.createElement('div');
    dr.id = 'pp-drawer'; dr.className = 'pp-drawer'; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-modal', 'true'); dr.setAttribute('aria-hidden', 'true'); dr.setAttribute('aria-label', 'Log Aktiviti');
    dr.innerHTML = '<div class="pp-drawer__panel"><div class="pp-drawer__kepala"><h2>📜 Log Aktiviti <small>50 terakhir</small></h2><button type="button" id="pp-drawer-tutup" aria-label="Tutup">✕</button></div><div id="pp-drawer-isi" class="pp-drawer__isi"></div></div>';
    d.body.appendChild(dr);
    b.addEventListener('click', togolPop);
    dr.addEventListener('click', function (ev) {
      if (ev.target === dr || (ev.target.id === 'pp-drawer-tutup')) { tutupLog(); return; }
      var t = ev.target.closest ? ev.target.closest('[data-pp-tapis]') : null;
      if (t) { penapis = t.getAttribute('data-pp-tapis'); renderDrawer(); }
    });
    d.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { tutupLog(); tutupPop(true); } });
  }

  /* ------------------------------------------------------------------------
     4. KERUSI PARLIMEN / DUN
     ------------------------------------------------------------------------ */
  function hash(t) { var h = 7; t = String(t || ''); for (var i = 0; i < t.length; i++) { h = (h * 31 + t.charCodeAt(i)) >>> 0; } return h; }
  function negeriDUN(p) {
    var n = String(p.negeri || '').toLowerCase().replace(/^wp\s+/, 'wilayah ');
    if (/wilayah|kuala lumpur|putrajaya|labuan/.test(n)) { return 0; }
    return DUN_NEGERI[n] || 0;
  }
  /** Anggaran kerusi bagi satu pilihan raya (deterministik: benih = id + tahun/bulan rekod). */
  function anggarKerusi(p, rekod) {
    var N = p.pru && p.pru.nasional;
    var rng = S().rngBerbenih(hash((p.id || '') + '|' + rekod.tahun + '|' + rekod.bulan));
    var J = CONFIG.JUMLAH_PARLIMEN, parti, rakan, bebas = Math.round(rng() * CONFIG.BEBAS_MAKS);
    if (N && typeof N.parti === 'number' && typeof N.rakan === 'number' && N.tahun === rekod.tahun && N.bulan === rekod.bulan) { parti = N.parti; rakan = N.rakan; }
    else {
      var pop = clamp(45 + ((Number(p.reputasi) || 50) - 50) * 0.3 + (rng() * 12 - 6), 30, 70);
      parti = clamp(Math.round(J * (0.18 + (pop - 30) / 40 * 0.42) + (rng() * 16 - 8)), 30, 150);
      rakan = Math.min(J - parti, Math.round(J * (0.14 + rng() * 0.12)));
    }
    bebas = Math.min(bebas, J - parti - rakan);
    var lawan = J - parti - rakan - bebas, gabung = parti + rakan, kerajaan = gabung >= CONFIG.MAJORITI;
    var o = { tahun: rekod.tahun, bulan: rekod.bulan, parti: parti, rakan: rakan, pembangkang: lawan, bebas: bebas, kerajaan: kerajaan };
    var dun = negeriDUN(p);
    if (dun) {
      var skala = (kerajaan ? gabung : J - gabung) / J, nBebas = Math.round(rng() * 2);
      var kr = clamp(Math.round(dun * (kerajaan ? clamp(gabung / J + (rng() * 0.1 - 0.05), 0.3, 0.8) : clamp(gabung / J + (rng() * 0.1 - 0.05), 0.15, 0.6))), 1, dun - nBebas - 1);
      o.dun = { jumlah: dun, kerajaan: kr, bebas: nBebas, pembangkang: dun - kr - nBebas };
      void skala;
    }
    return o;
  }
  function kunciRekod(p) {
    var sj = p && p.pru && Array.isArray(p.pru.sejarah) ? p.pru.sejarah : [];
    return sj.length ? sj[sj.length - 1] : null;
  }
  /** Jana & simpan anggaran bagi PRU terakhir jika belum ada (idempotent). Pulang p.kerusiNasional atau null. */
  function kemaskiniKerusi(p) {
    if (!p || !S()) { return null; }
    var r = kunciRekod(p); if (!r) { return null; }
    var k = p.kerusiNasional;
    if (k && k.tahun === r.tahun && k.bulan === r.bulan) { return k; }
    var baru = anggarKerusi(p, r);
    var h = S().applyEffects({}, { kiraTindakan: false, patch: { kerusiNasional: baru } });
    return h && h.ok ? baru : null;
  }
  function bar(segmen, majoriti) {
    var jumlah = segmen.reduce(function (a, s) { return a + s.n; }, 0) || 1;
    return '<div class="pp-stack" role="img" aria-label="' + esc(segmen.map(function (s) { return s.nama + ' ' + s.n; }).join(', ')) + '">' +
      segmen.filter(function (s) { return s.n > 0; }).map(function (s) { return '<i style="width:' + (s.n / jumlah * 100).toFixed(2) + '%;background:' + s.warna + '">' + (s.n / jumlah > 0.09 ? esc((s.label !== undefined ? s.label : s.nama) + (s.label === '' ? '' : ' ' + s.n)) : '') + '</i>'; }).join('') +
      (majoriti ? '<span class="pp-maj" style="left:' + (majoriti / jumlah * 100).toFixed(2) + '%" title="Majoriti ' + majoriti + '"></span>' : '') + '</div>';
  }
  function legend(segmen) { return '<div class="pp-leg">' + segmen.map(function (s) { return '<span style="--c:' + s.warna + '">' + esc(s.nama) + ' ' + s.n + '</span>'; }).join('') + '</div>'; }
  /* v7.52: nama gabungan sebenar. Warna mengikut nama warna rasmi (BN biru diraja, PH merah, PN biru tua); hex ialah anggaran. */
  var GABUNGAN = {
    BN: { nama: 'Barisan Nasional', pendek: 'BN', warna: '#2D50B8' },
    PH: { nama: 'Pakatan Harapan', pendek: 'PH', warna: '#D7263D' },
    PN: { nama: 'Perikatan Nasional', pendek: 'PN', warna: '#0B2A5B' },
    LAIN: { nama: 'Bebas & lain-lain', pendek: 'Bebas', warna: '#7A808C' }
  };
  /** Pecah kerusi pembangkang kepada PH/PN (anggaran deterministik). Jika parti anda kalah, PH diberi bahagian lebih besar (gabungan pembangkang utama). */
  function pecahPembangkang(p, k, jumlah, kerajaan, kunci) {
    var rng = S().rngBerbenih(hash((p.id || '') + '|' + k.tahun + '|' + k.bulan + '|' + kunci)), r = kerajaan ? 0.4 + rng() * 0.3 : 0.6 + rng() * 0.25, ph = Math.round(jumlah * r);
    return { PH: ph, PN: jumlah - ph };
  }
  function segGabungan(n) {
    return ['BN', 'PH', 'PN', 'LAIN'].map(function (k) { return { nama: GABUNGAN[k].nama + (k === 'BN' ? ' (★ parti anda)' : ''), n: n[k], warna: GABUNGAN[k].warna, kod: k, label: k === 'LAIN' ? '' : GABUNGAN[k].pendek }; });
  }
  /** Selaras dengan permainan: BN membentuk kerajaan jika kerusinya mencapai ambang; jika tidak, pihak pembangkang membentuk kerajaan (diketuai PH atau PN yang lebih besar). */
  function ayatKerajaan(tajuk, n, ambang) {
    if (n.BN >= ambang) { return '<b>' + tajuk + ': ' + GABUNGAN.BN.nama + '</b> (' + n.BN + ' kerusi, majoriti ' + ambang + ').'; }
    var ketua = n.PH >= n.PN ? 'PH' : 'PN', lain = ketua === 'PH' ? 'PN' : 'PH', opp = n.PH + n.PN + n.LAIN;
    if (opp >= ambang) {
      return '<b>' + tajuk + ': gabungan pembangkang diketuai ' + GABUNGAN[ketua].nama + '</b> (' + GABUNGAN[ketua].pendek + ' ' + n[ketua] + ' + ' + GABUNGAN[lain].pendek + ' ' + n[lain] + ' + lain-lain ' + n.LAIN + ' = ' + opp + ' kerusi, majoriti ' + ambang + '). ' +
        GABUNGAN.BN.nama + ' menjadi pembangkang (' + n.BN + ' kerusi).';
    }
    return '<b>Tiada majoriti</b> (perlu ' + ambang + '): ' + GABUNGAN.BN.pendek + ' ' + n.BN + ', ' + GABUNGAN.PH.pendek + ' ' + n.PH + ', ' + GABUNGAN.PN.pendek + ' ' + n.PN + '. Kerajaan minoriti atau gabungan baharu perlu dibentuk.';
  }
  function htmlKerusi(p) {
    var k = p.kerusiNasional, r = kunciRekod(p);
    if (!k || !r) { return '<p class="pp-nota">Belum ada keputusan PRU. Anggaran kerusi muncul selepas pilihan raya pertama.</p>'; }
    var gabung = k.parti + k.rakan, pp = pecahPembangkang(p, k, k.pembangkang, k.kerajaan, 'parlimen');
    var np = { BN: gabung, PH: pp.PH, PN: pp.PN, LAIN: k.bebas }, seg = segGabungan(np);
    var h = '<h4>Kerusi Parlimen <small>PRU ' + esc(k.tahun) + ' · anggaran</small></h4>' + bar(seg, CONFIG.MAJORITI) + legend(seg) +
      '<p class="pp-nota">' + ayatKerajaan('Kerajaan persekutuan', np, CONFIG.MAJORITI) + ' Garis putus = majoriti.</p>';
    if (k.dun) {
      var amb = Math.floor(k.dun.jumlah / 2) + 1, pd = pecahPembangkang(p, k, k.dun.pembangkang, k.dun.kerajaan >= amb, 'dun'), nd = { BN: k.dun.kerajaan, PH: pd.PH, PN: pd.PN, LAIN: k.dun.bebas }, sd = segGabungan(nd);
      h += '<h4 class="pp-sub">Kerusi DUN <small>' + esc(p.negeri) + ' · ' + k.dun.jumlah + ' kerusi · anggaran</small></h4>' + bar(sd, amb) + legend(sd) +
        '<p class="pp-nota">' + ayatKerajaan('Kerajaan negeri', nd, amb) + '</p>';
    }
    return h;
  }

  /* ------------------------------------------------------------------------
     5. SENTIMEN PENGUNDI (bar progres)
     ------------------------------------------------------------------------ */
  function pb(nama, nilai, warna) {
    var n = clamp(Math.round(Number(nilai) || 0), 0, 100);
    return '<div class="pp-pb"><div class="pp-pb__t"><span>' + esc(nama) + '</span><b>' + n + '%</b></div><div class="pp-pb__b" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + n + '" aria-label="' + esc(nama) + '"><i style="width:' + n + '%;background:' + warna + '"></i></div></div>';
  }
  function htmlSentimen(p) {
    var PR = root.MyPolitikPRU, a = p.pru && p.pru.aktif;
    if (PR && a && a.fasa === 'kempen' && a.candidateType && a.candidateType !== 'NONE') {
      var h;
      try { h = PR.hitungKeputusan(p, a, { rng: function () { return 0.5; } }); } catch (e) { h = null; }
      if (h && h.pecah) {
        var seg = h.pecah.map(function (x) { return { nama: x.ke === 'anda' ? 'Anda' : x.ke === 'rakan' ? 'Rakan' : 'Lawan', n: x.nilai, warna: x.ke === 'anda' ? '#C8102E' : x.ke === 'rakan' ? '#2B6CB0' : '#555B66' }; });
        return '<h4>Sentimen Kempen <small>PRU <span class="pp-live">LANGSUNG</span></small></h4>' + bar(seg, 0) + legend(seg) +
          '<p class="pp-nota">Hari ' + (a.hari || 0) + '/' + ((a.hari || 0) + (a.campaignDaysLeft || 0)) + ' · anggaran semasa, berubah selepas setiap tindakan kempen.</p>';
      }
    }
    var kes = p.kesetiaan || {}, kab = p.kabinet || {};
    var pop = kab.hasGovernmentRole ? kab.popularitiNasional : 45 + ((Number(p.reputasi) || 50) - 50) * 0.3;
    return '<h4>Sentimen Pengundi <small>fasa biasa</small></h4>' + pb('Sokongan akar umbi', kes.akarUmbi, '#C8102E') + pb('Sokongan AJK', kes.ajk, '#2B6CB0') + pb('Populariti parti', pop, '#14994F');
  }

  /* ------------------------------------------------------------------------
     6. RENDER & MULA
     ------------------------------------------------------------------------ */
  function render(p) {
    var d = dok(); if (!d || !p || !S()) { return; }
    var k = d.getElementById('pp-kerusi'), s = d.getElementById('pp-sentimen');
    try { p = kemaskiniKerusi(p) ? S().loadPlayer() : p; } catch (e) { /* paparan tidak kritikal */ }
    if (k) { k.innerHTML = htmlKerusi(p); }
    if (s) { s.innerHTML = htmlSentimen(p); }
    kemaskiniLoceng();
  }
  function mula() {
    var d = dok(); if (!d || !S()) { return; }
    pasangUI();
    var p = S().loadPlayer(); snap = p ? { stress: Number(p.stress) || 0 } : null;
    S().subscribe(ambilPerubahan);
    aktif = true;
    kemaskiniLoceng();
  }
  if (dok()) { if (dok().readyState === 'loading') { dok().addEventListener('DOMContentLoaded', function () { try { mula(); } catch (e) { /* abaikan */ } }); } else { try { mula(); } catch (e) { /* abaikan */ } } }

  return { CONFIG: CONFIG, toast: toast, toastImpak: toastImpak, chipDaripada: chipDaripada, render: render, anggarKerusi: anggarKerusi, kemaskiniKerusi: kemaskiniKerusi, htmlKerusi: htmlKerusi, htmlSentimen: htmlSentimen, bukaLog: bukaLog, tutupLog: tutupLog, senyap: senyap, setSenyap: setSenyap, mula: mula };
});
