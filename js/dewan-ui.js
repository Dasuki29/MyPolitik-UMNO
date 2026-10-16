/* ==========================================================================
   Nusa Politik — js/dewan-ui.js   (v7.55)
   UI tab Dewan Rakyat (js/dewan.js): kerusi mengikut gabungan, bentang RUU/Bajet, lobi MP, undian,
   Usul Undi Tidak Percaya (3 hari) dan Soal Jawab Lisan.
   Bergantung pada W.NusaUI (modal, toast, render, esc, fmt) daripada js/app.js.
   ========================================================================== */
(function (W) {
  'use strict';
  var D0 = W.MyPolitikDewan, N = W.MyPolitikDUN, S = W.MyPolitikSave, D = D0;
  if (!D0 || !S) { return; }
  /** Pilih enjin: Dewan Rakyat (MP/Menteri) atau DUN (ADUN/EXCO); API kedua-duanya sama. */
  var pilihan = 'RAKYAT';      // dewan yang dipapar apabila pemain memegang dua kerusi (Parlimen + DUN)
  function kedua(p) { return !!(N && D0.aktif(p) && N.aktif(p)); }
  /** Jika dua dewan aktif, papar dewan yang ada soalan/usul menunggu. */
  function utamakan(p, fn) { if (kedua(p)) { var m = [D0, N].filter(function (x) { return x.aktif(p) && x[fn](p); })[0]; if (m) { pilihan = m === N ? 'DUN' : 'RAKYAT'; } } }
  function pilih(p) { D = D0.aktif(p) && !(kedua(p) && pilihan === 'DUN') ? D0 : (N && N.aktif(p) ? N : D0); return D; }
  var BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  var WARNA = { BN: '#2D50B8', PH: '#D7263D', PN: '#0B2A5B', LAIN: '#7A808C' };

  function U() { return W.NusaUI; }
  function esc(s) { return U() ? U().esc(s) : String(s); }
  function toast(t, j) { if (U()) { U().toast(t, j); } }
  function segarkan() { if (U()) { U().render(); } }
  function modal(o) { return U().modal(o); }
  function tanda(n) { return (n > 0 ? '+' : '') + n; }

  var CSS = '' +
    '.dw-bar{display:flex;height:30px;border:2px solid var(--garis,var(--border));border-radius:6px;overflow:hidden;margin:8px 0;position:relative}' +
    '.dw-bar div{display:grid;place-items:center;color:#fff;font-size:.72rem;font-weight:800;min-width:0;white-space:nowrap;overflow:hidden}' +
    '.dw-garis{position:absolute;top:-3px;bottom:-3px;width:3px;background:#FFC107;box-shadow:0 0 0 1px #111}' +
    '.dw-undi{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0;text-align:center}' +
    '.dw-undi div{border:2px solid var(--garis,var(--border));border-radius:6px;padding:6px;background:var(--bg-elev-2)}.dw-undi b{display:block;font-size:1.25rem}' +
    '.dw-tp{border:3px solid var(--red);background:var(--bg-elev-1)}.dw-list{display:grid;gap:8px;margin:8px 0;padding:0;list-style:none}' +
    '.dw-list button{width:100%;text-align:left}.dw-sej{margin:6px 0 0;padding:0;list-style:none;font-size:.8rem}.dw-sej li{border-left:4px solid var(--garis,var(--border));padding-left:8px;margin:4px 0;color:var(--text-muted)}' +
    '.dw-tukar{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px}.dw-lulus{color:#14994F;font-weight:800}.dw-gagal{color:#D3162F;font-weight:800}';
  (function () { var s = W.document.createElement('style'); s.textContent = CSS; W.document.head.appendChild(s); })();

  function bar(label, nilai, bahaya) {
    nilai = Math.max(0, Math.min(100, Math.round(nilai)));
    return '<div class="loy__row"><div class="loy__label"><span>' + esc(label) + '</span><b>' + nilai + '%</b></div>' +
      '<div class="progress progress--sm' + (bahaya ? ' progress--danger' : '') + '" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + nilai + '"><div class="progress__bar" style="width:' + nilai + '%"></div></div></div>';
  }
  function btn(act, id, teks, kecil, boleh, kelas) {
    var ok = boleh === true;      // string = sebab tidak boleh
    return '<li><button type="button" class="btn ' + (kelas || 'btn--ghost') + '" data-dewan="' + act + '" data-id="' + esc(id) + '"' + (ok ? '' : ' disabled') + '><b>' + esc(teks) + '</b><br><small>' + esc(kecil) + (ok ? '' : ' — ' + esc(boleh)) + '</small></button></li>';
  }
  function pecahKerusi(k) {
    var seg = [['BN', k.BN], ['PH', k.PH], ['PN', k.PN], ['LAIN', k.LAIN]], h = '<div class="dw-bar" role="img" aria-label="Kerusi Dewan Rakyat">';
    seg.forEach(function (s) { if (s[1] > 0) { h += '<div style="width:' + (s[1] / k.jumlah * 100) + '%;background:' + WARNA[s[0]] + '" title="' + s[0] + ' ' + s[1] + '">' + (s[1] >= 14 ? (s[0] === 'LAIN' ? 'Lain' : s[0]) + ' ' + s[1] : '') + '</div>'; } });
    return h + '<i class="dw-garis" style="left:' + (k.ambang / k.jumlah * 100) + '%" title="Majoriti ' + k.ambang + '"></i></div>';
  }

  /* ---------- Panel ---------- */
  function panel(p) {
    try {
      var r = pilih(p).ringkasan(p), L = r.label || { dewan: 'Dewan Rakyat', usul: 'RUU', ketua: 'kerajaan' };
      var sw = kedua(p) ? '<div class="dw-tukar" role="group" aria-label="Pilih dewan"><button type="button" class="btn btn--sm ' + (D === D0 ? 'btn--primary' : 'btn--ghost') + '" data-dewan="tukar" data-id="RAKYAT">🏛️ Dewan Rakyat</button> <button type="button" class="btn btn--sm ' + (D === N ? 'btn--primary' : 'btn--ghost') + '" data-dewan="tukar" data-id="DUN">🏢 DUN' + (p.negeri ? ' ' + esc(p.negeri) : '') + '</button></div>' : '';
      if (!r.aktif) { return '<div class="banner"><strong>Dewan Rakyat</strong>Tab ini terbuka apabila anda menjadi Ahli Parlimen, Menteri, ADUN atau EXCO Negeri.</div>'; }
      var k = r.kerusi, h = sw;
      h += '<section class="card"><h2 class="card__title" style="margin:0 0 4px">🏛️ ' + esc(L.dewan) + (L.negeri ? ' · ' + esc(L.negeri) : '') + '</h2>';
      if (!k) { return h + '<p class="note">Belum ada keputusan PRU untuk dipaparkan.</p></section>'; }
      h += '<p class="note">' + esc(r.peranan === 'MP' ? 'Ahli Parlimen' : r.peranan === 'ADUN' ? 'ADUN' : r.peranan === 'EXCO' ? 'EXCO Negeri' : 'Menteri') + (r.portfolio ? ' · ' + esc(r.portfolio) : '') + ' · ' + (r.kerajaan ? '<b>Kerajaan: BN</b>' : 'Bukan kerajaan BN') + ' · majoriti ' + r.ambang + '/' + k.jumlah + '</p>';
      h += pecahKerusi(k);
      h += '<p class="note">Kerajaan (BN) <b>' + k.BN + '</b> · PH <b>' + k.PH + '</b> · PN <b>' + k.PN + '</b> · Bebas/lain <b>' + k.LAIN + '</b></p>';
      if (r.kerajaan) { h += bar('Kestabilan gabungan', r.kestabilan, r.kestabilan < 30) + (r.rating !== null ? bar('Penarafan Tadbir Urus', r.rating, r.rating < 30) : ''); }
      h += '<p class="note" style="font-size:.78rem">Simulasi: angka kerusi dianggar daripada keputusan PRU dalam permainan.</p></section>';

      if (r.tp) { h += kadTP(r.tp, L); }
      if (r.soalan) { h += '<section class="card"><h2 class="card__title" style="margin:0 0 4px">🎤 Waktu Pertanyaan Menteri</h2><p class="note"><b>' + esc(r.soalan.yb) + '</b>: ' + esc(r.soalan.soal) + '</p><button type="button" class="btn btn--primary btn--block" data-dewan="soalan">Jawab Soalan</button></section>'; }
      if (r.undi) { h += kadUndi(r.undi); }
      else if (r.bolehBentang && r.kerajaan && !r.tp) { h += kadBentang(r.bentang, L); }
      else if (!r.bolehBentang) { h += '<section class="card"><p class="note">' + (r.dun ? 'Hanya EXCO Negeri boleh membentang Enakmen dan Bajet Negeri.' : 'Hanya Menteri Penuh, Timbalan Perdana Menteri atau Perdana Menteri boleh membentang RUU dan Bajet.') + '</p></section>'; }
      if (r.sejarah.length) {
        h += '<section class="card"><h2 class="card__title" style="margin:0 0 4px">📜 Rekod Dewan</h2><ul class="dw-sej">' + r.sejarah.slice().reverse().map(function (x) {
          return '<li>' + esc(BULAN[(x.bulan || 1) - 1] + ' ' + x.tahun) + ': ' + esc(x.tajuk || 'Usul Undi Tidak Percaya') + ' — <span class="' + (x.lulus ? 'dw-lulus' : 'dw-gagal') + '">' + (x.jenis === 'tp' ? (x.lulus ? 'selamat' : 'tumbang') : (x.lulus ? 'lulus' : 'gagal')) + '</span> (' + x.sokong + ')</li>';
        }).join('') + '</ul></section>';
      }
      return h;
    } catch (e) { return ''; }
  }
  function kadBentang(b, L) {
    var h = '<section class="card"><h2 class="card__title" style="margin:0 0 4px">📑 Bentang ' + esc(L.usul) + ' &amp; Bajet</h2>';
    h += '<ul class="dw-list">';
    if (b.bajet) { h += btn('bentang', 'bajet', '💰 ' + b.bajet.tajuk, 'Dibentang sekali setahun (bulan ' + D.CONFIG.BULAN_BAJET + '). Gagal = Tadbir Urus ' + D.CONFIG.GAGAL_BAJET.rating + '%, kestabilan ' + D.CONFIG.GAGAL_BAJET.kestabilan + '%.', true, 'btn--gold'); }
    b.ruu.forEach(function (x) { h += btn('bentang', x.id, x.tajuk, x.kategoriNama + ' · ' + x.huraian, true); });
    h += '</ul>';
    if (!b.ruu.length) { h += '<p class="note">' + esc(b.sebabRUU) + '</p>'; }
    return h + '</section>';
  }
  function kadUndi(s) {
    var u = s.undi, h = '<section class="card"><h2 class="card__title" style="margin:0 0 4px">🗳️ Undian: ' + esc(u.tajuk) + '</h2>';
    h += '<div class="dw-undi"><div>Sokong<b>' + u.sokong + '</b></div><div>Atas pagar<b>' + u.atas + '</b></div><div>Bantah<b>' + u.bantah + '</b></div></div>';
    h += '<p class="note">Perlu <b>' + s.ambang + '</b> sokong · anggaran peluang lulus: <b>' + esc(s.kebarangkalian) + '</b> · lobi berbaki: ' + s.baki + '</p><ul class="dw-list">';
    s.tindakan.forEach(function (t) { h += btn('lobi', t.id, t.nama, t.huraian, t.boleh ? true : t.sebab); });
    h += '</ul><button type="button" class="btn btn--primary btn--block" data-dewan="undi">🗳️ Mula Undian Sekarang</button> <button type="button" class="btn btn--ghost btn--block" data-dewan="tarik">Tarik Balik Usul</button></section>';
    return h;
  }
  function kadTP(s, L) {
    var t = s.tp, h = '<section class="card dw-tp"><h2 class="card__title" style="margin:0 0 4px">⚠️ Undi Tidak Percaya (' + esc(L.ketua) + ') · Hari ' + Math.min(t.hari, s.hariMaks) + '/' + s.hariMaks + '</h2>';
    h += '<div class="dw-undi"><div>Setia<b>' + t.setia + '</b></div><div>Goyah<b>' + t.goyah + '</b></div><div>Pembangkang<b>' + t.tentang + '</b></div></div>';
    h += '<p class="note">Perlu <b>' + s.ambang + '</b> undi untuk kekal. Setiap wakil rakyat goyah boleh dipujuk; sebahagian kecil akan menyokong anda pada hari undian. Hubungan gabungan: ' + s.hubungan + '%.</p><ul class="dw-list">';
    s.tindakan.forEach(function (a) { h += btn('tp', a.id, a.nama, a.huraian, a.boleh ? true : a.sebab, a.id === 'bubar' ? 'btn--ghost' : 'btn--primary'); });
    h += '</ul>' + (t.log.length ? '<ul class="dw-sej">' + t.log.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</section>';
    return h;
  }

  /* ---------- Tindakan ---------- */
  function tanya(tajuk, isi, ya) { return modal({ tajuk: tajuk, isi: isi, butang: [{ label: 'Batal', nilai: false }, { label: ya, nilai: true, kelas: 'btn--primary' }] }); }
  async function bentang(id) {
    var r = D.mulaBentang(id);
    if (!r.ok) { toast(r.ralat, 'ralat'); return; }
    toast(r.mesej); segarkan();
  }
  function lobi(id) { var r = D.lobi(id); toast(r.ok ? r.mesej : r.ralat, r.ok ? 'ok' : 'ralat'); segarkan(); }
  async function mulaUndi() {
    var ok = await tanya('Mula undian?', '<p>Undian akan dikira sekarang. Pastikan lobi sudah mencukupi.</p>', 'Undi');
    if (!ok) { return; }
    var r = D.undi();
    if (!r.ok) { toast(r.ralat, 'ralat'); return; }
    await modal({ tajuk: r.lulus ? '✅ Lulus' : '❌ Gagal', isi: '<div class="dw-undi"><div>Sokong<b>' + r.sokong + '</b></div><div>Bantah<b>' + r.bantah + '</b></div><div>Perlu<b>' + (D.ringkasan(S.loadPlayer()).ambang) + '</b></div></div><p>' + esc(r.mesej) + '</p>' });
    segarkan();
  }
  async function tarik() {
    var ok = await tanya('Tarik balik usul?', '<p>Usul ditarik tanpa undian. Satu cubaan sesi ini dikira digunakan.</p>', 'Tarik balik');
    if (!ok) { return; }
    var r = D.tarikBalik(); toast(r.ok ? r.mesej : r.ralat, r.ok ? 'ok' : 'ralat'); segarkan();
  }
  async function tindakTP(id) {
    if (id === 'bubar') { var ok = await tanya('Bubar Parlimen?', '<p>Anda menasihatkan pembubaran Parlimen. Pilihan Raya Mengejut akan diisytiharkan.</p>', 'Bubar'); if (!ok) { return; } }
    var r = D.tindakTP(id);
    if (!r.ok) { toast(r.ralat, 'ralat'); return; }
    if (r.tamat) {
      await modal({ tajuk: r.selamat === false || r.snap ? '🚨 Kerajaan Tumbang' : '✅ Kerajaan Selamat', isi: '<p>' + esc(r.mesej) + '</p>' });
      if (W.NusaPRU_UI && W.NusaPRU_UI.selepasBulan && r.peristiwa) { await W.NusaPRU_UI.selepasBulan(r.peristiwa); }
    } else { toast(r.mesej); }
    segarkan();
  }
  async function soalan() {
    utamakan(S.loadPlayer(), 'soalanSemasa'); pilih(S.loadPlayer());
    var s = D.soalanSemasa(S.loadPlayer());
    if (!s) { return; }
    function ringkas(j) {
      if (j.rawak) { return 'Berjaya ' + Math.round(j.rawak.p * 100) + '%: Stress ' + tanda(j.rawak.jaya.stress) + ', Tadbir Urus ' + tanda(j.rawak.jaya.rating) + '% · Gagal: Stress ' + tanda(j.rawak.gagal.stress) + ', Tadbir Urus ' + tanda(j.rawak.gagal.rating) + '%'; }
      var x = j.kesan, t = []; if (x.stress) { t.push('Stress ' + tanda(x.stress)); } if (x.ip) { t.push('IP ' + tanda(x.ip)); } if (x.rating) { t.push('Tadbir Urus ' + tanda(x.rating) + '%'); } if (x.rep) { t.push('Reputasi ' + tanda(x.rep)); } if (x.kestabilan) { t.push('Kestabilan ' + tanda(x.kestabilan) + '%'); }
      return t.join(' · ');
    }
    var id = await modal({
      tajuk: '🎤 Waktu Pertanyaan Menteri',
      isi: '<p><b>' + esc(s.yb) + '</b>: ' + esc(s.soal) + '</p><ul class="acara__pil">' + s.jawapan.map(function (j) { return '<li><button type="button" class="acara__opsi" data-pilih="' + esc(j.id) + '"><b>' + j.ikon + ' ' + esc(j.nama) + '</b><small>' + esc(j.teks) + '<br>' + esc(ringkas(j)) + '</small></button></li>'; }).join('') + '</ul>',
      butang: []
    });
    if (!id) { toast('Soalan masih menunggu jawapan anda.'); return; }
    var r = D.jawabSoalan(id);
    toast(r.ok ? r.mesej : r.ralat, r.ok && r.rating >= 0 ? 'ok' : 'ralat'); segarkan();
  }

  /* ---------- Selepas bulan berganti ---------- */
  async function selepasBulan(peristiwa) {
    var s = peristiwa || []; utamakan(S.loadPlayer(), s.some(function (e) { return e.jenis === 'dewan_tp'; }) ? 'tpSemasa' : 'soalanSemasa'); pilih(S.loadPlayer());
    if (s.some(function (e) { return e.jenis === 'dewan_tp'; })) { await modal({ tajuk: '⚠️ Usul Undi Tidak Percaya', isi: '<p>' + esc(((s.filter(function (e) { return e.jenis === 'dewan_tp'; })[0] || {}).mesej) || 'Pembangkang mengemukakan usul undi tidak percaya.') + ' Buka tab <b>' + (N && N.aktif(S.loadPlayer()) ? 'DUN' : 'Dewan Rakyat') + '</b>.</p>' }); if (U() && U().gotoTab) { U().gotoTab('dewan'); } return true; }
    if (s.some(function (e) { return e.jenis === 'dewan_soalan'; })) { await soalan(); return true; }
    return false;
  }

  W.document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-dewan]') : null;
    if (!t || t.disabled) { return; }
    var a = t.getAttribute('data-dewan'), id = t.getAttribute('data-id'); pilih(S.loadPlayer());
    if (a === 'bentang') { bentang(id); } else if (a === 'lobi') { lobi(id); } else if (a === 'undi') { mulaUndi(); } else if (a === 'tarik') { tarik(); }
    else if (a === 'tukar') { pilihan = id === 'DUN' ? 'DUN' : 'RAKYAT'; segarkan(); } else if (a === 'tp') { tindakTP(id); } else if (a === 'soalan') { soalan(); }
  });

  function guna(p) { return pilih(p); }
  W.NusaDewan_UI = { guna: guna, panel: panel, selepasBulan: selepasBulan, soalan: soalan };
})(window);
