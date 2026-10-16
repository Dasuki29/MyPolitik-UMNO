/* ==========================================================================
   Nusa Politik — js/rival.js   (v7.28)  Tahap Kesukaran & AI Pencabar Dinamik
     p.settings.difficultyLevel : 'EASY' | 'NORMAL' | 'HARDCORE'   (dipilih semasa daftar, DIKUNCI selepas itu)
     p.rival = { siri, tahunReset, senaraiPencabar:{ cawangan|sayap|bahagian: { nama, kuasa, tren, serang } }, amaran:[] }
   tick()           dipanggil oleh Calendar.majuBulan pada akhir setiap bulan (nextMonthTick)
   bonusPesaing()   dipanggil oleh election.bina: pencabar menguatkan calon lawan sebenar
   htmlKad(p)       kad "Pencabar Utama" (tab Pemilihan)
   Andaian: kuasa pencabar 0-100; peratus "Anda" = kekuatan anda / (kekuatan anda + kuasa pencabar). Tiada pencabar PRU
   berasingan (PRU tidak boleh maju bulan semasa kempen); keputusan PRU kekal mengikut model sedia ada.
   ========================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikRival = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  var TAHAP = {
    EASY:     { label: 'Mudah',    stress: 0.75, belanja: 0.8, mula: 25, naik: 0.6, musim: 0, serang: 0,    lalaiAI: 'Pasif: mengumpul sokongan perlahan' },
    NORMAL:   { label: 'Biasa',    stress: 1,    belanja: 1,   mula: 35, naik: 1.1, musim: 1.5, serang: 0,    lalaiAI: 'Aktif menjelang musim pemilihan' },
    HARDCORE: { label: 'Hardcore', stress: 1.4,  belanja: 1.2, mula: 45, naik: 1.6, musim: 3, serang: 0.35, lalaiAI: 'Agresif: lobi, fitnah, dana politik' }
  };
  var LALAI = 'NORMAL';
  var TINGKAP = { cawangan: 4, sayap: 4, bahagian: 7 };                // bulan mula musim pemilihan peringkat itu
  var NAMA_L = ['Ismail', 'Faizal', 'Rosli', 'Hafiz', 'Azman', 'Kamarul', 'Zulkifli', 'Razak', 'Shahrul', 'Mazlan', 'Fadzil', 'Hisham', 'Nasir', 'Amran'];
  var NAMA_P = ['Norhayati', 'Salmah', 'Rohana', 'Zaleha', 'Aminah', 'Faridah', 'Suraya', 'Marlina', 'Haslinda', 'Rosnah'];
  var NAMA_2 = ['Harun', 'Rahman', 'Hamid', 'Yusof', 'Ahmad', 'Daud', 'Ibrahim', 'Othman', 'Jaafar', 'Salleh', 'Mansor', 'Abdullah'];
  var NAMA_PERINGKAT = { cawangan: 'Cawangan', sayap: 'Sayap', bahagian: 'Bahagian' };

  function S() { return root.MyPolitikSave || (typeof require === 'function' ? tryReq('./save.js') : null); }
  function tryReq(f) { try { return require(f); } catch (e) { return null; } }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function tahap(p) { var k = p && p.settings && p.settings.difficultyLevel; return TAHAP[k] ? k : LALAI; }
  function cfg(p) { return TAHAP[tahap(p)]; }
  function sah(k) { return !!TAHAP[k]; }

  /* ---- peringkat pencabar bagi pemain ---- */
  function peringkatPemain(p) {
    var l = ['cawangan'];
    if (p.sayap && p.sayap !== 'utama') { l.push('sayap'); }
    l.push('bahagian');
    return l;
  }
  function rngBenih(p, lv, siri) { var S0 = S(); return S0.rngBerbenih(String(p.id) + '|rival|' + lv + '|' + siri); }
  function janaNama(p, lv, siri) {
    var r = rngBenih(p, lv, siri), lelaki = lv === 'sayap' ? p.sayap === 'pemuda' : r() < 0.7;
    var a = (lelaki ? NAMA_L : NAMA_P)[Math.floor(r() * (lelaki ? NAMA_L.length : NAMA_P.length))], b = NAMA_2[Math.floor(r() * NAMA_2.length)];
    return (lv === 'bahagian' && lelaki ? "Dato' " : '') + a + ' ' + b;
  }
  function baru(p, lv, siri) { return { nama: janaNama(p, lv, siri), kuasa: cfg(p).mula, tren: 0, serang: null }; }

  function pastikan(p) {
    var r = p.rival && typeof p.rival === 'object' ? p.rival : { siri: 1, tahunReset: p.tahun, senaraiPencabar: {}, amaran: [] };
    r.senaraiPencabar = r.senaraiPencabar || {};
    peringkatPemain(p).forEach(function (lv) { if (!r.senaraiPencabar[lv]) { r.senaraiPencabar[lv] = baru(p, lv, r.siri || 1); } });
    Object.keys(r.senaraiPencabar).forEach(function (lv) { if (peringkatPemain(p).indexOf(lv) < 0) { delete r.senaraiPencabar[lv]; } });
    return r;
  }

  /* ---- kekuatan pemain (0-100) bagi peringkat ---- */
  var KUNCI = { cawangan: ['akarUmbi', 'ketuaCawangan'], sayap: ['akarUmbi', 'ajk'], bahagian: ['ajk', 'perwakilan'] };
  var SKALA_IP = { cawangan: 120, sayap: 160, bahagian: 250 };
  function kekuatanPemain(p, lv) {
    var k = KUNCI[lv].map(function (x) { return Number((p.kesetiaan || {})[x]) || 0; }), avg = k.reduce(function (a, b) { return a + b; }, 0) / k.length;
    return clamp(avg * 0.7 + Math.min(100, 100 * (Number(p.ip) || 0) / SKALA_IP[lv]) * 0.3, 1, 100);
  }
  function peratusAnda(p, pen, lv) { var a = kekuatanPemain(p, lv); return Math.round(a / (a + Math.max(1, pen.kuasa)) * 100); }
  function ancaman(pen, p, lv) { var s = 100 - peratusAnda(p, pen, lv); return s >= 55 ? 'TINGGI' : s >= 45 ? 'SEDERHANA' : 'RENDAH'; }

  /* ---- bulan hingga musim ---- */
  function bulanKeMusim(p, lv) { var m = TINGKAP[lv], b = Number(p.bulan) || 1; return m >= b ? m - b : m + 12 - b; }
  function tahunPemilihan(p) { var E = root.MyPolitikElection || (typeof require === 'function' ? tryReq('./election.js') : null); return !E || !E.adalahTahunPemilihan || E.adalahTahunPemilihan(p.tahun); }

  /* ---- serangan Hardcore ---- */
  var SERANGAN = [
    { id: 'lobi',  huraian: function (n) { return n + ' melobi AJK dan perwakilan menentang anda.'; },  kesan: { kesetiaan: { ajk: -4, perwakilan: -4 } } },
    { id: 'fitnah', huraian: function (n) { return n + ' melancarkan kempen memburukkan imej anda.'; }, kesan: { reputasi: -3, kesetiaan: { akarUmbi: -4 } } },
    { id: 'dana',  huraian: function (n) { return n + ' mengagihkan dana politik untuk memotong sokongan anda secara mendadak.'; }, kesan: { kesetiaan: { akarUmbi: -8, ketuaCawangan: -6, ajk: -3 } } }
  ];

  /** Satu denyut bulanan. Pulang { peristiwa:[{jenis,mesej}] }. */
  function tick(opts) {
    opts = opts || {};
    var s = S(), p = s && s.loadPlayer(), ev = [];
    if (!p || p.tamat) { return { peristiwa: ev }; }
    var c = cfg(p), rng = opts.rng || Math.random, r = pastikan(p), pemilihan = tahunPemilihan(p), amaran = [];
    if (p.tahun !== r.tahunReset && (Number(p.bulan) || 1) === 1) {            // tahun baharu: selepas tahun pemilihan, pencabar baharu muncul
      r.tahunReset = p.tahun; r.siri = (r.siri || 1) + 1;
      Object.keys(r.senaraiPencabar).forEach(function (lv) { r.senaraiPencabar[lv] = baru(p, lv, r.siri); });
    }
    var kesan = { kesetiaan: {}, reputasi: 0 }, ada = false;
    Object.keys(r.senaraiPencabar).forEach(function (lv) {
      var pen = r.senaraiPencabar[lv], lama = peratusAnda(p, pen, lv), dekat = pemilihan && bulanKeMusim(p, lv) <= 2;
      var naik = c.naik + (dekat ? c.musim : 0) + (rng() * 2 - 1);
      if (tahap(p) === 'EASY') { naik = Math.min(naik, 1.5); }
      var kuatAnda = kekuatanPemain(p, lv);
      if (kuatAnda > 65) { naik -= (kuatAnda - 65) / 12; }                   // pemain kukuh melambatkan pencabar
      naik *= clamp((95 - pen.kuasa) / 55, 0.2, 1);                           // makin kuat, makin perlahan (siling)
      pen.kuasa = clamp(Math.round((pen.kuasa + naik) * 10) / 10, 10, 95);
      pen.serang = null;
      if (tahap(p) === 'HARDCORE' && (dekat || pen.kuasa >= 55) && rng() < c.serang) {
        var sr = SERANGAN[Math.floor(rng() * SERANGAN.length)];
        pen.serang = sr.id; ada = true;
        Object.keys(sr.kesan.kesetiaan || {}).forEach(function (k) { kesan.kesetiaan[k] = (kesan.kesetiaan[k] || 0) + sr.kesan.kesetiaan[k]; });
        kesan.reputasi += sr.kesan.reputasi || 0;
        var m = sr.huraian(pen.nama) + ' (' + NAMA_PERINGKAT[lv] + ')';
        amaran.push(m); ev.push({ jenis: 'pencabar_serang', mesej: m });
      }
      pen._lama = lama;
    });
    if (ada) { s.applyEffects({ kesetiaan: kesan.kesetiaan, reputasi: kesan.reputasi }, { kiraTindakan: false, log: { tindakan: 'pencabar_serang', nama: 'Serangan pencabar', peringkat: 'bulan' } }); p = s.loadPlayer(); }
    Object.keys(r.senaraiPencabar).forEach(function (lv) {
      var pen = r.senaraiPencabar[lv]; pen.tren = pen._lama - peratusAnda(p, pen, lv); delete pen._lama;      // + = pencabar naik (peratusan anda turun)
      var tinggi = ancaman(pen, p, lv) === 'TINGGI', baruTinggi = tinggi && !pen.tinggi; pen.tinggi = tinggi;      // amaran hanya apabila baru melepasi ambang
      if (baruTinggi && !pen.serang) { ev.push({ jenis: 'pencabar_amaran', mesej: pen.nama + ' (' + NAMA_PERINGKAT[lv] + ') kini mendahului anda. Jaga sokongan sebelum musim pemilihan.' }); }
    });
    r.amaran = amaran;
    s.applyEffects({}, { kiraTindakan: false, patch: { rival: r } });
    return { peristiwa: ev };
  }

  /** Tambahan kekuatan calon lawan terkuat dalam pertandingan jawatan; pulang { bonus, nama } atau null. */
  function bonusPesaing(p, peringkat, jenis) {
    if (jenis === 'perwakilan' || !p || !p.rival || !p.rival.senaraiPencabar) { return null; }
    var lv = peringkat === 'cawangan' ? 'cawangan' : peringkat === 'bahagian' ? 'bahagian' : /^sayap_/.test(peringkat) ? 'sayap' : null;
    var pen = lv && p.rival.senaraiPencabar[lv]; if (!pen) { return null; }
    return { bonus: clamp((pen.kuasa - 40) * 0.25, -3, 10), nama: pen.nama };
  }

  /** Pelarasan tahap kesukaran (digunakan oleh save.applyEffects dan stress.js). */
  function pengali(p, jenis) { return cfg(p)[jenis === 'belanja' ? 'belanja' : 'stress']; }

  /* ---- UI ---- */
  function htmlKad(p) {
    if (!p || !S()) { return ''; }
    var r = p.rival && p.rival.senaraiPencabar ? p.rival : null, c = cfg(p);
    var h = '<section class="card pp-rival" aria-label="Pencabar Utama"><h2 class="stats-panel__title">⚠️ Pencabar Utama <small>· Bulan ' + esc(p.bulan) + ' · ' + esc(c.label) + ' (dikunci)</small></h2>';
    if (!r) { return h + '<p class="note">Pencabar mula muncul apabila bulan bertukar. ' + esc(c.lalaiAI) + '.</p></section>'; }
    Object.keys(r.senaraiPencabar).forEach(function (lv) {
      var pen = r.senaraiPencabar[lv], a = peratusAnda(p, pen, lv), b = 100 - a, an = ancaman(pen, p, lv), kelas = an === 'TINGGI' ? 'b' : an === 'SEDERHANA' ? 'k' : 'o';
      var tren = Math.round(pen.tren || 0), dekat = tahunPemilihan(p) && bulanKeMusim(p, lv) <= 2;
      var status = pen.serang ? 'Menyerang bulan ini' : dekat ? 'Berkempen menjelang musim pemilihan' : tahap(p) === 'EASY' ? 'Mengumpul sokongan perlahan' : 'Menjalankan program peribadi';
      h += '<div class="rv"><h3>' + esc(NAMA_PERINGKAT[lv] + ': ' + pen.nama) + ' <span class="rv-lv ' + kelas + '">' + an + '</span></h3><small>' + esc(status) + '</small>' +
        '<div class="rv-m" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + b + '" aria-label="Sokongan pencabar ' + esc(pen.nama) + '"><i class="a" style="width:' + a + '%"></i><i class="b" style="width:' + b + '%"></i></div>' +
        '<div class="rv-t"><span><b>Anda ' + a + '%</b></span><span>Pencabar ' + b + '% ' + (tren > 0 ? '<b class="rv-n">▲ +' + tren + '</b>' : tren < 0 ? '<b class="rv-b">▼ ' + String(tren).replace('-', '−') + '</b>' : '<b>▬ 0</b>') + '</span></div></div>';
    });
    (r.amaran || []).forEach(function (m) { h += '<div class="rv-w"><b>Amaran:</b> ' + esc(m) + '</div>'; });
    return h + '</section>';
  }

  return { TAHAP: TAHAP, LALAI: LALAI, sah: sah, tahap: tahap, pengali: pengali, tick: tick, bonusPesaing: bonusPesaing, htmlKad: htmlKad, pastikan: pastikan, peratusAnda: peratusAnda, kekuatanPemain: kekuatanPemain };
});
