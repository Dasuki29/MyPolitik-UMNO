/* ==========================================================================
   Nusa Politik — js/menu.js   (v4.0)
   Menu utama pada index.html. Hanya mengawal paparan: butang Sambung membuka
   dashboard.html, Permainan Baharu memaparkan borang pendaftaran sedia ada.
   Tiada logik permainan diubah. Perlu dimuatkan selepas js/save.js dan js/app.js.
   ========================================================================== */
(function () {
  'use strict';
  var menu = document.getElementById('menu');
  if (!menu) { return; }

  var S = window.MyPolitikSave, body = document.body;
  var btnSambung = document.getElementById('menu-sambung'), info = document.getElementById('menu-sambung-info');
  var btnKembali = document.getElementById('btn-menu'), bantuan = document.getElementById('menu-bantuan');

  function tunjukMenu() {
    menu.hidden = false; body.classList.add('menu-aktif');
    if (btnKembali) { btnKembali.hidden = true; }
    try { if (location.hash) { history.replaceState(null, '', location.pathname + location.search); } } catch (e) { /* abaikan */ }
    segerak();
    menu.scrollTop = 0;
  }

  function tunjukBorang(sasaran) {
    menu.hidden = true; body.classList.remove('menu-aktif');
    if (btnKembali) { btnKembali.hidden = false; }
    try { history.replaceState(null, '', location.pathname + location.search + '#daftar'); } catch (e) { /* abaikan */ }
    var el = sasaran ? document.getElementById(sasaran) : document.getElementById('nama') || document.getElementById('f-nama');
    if (el) {
      if (sasaran) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      else { window.scrollTo(0, 0); }
    }
  }

  /** Papar butang Sambung hanya jika ada permainan disimpan. */
  function segerak() {
    var p = null;
    try { p = S && S.loadPlayer ? S.loadPlayer() : null; } catch (e) { p = null; }
    if (!btnSambung) { return; }
    btnSambung.hidden = !p;
    if (p && info) {
      info.textContent = p.nama + ' · ' + p.jawatan + ' · Cawangan ' + p.cawangan + ' · ' + p.tahun + ', bulan ' + (p.bulan || 1);
    }
  }

  menu.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-menu]') : null;
    if (!b) { return; }
    var a = b.getAttribute('data-menu');
    if (a === 'sambung') { window.location.assign('dashboard.html'); }
    else if (a === 'baharu') { tunjukBorang(); }
    else if (a === 'lagu') { tunjukBorang('kad-lagu'); }
    else if (a === 'bantuan' && bantuan) {
      bantuan.hidden = !bantuan.hidden;
      b.setAttribute('aria-expanded', String(!bantuan.hidden));
    }
  });

  if (btnKembali) { btnKembali.addEventListener('click', tunjukMenu); }

  // Pautan terus ke borang (#daftar) melangkau menu
  if (location.hash === '#daftar') { tunjukBorang(); } else { tunjukMenu(); }
})();
