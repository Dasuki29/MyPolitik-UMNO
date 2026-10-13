/* ==========================================================================
   Nusa Politik — js/slotpanel.js   (v5.4)
   Panel "Simpanan Permainan" pada menu utama (index.html). Sambungan kepada slot.js.
   Elemen dengan [data-slot-panel] membuka panel. CSS disuntik sendiri.
   ========================================================================== */
(function () {
  'use strict';
  var Sl = window.MyPolitikSlot, AV = window.MyPolitikAvatar;
  if (!Sl) { return; }

  var css = '.slp{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.72)}' +
    '.slp[hidden]{display:none}.slp__kad{width:100%;max-width:520px;max-height:90vh;overflow:auto;background:var(--bg-elev-1,#16181E);border:1px solid var(--border,#2E333F);border-radius:16px;padding:18px;color:var(--text,#F4F5F7)}' +
    '.slp__kepala{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}.slp__kepala h2{margin:0;font-size:1.15rem}' +
    '.slp__x{background:none;border:0;color:inherit;font-size:1.4rem;cursor:pointer;padding:4px 8px}.slp__nota{margin:0 0 12px;font-size:.85rem;color:var(--text-muted,#A3A9B8)}' +
    '.slp__senarai{list-style:none;margin:0;padding:0;display:grid;gap:10px}.slp__item{display:flex;gap:12px;align-items:center;padding:10px;border:1px solid var(--border,#2E333F);border-radius:12px;background:var(--bg-elev-2,#1D2028)}' +
    '.slp__item.is-aktif{border-color:var(--gold,#F2B705)}.slp__av{flex:none;width:48px;height:48px}.slp__av svg{width:48px;height:48px}' +
    '.slp__no{flex:none;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--text-dim,#717789);border:1px dashed var(--border,#2E333F)}' +
    '.slp__info{flex:1;min-width:0}.slp__info b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.slp__info small{display:block;color:var(--text-muted,#A3A9B8)}' +
    '.slp__tag{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:99px;font-size:.68rem;background:var(--gold,#F2B705);color:#111;vertical-align:middle}' +
    '.slp__btn{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.slp__btn button{font:inherit;font-size:.8rem;padding:6px 10px;border-radius:8px;border:1px solid var(--border,#2E333F);background:var(--bg-elev-3,#262A34);color:inherit;cursor:pointer}' +
    '.slp__btn .is-utama{background:var(--gold,#F2B705);color:#111;border-color:transparent;font-weight:700}.slp__btn .is-bahaya{color:#FF8A95}' +
    '@media(max-width:420px){.slp__item{flex-wrap:wrap}.slp__btn{width:100%;justify-content:flex-start}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var panel = document.createElement('div');
  panel.className = 'slp'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'slp-tajuk');
  panel.innerHTML = '<div class="slp__kad"><div class="slp__kepala"><h2 id="slp-tajuk">Simpanan Permainan</h2><button type="button" class="slp__x" data-slp="tutup" aria-label="Tutup">×</button></div>' +
    '<p class="slp__nota" id="slp-nota">Pilih watak untuk diteruskan, atau mulakan watak baharu dalam slot kosong. Simpanan disimpan dalam pelayar ini sahaja.</p><ul class="slp__senarai" id="slp-senarai"></ul></div>';
  document.body.appendChild(panel);

  function esc(t) { return String(t === undefined || t === null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function lukis(nota) {
    document.getElementById('slp-nota').textContent = nota || 'Pilih watak untuk diteruskan, atau mulakan watak baharu dalam slot kosong. Simpanan disimpan dalam pelayar ini sahaja.';
    document.getElementById('slp-senarai').innerHTML = Sl.senarai().map(function (x) {
      var r = x.ringkas, tag = x.aktif ? '<span class="slp__tag">Dimainkan</span>' : '';
      if (!r) {
        return '<li class="slp__item' + (x.aktif ? ' is-aktif' : '') + '"><div class="slp__no">' + x.no + '</div><div class="slp__info"><b>Slot ' + x.no + ' (kosong)' + tag + '</b><small>Belum ada watak</small></div>' +
          '<div class="slp__btn"><button type="button" class="is-utama" data-slp="baharu" data-no="' + x.no + '">Watak baharu</button></div></li>';
      }
      var av = AV ? AV.svg(r.avatar, { saiz: 48 }) : '';
      var butiran = [r.kategori, r.umur !== null ? r.umur + ' tahun' : '', r.tahun + ', bulan ' + r.bulan].filter(Boolean).join(' · ');
      return '<li class="slp__item' + (x.aktif ? ' is-aktif' : '') + '"><div class="slp__av">' + av + '</div><div class="slp__info"><b>' + esc(r.nama) + tag + '</b><small>' + esc(r.tamat ? 'Kerjaya tamat · ' + r.jawatan : r.jawatan) + '</small><small>' + esc(butiran) + '</small></div>' +
        '<div class="slp__btn"><button type="button" class="is-utama" data-slp="main" data-no="' + x.no + '">' + (r.tamat ? 'Lihat rumusan' : 'Main') + '</button><button type="button" class="is-bahaya" data-slp="padam" data-no="' + x.no + '">Padam</button></div></li>';
    }).join('');
  }

  function buka(nota) { lukis(nota); panel.hidden = false; var b = panel.querySelector('button.is-utama') || panel.querySelector('.slp__x'); if (b) { b.focus(); } }
  function tutup() { panel.hidden = true; }

  function keBorang() { try { history.replaceState(null, '', location.pathname + '#daftar'); } catch (e) { /* abaikan */ } location.reload(); }

  panel.addEventListener('click', function (e) {
    if (e.target === panel) { tutup(); return; }
    var b = e.target.closest ? e.target.closest('[data-slp]') : null; if (!b) { return; }
    var a = b.getAttribute('data-slp'), n = parseInt(b.getAttribute('data-no'), 10), r;
    if (a === 'tutup') { tutup(); }
    else if (a === 'main') { r = Sl.aktifkan(n); if (r.ok) { location.assign('dashboard.html'); } else { lukis(r.ralat); } }
    else if (a === 'baharu') { r = Sl.aktifkan(n); if (r.ok) { keBorang(); } else { lukis(r.ralat); } }
    else if (a === 'padam') {
      var ri = Sl.ringkasan(n);
      if (window.confirm('Padam watak "' + (ri ? ri.nama : 'slot ' + n) + '" di slot ' + n + '? Tindakan ini tidak boleh dibatalkan.')) { Sl.padam(n); lukis('Slot ' + n + ' telah dipadam.'); }
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { tutup(); } });
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-slot-panel]') : null;
    if (t) { e.preventDefault(); buka(); }
  });

  window.MyPolitikSlotPanel = { buka: buka, tutup: tutup };
})();
