/* ==========================================================================
   Nusa Politik — js/tema.js   (v7.0)
   Mod paparan Dashboard: Cerah / Gelap / Auto (ikut tetapan peranti).
   Gaya tunggal "Poster Berani" (css/tema.css). Pilihan disimpan dalam
   localStorage (kunci nusa_mod) — tiada kesan pada profil permainan.
   Dimuatkan dalam <head> supaya tiada kelipan.
   ========================================================================== */
(function (root) {
  'use strict';
  var KUNCI = 'nusa_mod';
  var MOD = [
    { id: 'cerah', nama: 'Cerah', ikon: '☀️', ket: 'Kuning terang, paling ceria' },
    { id: 'gelap', nama: 'Gelap', ikon: '🌙', ket: 'Hitam pekat, garis kuning' },
    { id: 'auto',  nama: 'Auto',  ikon: '🌗', ket: 'Ikut tetapan peranti anda' }
  ];
  var LALAI = 'cerah';
  var doc = root.document;

  function baca() { try { return root.localStorage.getItem(KUNCI); } catch (e) { return null; } }
  function simpan(v) { try { root.localStorage.setItem(KUNCI, v); } catch (e) { /* abaikan */ } }
  function sah(v) { return MOD.some(function (m) { return m.id === v; }) ? v : LALAI; }
  function cari(v) { for (var i = 0; i < MOD.length; i++) { if (MOD[i].id === v) { return MOD[i]; } } return MOD[0]; }
  function gelapPeranti() { try { return !!(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) { return false; } }

  var mod = sah(baca());

  function terap() {
    var skema = mod === 'auto' ? (gelapPeranti() ? 'gelap' : 'cerah') : mod;
    var h = doc.documentElement;
    h.setAttribute('data-tema', 'poster');
    h.setAttribute('data-skema', skema);
    var m = doc.querySelector('meta[name="theme-color"]');
    if (m) { m.setAttribute('content', skema === 'gelap' ? '#15151B' : '#FFE45C'); }
    return skema;
  }
  function tetapkan(v) { mod = sah(v); simpan(mod); terap(); kemaskini(); return mod; }

  function kemaskini() {
    var b = doc.getElementById('btn-tema');
    if (b) {
      var t = cari(mod);
      b.innerHTML = t.ikon + '<span class="tema-teks"> ' + t.nama + '</span>';
      b.setAttribute('title', 'Paparan: ' + t.nama);
      b.setAttribute('aria-label', 'Tetapan paparan. Sekarang: ' + t.nama);
    }
    var p = doc.getElementById('paparan-pop');
    if (p) {
      var r = p.querySelectorAll('input[name=mod-paparan]');
      for (var i = 0; i < r.length; i++) { r[i].checked = (r[i].value === mod); }
    }
  }

  function bina() {
    var b = doc.getElementById('btn-tema');
    if (!b || doc.getElementById('paparan-pop')) { return; }
    var p = doc.createElement('div');
    p.id = 'paparan-pop'; p.className = 'card paparan-pop'; p.hidden = true;
    p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Tetapan paparan');
    var h = '<h3>Paparan</h3><div class="pilih">';
    MOD.forEach(function (m) {
      h += '<label><input type="radio" name="mod-paparan" value="' + m.id + '"><span>' + m.ikon + ' ' + m.nama +
        '<small>' + m.ket + '</small></span></label>';
    });
    p.innerHTML = h + '</div>';
    doc.body.appendChild(p);
    p.addEventListener('change', function (e) { if (e.target && e.target.name === 'mod-paparan') { tetapkan(e.target.value); } });
    b.setAttribute('aria-haspopup', 'dialog');
    b.addEventListener('click', function (e) { e.stopPropagation(); p.hidden = !p.hidden; });
    doc.addEventListener('click', function (e) { if (!p.hidden && !p.contains(e.target)) { p.hidden = true; } });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') { p.hidden = true; } });
    kemaskini();
  }

  terap();
  try {
    var mq = root.matchMedia('(prefers-color-scheme: dark)');
    var ubah = function () { if (mod === 'auto') { terap(); } };
    if (mq.addEventListener) { mq.addEventListener('change', ubah); } else if (mq.addListener) { mq.addListener(ubah); }
  } catch (e) { /* abaikan */ }

  root.MyPolitikTema = { MOD: MOD, tetapkan: tetapkan, semasa: function () { return mod; },
    skema: function () { return doc.documentElement.getAttribute('data-skema'); } };

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', bina); } else { bina(); }
})(typeof window !== 'undefined' ? window : this);
