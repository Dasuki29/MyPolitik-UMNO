/* ==========================================================================
   Nusa Politik — js/lagu.js (v3.5)
   Kad "Lagu Rasmi & Pemain Audio": Spotify Embed dimuat secara malas (lazy)
   hanya apabila kad dibuka, supaya halaman kekal pantas.
   - index.html: kad dalam lajur sisi; butang tajuk membuka/menutup.
   - dashboard.html: butang "Lagu" di header membuka panel terapung.
   Pilihan kad (buka/tutup) diingati dalam localStorage (try/catch).
   ========================================================================== */
(function () {
  'use strict';
  var KEY = 'nusaPolitik_lagu';
  function $(id) { return document.getElementById(id); }
  var kad = $('kad-lagu'), badan = $('lagu-badan'), tog = $('lagu-tog'), btn = $('btn-lagu');
  if (!kad || !badan) { return; }
  var pop = kad.classList.contains('lagu-pop');

  function pasang() {
    if (badan.firstChild) { return; }
    var f = document.createElement('iframe');
    f.setAttribute('data-testid', 'embed-iframe');
    f.title = 'Pemain Spotify: lagu rasmi';
    f.style.borderRadius = '12px';
    f.width = '100%'; f.height = '152'; f.frameBorder = '0'; f.setAttribute('allowfullscreen', '');
    f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    f.loading = 'lazy';
    f.src = 'https://open.spotify.com/embed/track/' + badan.getAttribute('data-spotify') +
            '?utm_source=generator&si=b9deab84a28f4295';
    badan.appendChild(f);
  }
  function set(buka) {
    kad.classList.toggle('is-buka', buka);
    if (pop) { kad.hidden = !buka; if (btn) { btn.setAttribute('aria-expanded', String(buka)); } }
    else { badan.hidden = !buka; if (tog) { tog.setAttribute('aria-expanded', String(buka)); } }
    if (pop) { badan.hidden = false; }
    if (buka) { pasang(); }
    try { localStorage.setItem(KEY, buka ? '1' : '0'); } catch (e) { /* abaikan */ }
  }
  function kini() { return kad.classList.contains('is-buka'); }
  var simpan = null; try { simpan = localStorage.getItem(KEY); } catch (e) { /* abaikan */ }

  if (pop) {
    btn.addEventListener('click', function () { set(!kini()); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && kini()) { set(false); btn.focus(); } });
    // Dashboard: panel ditutup secara lalai; muzik tidak dimuat sehingga diminta.
  } else {
    tog.addEventListener('click', function () { set(!kini()); });
    set(simpan !== '0');   // halaman pendaftaran: terbuka melainkan pernah ditutup
  }
})();
