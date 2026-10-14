/* ==========================================================================
   Nusa Politik — js/kopi.js   (v7.1)
   Tetingkap "Belanja Kopi": paparan terus DuitNow QR sokongan pembangun.
   Dicetuskan oleh mana-mana elemen [data-kopi]. Sukarela; tiada kesan pada
   permainan. Tiada skrip luar, tiada data dikumpul.
   ========================================================================== */
(function (root) {
  'use strict';
  var doc = root.document;
  var QR = 'assets/images/duitnow-qr.png';
  var NAMA = 'DINIE DASUKI BIN ABDUL RASID';
  var el = null, pemicu = null;

  var CSS = '' +
    '.kopi{position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.6)}' +
    '.kopi[hidden]{display:none}' +
    '.kopi__kotak{position:relative;width:min(340px,100%);max-height:calc(100vh - 32px);overflow:auto;text-align:center;padding:18px 16px 16px;' +
    'background:var(--bg-elev-1,#fff);color:var(--text,#111);border:3px solid var(--garis,var(--border,#111));' +
    'border-radius:var(--radius,8px);box-shadow:8px 8px 0 var(--garis,rgba(0,0,0,.45))}' +
    '.kopi__kotak h2{margin:0 0 6px;font-size:1.15rem;text-transform:uppercase;font-weight:900;color:var(--white,inherit)}' +
    '.kopi__kotak p{margin:0 0 10px;font-size:.85rem;color:var(--text-muted,#444)}' +
    '.kopi__x{position:absolute;top:8px;right:8px;width:30px;height:30px;line-height:1;font-size:1.1rem;font-weight:900;cursor:pointer;' +
    'color:inherit;background:var(--bg-elev-2,#fff);border:2px solid var(--garis,var(--border,#111));border-radius:6px}' +
    '.kopi__qr{display:block;width:100%;max-width:260px;height:auto;margin:6px auto 8px;background:#fff;border:3px solid var(--garis,#111);border-radius:6px}' +
    '.kopi__nota{font-size:.75rem;color:var(--text-dim,#666)}' +
    '.kopi__tutup{display:block;width:100%;margin-top:12px;padding:10px;font:inherit;font-weight:800;cursor:pointer;color:#111;' +
    'background:var(--gold,#F2B705);border:2px solid var(--garis,#111);border-radius:6px;box-shadow:3px 3px 0 var(--garis,#111)}';

  function bina() {
    if (el) { return el; }
    var s = doc.createElement('style'); s.textContent = CSS; doc.head.appendChild(s);
    el = doc.createElement('div');
    el.className = 'kopi'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'kopi-tajuk');
    el.innerHTML =
      '<div class="kopi__kotak">' +
      '<button type="button" class="kopi__x" aria-label="Tutup" data-kopi-tutup>&times;</button>' +
      '<h2 id="kopi-tajuk">☕ Belanja Kopi</h2>' +
      '<p>Terima kasih sudi menyokong! Imbas dengan app bank atau e-dompet anda.</p>' +
      '<img class="kopi__qr" src="' + QR + '" alt="Kod QR DuitNow (Malaysia National QR) untuk ' + NAMA + '" width="443" height="534">' +
      '<div class="kopi__nota">Sukarela. Tiada kelebihan dalam permainan.</div>' +
      '<button type="button" class="kopi__tutup" data-kopi-tutup>Tutup</button>' +
      '</div>';
    doc.body.appendChild(el);
    el.addEventListener('click', function (e) {
      if (e.target === el || (e.target.closest && e.target.closest('[data-kopi-tutup]'))) { tutup(); }
    });
    return el;
  }
  function buka(dari) {
    bina(); pemicu = dari || null; el.hidden = false;
    var b = el.querySelector('.kopi__tutup'); if (b) { b.focus(); }
    try { if (root.goatcounter && root.goatcounter.count) { root.goatcounter.count({ path: 'acara/kopi-buka', title: 'kopi-buka', event: true }); } } catch (e) { /* abaikan */ }
  }
  function tutup() { if (el) { el.hidden = true; } if (pemicu && pemicu.focus) { try { pemicu.focus(); } catch (e) { /* abaikan */ } } pemicu = null; }

  doc.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-kopi]') : null;
    if (t) { e.preventDefault(); buka(t); }
  });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && el && !el.hidden) { tutup(); } });
  root.MyPolitikKopi = { buka: buka, tutup: tutup };
})(typeof window !== 'undefined' ? window : this);
